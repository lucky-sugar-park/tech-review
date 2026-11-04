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
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * AI 공장장 아침 브리핑 데모 (briefing.py의 Java 버전).
 *
 * 흐름:  collect(MES 조회) → analyze(출하 충족 계산) → advise(LLM 권고) → verify(수치 검증) → render
 *
 * 원칙:
 * - 숫자는 MES 조회 도구(MesTools)와 결정적 계산(analyze)에서만 나온다.
 * - LLM(Ollama)은 주의 사항과 권고 문장만 쓴다.
 * - LLM 문장에 MES에 없는 숫자가 있으면 verify 단계에서 걸러내고 규칙 기반 문장으로 대체한다.
 */
public final class Briefing {
    static final String TODAY = Ollama.env("BRIEFING_DATE", "2026-10-20");
    static final String WEEKDAYS = "월화수목금토일";

    /** 그래프가 노드를 거치며 채워 가는 상태. */
    static final class State {
        String today;
        String yesterday;
        boolean useLlm;
        Map<String, Object> facts;            // MES에서 조회한 원자료
        List<Map<String, Object>> items;      // 품목별 출하 충족 계산 결과
        List<String> advice;                  // 주의 사항과 권고 문장
        String adviceSource;                  // "llm" | "rules" | "rules (LLM 검증 실패)" ...
        String report;
    }

    private Briefing() {}

    static long n(Map<String, Object> row, String key) {
        return ((Number) row.get(key)).longValue();
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> list(Map<String, Object> facts, String key) {
        return (List<Map<String, Object>>) facts.get(key);
    }

    // ── 1. collect: MES 조회 (읽기 전용 도구만 사용) ─────────────────────
    static void collect(State s) {
        s.yesterday = LocalDate.parse(s.today).minusDays(1).toString();
        s.facts = Json.obj(
                "production_yesterday", MesTools.getProductionSummary(s.yesterday),
                "shipment_yesterday", MesTools.getShipmentSummary(s.yesterday),
                "today_plan", MesTools.getTodayPlanByItem(s.today),
                "inventory_as_of", MesTools.getInventoryAsOf(),
                "material_risks", MesTools.getMaterialRisks(s.today),
                "equipment_signals", MesTools.getEquipmentSignals());
    }

    // ── 2. analyze: 결정적 계산 (LLM 아님) ───────────────────────────────
    static void analyze(State s) {
        s.items = new ArrayList<>();
        for (Map<String, Object> row : list(s.facts, "today_plan")) {
            Map<String, Object> it = new LinkedHashMap<>(row);
            // 출하 충족 여부 = 완제품 재고 + 금일 생산 계획 - 출하 예정
            it.put("balance", n(row, "fg_inventory") + n(row, "production_plan") - n(row, "shipment_plan"));
            s.items.add(it);
        }
    }

    // ── 3. advise: 주의 사항과 권고 (LLM 또는 규칙) ──────────────────────
    static List<String> ruleBasedAdvice(State s) {
        List<String> advice = new ArrayList<>();
        for (Map<String, Object> it : s.items) {
            if (n(it, "balance") < 0) {
                advice.add(String.format("%s 출하 %,d개 부족 예상 → 오전 중 %s 우선 투입 권고", it.get("item_code"), -n(it, "balance"), it.get("line")));
            }
        }
        for (Map<String, Object> m : list(s.facts, "material_risks")) {
            advice.add(String.format("%s 입고 지연 가능성 (%s, %s) → 구매팀 확인 필요", m.get("material"), m.get("supplier"), m.get("status")));
        }
        for (Map<String, Object> e : list(s.facts, "equipment_signals")) {
            advice.add(String.format("%s %s %s → 점심시간 점검 권고", e.get("equipment"), e.get("signal"), e.get("trend")));
        }
        return advice;
    }

    static void advise(State s) {
        if (!s.useLlm) {
            s.advice = ruleBasedAdvice(s);
            s.adviceSource = "rules";
            return;
        }
        try {
            String prompt = "너는 중소 제조공장의 AI 공장장이다. 아래 MES 데이터만 근거로 오늘 아침 회의용 "
                    + "'주의 사항과 권고'를 3~5개 항목으로 작성하라.\n"
                    + "- 각 항목은 한 줄, '문제 → 권고 조치' 형식\n"
                    + "- 데이터에 없는 숫자를 만들지 말 것. 숫자는 아래 데이터의 값만 그대로 사용할 것\n"
                    + "- balance가 음수인 품목은 출하 부족이다 (부족 수량 = balance의 절댓값)\n"
                    + "- 항목 앞에 기호를 붙이지 말고 한 줄에 하나씩만 출력\n\n"
                    + "[품목별 금일 계획]\n" + Json.write(s.items) + "\n\n"
                    + "[자재 입고 위험]\n" + Json.write(s.facts.get("material_risks")) + "\n\n"
                    + "[설비 이상 징후]\n" + Json.write(s.facts.get("equipment_signals")) + "\n";
            String text = Ollama.generate(prompt, Ollama.LLM_MODEL);
            s.advice = text.lines().map(ln -> ln.replaceAll("^[\\s\\-*•]+|[\\s\\-*•]+$", "")).filter(ln -> !ln.isEmpty()).toList();
            s.adviceSource = "llm";
        } catch (RuntimeException e) {   // Ollama 미기동 등 → 백업 모드로 전환
            s.advice = ruleBasedAdvice(s);
            s.adviceSource = "rules (LLM 호출 실패: " + e.getClass().getSimpleName() + ")";
        }
    }

    // ── 4. verify: LLM 문장 속 숫자가 MES 데이터에 있는지 검증 ───────────
    static void verify(State s) {
        if (!"llm".equals(s.adviceSource)) {
            return;
        }
        Set<Long> allowed = new TreeSet<>(Text.integers(Json.write(s.facts)));
        allowed.addAll(Text.integers(Json.write(s.items)));
        s.items.forEach(it -> allowed.add(Math.abs(n(it, "balance"))));
        Set<Long> unknown = new TreeSet<>(Text.integers(String.join(" ", s.advice)));
        unknown.removeAll(allowed);
        if (!unknown.isEmpty()) {   // 근거 없는 수치 → LLM 결과를 버리고 규칙 기반으로 대체
            s.advice = ruleBasedAdvice(s);
            s.adviceSource = "rules (LLM 검증 실패: 근거 없는 수치 " + unknown + ")";
        }
    }

    // ── 5. render: 브리핑 출력 (표의 숫자는 모두 MES 조회·계산 결과) ─────
    static String pct(long actual, long plan) {
        return plan == 0 ? "-" : String.format("%.1f%%", actual * 100.0 / plan);
    }

    @SuppressWarnings("unchecked")
    static void render(State s) {
        Map<String, Object> prod = (Map<String, Object>) s.facts.get("production_yesterday");
        Map<String, Object> ship = (Map<String, Object>) s.facts.get("shipment_yesterday");
        LocalDate d = LocalDate.parse(s.today);
        LocalDate y = LocalDate.parse(s.yesterday);
        List<String> lines = new ArrayList<>(List.of(
                String.format("📋 %d월 %d일(%c) 아침 브리핑 — AI 공장장, 07:00 기준", d.getMonthValue(), d.getDayOfMonth(),
                        WEEKDAYS.charAt(d.getDayOfWeek().getValue() - 1)),
                "",
                String.format("1. 전일 실적 (%d/%d)", y.getMonthValue(), y.getDayOfMonth()),
                String.format("   %-6s%10s%10s%10s", "구분", "계획", "실적", "달성률"),
                String.format("   %-6s%,10d%,10d%10s", "생산", n(prod, "plan"), n(prod, "actual"), pct(n(prod, "actual"), n(prod, "plan"))),
                String.format("   %-6s%,10d%,10d%10s", "출하", n(ship, "plan"), n(ship, "actual"), pct(n(ship, "actual"), n(ship, "plan"))),
                "",
                String.format("2. 금일 계획 (%d/%d)", d.getMonthValue(), d.getDayOfMonth()),
                String.format("   %-14s%9s%9s%9s   출하 충족", "품목", "생산계획", "출하예정", "완제품재고")));
        long totalProd = 0;
        long totalShip = 0;
        for (Map<String, Object> it : s.items) {
            long b = n(it, "balance");
            String status = b >= 0 ? String.format("✅ 여유 %,d", b) : String.format("⚠️ 부족 %,d", -b);
            String name = it.get("item_code") + " (" + it.get("process") + ")";
            lines.add(String.format("   %-14s%,9d%,9d%,9d   %s", name, n(it, "production_plan"), n(it, "shipment_plan"), n(it, "fg_inventory"), status));
            totalProd += n(it, "production_plan");
            totalShip += n(it, "shipment_plan");
        }
        lines.add(String.format("   %-14s%,9d%,9d", "합계", totalProd, totalShip));
        lines.add("");
        lines.add("3. 주의 사항");
        s.advice.forEach(a -> lines.add("   ⚠️ " + a));
        lines.add("");
        lines.add("* 수치 출처: MES (작업지시, 작업실적, 출하계획, 출하실적, 완제품 재고 " + s.facts.get("inventory_as_of") + " 기준)");
        lines.add("* 주의 사항 작성: " + s.adviceSource + ("llm".equals(s.adviceSource) ? " / 모델 " + Ollama.LLM_MODEL : ""));
        s.report = String.join("\n", lines);
    }

    static StateGraph.Compiled<State> buildGraph() {
        return new StateGraph<State>()
                .addNode("collect", Briefing::collect)
                .addNode("analyze", Briefing::analyze)
                .addNode("advise", Briefing::advise)
                .addNode("verify", Briefing::verify)
                .addNode("render", Briefing::render)
                .addEdge(StateGraph.START, "collect")
                .addEdge("collect", "analyze")
                .addEdge("analyze", "advise")
                .addEdge("advise", "verify")
                .addEdge("verify", "render")
                .addEdge("render", StateGraph.END)
                .compile();
    }

    public static void main(String[] args) {
        Cli cli = new Cli(args, Set.of());
        if (!Files.exists(MesTools.DB_PATH)) {
            throw new Cli.Exit(MesTools.DB_PATH + "가 없습니다. 먼저 `seed`를 실행하세요.");
        }
        State s = new State();
        s.today = TODAY;
        s.useLlm = !cli.flag("--no-llm");
        System.out.println(buildGraph().invoke(s).report);
    }
}
