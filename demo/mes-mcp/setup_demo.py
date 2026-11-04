"""MCP 데모용 가상 MES DB를 만든다.

아침 브리핑 데모의 데이터(seed_mes.py)에 다음을 더한다.
- 조립2라인의 두 번째 작업지시 WO-1020-04 (B-207, 시안과 같은 가상 품목)
- 작업지시 순서표 work_order_sequence: 라인별 작업 순서와 상태 (MES 쓰기 API가 바꾸는 대상)
- MES 쪽 변경 이력 mes_change_log
승인 대기열(approvals.db)은 AI 서비스 쪽 저장소라 따로 둔다 (approvals.py가 처음 쓸 때 만든다).
"""

import sqlite3
import sys
from pathlib import Path

import mes_api

sys.path.insert(0, str(Path(__file__).parent.parent / "morning-briefing"))
import seed_mes  # noqa: E402


def setup() -> Path:
    seed_mes.seed(mes_api.DB_PATH)
    with sqlite3.connect(mes_api.DB_PATH) as conn:
        conn.executescript("""
            CREATE TABLE work_order_sequence (
                wo_id TEXT PRIMARY KEY REFERENCES work_orders, line TEXT NOT NULL, plan_date TEXT NOT NULL,
                seq INTEGER NOT NULL, status TEXT NOT NULL      -- 대기 / 진행 / 완료
            );
            CREATE TABLE mes_change_log (
                request_id TEXT PRIMARY KEY, api TEXT, requested_by TEXT, at TEXT, result TEXT
            );
        """)
        conn.execute("INSERT INTO items VALUES ('B-207', '브래킷 커버 어셈블리', '조립')")
        conn.execute("INSERT INTO work_orders VALUES ('WO-1020-04', '2026-10-20', '조립2라인', 'B-207', 1500)")
        conn.execute("INSERT INTO fg_inventory VALUES ('2026-10-20 07:00', 'B-207', 2000)")
        conn.executemany("INSERT INTO work_order_sequence VALUES (?,?,?,?,?)", [
            ("WO-1019-01", "사출1라인", "2026-10-19", 1, "완료"),
            ("WO-1019-02", "조립2라인", "2026-10-19", 1, "완료"),
            ("WO-1019-03", "사출2라인", "2026-10-19", 1, "완료"),
            ("WO-1020-01", "사출1라인", "2026-10-20", 1, "대기"),
            ("WO-1020-04", "조립2라인", "2026-10-20", 1, "대기"),   # B-207이 먼저
            ("WO-1020-02", "조립2라인", "2026-10-20", 2, "대기"),   # B-205가 두 번째 → 출하 부족 위험
            ("WO-1020-03", "사출2라인", "2026-10-20", 1, "대기"),
        ])
    approvals = Path(mes_api.HERE / "approvals.db")
    approvals.unlink(missing_ok=True)
    return mes_api.DB_PATH


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(f"MCP 데모용 MES DB 생성: {setup()}")
    print("승인 대기열 초기화: approvals.db")
