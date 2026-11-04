"""승인함 (사람이 쓰는 창구): AI가 올린 제안을 보고 승인·거절한다. 실제로는 공장장실 웹의 승인함 화면이다.

이 기능은 MCP 도구로 노출하지 않는다. AI는 제안만 할 수 있고, 결정은 사람이 한다.

실행:
    python approve.py list                         # 승인 대기 목록
    python approve.py show AP-1104-001             # 제안 상세 (변경 미리보기)
    python approve.py approve AP-1104-001 --by 이OO
    python approve.py reject AP-1104-001 --by 이OO --note "라인 사정"
    python approve.py audit                        # 감사 로그
"""

import argparse
import json
import sys

import approvals


def show(ap: dict) -> None:
    p = ap["preview"] or {}
    print(f"[{ap['approval_id']}] {ap['status']} · {ap['kind']} · 요청 {ap['requested_by']} {ap['requested_at']}")
    print(f"  이유: {ap['reason']}")
    if p:
        print(f"  {p['line']} {p['plan_date']}")
        print("  변경 전: " + " → ".join(p["before"]))
        print("  변경 후: " + " → ".join(p["after"]))
        print(f"  되돌리기: {p['reversible']} · 위험: {p['risk']}")
    if ap.get("decided_by"):
        print(f"  결정: {ap['decided_by']} {ap['decided_at']} {ap.get('decision_note') or ''}")
    if ap.get("result"):
        print("  결과: " + json.dumps(ap["result"], ensure_ascii=False))
    if ap.get("message"):
        print("  ※ " + ap["message"])


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="승인함 (사람용)")
    ap.add_argument("cmd", choices=["list", "show", "approve", "reject", "audit"])
    ap.add_argument("approval_id", nargs="?")
    ap.add_argument("--by", default="생산관리자")
    ap.add_argument("--note", default="")
    a = ap.parse_args()
    if a.cmd == "list":
        pending = approvals.list_requests("대기")
        print(f"승인 대기 {len(pending)}건")
        for r in pending:
            show(r)
    elif a.cmd == "audit":
        for r in approvals.audit_log():
            print(f"{r['at']}  {r['actor']:<10} {r['action']:<10} {r['approval_id']}  {r['detail']}")
    else:
        if not a.approval_id:
            sys.exit("approval_id가 필요합니다")
        if a.cmd == "show":
            r = approvals.get(a.approval_id)
        else:
            r = approvals.decide(a.approval_id, a.by, approve=(a.cmd == "approve"), note=a.note)
        show(r) if r else sys.exit(f"{a.approval_id} 요청이 없습니다")
