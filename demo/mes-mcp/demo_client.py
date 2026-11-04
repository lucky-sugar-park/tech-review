"""MCP 클라이언트 데모 (LLM 없이): 에이전트가 하는 일을 순서대로 직접 호출해 본다.

1. 서버에 연결해 도구 목록을 본다 (읽기 전용 / 제안 구분)
2. 조회·계산 도구로 B-205 출하 부족을 확인한다
3. 작업지시 순서 변경을 '제안'한다 → MES는 그대로
4. 사람이 승인함에서 승인한다 → 그때 MES가 바뀐다
5. 같은 승인을 다시 눌러도 두 번 실행되지 않는다

실행:
    python setup_demo.py
    python demo_client.py
"""

import asyncio
import json
import sys
from pathlib import Path

from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

import approvals

SERVER = StdioServerParameters(command=sys.executable, args=[str(Path(__file__).with_name("mes_mcp_server.py"))])


def payload(result) -> dict:
    """도구 결과(텍스트 JSON)를 dict로 바꾼다. mcp 1.x·2.x 공통."""
    return json.loads(result.content[0].text)


async def main():
    async with stdio_client(SERVER) as (r, w), ClientSession(r, w) as s:
        await s.initialize()

        print("━━ 1. 도구 목록")
        for t in (await s.list_tools()).tools:
            ann = t.annotations
            ro = ann and (getattr(ann, "read_only_hint", None) or getattr(ann, "readOnlyHint", None))   # mcp 2.x / 1.x
            print(f"  {'🔍 읽기' if ro else '✋ 제안'}  {t.name:<28} {t.description.splitlines()[0][:60]}")

        print("\n━━ 2. 조회·계산: 오늘 출하 충족")
        cov = payload(await s.call_tool("get_shipment_coverage", {}))
        for it in cov["items"]:
            print(f"  {it['item_code']}  재고 {it['fg_inventory']:>5,} + 계획 {it['production_plan']:>5,} - 출하 {it['shipment_plan']:>5,}"
                  f" = {it['balance']:>6,}  {it['status']}")
        print(f"  출처: {cov['source']} · 기준 {cov['as_of']}")
        seq = payload(await s.call_tool("get_work_order_sequence", {"line": "조립2라인"}))
        print("  조립2라인 순서: " + " → ".join(f"{x['seq']}. {x['wo_id']}({x['item_code']})" for x in seq["sequence"]))

        print("\n━━ 3. 제안: B-205 작업지시를 1순위로 (MES는 아직 그대로)")
        prop = payload(await s.call_tool("propose_work_order_reorder",
                                         {"wo_id": "WO-1020-02", "new_position": 1, "reason": "B-205 출하 200개 부족 예상"}))
        print(f"  {prop['approval_id']} · {prop['status']} · {prop['message']}")
        print("  변경 후 (미리보기): " + " → ".join(prop["preview"]["after"]))
        seq = payload(await s.call_tool("get_work_order_sequence", {"line": "조립2라인"}))
        print("  현재 MES 순서: " + " → ".join(x["wo_id"] for x in seq["sequence"]) + "   ← 바뀌지 않음")

        print("\n━━ 4. 사람이 승인함에서 승인 (approve.py와 같은 동작)")
        done = approvals.decide(prop["approval_id"], approver="생산관리자 이OO", approve=True)
        print(f"  {done['approval_id']} · {done['status']} · 결정 {done['decided_by']}")
        seq = payload(await s.call_tool("get_work_order_sequence", {"line": "조립2라인"}))
        print("  현재 MES 순서: " + " → ".join(f"{x['seq']}. {x['wo_id']}({x['item_code']})" for x in seq["sequence"]) + "   ← 반영됨")

        print("\n━━ 5. 같은 승인을 다시 누르면?")
        again = approvals.decide(prop["approval_id"], approver="생산관리자 이OO", approve=True)
        print(f"  {again['message']}")
        st = payload(await s.call_tool("get_approval_status", {"approval_id": prop["approval_id"]}))
        print(f"  AI가 상태 조회: {st['status']} · before {st['result']['before']} → after {st['result']['after']}")

        print("\n━━ 감사 로그")
        for a in approvals.audit_log():
            print(f"  {a['at']}  {a['actor']:<12} {a['action']:<10} {a['approval_id']}")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main())
