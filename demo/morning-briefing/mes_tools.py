"""MES 조회 도구 (읽기 전용).

AI 공장장이 쓰는 '숫자의 출처'. 모든 집계는 여기서 SQL로 계산하고,
LLM은 이 결과를 해석·요약만 한다.
실제 환경에서는 이 함수들을 MES 조회 API나 MCP 서버로 노출하면 된다.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).with_name("mes.db")


def _query(sql: str, params: tuple = ()) -> list[dict]:
    # mode=ro: 읽기 전용으로 연결해서 AI가 MES 데이터를 바꿀 수 없게 한다
    uri = f"file:{DB_PATH}?mode=ro"
    with sqlite3.connect(uri, uri=True) as conn:
        conn.row_factory = sqlite3.Row
        return [dict(r) for r in conn.execute(sql, params)]


def get_production_summary(date: str) -> dict:
    """해당 일자의 생산 계획 대비 실적 (작업지시 + 작업실적)."""
    plan = _query("SELECT COALESCE(SUM(plan_qty), 0) AS q FROM work_orders WHERE plan_date = ?", (date,))[0]["q"]
    actual = _query("SELECT COALESCE(SUM(good_qty), 0) AS q FROM production_results WHERE result_date = ?", (date,))[0]["q"]
    return {"date": date, "plan": plan, "actual": actual}


def get_shipment_summary(date: str) -> dict:
    """해당 일자의 출하 계획 대비 실적 (출하 계획 + 출하 실적)."""
    plan = _query("SELECT COALESCE(SUM(qty), 0) AS q FROM shipment_plans WHERE ship_date = ?", (date,))[0]["q"]
    actual = _query("SELECT COALESCE(SUM(qty), 0) AS q FROM shipments WHERE ship_date = ?", (date,))[0]["q"]
    return {"date": date, "plan": plan, "actual": actual}


def get_today_plan_by_item(date: str) -> list[dict]:
    """품목별 금일 생산 계획, 출하 예정, 완제품 재고 (작업지시 + 출하 계획 + 재고)."""
    return _query(
        """
        SELECT i.item_code, i.item_name, i.process,
               COALESCE((SELECT SUM(plan_qty) FROM work_orders w
                         WHERE w.item_code = i.item_code AND w.plan_date = ?), 0) AS production_plan,
               COALESCE((SELECT GROUP_CONCAT(DISTINCT line) FROM work_orders w
                         WHERE w.item_code = i.item_code AND w.plan_date = ?), '') AS line,
               COALESCE((SELECT SUM(qty) FROM shipment_plans s
                         WHERE s.item_code = i.item_code AND s.ship_date = ?), 0) AS shipment_plan,
               COALESCE((SELECT qty FROM fg_inventory f
                         WHERE f.item_code = i.item_code ORDER BY as_of DESC LIMIT 1), 0) AS fg_inventory
        FROM items i
        ORDER BY i.item_code
        """,
        (date, date, date),
    )


def get_inventory_as_of() -> str:
    """완제품 재고 스냅숏의 기준 시각."""
    return _query("SELECT MAX(as_of) AS t FROM fg_inventory")[0]["t"]


def get_material_risks(date: str) -> list[dict]:
    """금일 입고 예정 중 확정되지 않은 자재."""
    return _query(
        "SELECT material, supplier, status FROM material_receipts WHERE expected_date = ? AND status != '입고 확정'",
        (date,),
    )


def get_equipment_signals() -> list[dict]:
    """이상 감지 모델이 기록한 설비 이상 징후."""
    return _query("SELECT equipment, line, signal, trend, as_of FROM equipment_signals")


def get_item_detail(item_code: str, today: str, yesterday: str) -> dict | None:
    """품목 하나의 전일 실적·출하, 금일 계획·출하 예정, 재고를 모아 조회 (원인 분석용)."""
    item = _query("SELECT item_code, item_name, process FROM items WHERE item_code = ?", (item_code,))
    if not item:
        return None

    def one(sql: str, params: tuple) -> int:
        return _query(sql, params)[0]["q"]

    return {
        **item[0],
        "line": _query("SELECT COALESCE(GROUP_CONCAT(DISTINCT line), '') AS l FROM work_orders "
                       "WHERE item_code = ? AND plan_date = ?", (item_code, today))[0]["l"],
        "yesterday": yesterday,
        "today": today,
        "plan_yesterday": one("SELECT COALESCE(SUM(plan_qty), 0) AS q FROM work_orders WHERE item_code = ? AND plan_date = ?", (item_code, yesterday)),
        "produced_yesterday": one("SELECT COALESCE(SUM(good_qty), 0) AS q FROM production_results WHERE item_code = ? AND result_date = ?", (item_code, yesterday)),
        "defects_yesterday": one("SELECT COALESCE(SUM(defect_qty), 0) AS q FROM production_results WHERE item_code = ? AND result_date = ?", (item_code, yesterday)),
        "shipped_yesterday": one("SELECT COALESCE(SUM(qty), 0) AS q FROM shipments WHERE item_code = ? AND ship_date = ?", (item_code, yesterday)),
        "plan_today": one("SELECT COALESCE(SUM(plan_qty), 0) AS q FROM work_orders WHERE item_code = ? AND plan_date = ?", (item_code, today)),
        "ship_plan_today": one("SELECT COALESCE(SUM(qty), 0) AS q FROM shipment_plans WHERE item_code = ? AND ship_date = ?", (item_code, today)),
        "customers_today": _query("SELECT COALESCE(GROUP_CONCAT(DISTINCT customer), '') AS c FROM shipment_plans "
                                  "WHERE item_code = ? AND ship_date = ?", (item_code, today))[0]["c"],
        "fg_inventory": one("SELECT COALESCE((SELECT qty FROM fg_inventory WHERE item_code = ? ORDER BY as_of DESC LIMIT 1), 0) AS q", (item_code,)),
    }


def list_item_codes() -> list[str]:
    """등록된 품목 코드 목록."""
    return [r["item_code"] for r in _query("SELECT item_code FROM items ORDER BY item_code")]
