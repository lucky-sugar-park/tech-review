package com.techreview.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techreview.common.Json;

import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.ServerParameters;
import io.modelcontextprotocol.client.transport.StdioClientTransport;
import io.modelcontextprotocol.json.jackson2.JacksonMcpJsonMapper;
import io.modelcontextprotocol.spec.McpSchema;

import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;

/**
 * MCP 클라이언트 데모 (demo_client.py의 Java 버전, LLM 없이): 에이전트가 하는 일을 순서대로 직접 호출해 본다.
 *
 * 1. 서버(이 jar의 mcp-server)를 띄워 연결하고 도구 목록을 본다 (읽기 전용 / 제안 구분)
 * 2. 조회·계산 도구로 B-205 출하 부족을 확인한다
 * 3. 작업지시 순서 변경을 '제안'한다 → MES는 그대로
 * 4. 사람이 승인함에서 승인한다 → 그때 MES가 바뀐다
 * 5. 같은 승인을 다시 눌러도 두 번 실행되지 않는다
 */
public final class McpDemo {
    private McpDemo() {}

    static JsonNode call(McpSyncClient client, String tool, Map<String, Object> args) {
        McpSchema.CallToolResult r = client.callTool(McpSchema.CallToolRequest.builder(tool).arguments(args).build());
        return Json.read(((McpSchema.TextContent) r.content().get(0)).text());
    }

    static String seqText(JsonNode seq) {
        StringBuilder sb = new StringBuilder();
        for (JsonNode x : seq.get("sequence")) {
            sb.append(sb.length() > 0 ? " → " : "").append(x.get("seq").asInt()).append(". ").append(x.get("wo_id").asText())
                    .append("(").append(x.get("item_code").asText()).append(")");
        }
        return sb.toString();
    }

    public static void main(String[] args) throws Exception {
        MesApi.use();
        String java = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        ServerParameters params = ServerParameters.builder(java)
                .args("-cp", System.getProperty("java.class.path"), "com.techreview.Main", "mcp-server").build();
        StdioClientTransport transport = new StdioClientTransport(params, new JacksonMcpJsonMapper(new ObjectMapper()));
        transport.setStdErrorHandler(line -> { });
        try (McpSyncClient client = McpClient.sync(transport).requestTimeout(Duration.ofSeconds(30)).build()) {
            client.initialize();

            System.out.println("━━ 1. 도구 목록 (Java MCP 서버: " + client.getServerInfo().name() + ")");
            for (McpSchema.Tool t : client.listTools().tools()) {
                boolean ro = t.annotations() != null && Boolean.TRUE.equals(t.annotations().readOnlyHint());
                String d = t.description().split("\\. ")[0];
                System.out.printf("  %s  %-28s %s%n", ro ? "🔍 읽기" : "✋ 제안", t.name(), d.length() > 60 ? d.substring(0, 60) : d);
            }

            System.out.println("\n━━ 2. 조회·계산: 오늘 출하 충족");
            JsonNode cov = call(client, "get_shipment_coverage", Map.of());
            for (JsonNode it : cov.get("items")) {
                System.out.printf("  %s  재고 %,5d + 계획 %,5d - 출하 %,5d = %,6d  %s%n", it.get("item_code").asText(), it.get("fg_inventory").asLong(),
                        it.get("production_plan").asLong(), it.get("shipment_plan").asLong(), it.get("balance").asLong(), it.get("status").asText());
            }
            System.out.println("  출처: " + cov.get("source").asText() + " · 기준 " + cov.get("as_of").asText());
            System.out.println("  조립2라인 순서: " + seqText(call(client, "get_work_order_sequence", Map.of("line", "조립2라인"))));

            System.out.println("\n━━ 3. 제안: B-205 작업지시를 1순위로 (MES는 아직 그대로)");
            JsonNode prop = call(client, "propose_work_order_reorder",
                    Map.of("wo_id", "WO-1020-02", "new_position", 1, "reason", "B-205 출하 200개 부족 예상"));
            String id = prop.get("approval_id").asText();
            System.out.println("  " + id + " · " + prop.get("status").asText() + " · " + prop.get("message").asText());
            StringBuilder after = new StringBuilder();
            prop.at("/preview/after").forEach(n -> after.append(after.length() > 0 ? " → " : "").append(n.asText()));
            System.out.println("  변경 후 (미리보기): " + after);
            System.out.println("  현재 MES 순서: " + seqText(call(client, "get_work_order_sequence", Map.of("line", "조립2라인"))) + "   ← 바뀌지 않음");

            System.out.println("\n━━ 4. 사람이 승인함에서 승인 (mcp-approve와 같은 동작)");
            Map<String, Object> done = Approvals.decide(id, "생산관리자 이OO", true, "");
            System.out.println("  " + done.get("approval_id") + " · " + done.get("status") + " · 결정 " + done.get("decided_by"));
            System.out.println("  현재 MES 순서: " + seqText(call(client, "get_work_order_sequence", Map.of("line", "조립2라인"))) + "   ← 반영됨");

            System.out.println("\n━━ 5. 같은 승인을 다시 누르면?");
            System.out.println("  " + Approvals.decide(id, "생산관리자 이OO", true, "").get("message"));
            JsonNode st = call(client, "get_approval_status", Map.of("approval_id", id));
            System.out.println("  AI가 상태 조회: " + st.get("status").asText() + " · before " + st.at("/result/before") + " → after " + st.at("/result/after"));

            System.out.println("\n━━ 감사 로그");
            Approvals.auditLog().forEach(a -> System.out.printf("  %s  %-12s %-10s %s%n", a.get("at"), a.get("actor"), a.get("action"), a.get("approval_id")));
        }
    }
}
