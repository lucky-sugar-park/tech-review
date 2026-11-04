"""승인 대기열 (AI 서비스 쪽 저장소): AI는 '제안'만 올리고, 사람이 승인해야 MES 쓰기 API가 실행된다.

- create_request: 제안 등록 (MCP 도구 propose_*가 호출). 실행 시점 비교용으로 현재 상태 스냅숏을 함께 저장
- decide: 사람의 승인·거절 (approve.py = 승인함 화면). MCP 도구로는 노출하지 않는다
  · 승인 시 스냅숏과 지금 MES 상태가 같은지 확인 (제안 이후 누가 바꿨으면 실행하지 않음)
  · approval_id를 MES API의 request_id로 써서 멱등성 보장
- 모든 단계를 audit_log에 남긴다 (누가, 언제, 무엇을, 왜)
"""

import json
import sqlite3
from datetime import datetime
from pathlib import Path

import mes_api

DB_PATH = mes_api.HERE / "approvals.db"
SCHEMA = """
CREATE TABLE IF NOT EXISTS approvals (
    approval_id TEXT PRIMARY KEY, kind TEXT, payload TEXT, preview TEXT, snapshot TEXT,
    reason TEXT, requested_by TEXT, requested_at TEXT,
    status TEXT,                     -- 대기 / 실행됨 / 거절 / 실패
    decided_by TEXT, decided_at TEXT, decision_note TEXT, result TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
    at TEXT, actor TEXT, action TEXT, approval_id TEXT, detail TEXT
);
"""


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _audit(conn, actor: str, action: str, approval_id: str, detail: dict) -> None:
    conn.execute("INSERT INTO audit_log VALUES (?,?,?,?,?)", (_now(), actor, action, approval_id, json.dumps(detail, ensure_ascii=False)))


def create_request(kind: str, payload: dict, preview: dict, snapshot: list, reason: str, requested_by: str) -> dict:
    with _conn() as conn:
        n = conn.execute("SELECT COUNT(*) FROM approvals").fetchone()[0] + 1
        approval_id = f"AP-{datetime.now():%m%d}-{n:03d}"
        conn.execute("INSERT INTO approvals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", (
            approval_id, kind, json.dumps(payload, ensure_ascii=False), json.dumps(preview, ensure_ascii=False),
            json.dumps(snapshot, ensure_ascii=False), reason, requested_by, _now(), "대기", None, None, None, None))
        _audit(conn, requested_by, "제안", approval_id, {"kind": kind, "payload": payload, "reason": reason})
    return get(approval_id)


def get(approval_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM approvals WHERE approval_id = ?", (approval_id,)).fetchone()
    if row is None:
        return None
    d = dict(row)
    for k in ("payload", "preview", "snapshot", "result"):
        d[k] = json.loads(d[k]) if d[k] else None
    return d


def list_requests(status: str | None = None) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute("SELECT approval_id FROM approvals" + (" WHERE status = ?" if status else "") + " ORDER BY requested_at",
                            (status,) if status else ()).fetchall()
    return [get(r["approval_id"]) for r in rows]


def decide(approval_id: str, approver: str, approve: bool, note: str = "") -> dict:
    """사람의 결정. 승인이면 MES 쓰기 API를 실행한다."""
    ap = get(approval_id)
    if ap is None:
        raise ValueError(f"{approval_id} 요청이 없습니다")
    if ap["status"] != "대기":
        return {**ap, "message": f"이미 '{ap['status']}' 처리된 요청입니다"}
    with _conn() as conn:
        if not approve:
            conn.execute("UPDATE approvals SET status='거절', decided_by=?, decided_at=?, decision_note=? WHERE approval_id=?",
                         (approver, _now(), note, approval_id))
            _audit(conn, approver, "거절", approval_id, {"note": note})
            return get(approval_id)
        p = ap["payload"]
        current = [r["wo_id"] for r in mes_api.get_work_order_sequence(ap["preview"]["line"], ap["preview"]["plan_date"])]
        if current != ap["snapshot"]:                          # 제안 이후 다른 변경이 있었으면 실행하지 않는다
            status, result = "실패", {"error": "제안 이후 작업지시 순서가 바뀌어 실행하지 않았습니다. 다시 제안이 필요합니다.",
                                      "snapshot": ap["snapshot"], "current": current}
        else:
            try:
                result = mes_api.reorder_work_order(p["wo_id"], p["new_position"], request_id=approval_id, requested_by=approver)
                status = "실행됨"
            except ValueError as exc:
                status, result = "실패", {"error": str(exc)}
        conn.execute("UPDATE approvals SET status=?, decided_by=?, decided_at=?, decision_note=?, result=? WHERE approval_id=?",
                     (status, approver, _now(), note, json.dumps(result, ensure_ascii=False), approval_id))
        _audit(conn, approver, "승인 → " + status, approval_id, result)
    return get(approval_id)


def audit_log() -> list[dict]:
    with _conn() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log ORDER BY rowid")]
