"""AI 공장장 MES 도구 서버 (MCP).

아침 브리핑 데모의 mes_tools.py(읽기 전용 조회)를 MCP 도구로 감싸고, 승인을 거쳐야만 실행되는 '제안' 도구를 더했다.
LangGraph 에이전트, Claude Desktop·Claude Code, 다른 MCP 클라이언트가 같은 도구를 쓴다.

도구 종류
- 조회   get_production_summary, get_shipment_coverage, get_item_detail, get_work_order_sequence,
         get_material_risks, get_equipment_signals
- 계산   get_shipment_coverage 안에서 출하 충족(재고 + 계획 − 출하 예정)을 코드로 계산
- 지식   search_knowledge (rag-indexer 데모의 색인이 있으면 사용)
- 제안   propose_work_order_reorder → 승인 대기열에 올리고 변경 미리보기만 돌려줌 (실행하지 않음)
         get_approval_status, list_pending_approvals
- 승인·실행은 MCP 도구로 노출하지 않는다. 사람이 승인함(approve.py)에서 결정한다.

모든 결과에 출처(source)와 기준 시각(as_of)을 붙인다.

실행:
    python setup_demo.py            # 데모용 MES DB 생성
    python mes_mcp_server.py        # stdio로 MCP 서버 실행 (보통은 MCP 클라이언트가 띄운다)
"""

import os
import sys
from datetime import date, timedelta
from pathlib import Path

try:
    from mcp.server.mcpserver import MCPServer as Server   # mcp 2.x
except ImportError:
    from mcp.server.fastmcp import FastMCP as Server       # mcp 1.x
from mcp.types import ToolAnnotations

import approvals
import mes_api
from mes_api import mes_tools

TODAY = os.environ.get("BRIEFING_DATE", "2026-10-20")
USER = os.environ.get("MES_MCP_USER", "AI 공장장")          # 제안을 올리는 주체 (실제로는 질문한 사용자의 계정)
RAG_DIR = Path(__file__).parent.parent / "rag-indexer"

READ = ToolAnnotations(readOnlyHint=True, idempotentHint=True, openWorldHint=False)
PROPOSE = ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)

server = Server(
    "ai-plant-manager-mes",
    instructions=(
        "중소 제조공장 MES 도구다. 숫자는 반드시 도구 결과만 쓰고, 계산은 도구가 한다. "
        "작업지시 변경 같은 쓰기는 propose_* 도구로 '제안'만 할 수 있고, 실행은 사람이 승인해야 일어난다. "
        "답할 때는 결과의 source와 as_of를 함께 알려라."),
)


def _yesterday(d: str) -> str:
    return (date.fromisoformat(d) - timedelta(days=1)).isoformat()


def _src(source: str, **data) -> dict:
    return {**data, "source": source, "as_of": mes_tools.get_inventory_as_of()}


# ── 조회 ─────────────────────────────────────────────────────────────────
@server.tool(annotations=READ)
def get_production_summary(day: str = "") -> dict:
    """일자별 생산 계획 대비 실적과 출하 계획 대비 실적. day는 YYYY-MM-DD, 비우면 전일."""
    d = day or _yesterday(TODAY)
    return _src("MES 작업지시·작업실적·출하계획·출하실적",
                production=mes_tools.get_production_summary(d), shipment=mes_tools.get_shipment_summary(d))


@server.tool(annotations=READ)
def get_shipment_coverage(day: str = "") -> dict:
    """품목별 출하 충족 여부. balance = 완제품 재고 + 금일 생산 계획 − 출하 예정 (음수면 부족). day를 비우면 오늘."""
    d = day or TODAY
    items = []
    for r in mes_tools.get_today_plan_by_item(d):
        balance = r["fg_inventory"] + r["production_plan"] - r["shipment_plan"]   # 계산은 코드가 한다
        items.append({**r, "balance": balance, "status": "부족" if balance < 0 else "충족"})
    return _src("MES 작업지시·출하계획·완제품 재고", day=d, items=items,
                formula="balance = fg_inventory + production_plan - shipment_plan")


@server.tool(annotations=READ)
def get_item_detail(item_code: str) -> dict:
    """품목 하나의 전일 계획·실적·출하, 금일 계획·출하 예정, 재고, 거래처, 라인. 원인 분석용."""
    d = mes_tools.get_item_detail(item_code.upper(), TODAY, _yesterday(TODAY))
    if d is None:
        return {"error": f"품목 {item_code}가 없습니다", "known_items": mes_tools.list_item_codes()}
    return _src("MES 작업지시·작업실적·출하계획·출하실적·재고", **d)


@server.tool(annotations=READ)
def get_work_order_sequence(line: str, day: str = "") -> dict:
    """라인의 작업지시 순서와 상태(대기·진행·완료). 예: line='조립2라인'."""
    d = day or TODAY
    return _src("MES 작업지시 순서", line=line, day=d, sequence=mes_api.get_work_order_sequence(line, d))


@server.tool(annotations=READ)
def get_material_risks(day: str = "") -> dict:
    """입고 예정 중 확정되지 않은 자재 (납기 회신 미수신 등)."""
    d = day or TODAY
    return _src("MES 자재 입고 예정", day=d, risks=mes_tools.get_material_risks(d))


@server.tool(annotations=READ)
def get_equipment_signals() -> dict:
    """이상 감지 모델이 기록한 설비 이상 징후 (진동 상승 추세 등)."""
    return _src("설비 이상 감지", signals=mes_tools.get_equipment_signals())


# ── 지식 ─────────────────────────────────────────────────────────────────
@server.tool(annotations=READ)
def search_knowledge(query: str, k: int = 3) -> dict:
    """작업표준서·설비 매뉴얼·검사 기준·불량 사례에서 질문과 가까운 원문 조각을 찾는다 (RAG). 출처와 개정판 포함."""
    db = RAG_DIR / "index.db"
    if not db.exists():
        return {"error": "지식 색인이 없습니다. demo/rag-indexer에서 `python indexer.py --offline`을 먼저 실행하세요."}
    sys.path.insert(0, str(RAG_DIR))
    import ragkit
    import search
    hits, model = search.search(query, k=k, con=ragkit.connect(db))
    return {"query": query, "embed_model": model, "source": "지식 색인 (rag-indexer)",
            "hits": [{"title": h["title"], "revision": h["revision"], "heading": h["heading_path"],
                      "text": h["text"], "file": h["source_path"]} for h in hits]}


# ── 제안 (승인 필요) ─────────────────────────────────────────────────────
@server.tool(annotations=PROPOSE)
def propose_work_order_reorder(wo_id: str, new_position: int, reason: str) -> dict:
    """작업지시 순서 변경을 '제안'한다. MES는 바뀌지 않는다.
    변경 미리보기를 만들어 승인 대기열에 올리고 approval_id를 돌려준다. 실행은 사람이 승인해야 일어난다."""
    wo = mes_api.find_work_order(wo_id.upper())
    if wo is None:
        return {"error": f"작업지시 {wo_id}가 없습니다"}
    if wo["status"] != "대기":
        return {"error": f"{wo['wo_id']}는 '{wo['status']}' 상태라 순서를 바꿀 수 없습니다"}
    seq = mes_api.get_work_order_sequence(wo["line"], wo["plan_date"])
    before = [s["wo_id"] for s in seq]
    if not 1 <= new_position <= len(before):
        return {"error": f"new_position은 1~{len(before)} 사이여야 합니다", "sequence": seq}
    after = [w for w in before if w != wo["wo_id"]]
    after.insert(new_position - 1, wo["wo_id"])
    label = {s["wo_id"]: f"{s['wo_id']} ({s['item_code']} {s['plan_qty']:,})" for s in seq}
    preview = {
        "line": wo["line"], "plan_date": wo["plan_date"],
        "before": [label[w] for w in before], "after": [label[w] for w in after],
        "reversible": "작업 시작 전까지 되돌릴 수 있음", "risk": "중 (계획 수량은 그대로, 순서만 변경)",
    }
    ap = approvals.create_request("reorder_work_order", {"wo_id": wo["wo_id"], "new_position": new_position},
                                  preview, snapshot=before, reason=reason, requested_by=USER)
    return {"approval_id": ap["approval_id"], "status": ap["status"], "preview": preview,
            "message": "승인 대기열에 올렸습니다. 담당자가 승인해야 MES에 반영됩니다."}


@server.tool(annotations=READ)
def get_approval_status(approval_id: str) -> dict:
    """제안의 처리 상태 (대기 / 실행됨 / 거절 / 실패)와 결과."""
    ap = approvals.get(approval_id)
    return ap or {"error": f"{approval_id} 요청이 없습니다"}


@server.tool(annotations=READ)
def list_pending_approvals() -> dict:
    """승인을 기다리는 제안 목록."""
    return {"pending": [{"approval_id": a["approval_id"], "kind": a["kind"], "reason": a["reason"],
                         "requested_by": a["requested_by"], "preview": a["preview"]} for a in approvals.list_requests("대기")]}


if __name__ == "__main__":
    if not mes_api.DB_PATH.exists():
        sys.exit("mes.db가 없습니다. 먼저 `python setup_demo.py`를 실행하세요.")
    server.run()   # stdio
