"""가상 MES 쪽 API (데모용): 조회는 morning-briefing의 mes_tools를 그대로 쓰고, 쓰기는 이 파일의 함수만 쓴다.

실제 환경에서 이 파일은 MES 벤더가 제공하는 API에 해당한다. AI 쪽 코드는 MES DB에 직접 쓰지 않는다.

- reorder_work_order: 작업지시 순서 변경 (쓰기 API)
  · request_id로 멱등성 보장: 같은 요청을 두 번 보내도 한 번만 반영
  · 이미 시작된 작업지시는 바꾸지 않음
  · MES 쪽 변경 이력(mes_change_log)을 남김
"""

import json
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "morning-briefing"))
import mes_tools  # noqa: E402  (아침 브리핑 데모의 읽기 전용 조회 도구를 재사용)

DB_PATH = Path(os.environ.get("MES_DB", HERE / "mes.db"))
mes_tools.DB_PATH = DB_PATH          # 조회 도구가 이 데모의 MES DB를 보게 한다


def _connect_rw() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_work_order_sequence(line: str, date: str) -> list[dict]:
    """라인의 작업지시 순서 (읽기 전용)."""
    return mes_tools._query(
        """SELECT s.seq, s.wo_id, w.item_code, w.plan_qty, s.status
           FROM work_order_sequence s JOIN work_orders w ON w.wo_id = s.wo_id
           WHERE s.line = ? AND s.plan_date = ? ORDER BY s.seq""", (line, date))


def find_work_order(wo_id: str) -> dict | None:
    rows = mes_tools._query(
        "SELECT w.wo_id, w.plan_date, w.line, w.item_code, w.plan_qty, s.seq, s.status FROM work_orders w "
        "LEFT JOIN work_order_sequence s ON s.wo_id = w.wo_id WHERE w.wo_id = ?", (wo_id,))
    return rows[0] if rows else None


def reorder_work_order(wo_id: str, new_position: int, request_id: str, requested_by: str) -> dict:
    """작업지시를 같은 라인·일자 안에서 new_position(1부터)으로 옮긴다. (MES 쓰기 API)"""
    with _connect_rw() as conn:
        done = conn.execute("SELECT result FROM mes_change_log WHERE request_id = ?", (request_id,)).fetchone()
        if done:                                            # 멱등성: 이미 처리한 요청이면 그때 결과를 그대로 돌려준다
            return {**json.loads(done["result"]), "idempotent_replay": True}
        wo = conn.execute("SELECT line, plan_date, status FROM work_order_sequence WHERE wo_id = ?", (wo_id,)).fetchone()
        if wo is None:
            raise ValueError(f"작업지시 {wo_id}가 없습니다")
        if wo["status"] != "대기":
            raise ValueError(f"{wo_id}는 이미 '{wo['status']}' 상태라 순서를 바꿀 수 없습니다")
        order = [r["wo_id"] for r in conn.execute(
            "SELECT wo_id FROM work_order_sequence WHERE line = ? AND plan_date = ? ORDER BY seq", (wo["line"], wo["plan_date"]))]
        if not 1 <= new_position <= len(order):
            raise ValueError(f"순서는 1~{len(order)} 사이여야 합니다")
        before = list(order)
        order.remove(wo_id)
        order.insert(new_position - 1, wo_id)
        for i, w in enumerate(order, 1):
            conn.execute("UPDATE work_order_sequence SET seq = ? WHERE wo_id = ?", (i, w))
        result = {"line": wo["line"], "plan_date": wo["plan_date"], "before": before, "after": order}
        conn.execute("INSERT INTO mes_change_log VALUES (?,?,?,?,?)",
                     (request_id, "reorder_work_order", requested_by, datetime.now().isoformat(timespec="seconds"),
                      json.dumps(result, ensure_ascii=False)))
        return result
