"""데모용 가상 MES 데이터베이스(SQLite)를 만든다.

가상의 중소기업(자동차 부품 사출·조립 2차 협력사)의 하루치 데이터:
- 10/19: 전일 생산·출하 계획과 실적
- 10/20: 금일 작업지시(생산 계획)와 출하 계획
- 07:00 기준 완제품 재고, 자재 입고 예정, 설비 이상 징후
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).with_name("mes.db")

SCHEMA = """
CREATE TABLE items (
    item_code TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    process   TEXT NOT NULL              -- 사출 / 조립
);
CREATE TABLE work_orders (               -- 생산계획·작업지시
    wo_id     TEXT PRIMARY KEY,
    plan_date TEXT NOT NULL,
    line      TEXT NOT NULL,
    item_code TEXT NOT NULL REFERENCES items,
    plan_qty  INTEGER NOT NULL
);
CREATE TABLE production_results (        -- 작업실적(POP)
    result_date TEXT NOT NULL,
    line        TEXT NOT NULL,
    item_code   TEXT NOT NULL REFERENCES items,
    good_qty    INTEGER NOT NULL,
    defect_qty  INTEGER NOT NULL
);
CREATE TABLE shipment_plans (            -- 출하 계획
    ship_date TEXT NOT NULL,
    customer  TEXT NOT NULL,
    item_code TEXT NOT NULL REFERENCES items,
    qty       INTEGER NOT NULL
);
CREATE TABLE shipments (                 -- 출하 실적
    ship_date TEXT NOT NULL,
    customer  TEXT NOT NULL,
    item_code TEXT NOT NULL REFERENCES items,
    qty       INTEGER NOT NULL
);
CREATE TABLE fg_inventory (              -- 완제품 재고 스냅숏
    as_of     TEXT NOT NULL,
    item_code TEXT NOT NULL REFERENCES items,
    qty       INTEGER NOT NULL
);
CREATE TABLE material_receipts (         -- 자재 입고 예정
    expected_date TEXT NOT NULL,
    material      TEXT NOT NULL,
    supplier      TEXT NOT NULL,
    status        TEXT NOT NULL
);
CREATE TABLE equipment_signals (         -- 설비 이상 징후 (이상 감지 모델 결과)
    as_of     TEXT NOT NULL,
    equipment TEXT NOT NULL,
    line      TEXT NOT NULL,
    signal    TEXT NOT NULL,
    trend     TEXT NOT NULL
);
"""

ITEMS = [
    ("A-101", "도어 트림 브래킷", "사출"),
    ("B-205", "센서 하우징 어셈블리", "조립"),
    ("C-310", "커넥터 커버", "사출"),
]

WORK_ORDERS = [
    # 전일 (10/19)
    ("WO-1019-01", "2026-10-19", "사출1라인", "A-101", 5000),
    ("WO-1019-02", "2026-10-19", "조립2라인", "B-205", 3000),
    ("WO-1019-03", "2026-10-19", "사출2라인", "C-310", 4000),
    # 금일 (10/20)
    ("WO-1020-01", "2026-10-20", "사출1라인", "A-101", 5000),
    ("WO-1020-02", "2026-10-20", "조립2라인", "B-205", 3000),
    ("WO-1020-03", "2026-10-20", "사출2라인", "C-310", 4000),
]

PRODUCTION_RESULTS = [
    ("2026-10-19", "사출1라인", "A-101", 4780, 95),
    ("2026-10-19", "조립2라인", "B-205", 2900, 40),
    ("2026-10-19", "사출2라인", "C-310", 3600, 210),
]

SHIPMENT_PLANS = [
    # 전일 (10/19)
    ("2026-10-19", "가온자동차", "A-101", 4500),
    ("2026-10-19", "나래모빌리티", "B-205", 3000),
    ("2026-10-19", "가온자동차", "C-310", 2000),
    # 금일 (10/20)
    ("2026-10-20", "가온자동차", "A-101", 4800),
    ("2026-10-20", "나래모빌리티", "B-205", 3500),
    ("2026-10-20", "가온자동차", "C-310", 2000),
]

SHIPMENTS = [
    ("2026-10-19", "가온자동차", "A-101", 4500),
    ("2026-10-19", "나래모빌리티", "B-205", 3000),
    ("2026-10-19", "가온자동차", "C-310", 2000),
]

FG_INVENTORY = [
    ("2026-10-20 07:00", "A-101", 1200),
    ("2026-10-20 07:00", "B-205", 300),
    ("2026-10-20 07:00", "C-310", 2500),
]

MATERIAL_RECEIPTS = [
    ("2026-10-20", "자재 A (PP 수지)", "다온케미칼", "납기 회신 미수신"),
    ("2026-10-20", "자재 B (커넥터 핀)", "라온부품", "입고 확정"),
]

EQUIPMENT_SIGNALS = [
    ("2026-10-20 06:50", "3호기 사출기", "사출2라인", "진동", "최근 3일 상승 추세"),
]


def seed(db_path: Path = DB_PATH) -> Path:
    db_path.unlink(missing_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.executescript(SCHEMA)
        conn.executemany("INSERT INTO items VALUES (?,?,?)", ITEMS)
        conn.executemany("INSERT INTO work_orders VALUES (?,?,?,?,?)", WORK_ORDERS)
        conn.executemany("INSERT INTO production_results VALUES (?,?,?,?,?)", PRODUCTION_RESULTS)
        conn.executemany("INSERT INTO shipment_plans VALUES (?,?,?,?)", SHIPMENT_PLANS)
        conn.executemany("INSERT INTO shipments VALUES (?,?,?,?)", SHIPMENTS)
        conn.executemany("INSERT INTO fg_inventory VALUES (?,?,?)", FG_INVENTORY)
        conn.executemany("INSERT INTO material_receipts VALUES (?,?,?,?)", MATERIAL_RECEIPTS)
        conn.executemany("INSERT INTO equipment_signals VALUES (?,?,?,?,?)", EQUIPMENT_SIGNALS)
    return db_path


if __name__ == "__main__":
    print(f"MES 샘플 DB 생성: {seed()}")
