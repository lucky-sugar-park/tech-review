"""인덱스 검색 데모: 벡터 + BM25 하이브리드 검색, 출처·개정판 표시.

- 질의 임베딩은 인덱스에 기록된 임베딩 모델과 같은 모델을 자동으로 쓴다 (모델이 섞이면 경고)
- 벡터 순위와 BM25 순위를 RRF(Reciprocal Rank Fusion)로 합친다
- 폐기 문서는 인덱서가 청크를 지웠으므로 검색되지 않는다

실행:
    python search.py "3호기 E-217 알람 조치"
    python search.py "B-205 체결 토크" --doc-type 작업표준서
    python search.py "C-310 버 불량 해결 사례" --answer     # Ollama로 출처를 단 답변 생성
"""

import argparse
import json
import math
import sys
from collections import Counter

import ragkit


def bm25_scores(query_tokens, docs_tokens, k1=1.5, b=0.75):
    n = len(docs_tokens)
    avgdl = sum(len(d) for d in docs_tokens) / max(n, 1)
    df = Counter(t for d in docs_tokens for t in set(d))
    scores = []
    for d in docs_tokens:
        tf, s = Counter(d), 0.0
        for t in set(query_tokens):
            if t in tf:
                idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
                s += idf * tf[t] * (k1 + 1) / (tf[t] + k1 * (1 - b + b * len(d) / avgdl))
        scores.append(s)
    return scores


def search(query: str, k: int = 5, doc_type: str | None = None, equipment: str | None = None, con=None) -> tuple[list[dict], str]:
    con = con or ragkit.connect()
    models = [r[0] for r in con.execute("SELECT DISTINCT embed_model FROM documents WHERE n_chunks > 0")]
    if not models:
        raise SystemExit("인덱스가 비어 있습니다. 먼저 `python indexer.py`를 실행하세요.")
    if len(models) > 1:
        print(f"⚠️  인덱스에 임베딩 모델이 섞여 있습니다: {models}. 전체 재색인이 필요합니다.")
    model = models[0]

    sql = ("SELECT c.*, d.title, d.doc_type, d.revision, d.source_path, d.meta AS doc_meta "
           "FROM chunks c JOIN documents d ON c.doc_id = d.doc_id WHERE d.status = '유효'")
    rows = [dict(r) for r in con.execute(sql)]
    if doc_type:
        rows = [r for r in rows if r["doc_type"] == doc_type]
    if equipment:
        rows = [r for r in rows if equipment in json.loads(r["doc_meta"]).get("equipment", "")]
    if not rows:
        return [], model

    qvec = ragkit.embed(con, [query], model)[0]
    con.commit()
    vec_scores = [ragkit.cosine(qvec, json.loads(r["vector"])) for r in rows]
    kw_scores = bm25_scores(ragkit.tokenize(query), [ragkit.tokenize(r["embed_text"]) for r in rows])

    def ranks(scores):
        order = sorted(range(len(scores)), key=lambda i: -scores[i])
        return {i: rank for rank, i in enumerate(order, 1)}

    rv, rk = ranks(vec_scores), ranks(kw_scores)
    for i, r in enumerate(rows):
        r["score"] = 1 / (60 + rv[i]) + 1 / (60 + rk[i])     # RRF
        r["vec_rank"], r["kw_rank"] = rv[i], rk[i]
    return sorted(rows, key=lambda r: -r["score"])[:k], model


def answer(query: str, hits: list[dict]) -> str:
    sources = "\n\n".join(f"[{i}] {h['title']} ({h['revision']}) > {h['heading_path']}\n{h['text']}" for i, h in enumerate(hits, 1))
    prompt = ("너는 중소 제조공장의 지식 도우미다. 아래 문서 조각만 근거로 한국어로 짧게 답하라.\n"
              "- 문장 끝에 근거 번호를 [1]처럼 달 것\n- 문서에 없으면 '문서에서 찾지 못했습니다'라고 답할 것\n\n"
              f"[질문]\n{query}\n\n[문서 조각]\n{sources}\n")
    return ragkit.generate(prompt)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="인덱스 검색 데모")
    ap.add_argument("query")
    ap.add_argument("-k", type=int, default=3, help="결과 개수 (기본 3)")
    ap.add_argument("--doc-type", help="문서 유형 필터 (예: 작업표준서, 설비 매뉴얼, 불량 사례)")
    ap.add_argument("--equipment", help="설비 필터 (예: 3호기)")
    ap.add_argument("--answer", action="store_true", help="Ollama LLM으로 출처를 단 답변 생성")
    args = ap.parse_args()
    try:
        hits, model = search(args.query, args.k, args.doc_type, args.equipment)
        print(f"🔎 {args.query}   (임베딩: {model}, 벡터 + BM25 하이브리드)\n")
        for i, h in enumerate(hits, 1):
            text = h["text"].replace("\n", " ")
            print(f"[{i}] {h['title']} · {h['revision']} · {h['heading_path']}")
            print(f"    {text[:160]}{'…' if len(text) > 160 else ''}")
            print(f"    출처: {h['source_path']}  (벡터 {h['vec_rank']}위, 키워드 {h['kw_rank']}위)\n")
        if args.answer and hits:
            print("💬 " + answer(args.query, hits))
    except ragkit.OllamaUnavailable as exc:
        raise SystemExit(f"❌ {exc}")
