package com.techreview.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.techreview.briefing.MesTools;
import com.techreview.common.Json;
import com.techreview.common.Ollama;
import com.techreview.rag.RagKit;
import com.techreview.rag.Search;

import io.modelcontextprotocol.json.jackson2.JacksonMcpJsonMapper;
import io.modelcontextprotocol.server.McpServer;
import io.modelcontextprotocol.server.McpServerFeatures.SyncToolSpecification;
import io.modelcontextprotocol.server.transport.StdioServerTransportProvider;
import io.modelcontextprotocol.spec.McpSchema;

import java.nio.file.Files;
import java.sql.Connection;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.function.Function;

/**
 * AI 공장장 MES 도구 서버 (mes_mcp_server.py의 Java 버전, 공식 MCP Java SDK 사용).
 *
 * 도구 종류
 * - 조회   get_production_summary, get_shipment_coverage, get_item_detail, get_work_order_sequence,
 *          get_material_risks, get_equipment_signals
 * - 계산   get_shipment_coverage 안에서 출하 충족(재고 + 계획 − 출하 예정)을 코드로 계산
 * - 지식   search_knowledge (Java 인덱서의 rag-index.db가 있으면 사용)
 * - 제안   propose_work_order_reorder → 승인 대기열에 올리고 변경 미리보기만 돌려줌 (실행하지 않음)
 *          get_approval_status, list_pending_approvals
 * - 승인·실행은 MCP 도구로 노출하지 않는다. 사람이 승인함(McpApprove)에서 결정한다.
 *
 * 모든 결과에 출처(source)와 기준 시각(as_of)을 붙인다. stdio로 동작하므로 표준 출력에는 아무것도 찍지 않는다.
 */
public final class MesMcpServer {
    static final String TODAY = Ollama.env("BRIEFING_DATE", "2026-10-20");
    static final String USER = Ollama.env("MES_MCP_USER", "AI 공장장");   // 제안을 올리는 주체 (실제로는 질문한 사용자의 계정)
    static final String INSTRUCTIONS = "중소 제조공장 MES 도구다. 숫자는 반드시 도구 결과만 쓰고, 계산은 도구가 한다. "
            + "작업지시 변경 같은 쓰기는 propose_* 도구로 '제안'만 할 수 있고, 실행은 사람이 승인해야 일어난다. "
            + "답할 때는 결과의 source와 as_of를 함께 알려라.";

    private static final McpSchema.ToolAnnotations READ = McpSchema.ToolAnnotations.builder()
            .readOnlyHint(true).idempotentHint(true).openWorldHint(false).build();
    private static final McpSchema.ToolAnnotations PROPOSE = McpSchema.ToolAnnotations.builder()
            .readOnlyHint(false).destructiveHint(false).idempotentHint(false).openWorldHint(false).build();

    private MesMcpServer() {}

    // ── 도구 정의 도우미 ─────────────────────────────────────────────────
    private static Map<String, Object> prop(String type, String description) {
        return Json.obj("type", type, "description", description);
    }

    private static SyncToolSpecification tool(String name, String description, Map<String, Object> props, List<String> required,
                                               McpSchema.ToolAnnotations annotations, Function<Map<String, Object>, Object> handler) {
        McpSchema.Tool tool = McpSchema.Tool.builder().name(name).description(description)
                .inputSchema(Json.obj("type", "object", "properties", props, "required", required))
                .annotations(annotations).build();
        return SyncToolSpecification.builder().tool(tool).callHandler((exchange, req) -> {
            try {
                Object result = handler.apply(req.arguments() == null ? Map.of() : req.arguments());
                return McpSchema.CallToolResult.builder().addTextContent(Json.pretty(result)).isError(false).build();
            } catch (RuntimeException e) {
                return McpSchema.CallToolResult.builder().addTextContent(Json.write(Json.obj("error", e.getMessage()))).isError(true).build();
            }
        }).build();
    }

    private static String str(Map<String, Object> args, String key, String def) {
        Object v = args.get(key);
        return v == null || v.toString().isBlank() ? def : v.toString();
    }

    private static String yesterday(String day) {
        return LocalDate.parse(day).minusDays(1).toString();
    }

    private static Map<String, Object> src(String source, Map<String, Object> data) {
        Map<String, Object> m = new LinkedHashMap<>(data);
        m.put("source", source);
        m.put("as_of", MesTools.getInventoryAsOf());
        return m;
    }

    private static <T> T unchecked(java.util.concurrent.Callable<T> body) {
        try {
            return body.call();
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage(), e);
        }
    }

    // ── 도구 목록 ────────────────────────────────────────────────────────
    static List<SyncToolSpecification> tools() {
        List<SyncToolSpecification> t = new ArrayList<>();
        Map<String, Object> dayProp = Json.obj("day", prop("string", "YYYY-MM-DD. 비우면 기본값"));

        t.add(tool("get_production_summary", "일자별 생산 계획 대비 실적과 출하 계획 대비 실적. day는 YYYY-MM-DD, 비우면 전일.",
                dayProp, List.of(), READ, a -> {
                    String d = str(a, "day", yesterday(TODAY));
                    return src("MES 작업지시·작업실적·출하계획·출하실적",
                            Json.obj("production", MesTools.getProductionSummary(d), "shipment", MesTools.getShipmentSummary(d)));
                }));

        t.add(tool("get_shipment_coverage", "품목별 출하 충족 여부. balance = 완제품 재고 + 금일 생산 계획 − 출하 예정 (음수면 부족). day를 비우면 오늘.",
                dayProp, List.of(), READ, a -> {
                    String d = str(a, "day", TODAY);
                    List<Map<String, Object>> items = new ArrayList<>();
                    for (Map<String, Object> r : MesTools.getTodayPlanByItem(d)) {
                        long balance = ((Number) r.get("fg_inventory")).longValue() + ((Number) r.get("production_plan")).longValue()
                                - ((Number) r.get("shipment_plan")).longValue();        // 계산은 코드가 한다
                        Map<String, Object> it = new LinkedHashMap<>(r);
                        it.put("balance", balance);
                        it.put("status", balance < 0 ? "부족" : "충족");
                        items.add(it);
                    }
                    return src("MES 작업지시·출하계획·완제품 재고", Json.obj("day", d, "items", items,
                            "formula", "balance = fg_inventory + production_plan - shipment_plan"));
                }));

        t.add(tool("get_item_detail", "품목 하나의 전일 계획·실적·출하, 금일 계획·출하 예정, 재고, 거래처, 라인. 원인 분석용.",
                Json.obj("item_code", prop("string", "품목 코드. 예: B-205")), List.of("item_code"), READ, a -> {
                    Map<String, Object> d = MesTools.getItemDetail(str(a, "item_code", "").toUpperCase(), TODAY, yesterday(TODAY));
                    return d == null ? Json.obj("error", "품목 " + a.get("item_code") + "가 없습니다", "known_items", MesTools.listItemCodes())
                            : src("MES 작업지시·작업실적·출하계획·출하실적·재고", d);
                }));

        t.add(tool("get_work_order_sequence", "라인의 작업지시 순서와 상태(대기·진행·완료). 예: line='조립2라인'.",
                Json.obj("line", prop("string", "라인 이름. 예: 조립2라인"), "day", prop("string", "YYYY-MM-DD. 비우면 오늘")),
                List.of("line"), READ, a -> {
                    String d = str(a, "day", TODAY);
                    String line = str(a, "line", "");
                    return src("MES 작업지시 순서", Json.obj("line", line, "day", d, "sequence", MesApi.getWorkOrderSequence(line, d)));
                }));

        t.add(tool("get_material_risks", "입고 예정 중 확정되지 않은 자재 (납기 회신 미수신 등).", dayProp, List.of(), READ, a -> {
            String d = str(a, "day", TODAY);
            return src("MES 자재 입고 예정", Json.obj("day", d, "risks", MesTools.getMaterialRisks(d)));
        }));

        t.add(tool("get_equipment_signals", "이상 감지 모델이 기록한 설비 이상 징후 (진동 상승 추세 등).", Json.obj(), List.of(), READ,
                a -> src("설비 이상 감지", Json.obj("signals", MesTools.getEquipmentSignals()))));

        t.add(tool("search_knowledge", "작업표준서·설비 매뉴얼·검사 기준·불량 사례에서 질문과 가까운 원문 조각을 찾는다 (RAG). 출처와 개정판 포함.",
                Json.obj("query", prop("string", "질문"), "k", prop("integer", "결과 개수 (기본 3)")), List.of("query"), READ, a -> unchecked(() -> {
                    if (!Files.exists(RagKit.DB_PATH)) {
                        return Json.obj("error", "지식 색인이 없습니다. `java -jar demo.jar index --offline`을 먼저 실행하세요.");
                    }
                    String q = str(a, "query", "");
                    int k = a.get("k") instanceof Number n ? n.intValue() : 3;
                    try (Connection c = RagKit.connect(RagKit.DB_PATH)) {
                        Search.Result r = Search.search(q, k, null, null, c);
                        List<Map<String, Object>> hits = r.hits().stream().map(h -> Json.obj("title", h.title, "revision", h.revision,
                                "heading", h.headingPath, "text", h.text, "file", h.sourcePath)).toList();
                        return Json.obj("query", q, "embed_model", r.model(), "source", "지식 색인 (Java 인덱서)", "hits", hits);
                    }
                })));

        t.add(tool("propose_work_order_reorder", "작업지시 순서 변경을 '제안'한다. MES는 바뀌지 않는다. "
                        + "변경 미리보기를 만들어 승인 대기열에 올리고 approval_id를 돌려준다. 실행은 사람이 승인해야 일어난다.",
                Json.obj("wo_id", prop("string", "작업지시 번호. 예: WO-1020-02"),
                        "new_position", prop("integer", "새 순서 (1부터)"), "reason", prop("string", "제안 이유")),
                List.of("wo_id", "new_position", "reason"), PROPOSE, a -> unchecked(() -> propose(a))));

        t.add(tool("get_approval_status", "제안의 처리 상태 (대기 / 실행됨 / 거절 / 실패)와 결과.",
                Json.obj("approval_id", prop("string", "예: AP-1104-001")), List.of("approval_id"), READ, a -> unchecked(() -> {
                    Map<String, Object> ap = Approvals.get(str(a, "approval_id", ""));
                    return ap == null ? Json.obj("error", a.get("approval_id") + " 요청이 없습니다") : ap;
                })));

        t.add(tool("list_pending_approvals", "승인을 기다리는 제안 목록.", Json.obj(), List.of(), READ, a -> unchecked(() ->
                Json.obj("pending", Approvals.listRequests("대기").stream().map(ap -> Json.obj("approval_id", ap.get("approval_id"),
                        "kind", ap.get("kind"), "reason", ap.get("reason"), "requested_by", ap.get("requested_by"),
                        "preview", ap.get("preview"))).toList()))));
        return t;
    }

    static Map<String, Object> propose(Map<String, Object> a) throws Exception {
        Map<String, Object> wo = MesApi.findWorkOrder(str(a, "wo_id", "").toUpperCase());
        if (wo == null) {
            return Json.obj("error", "작업지시 " + a.get("wo_id") + "가 없습니다");
        }
        if (!"대기".equals(wo.get("status"))) {
            return Json.obj("error", wo.get("wo_id") + "는 '" + wo.get("status") + "' 상태라 순서를 바꿀 수 없습니다");
        }
        int pos = ((Number) a.get("new_position")).intValue();
        List<Map<String, Object>> seq = MesApi.getWorkOrderSequence((String) wo.get("line"), (String) wo.get("plan_date"));
        List<String> before = seq.stream().map(s -> (String) s.get("wo_id")).toList();
        if (pos < 1 || pos > before.size()) {
            return Json.obj("error", "new_position은 1~" + before.size() + " 사이여야 합니다", "sequence", seq);
        }
        List<String> after = new ArrayList<>(before);
        after.remove((String) wo.get("wo_id"));
        after.add(pos - 1, (String) wo.get("wo_id"));
        Map<String, String> label = new LinkedHashMap<>();
        seq.forEach(s -> label.put((String) s.get("wo_id"),
                String.format("%s (%s %,d)", s.get("wo_id"), s.get("item_code"), ((Number) s.get("plan_qty")).longValue())));
        Map<String, Object> preview = Json.obj("line", wo.get("line"), "plan_date", wo.get("plan_date"),
                "before", before.stream().map(label::get).toList(), "after", after.stream().map(label::get).toList(),
                "reversible", "작업 시작 전까지 되돌릴 수 있음", "risk", "중 (계획 수량은 그대로, 순서만 변경)");
        Map<String, Object> ap = Approvals.createRequest("reorder_work_order", Json.obj("wo_id", wo.get("wo_id"), "new_position", pos),
                preview, before, str(a, "reason", ""), USER);
        return Json.obj("approval_id", ap.get("approval_id"), "status", ap.get("status"), "preview", preview,
                "message", "승인 대기열에 올렸습니다. 담당자가 승인해야 MES에 반영됩니다.");
    }

    public static void main(String[] args) throws Exception {
        MesApi.use();
        if (!Files.exists(MesApi.DB_PATH)) {
            System.err.println(MesApi.DB_PATH + "가 없습니다. 먼저 `mcp-setup`을 실행하세요.");
            System.exit(1);
        }
        StdioServerTransportProvider transport = new StdioServerTransportProvider(new JacksonMcpJsonMapper(new ObjectMapper()));
        McpServer.sync(transport)
                .serverInfo("ai-plant-manager-mes", "1.0")
                .instructions(INSTRUCTIONS)
                .capabilities(McpSchema.ServerCapabilities.builder().tools(true).build())
                .tools(tools())
                .build();
        new CountDownLatch(1).await();   // 클라이언트가 프로세스를 끝낼 때까지 대기
    }
}
