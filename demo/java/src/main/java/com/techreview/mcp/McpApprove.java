package com.techreview.mcp;

import com.techreview.common.Cli;
import com.techreview.common.Json;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 승인함 (approve.py의 Java 버전, 사람이 쓰는 창구): AI가 올린 제안을 보고 승인·거절한다. 실제로는 공장장실 웹의 승인함 화면이다.
 * 이 기능은 MCP 도구로 노출하지 않는다. AI는 제안만 할 수 있고, 결정은 사람이 한다.
 *
 * mcp-approve list | show ID | approve ID --by 이OO | reject ID --by 이OO --note "라인 사정" | audit
 */
public final class McpApprove {
    private McpApprove() {}

    @SuppressWarnings("unchecked")
    static void show(Map<String, Object> ap) {
        System.out.printf("[%s] %s · %s · 요청 %s %s%n", ap.get("approval_id"), ap.get("status"), ap.get("kind"), ap.get("requested_by"), ap.get("requested_at"));
        System.out.println("  이유: " + ap.get("reason"));
        Map<String, Object> p = (Map<String, Object>) ap.get("preview");
        if (p != null) {
            System.out.println("  " + p.get("line") + " " + p.get("plan_date"));
            System.out.println("  변경 전: " + String.join(" → ", (List<String>) p.get("before")));
            System.out.println("  변경 후: " + String.join(" → ", (List<String>) p.get("after")));
            System.out.println("  되돌리기: " + p.get("reversible") + " · 위험: " + p.get("risk"));
        }
        if (ap.get("decided_by") != null) {
            System.out.println("  결정: " + ap.get("decided_by") + " " + ap.get("decided_at") + " " + (ap.get("decision_note") == null ? "" : ap.get("decision_note")));
        }
        if (ap.get("result") != null) {
            System.out.println("  결과: " + Json.write(ap.get("result")));
        }
        if (ap.get("message") != null) {
            System.out.println("  ※ " + ap.get("message"));
        }
    }

    public static void main(String[] args) throws Exception {
        MesApi.use();
        Cli cli = new Cli(args, Set.of("--by", "--note"));
        String cmd = cli.positional.isEmpty() ? "list" : cli.positional.get(0);
        String id = cli.positional.size() > 1 ? cli.positional.get(1) : null;
        switch (cmd) {
            case "list" -> {
                List<Map<String, Object>> pending = Approvals.listRequests("대기");
                System.out.println("승인 대기 " + pending.size() + "건");
                pending.forEach(McpApprove::show);
            }
            case "audit" -> Approvals.auditLog().forEach(r -> System.out.printf("%s  %-10s %-10s %s  %s%n",
                    r.get("at"), r.get("actor"), r.get("action"), r.get("approval_id"), r.get("detail")));
            case "show", "approve", "reject" -> {
                if (id == null) {
                    throw new Cli.Exit("approval_id가 필요합니다");
                }
                Map<String, Object> r = cmd.equals("show") ? Approvals.get(id)
                        : Approvals.decide(id, cli.opt("--by", "생산관리자"), cmd.equals("approve"), cli.opt("--note", ""));
                if (r == null) {
                    throw new Cli.Exit(id + " 요청이 없습니다");
                }
                show(r);
            }
            default -> throw new Cli.Exit("사용법: mcp-approve list | show ID | approve ID --by 이름 | reject ID --by 이름 --note 사유 | audit");
        }
    }
}
