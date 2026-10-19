"""AI 공장장에게 묻기 데모: "B-205는 왜 부족해?"

LangGraph 흐름:  identify(품목 파악) → investigate(MES 조회) → analyze(원인 계산) → explain(LLM 설명) → verify(수치 검증) → render

원칙은 briefing.py와 같다.
- 숫자는 MES 조회 도구(mes_tools)와 결정적 계산(analyze)에서만 나온다.
- LLM(Ollama)은 원인을 사람이 읽기 좋게 설명하는 문장만 쓴다.
- LLM 문장에 근거 없는 숫자가 있으면 버리고 규칙 기반 설명으로 대체한다.

실행:
    python seed_mes.py
    python ask.py "B-205는 왜 부족해?"            # Ollama 사용
    python ask.py "B-205는 왜 부족해?" --no-llm   # LLM 없이 규칙 기반 (백업 모드)
    python ask.py "오늘 부족한 품목 있어?"          # 품목을 말하지 않으면 부족 품목 전체를 설명
"""

import argparse
import os
import re
import sys
from datetime import date, timedelta
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

import mes_tools

TODAY = os.environ.get("BRIEFING_DATE", "2026-10-20")
MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:8b")


class AskState(TypedDict, total=False):
    question: str
    use_llm: bool
    item_codes: list[str]
    details: list[dict]      # MES에서 조회한 품목별 원자료
    findings: list[dict]     # 품목별 계산 결과 (부족 수량, 원인 수치)
    explanation: list[str]
    source: str              # "llm" | "rules" | "rules (...)"
    answer: str


# ── 1. identify: 질문에서 품목 코드 파악 (등록된 품목 코드와 대조) ─────────
def identify(state: AskState) -> AskState:
    q = state["question"].upper().replace(" ", "")
    codes = [c for c in mes_tools.list_item_codes() if c.upper() in q or c.upper().replace("-", "") in q]
    return {"item_codes": codes}


# ── 2. investigate: MES 조회 (읽기 전용 도구만 사용) ──────────────────────
def investigate(state: AskState) -> AskState:
    yesterday = (date.fromisoformat(TODAY) - timedelta(days=1)).isoformat()
    codes = state["item_codes"] or mes_tools.list_item_codes()   # 품목을 말하지 않았으면 전체를 살펴봄
    details = [d for c in codes if (d := mes_tools.get_item_detail(c, TODAY, yesterday))]
    return {"details": details}


# ── 3. analyze: 원인 계산 (LLM 아님) ──────────────────────────────────────
def analyze(state: AskState) -> AskState:
    findings = []
    for d in state["details"]:
        balance = d["fg_inventory"] + d["plan_today"] - d["ship_plan_today"]
        findings.append({
            **d,
            "balance": balance,
            "shortage": max(-balance, 0),
            "production_gap_yesterday": d["plan_yesterday"] - d["produced_yesterday"],   # 양수면 전일 생산 미달
            "shipment_increase": d["ship_plan_today"] - d["shipped_yesterday"],          # 양수면 오늘 출하가 더 많음
        })
    if not state["item_codes"]:   # 품목을 지정하지 않은 질문이면 부족한 품목만 남김
        findings = [f for f in findings if f["shortage"] > 0]
    return {"findings": findings}


# ── 4. explain: 원인 설명 (LLM 또는 규칙) ─────────────────────────────────
def rule_based_explanation(state: AskState) -> list[str]:
    lines = []
    if not state["findings"]:
        return ["오늘 출하 예정 대비 부족한 품목은 없습니다."]
    for f in state["findings"]:
        code = f["item_code"]
        if f["shortage"] == 0:
            lines.append(f"{code} 품목은 부족하지 않습니다. 출하 예정 대비 {f['balance']:,}개 여유가 있습니다.")
            continue
        lines.append(f"{code} 출하 부족 {f['shortage']:,}개의 원인은 다음과 같습니다.")
        if f["production_gap_yesterday"] > 0:
            lines.append(f"전일 생산 미달: 계획 {f['plan_yesterday']:,}개 중 {f['produced_yesterday']:,}개만 생산해 "
                         f"{f['production_gap_yesterday']:,}개 미달했고, 그 결과 오늘 아침 재고가 {f['fg_inventory']:,}개입니다.")
        if f["shipment_increase"] > 0:
            lines.append(f"오늘 출하량 증가: {f['customers_today']} 출하 예정이 {f['ship_plan_today']:,}개로 "
                         f"전일 출하({f['shipped_yesterday']:,}개)보다 {f['shipment_increase']:,}개 많습니다.")
        lines.append(f"권고: 오전 중 {f['line']} 우선 투입으로 {f['shortage']:,}개 추가 확보 검토 (생산관리자 확인 필요)")
    return lines


def explain(state: AskState) -> AskState:
    if not state.get("use_llm") or not state["findings"]:
        return {"explanation": rule_based_explanation(state), "source": "rules"}
    try:
        from langchain_ollama import ChatOllama

        llm = ChatOllama(model=MODEL, temperature=0)
        prompt = (
            "너는 중소 제조공장의 AI 공장장이다. 사용자의 질문에 아래 MES 데이터만 근거로 답하라.\n"
            "- 부족(shortage>0)한 품목은 원인을 2~3개 항목으로 설명하고, 마지막 줄에 '권고:'로 시작하는 조치를 한 줄 써라\n"
            "- production_gap_yesterday가 양수면 전일 생산 미달, shipment_increase가 양수면 오늘 출하 증가가 원인이다\n"
            "- 데이터에 없는 숫자를 만들지 말 것. 숫자는 아래 값만 그대로 사용할 것\n"
            "- 권고는 확정이 아니라 생산관리자 확인이 필요한 제안으로 쓸 것\n"
            "- 항목 앞에 기호를 붙이지 말고 한 줄에 하나씩만 출력\n\n"
            f"[질문]\n{state['question']}\n\n[MES 데이터]\n{state['findings']}\n"
        )
        text = llm.invoke(prompt).content
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)   # 추론 모델의 사고 과정 제거
        lines = [ln.strip(" -*•\t") for ln in text.splitlines() if ln.strip(" -*•\t")]
        return {"explanation": lines, "source": "llm"}
    except Exception as exc:   # Ollama 미기동 등 → 백업 모드로 전환
        return {"explanation": rule_based_explanation(state), "source": f"rules (LLM 호출 실패: {type(exc).__name__})"}


# ── 5. verify: LLM 문장 속 숫자가 MES 데이터와 계산 결과에 있는지 검증 ────
def _numbers(text: str) -> set[int]:
    return {int(n.replace(",", "")) for n in re.findall(r"\d[\d,]*", text)}


def verify(state: AskState) -> AskState:
    if state.get("source") != "llm":
        return {}
    allowed = _numbers(str(state["findings"])) | _numbers(state["question"])
    allowed |= {abs(f["balance"]) for f in state["findings"]}
    unknown = _numbers(" ".join(state["explanation"])) - allowed
    if unknown:
        return {"explanation": rule_based_explanation(state),
                "source": f"rules (LLM 검증 실패: 근거 없는 수치 {sorted(unknown)})"}
    return {}


# ── 6. render: 답변 출력 (계산식은 코드가 만든 숫자) ──────────────────────
def render(state: AskState) -> AskState:
    out = [f"❓ {state['question']}", ""]
    out += [f"   {ln}" for ln in state["explanation"]]
    for f in state["findings"]:
        if f["shortage"] > 0:
            out += ["", f"   계산 ({f['item_code']}): 재고 {f['fg_inventory']:,} + 금일 생산 계획 {f['plan_today']:,} "
                        f"- 출하 예정 {f['ship_plan_today']:,} = {f['balance']:,}개"]
    out += [
        "",
        "* 수치 출처: MES (작업지시, 작업실적, 출하계획, 출하실적, 완제품 재고)",
        f"* 설명 작성: {state['source']}" + (f" / 모델 {MODEL}" if state["source"] == "llm" else ""),
    ]
    return {"answer": "\n".join(out)}


def build_graph():
    g = StateGraph(AskState)
    for name, fn in [("identify", identify), ("investigate", investigate), ("analyze", analyze),
                     ("explain", explain), ("verify", verify), ("render", render)]:
        g.add_node(name, fn)
    g.add_edge(START, "identify")
    g.add_edge("identify", "investigate")
    g.add_edge("investigate", "analyze")
    g.add_edge("analyze", "explain")
    g.add_edge("explain", "verify")
    g.add_edge("verify", "render")
    g.add_edge("render", END)
    return g.compile()


if __name__ == "__main__":
    # Windows에서 출력을 파일·파이프로 보낼 때 cp949 인코딩 오류가 나지 않도록 UTF-8로 고정
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="AI 공장장에게 묻기 데모")
    parser.add_argument("question", nargs="?", default="B-205는 왜 부족해?", help="질문 (기본값: B-205는 왜 부족해?)")
    parser.add_argument("--no-llm", action="store_true", help="LLM 없이 규칙 기반으로 답변 (백업 모드)")
    args = parser.parse_args()

    if not mes_tools.DB_PATH.exists():
        raise SystemExit("mes.db가 없습니다. 먼저 `python seed_mes.py`를 실행하세요.")
    result = build_graph().invoke({"question": args.question, "use_llm": not args.no_llm})
    print(result["answer"])
