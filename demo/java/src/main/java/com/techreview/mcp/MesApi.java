package com.techreview.mcp;

import com.techreview.briefing.MesTools;
import com.techreview.briefing.SeedMes;
import com.techreview.common.Json;
import com.techreview.common.Ollama;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 가상 MES 쪽 API (mes_api.py의 Java 버전): 조회는 MesTools(읽기 전용)를 그대로 쓰고, 쓰기는 이 클래스의 메서드만 쓴다.
 * 실제 환경에서 이 클래스는 MES 벤더가 제공하는 API에 해당한다. AI 쪽 코드는 MES DB에 직접 쓰지 않는다.
 */
public final class MesApi {
    public static final Path DB_PATH = Path.of(Ollama.env("MCP_MES_DB", "data/mcp-mes.db"));

    private MesApi() {}

    /** 조회 도구(MesTools)가 이 데모의 MES DB를 보게 한다. */
    public static void use() {
        MesTools.DB_PATH = DB_PATH;
    }

    /** 데모용 MES DB 생성: 아침 브리핑 데이터 + 조립2라인 두 번째 작업지시, 작업지시 순서표, MES 변경 이력. */
    public static void setup() throws Exception {
        SeedMes.seed(DB_PATH);
        try (Connection c = DriverManager.getConnection("jdbc:sqlite:" + DB_PATH); Statement st = c.createStatement()) {
            st.executeUpdate("CREATE TABLE work_order_sequence (wo_id TEXT PRIMARY KEY REFERENCES work_orders, line TEXT NOT NULL, "
                    + "plan_date TEXT NOT NULL, seq INTEGER NOT NULL, status TEXT NOT NULL)");   // 대기 / 진행 / 완료
            st.executeUpdate("CREATE TABLE mes_change_log (request_id TEXT PRIMARY KEY, api TEXT, requested_by TEXT, at TEXT, result TEXT)");
            st.executeUpdate("INSERT INTO items VALUES ('B-207', '브래킷 커버 어셈블리', '조립')");
            st.executeUpdate("INSERT INTO work_orders VALUES ('WO-1020-04', '2026-10-20', '조립2라인', 'B-207', 1500)");
            st.executeUpdate("INSERT INTO fg_inventory VALUES ('2026-10-20 07:00', 'B-207', 2000)");
            Object[][] seq = {
                    {"WO-1019-01", "사출1라인", "2026-10-19", 1, "완료"}, {"WO-1019-02", "조립2라인", "2026-10-19", 1, "완료"},
                    {"WO-1019-03", "사출2라인", "2026-10-19", 1, "완료"}, {"WO-1020-01", "사출1라인", "2026-10-20", 1, "대기"},
                    {"WO-1020-04", "조립2라인", "2026-10-20", 1, "대기"},   // B-207이 먼저
                    {"WO-1020-02", "조립2라인", "2026-10-20", 2, "대기"},   // B-205가 두 번째 → 출하 부족 위험
                    {"WO-1020-03", "사출2라인", "2026-10-20", 1, "대기"}};
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO work_order_sequence VALUES (?,?,?,?,?)")) {
                for (Object[] r : seq) {
                    for (int i = 0; i < r.length; i++) {
                        ps.setObject(i + 1, r[i]);
                    }
                    ps.executeUpdate();
                }
            }
        }
        Files.deleteIfExists(Approvals.DB_PATH);
    }

    /** 라인의 작업지시 순서 (읽기 전용). */
    public static List<Map<String, Object>> getWorkOrderSequence(String line, String date) {
        return MesTools.query("SELECT s.seq, s.wo_id, w.item_code, w.plan_qty, s.status FROM work_order_sequence s "
                + "JOIN work_orders w ON w.wo_id = s.wo_id WHERE s.line = ? AND s.plan_date = ? ORDER BY s.seq", line, date);
    }

    public static Map<String, Object> findWorkOrder(String woId) {
        List<Map<String, Object>> rows = MesTools.query("SELECT w.wo_id, w.plan_date, w.line, w.item_code, w.plan_qty, s.seq, s.status "
                + "FROM work_orders w LEFT JOIN work_order_sequence s ON s.wo_id = w.wo_id WHERE w.wo_id = ?", woId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 작업지시를 같은 라인·일자 안에서 newPosition(1부터)으로 옮긴다. (MES 쓰기 API)
     * request_id로 멱등성 보장, 이미 시작된 작업지시는 바꾸지 않음, MES 쪽 변경 이력을 남김.
     */
    public static Map<String, Object> reorderWorkOrder(String woId, int newPosition, String requestId, String requestedBy) throws SQLException {
        try (Connection c = DriverManager.getConnection("jdbc:sqlite:" + DB_PATH)) {
            c.setAutoCommit(false);
            try (PreparedStatement ps = c.prepareStatement("SELECT result FROM mes_change_log WHERE request_id = ?")) {
                ps.setString(1, requestId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {                                   // 멱등성: 이미 처리한 요청이면 그때 결과를 그대로 돌려준다
                        Map<String, Object> done = Json.readMap(rs.getString(1));
                        done.put("idempotent_replay", true);
                        return done;
                    }
                }
            }
            String line;
            String planDate;
            try (PreparedStatement ps = c.prepareStatement("SELECT line, plan_date, status FROM work_order_sequence WHERE wo_id = ?")) {
                ps.setString(1, woId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        throw new IllegalArgumentException("작업지시 " + woId + "가 없습니다");
                    }
                    if (!"대기".equals(rs.getString("status"))) {
                        throw new IllegalArgumentException(woId + "는 이미 '" + rs.getString("status") + "' 상태라 순서를 바꿀 수 없습니다");
                    }
                    line = rs.getString("line");
                    planDate = rs.getString("plan_date");
                }
            }
            List<String> order = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT wo_id FROM work_order_sequence WHERE line = ? AND plan_date = ? ORDER BY seq")) {
                ps.setString(1, line);
                ps.setString(2, planDate);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        order.add(rs.getString(1));
                    }
                }
            }
            if (newPosition < 1 || newPosition > order.size()) {
                throw new IllegalArgumentException("순서는 1~" + order.size() + " 사이여야 합니다");
            }
            List<String> before = new ArrayList<>(order);
            order.remove(woId);
            order.add(newPosition - 1, woId);
            try (PreparedStatement ps = c.prepareStatement("UPDATE work_order_sequence SET seq = ? WHERE wo_id = ?")) {
                for (int i = 0; i < order.size(); i++) {
                    ps.setInt(1, i + 1);
                    ps.setString(2, order.get(i));
                    ps.executeUpdate();
                }
            }
            Map<String, Object> result = Json.obj("line", line, "plan_date", planDate, "before", before, "after", order);
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO mes_change_log VALUES (?,?,?,?,?)")) {
                ps.setString(1, requestId);
                ps.setString(2, "reorder_work_order");
                ps.setString(3, requestedBy);
                ps.setString(4, LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString());
                ps.setString(5, Json.write(result));
                ps.executeUpdate();
            }
            c.commit();
            return result;
        }
    }
}
