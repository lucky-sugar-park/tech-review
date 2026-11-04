package com.techreview.mcp;

import com.techreview.common.Json;
import com.techreview.common.Ollama;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 승인 대기열 (approvals.py의 Java 버전, AI 서비스 쪽 저장소): AI는 '제안'만 올리고, 사람이 승인해야 MES 쓰기 API가 실행된다.
 *
 * - createRequest: 제안 등록 (MCP 도구 propose_*가 호출). 실행 시점 비교용으로 현재 상태 스냅숏을 함께 저장
 * - decide: 사람의 승인·거절 (McpApprove = 승인함). MCP 도구로는 노출하지 않는다
 *   · 승인 시 스냅숏과 지금 MES 상태가 같은지 확인 (제안 이후 누가 바꿨으면 실행하지 않음)
 *   · approval_id를 MES API의 request_id로 써서 멱등성 보장
 * - 모든 단계를 audit_log에 남긴다
 */
public final class Approvals {
    public static final Path DB_PATH = Path.of(Ollama.env("MCP_APPROVALS_DB", "data/mcp-approvals.db"));
    private static final String[] JSON_COLS = {"payload", "preview", "snapshot", "result"};

    private Approvals() {}

    private static Connection conn() throws SQLException {
        Connection c = DriverManager.getConnection("jdbc:sqlite:" + DB_PATH);
        try (Statement st = c.createStatement()) {
            st.executeUpdate("CREATE TABLE IF NOT EXISTS approvals (approval_id TEXT PRIMARY KEY, kind TEXT, payload TEXT, preview TEXT, "
                    + "snapshot TEXT, reason TEXT, requested_by TEXT, requested_at TEXT, status TEXT, decided_by TEXT, decided_at TEXT, "
                    + "decision_note TEXT, result TEXT)");   // status: 대기 / 실행됨 / 거절 / 실패
            st.executeUpdate("CREATE TABLE IF NOT EXISTS audit_log (at TEXT, actor TEXT, action TEXT, approval_id TEXT, detail TEXT)");
        }
        return c;
    }

    private static String now() {
        return LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString();
    }

    private static void exec(Connection c, String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                ps.setObject(i + 1, params[i]);
            }
            ps.executeUpdate();
        }
    }

    private static void audit(Connection c, String actor, String action, String approvalId, Object detail) throws SQLException {
        exec(c, "INSERT INTO audit_log VALUES (?,?,?,?,?)", now(), actor, action, approvalId, Json.write(detail));
    }

    public static Map<String, Object> createRequest(String kind, Map<String, Object> payload, Map<String, Object> preview,
                                                    List<String> snapshot, String reason, String requestedBy) throws SQLException {
        String id;
        try (Connection c = conn()) {
            long n;
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM approvals")) {
                n = rs.getLong(1) + 1;
            }
            id = String.format("AP-%s-%03d", LocalDate.now().format(DateTimeFormatter.ofPattern("MMdd")), n);
            exec(c, "INSERT INTO approvals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", id, kind, Json.write(payload), Json.write(preview),
                    Json.write(snapshot), reason, requestedBy, now(), "대기", null, null, null, null);
            audit(c, requestedBy, "제안", id, Json.obj("kind", kind, "payload", payload, "reason", reason));
        }
        return get(id);
    }

    public static Map<String, Object> get(String approvalId) throws SQLException {
        try (Connection c = conn(); PreparedStatement ps = c.prepareStatement("SELECT * FROM approvals WHERE approval_id = ?")) {
            ps.setString(1, approvalId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? row(rs) : null;
            }
        }
    }

    private static Map<String, Object> row(ResultSet rs) throws SQLException {
        Map<String, Object> d = new LinkedHashMap<>();
        for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) {
            String col = rs.getMetaData().getColumnLabel(i);
            String v = rs.getString(i);
            boolean json = List.of(JSON_COLS).contains(col);
            d.put(col, json && v != null ? Json.MAPPER.convertValue(Json.read(v), Object.class) : v);
        }
        return d;
    }

    public static List<Map<String, Object>> listRequests(String status) throws SQLException {
        List<Map<String, Object>> out = new ArrayList<>();
        try (Connection c = conn(); PreparedStatement ps = c.prepareStatement(
                "SELECT * FROM approvals" + (status == null ? "" : " WHERE status = ?") + " ORDER BY requested_at, approval_id")) {
            if (status != null) {
                ps.setString(1, status);
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(row(rs));
                }
            }
        }
        return out;
    }

    /** 사람의 결정. 승인이면 MES 쓰기 API를 실행한다. */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> decide(String approvalId, String approver, boolean approve, String note) throws SQLException {
        Map<String, Object> ap = get(approvalId);
        if (ap == null) {
            throw new IllegalArgumentException(approvalId + " 요청이 없습니다");
        }
        if (!"대기".equals(ap.get("status"))) {
            ap.put("message", "이미 '" + ap.get("status") + "' 처리된 요청입니다");
            return ap;
        }
        try (Connection c = conn()) {
            if (!approve) {
                exec(c, "UPDATE approvals SET status='거절', decided_by=?, decided_at=?, decision_note=? WHERE approval_id=?", approver, now(), note, approvalId);
                audit(c, approver, "거절", approvalId, Json.obj("note", note));
                return get(approvalId);
            }
            Map<String, Object> p = (Map<String, Object>) ap.get("payload");
            Map<String, Object> preview = (Map<String, Object>) ap.get("preview");
            List<String> current = MesApi.getWorkOrderSequence((String) preview.get("line"), (String) preview.get("plan_date"))
                    .stream().map(r -> (String) r.get("wo_id")).toList();
            String status;
            Map<String, Object> result;
            if (!Objects.equals(current, ap.get("snapshot"))) {           // 제안 이후 다른 변경이 있었으면 실행하지 않는다
                status = "실패";
                result = Json.obj("error", "제안 이후 작업지시 순서가 바뀌어 실행하지 않았습니다. 다시 제안이 필요합니다.",
                        "snapshot", ap.get("snapshot"), "current", current);
            } else {
                try {
                    result = MesApi.reorderWorkOrder((String) p.get("wo_id"), ((Number) p.get("new_position")).intValue(), approvalId, approver);
                    status = "실행됨";
                } catch (IllegalArgumentException e) {
                    status = "실패";
                    result = Json.obj("error", e.getMessage());
                }
            }
            exec(c, "UPDATE approvals SET status=?, decided_by=?, decided_at=?, decision_note=?, result=? WHERE approval_id=?",
                    status, approver, now(), note, Json.write(result), approvalId);
            audit(c, approver, "승인 → " + status, approvalId, result);
        }
        return get(approvalId);
    }

    public static List<Map<String, Object>> auditLog() throws SQLException {
        List<Map<String, Object>> out = new ArrayList<>();
        try (Connection c = conn(); Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT * FROM audit_log ORDER BY rowid")) {
            while (rs.next()) {
                out.add(Json.obj("at", rs.getString("at"), "actor", rs.getString("actor"), "action", rs.getString("action"),
                        "approval_id", rs.getString("approval_id"), "detail", rs.getString("detail")));
            }
        }
        return out;
    }
}
