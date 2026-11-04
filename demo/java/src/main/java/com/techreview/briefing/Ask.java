package com.techreview.briefing;

import com.techreview.common.Cli;
import com.techreview.common.Json;
import com.techreview.common.Ollama;
import com.techreview.common.StateGraph;
import com.techreview.common.Text;

import java.nio.file.Files;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;

/**
 * AI 공장장에게 묻기 데모: "B-205는 왜 부족해?" (ask.py의 Java 버전)
 *
 * 흐름:  identify(품목 파악) → investigate(MES 조회) → analyze(원인 계산) → explain(LLM 설명) → verify(수치 검증) → render
 *
 * - 숫자는 MES 조회 도구와 결정적 계산(analyze)에서만 나온다.
 * - LLM(Ollama)은 원인을 사람이 읽기 좋게 설명하는 문장만 쓴다.
 * - LLM 문장에 근거 없는 숫자가 있으면 버리고 규칙 기반 설명으로 대체한다.
 */
public final class Ask {
    static final class State {
        String question;
        boolean useLlm;
        List<String> itemCodes;
        List<Map<String, Object>> details;    // MES에서 조회한 품목별 원자료
        List<Map<String, Object>> findings;   // 품목별 계산 결과 (부족 수량, 원인 수치)
        List<String> explanation;
        String source;                        // "llm" | "rules" | "rules (...)"
        String answer;
    }

    private Ask() {}

    static long n(Map<String, Object> row, String key) {
        return ((Number) row.get(key)).longValue();
    }

    // ── 1. identify: 질문에서 품목 코드 파악 (등록된 품목 코드와 대조) ─────
    static void identify(State s) {
        String q = s.question.toUpperCase(Locale.ROOT).replace(" ", "");
        s.itemCodes = MesTools.listItemCodes().stream()
                .filter(c -> q.contains(c.toUpperCase(Locale.ROOT)) || q.contains(c.toUpperCase(Locale.ROOT).replace("-", "")))
                .toList();
    }

    // ── 2. investigate: MES 조회 (읽기 전용 도구만 사용) ──────────────────
    static void investigate(State s) {
        String yesterday = LocalDate.parse(Briefing.TODAY).minusDays(1).toString();
        List<String> codes = s.itemCodes.isEmpty() ? MesTools.listItemCodes() : s.itemCodes;   // 품목을 말하지 않았으면 전체
        s.details = codes.stream().map(c -> MesTools.getItemDetail(c, Briefing.TODAY, yesterday)).filter(Objects::nonNull).toList();
    }

    // ── 3. analyze: 원인 계산 (LLM 아님) ──────────────────────────────────
    static void analyze(State s) {
        List<Map<String, Object>> findings = new ArrayList<>();
        for (Map<String, Object> d : s.details) {
            Map<String, Object> f = new LinkedHashMap<>(d);
            long balance = n(d, "fg_inventory") + n(d, "plan_today") - n(d, "ship_plan_today");
            f.put("balance", balance);
            f.put("shortage", Math.max(-balance, 0));
            f.put("production_gap_yesterday", n(d, "plan_yesterday") - n(d, "produced_yesterday"));   // 양수면 전일 생산 미달
            f.put("shipment_increase", n(d, "ship_plan_today") - n(d, "shipped_yesterday"));           // 양수면 오늘 출하가 더 많음
            findings.add(f);
        }
        if (s.itemCodes.isEmpty()) {   // 품목을 지정하지 않은 질문이면 부족한 품목만 남김
            findings.removeIf(f -> n(f, "shortage") == 0);
        }
        s.findings = findings;
    }

    // ── 4. explain: 원인 설명 (LLM 또는 규칙) ─────────────────────────────
    static List<String> ruleBasedExplanation(State s) {
        List<String> lines = new ArrayList<>();
        if (s.findings.isEmpty()) {
            return List.of("오늘 출하 예정 대비 부족한 품목은 없습니다.");
        }
        for (Map<String, Object> f : s.findings) {
            Object code = f.get("item_code");
            if (n(f, "shortage") == 0) {
                lines.add(String.format("%s 품목은 부족하지 않습니다. 출하 예정 대비 %,d개 여유가 있습니다.", code, n(f, "balance")));
                continue;
            }
            lines.add(String.format("%s 출하 부족 %,d개의 원인은 다음과 같습니다.", code, n(f, "shortage")));
            if (n(f, "production_gap_yesterday") > 0) {
                lines.add(String.format("전일 생산 미달: 계획 %,d개 중 %,d개만 생산해 %,d개 미달했고, 그 결과 오늘 아침 재고가 %,d개입니다.",
                        n(f, "plan_yesterday"), n(f, "produced_yesterday"), n(f, "production_gap_yesterday"), n(f, "fg_inventory")));
            }
            if (n(f, "shipment_increase") > 0) {
                lines.add(String.format("오늘 출하량 증가: %s 출하 예정이 %,d개로 전일 출하(%,d개)보다 %,d개 많습니다.",
                        f.get("customers_today"), n(f, "ship_plan_today"), n(f, "shipped_yesterday"), n(f, "shipment_increase")));
            }
            lines.add(String.format("권고: 오전 중 %s 우선 투입으로 %,d개 추가 확보 검토 (생산관리자 확인 필요)", f.get("line"), n(f, "shortage")));
        }
        return lines;
    }

    static void explain(State s) {
        if (!s.useLlm || s.findings.isEmpty()) {
            s.explanation = ruleBasedExplanation(s);
            s.source = "rules";
            return;
        }
        try {
            String prompt = "너는 중소 제조공장의 AI 공장장이다. 사용자의 질문에 아래 MES 데이터만 근거로 답하라.\n"
                    + "- 부족(shortage>0)한 품목은 원인을 2~3개 항목으로 설명하고, 마지막 줄에 '권고:'로 시작하는 조치를 한 줄 써라\n"
                    + "- production_gap_yesterday가 양수면 전일 생산 미달, shipment_increase가 양수면 오늘 출하 증가가 원인이다\n"
                    + "- 데이터에 없는 숫자를 만들지 말 것. 숫자는 아래 값만 그대로 사용할 것\n"
                    + "- 권고는 확정이 아니라 생산관리자 확인이 필요한 제안으로 쓸 것\n"
                    + "- 항목 앞에 기호를 붙이지 말고 한 줄에 하나씩만 출력\n\n"
                    + "[질문]\n" + s.question + "\n\n[MES 데이터]\n" + Json.write(s.findings) + "\n";
            s.explanation = Ollama.generate(prompt, Ollama.LLM_MODEL).lines()
                    .map(ln -> ln.replaceAll("^[\\s\\-*•]+|[\\s\\-*•]+$", "")).filter(ln -> !ln.isEmpty()).toList();
            s.source = "llm";
        } catch (RuntimeException e) {   // Ollama 미기동 등 → 백업 모드로 전환
            s.explanation = ruleBasedExplanation(s);
            s.source = "rules (LLM 호출 실패: " + e.getClass().getSimpleName() + ")";
        }
    }

    // ── 5. verify: LLM 문장 속 숫자가 MES 데이터와 계산 결과에 있는지 검증 ──
    static void verify(State s) {
        if (!"llm".equals(s.source)) {
            return;
        }
        Set<Long> allowed = new TreeSet<>(Text.integers(Json.write(s.findings)));
        allowed.addAll(Text.integers(s.question));
        s.findings.forEach(f -> allowed.add(Math.abs(n(f, "balance"))));
        Set<Long> unknown = new TreeSet<>(Text.integers(String.join(" ", s.explanation)));
        unknown.removeAll(allowed);
        if (!unknown.isEmpty()) {
            s.explanation = ruleBasedExplanation(s);
            s.source = "rules (LLM 검증 실패: 근거 없는 수치 " + unknown + ")";
        }
    }

    // ── 6. render: 답변 출력 (계산식은 코드가 만든 숫자) ──────────────────
    static void render(State s) {
        List<String> out = new ArrayList<>(List.of("❓ " + s.question, ""));
        s.explanation.forEach(ln -> out.add("   " + ln));
        for (Map<String, Object> f : s.findings) {
            if (n(f, "shortage") > 0) {
                out.add("");
                out.add(String.format("   계산 (%s): 재고 %,d + 금일 생산 계획 %,d - 출하 예정 %,d = %,d개",
                        f.get("item_code"), n(f, "fg_inventory"), n(f, "plan_today"), n(f, "ship_plan_today"), n(f, "balance")));
            }
        }
        out.add("");
        out.add("* 수치 출처: MES (작업지시, 작업실적, 출하계획, 출하실적, 완제품 재고)");
        out.add("* 설명 작성: " + s.source + ("llm".equals(s.source) ? " / 모델 " + Ollama.LLM_MODEL : ""));
        s.answer = String.join("\n", out);
    }

    static StateGraph.Compiled<State> buildGraph() {
        StateGraph<State> g = new StateGraph<State>()
                .addNode("identify", Ask::identify)
                .addNode("investigate", Ask::investigate)
                .addNode("analyze", Ask::analyze)
                .addNode("explain", Ask::explain)
                .addNode("verify", Ask::verify)
                .addNode("render", Ask::render);
        String prev = StateGraph.START;
        for (String node : List.of("identify", "investigate", "analyze", "explain", "verify", "render")) {
            g.addEdge(prev, node);
            prev = node;
        }
        return g.addEdge(prev, StateGraph.END).compile();
    }

    public static void main(String[] args) {
        Cli cli = new Cli(args, Set.of());
        if (!Files.exists(MesTools.DB_PATH)) {
            throw new Cli.Exit(MesTools.DB_PATH + "가 없습니다. 먼저 `seed`를 실행하세요.");
        }
        State s = new State();
        s.question = cli.positional.isEmpty() ? "B-205는 왜 부족해?" : cli.positional.get(0);
        s.useLlm = !cli.flag("--no-llm");
        System.out.println(buildGraph().invoke(s).answer);
    }
}
