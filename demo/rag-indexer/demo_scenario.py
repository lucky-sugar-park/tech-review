"""증분 인덱싱 시나리오 데모: 문서가 바뀔 때 인덱스가 어떻게 따라가는지 순서대로 보여준다.

sources/를 workspace/로 복사해서 작업하므로 원본 샘플은 바뀌지 않는다.

실행:
    python demo_scenario.py --offline          # Ollama 없이 (강의장 백업)
    python demo_scenario.py                    # Ollama 임베딩 (bge-m3)
    python demo_scenario.py --offline --pause  # 단계마다 Enter를 눌러 진행
"""

import argparse
import shutil
import sys
from pathlib import Path

import indexer
import ragkit
import search

WORK = ragkit.BASE / "workspace"


def show_search(con, query, **kw):
    hits, _ = search.search(query, k=2, con=con, **kw)
    print(f"  🔎 \"{query}\"")
    for h in hits:
        print(f"     → {h['title']} · {h['revision']} · {h['heading_path']}")
        print(f"       {h['text'].replace(chr(10), ' ')[:110]}")


def edit(path: Path, old: str, new: str):
    text = path.read_text(encoding="utf-8")
    assert old in text, f"{path}: '{old}'를 찾지 못함"
    path.write_text(text.replace(old, new), encoding="utf-8")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="증분 인덱싱 시나리오 데모")
    ap.add_argument("--offline", action="store_true", help="Ollama 없이 오프라인 해시 임베딩 사용")
    ap.add_argument("--pause", action="store_true", help="단계마다 Enter를 눌러 진행")
    args = ap.parse_args()
    model = ragkit.OFFLINE_MODEL if args.offline else ragkit.EMBED_MODEL

    if WORK.exists():
        shutil.rmtree(WORK)
    src = WORK / "sources"
    shutil.copytree(indexer.SOURCE_DIR, src, ignore=shutil.ignore_patterns("converted"))   # 변환본은 제외 (샘플 7건 기준)
    con = ragkit.connect(WORK / "index.db")

    def step(n, title):
        if args.pause and n > 1:
            input("\n  (Enter를 누르면 다음 단계)")
        print(f"\n━━ {n}. {title} " + "━" * max(0, 50 - len(title)))

    def index(**kw):
        return indexer.run(src, model, con=con, out=print, **kw)

    try:
        step(1, "처음 색인: 모든 문서를 변환·청킹·임베딩")
        index()
        show_search(con, "B-205 볼트 체결 토크")

        step(2, "다시 실행: 바뀐 것이 없으면 아무것도 하지 않는다")
        index()

        step(3, "작업표준서 개정 (Rev.3 → Rev.4, 체결 토크 9.0 → 9.5 N·m)")
        wi = src / "standards" / "wi-assy2-b205.md"
        edit(wi, "revision: Rev.3", "revision: Rev.4")
        for old in ("체결 토크는 9.0 N·m이다", "설정값을 9.0 N·m로", "9.0 ± 0.5 N·m"):
            edit(wi, old, old.replace("9.0", "9.5"))
        index()
        show_search(con, "B-205 볼트 체결 토크")

        step(4, "DB에 불량 사례 1건 추가 (행 1건 = 문서 1건)")
        with open(src / "db" / "defect_cases.csv", "a", encoding="utf-8") as f:
            f.write("DC-1028,2026-10-28,사출2라인,3호기,C-310,흑점,외관면 흑점 0.5 mm,"
                    "실린더 히터 단선(E-217)으로 수지 체류 탄화,히터 교체 및 실린더 퍼징,불량 해소,2026-10-29\n")
        index()
        show_search(con, "3호기 흑점 불량 원인", doc_type="불량 사례")

        step(5, "검사 기준서 폐기: 원본은 남지만 검색에서는 빠진다")
        edit(src / "quality" / "inspection-c310.md", "status: 유효", "status: 폐기")
        index()
        show_search(con, "C-310 버 합격 기준")

        step(6, "MES 매뉴얼 파일 삭제: 원천에서 사라진 문서는 인덱스에서도 삭제")
        (src / "manuals" / "mes-user-manual.md").unlink()
        index()

        step(7, "청킹 규칙을 바꾸면? (dry-run: 계획만)")
        indexer.CHUNKER_VERSION = "md-heading-v2"
        index(dry_run=True)
        print("  → 설정이 바뀐 문서는 모두 다시 색인해야 한다. 운영에서는 새 인덱스를 옆에 만들고 전환한다 (README 참고)")
    except ragkit.OllamaUnavailable as exc:
        raise SystemExit(f"❌ {exc}")

    print("\n실행 이력 (runs 테이블):")
    for r in con.execute("SELECT run_id, added, updated, skipped, withdrawn, removed FROM runs"):
        print(f"  #{r['run_id']}: 추가 {r['added']} · 갱신 {r['updated']} · 유지 {r['skipped']} · 폐기 {r['withdrawn']} · 삭제 {r['removed']}")


if __name__ == "__main__":
    main()
