"""인덱싱 방식별 검색 품질 비교: 같은 원본, 같은 질문으로 네 가지 인덱스를 만들어 적중률을 잰다.

변형 (raw/의 원본 3건을 각각 다른 방식으로 만든 뒤, sources/의 기존 문서 7건을 방해 문서로 함께 넣는다):
    plain      문자열만 뽑아 300자씩 자른 것 (흔한 단순 파이프라인: 구조·메타데이터 없음)
    converted  convert.py로 구조를 살린 md (제목·표·앞머리 메타데이터)
    enriched   converted + enrich.py 보강 (맥락 문장·지시어 풀기·예상 질문·동의어)
    gold       Claude가 만든 md (gold/, 비교 기준)

질문: eval/questions.json  {"q": 질문, "expect": [정답 청크에 있어야 할 문자열들]}
지표: Hit@1 (1위 청크에 정답), Hit@3, MRR@5 (정답 순위의 역수 평균)

실행:
    python evaluate.py --offline            # 오프라인 임베딩 + 규칙 기반 보강
    python evaluate.py                      # Ollama 임베딩(bge-m3) + Ollama 보강(qwen3:8b)
    python evaluate.py --offline --detail   # 질문별 순위
"""

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

import convert
import enrich
import indexer
import ragkit
import search

WORK = ragkit.BASE / "workspace" / "eval"
QUESTIONS = ragkit.BASE / "eval" / "questions.json"
GOLD = ragkit.BASE / "gold"
VARIANTS = ["plain", "converted", "enriched", "gold"]
LABEL = {"plain": "단순 추출", "converted": "구조화 md", "enriched": "구조화 + LLM 보강", "gold": "Claude md"}


def plain_text(md: str) -> str:
    """마크다운 표시를 모두 지우고 글자만 남긴 뒤 300자씩 자른다."""
    text = re.sub(r"^---.*?---\s*", "", md, flags=re.S)
    text = re.sub(r"^\|?\s*-{3,}.*$", "", text, flags=re.M)
    text = re.sub(r"[#*|>]|^- ", " ", text, flags=re.M)
    words = " ".join(text.split())
    return "\n\n".join(words[i:i + 300] for i in range(0, len(words), 300))


def build_sources(variant: str, root: Path, engine: str, offline: bool, out) -> Path:
    src = root / "sources"
    shutil.copytree(indexer.SOURCE_DIR, src, ignore=shutil.ignore_patterns("converted", "*.enrich.json"))   # 방해 문서 (공통)
    if variant == "gold":
        shutil.copytree(GOLD, src / "gold")
        return src
    conv = src / "converted"
    convert.run(convert.RAW_DIR, conv, engine="builtin" if variant == "plain" else engine, out=lambda *_: None)
    if variant == "plain":
        for md in conv.rglob("*.md"):
            meta, _ = indexer.parse_front_matter(md.read_text(encoding="utf-8"))
            body = plain_text(md.read_text(encoding="utf-8"))
            md.write_text(f"---\ndoc_id: {meta['doc_id']}\ntitle: {Path(meta['source']).name}\n---\n\n{body}\n", encoding="utf-8")
    if variant == "enriched":
        enrich.run(conv, offline=offline, out=lambda *_: None)
    return src


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).lower()


def evaluate(variant: str, questions: list[dict], embed_model: str, engine: str, offline: bool, k: int = 5) -> dict:
    root = WORK / variant
    if root.exists():
        shutil.rmtree(root)
    root.mkdir(parents=True)
    src = build_sources(variant, root, engine, offline, print)
    con = ragkit.connect(root / "index.db")
    indexer.run(src, embed_model, con=con, out=lambda *_: None)
    ranks = []
    for q in questions:
        hits, _ = search.search(q["q"], k=k, con=con)
        rank = next((i for i, h in enumerate(hits, 1) if all(norm(e) in norm(h["text"]) for e in q["expect"])), None)
        ranks.append(rank)
    n = len(questions)
    return {
        "ranks": ranks,
        "hit1": sum(r == 1 for r in ranks) / n,
        "hit3": sum(r is not None and r <= 3 for r in ranks) / n,
        "mrr": sum(1 / r for r in ranks if r) / n,
        "chunks": con.execute("SELECT COUNT(*) FROM chunks").fetchone()[0],
    }


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="인덱싱 방식별 검색 품질 비교")
    ap.add_argument("--offline", action="store_true", help="오프라인 임베딩 + 규칙 기반 보강 (Ollama 없이)")
    ap.add_argument("--engine", default="auto", help="convert.py 변환기 (기본 auto)")
    ap.add_argument("--variants", default=",".join(VARIANTS), help="비교할 변형 (쉼표 구분)")
    ap.add_argument("--detail", action="store_true", help="질문별 순위 출력")
    args = ap.parse_args()
    embed_model = ragkit.OFFLINE_MODEL if args.offline else ragkit.EMBED_MODEL
    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))
    variants = [v.strip() for v in args.variants.split(",")]
    print(f"📏 평가: 질문 {len(questions)}개 · 임베딩 {embed_model} · 보강 {'rules' if args.offline else ragkit.LLM_MODEL}\n")
    results = {}
    try:
        for v in variants:
            results[v] = evaluate(v, questions, embed_model, args.engine, args.offline)
    except ragkit.OllamaUnavailable as exc:
        raise SystemExit(f"❌ {exc} (Ollama 없이 해 보려면 --offline)")

    def cell(text, width):   # 한글은 화면에서 두 칸을 차지하므로 폭을 보정한다
        return text + " " * max(1, width - sum(2 if ord(ch) > 0x3000 else 1 for ch in text))

    print(cell("방식", 34) + f"{'Hit@1':>7}{'Hit@3':>7}{'MRR@5':>7}{'청크':>6}")
    for v, r in results.items():
        print(cell(f"{v} ({LABEL[v]})", 34) + f"{r['hit1']:>7.0%}{r['hit3']:>7.0%}{r['mrr']:>7.2f}{r['chunks']:>6}")
    if args.detail:
        print("\n질문별 정답 순위 (- = 5위 안에 없음)")
        for i, q in enumerate(questions):
            cells = "  ".join(f"{v[:4]}:{results[v]['ranks'][i] or '-'}" for v in results)
            print(f"  {cells}   {q['q']}")


if __name__ == "__main__":
    main()
