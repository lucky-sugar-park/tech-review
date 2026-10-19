"""AI 공장장 아침 브리핑 데모.

LangGraph 흐름:  collect(MES 조회) → analyze(출하 충족 계산) → advise(LLM 권고) → verify(수치 검증) → render

원칙:
- 숫자는 MES 조회 도구(mes_tools)와 결정적 계산(analyze)에서만 나온다.
- LLM(Ollama)은 주의 사항과 권고 문장만 쓴다.
- LLM 문장에 MES에 없는 숫자가 있으면 verify 단계에서 걸러내고 규칙 기반 문장으로 대체한다.

실행:
    python seed_mes.py
    python briefing.py              # Ollama 사용
    python briefing.py --no-llm     # LLM 없이 규칙 기반 (백업 모드)
"""

import argparse
import os
import re
from datetime import date, timedelta
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

import mes_tools

TODAY = os.environ.get("BRIEFING_DATE", "2026-10-20")
MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:8b")
WEEKDAYS = "월화수목금토일"


class BriefingState(TypedDict, total=False):
    today: str
    yesterday: str
    use_llm: bool
    facts: dict          # MES에서 조회한 원자료
    items: list[dict]    # 품목별 출하 충족 계산 결과
    advice: list[str]    # 주의 사항과 권고 문장
    advice_source: str   # "llm" | "rules" | "rules (LLM 검증 실패)" ...
    report: str


# ── 1. collect: MES 조회 (읽기 전용 도구만 사용) ─────────────────────────
def collect(state: BriefingState) -> BriefingState:
    today = state["today"]
    yesterday = (date.fromisoformat(today) - timedelta(days=1)).isoformat()
    facts = {
        "production_yesterday": mes_tools.get_production_summary(yesterday),
        "shipment_yesterday": mes_tools.get_shipment_summary(yesterday),
        "today_plan": mes_tools.get_today_plan_by_item(today),
        "inventory_as_of": mes_tools.get_inventory_as_of(),
        "material_risks": mes_tools.get_material_risks(today),
        "equipment_signals": mes_tools.get_equipment_signals(),
    }
    return {"yesterday": yesterday, "facts": facts}


# ── 2. analyze: 결정적 계산 (LLM 아님) ───────────────────────────────────
def analyze(state: BriefingState) -> BriefingState:
    items = []
    for row in state["facts"]["today_plan"]:
        # 출하 충족 여부 = 완제품 재고 + 금일 생산 계획 - 출하 예정
        balance = row["fg_inventory"] + row["production_plan"] - row["shipment_plan"]
        items.append({**row, "balance": balance})
    return {"items": items}


# ── 3. advise: 주의 사항과 권고 (LLM 또는 규칙) ──────────────────────────
def rule_based_advice(state: BriefingState) -> list[str]:
    advice = []
    for it in state["items"]:
        if it["balance"] < 0:
            advice.append(
                f"{it['item_code']} 출하 {-it['balance']:,}개 부족 예상 → 오전 중 {it['line']} 우선 투입 권고"
            )
    for m in state["facts"]["material_risks"]:
        advice.append(f"{m['material']} 입고 지연 가능성 ({m['supplier']}, {m['status']}) → 구매팀 확인 필요")
    for e in state["facts"]["equipment_signals"]:
        advice.append(f"{e['equipment']} {e['signal']} {e['trend']} → 점심시간 점검 권고")
    return advice


def advise(state: BriefingState) -> BriefingState:
    if not state.get("use_llm"):
        return {"advice": rule_based_advice(state), "advice_source": "rules"}
    try:
        from langchain_ollama import ChatOllama

        llm = ChatOllama(model=MODEL, temperature=0)
        prompt = (
            "너는 중소 제조공장의 AI 공장장이다. 아래 MES 데이터만 근거로 오늘 아침 회의용 "
            "'주의 사항과 권고'를 3~5개 항목으로 작성하라.\n"
            "- 각 항목은 한 줄, '문제 → 권고 조치' 형식\n"
            "- 데이터에 없는 숫자를 만들지 말 것. 숫자는 아래 데이터의 값만 그대로 사용할 것\n"
            "- balance가 음수인 품목은 출하 부족이다 (부족 수량 = balance의 절댓값)\n"
            "- 항목 앞에 기호를 붙이지 말고 한 줄에 하나씩만 출력\n\n"
            f"[품목별 금일 계획]\n{state['items']}\n\n"
            f"[자재 입고 위험]\n{state['facts']['material_risks']}\n\n"
            f"[설비 이상 징후]\n{state['facts']['equipment_signals']}\n"
        )
        text = llm.invoke(prompt).content
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)  # 추론 모델의 사고 과정 제거
        lines = [ln.strip(" -*•\t") for ln in text.splitlines() if ln.strip(" -*•\t")]
        return {"advice": lines, "advice_source": "llm"}
    except Exception as exc:  # Ollama 미기동 등 → 백업 모드로 전환
        return {"advice": rule_based_advice(state), "advice_source": f"rules (LLM 호출 실패: {type(exc).__name__})"}


# ── 4. verify: LLM 문장 속 숫자가 MES 데이터에 있는지 검증 ───────────────
def _numbers(text: str) -> set[int]:
    return {int(n.replace(",", "")) for n in re.findall(r"\d[\d,]*", text)}


def verify(state: BriefingState) -> BriefingState:
    if state.get("advice_source") != "llm":
        return {}
    allowed = _numbers(str(state["facts"])) | _numbers(str(state["items"]))
    allowed |= {abs(it["balance"]) for it in state["items"]}
    unknown = _numbers(" ".join(state["advice"])) - allowed
    if unknown:  # 근거 없는 수치 → LLM 결과를 버리고 규칙 기반으로 대체
        return {"advice": rule_based_advice(state), "advice_source": f"rules (LLM 검증 실패: 근거 없는 수치 {sorted(unknown)})"}
    return {}


# ── 5. render: 브리핑 출력 (표의 숫자는 모두 MES 조회·계산 결과) ─────────
def _pct(actual: int, plan: int) -> str:
    return f"{actual / plan * 100:.1f}%" if plan else "-"


def render(state: BriefingState) -> BriefingState:
    f, items = state["facts"], state["items"]
    d = date.fromisoformat(state["today"])
    y = date.fromisoformat(state["yesterday"])
    prod, ship = f["production_yesterday"], f["shipment_yesterday"]

    lines = [
        f"📋 {d.month}월 {d.day}일({WEEKDAYS[d.weekday()]}) 아침 브리핑 — AI 공장장, 07:00 기준",
        "",
        f"1. 전일 실적 ({y.month}/{y.day})",
        f"   {'구분':<6}{'계획':>10}{'실적':>10}{'달성률':>10}",
        f"   {'생산':<6}{prod['plan']:>10,}{prod['actual']:>10,}{_pct(prod['actual'], prod['plan']):>10}",
        f"   {'출하':<6}{ship['plan']:>10,}{ship['actual']:>10,}{_pct(ship['actual'], ship['plan']):>10}",
        "",
        f"2. 금일 계획 ({d.month}/{d.day})",
        f"   {'품목':<14}{'생산계획':>9}{'출하예정':>9}{'완제품재고':>9}   출하 충족",
    ]
    for it in items:
        status = f"✅ 여유 {it['balance']:,}" if it["balance"] >= 0 else f"⚠️ 부족 {-it['balance']:,}"
        name = f"{it['item_code']} ({it['process']})"
        lines.append(
            f"   {name:<14}{it['production_plan']:>9,}{it['shipment_plan']:>9,}{it['fg_inventory']:>9,}   {status}"
        )
    total_prod = sum(it["production_plan"] for it in items)
    total_ship = sum(it["shipment_plan"] for it in items)
    lines += [f"   {'합계':<14}{total_prod:>9,}{total_ship:>9,}", "", "3. 주의 사항"]
    lines += [f"   ⚠️ {a}" for a in state["advice"]]
    lines += [
        "",
        f"* 수치 출처: MES (작업지시, 작업실적, 출하계획, 출하실적, 완제품 재고 {f['inventory_as_of']} 기준)",
        f"* 주의 사항 작성: {state['advice_source']}" + (f" / 모델 {MODEL}" if state["advice_source"] == "llm" else ""),
    ]
    return {"report": "\n".join(lines)}


def build_graph():
    g = StateGraph(BriefingState)
    for name, fn in [("collect", collect), ("analyze", analyze), ("advise", advise),
                     ("verify", verify), ("render", render)]:
        g.add_node(name, fn)
    g.add_edge(START, "collect")
    g.add_edge("collect", "analyze")
    g.add_edge("analyze", "advise")
    g.add_edge("advise", "verify")
    g.add_edge("verify", "render")
    g.add_edge("render", END)
    return g.compile()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI 공장장 아침 브리핑 데모")
    parser.add_argument("--no-llm", action="store_true", help="LLM 없이 규칙 기반으로 작성 (백업 모드)")
    args = parser.parse_args()

    if not mes_tools.DB_PATH.exists():
        raise SystemExit("mes.db가 없습니다. 먼저 `python seed_mes.py`를 실행하세요.")
    result = build_graph().invoke({"today": TODAY, "use_llm": not args.no_llm})
    print(result["report"])
