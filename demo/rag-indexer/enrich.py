"""청크 보강: Ollama LLM으로 검색용 필드를 만들어 원문 옆에 붙인다 ("다시 쓰지 말고, 덧붙인다").

흐름:  md 읽기 → 인덱서와 같은 규칙으로 청킹 → 문서 요약(1회) → 청크마다 보강(구조화 출력) → 숫자 검증 → 옆 파일 저장

- 원문 md는 바꾸지 않는다. 결과는 `문서.md.enrich.json`에 청크 해시별로 저장하고, indexer.py가 읽어 임베딩에 쓴다
- 청크마다 만드는 필드 (JSON 스키마로 강제):
    context     이 청크가 문서에서 어떤 내용인지 한 문장
    standalone  지시어("위 조건", "이 설비")를 풀어 청크만 읽어도 이해되는 요약
    questions   현장 말투의 예상 질문 3~5개
    keywords    키워드와 동의어
- few-shot: examples/enrich_examples.json (Claude가 만든 견본)을 대화 예시로 넣는다
- 용어 사전: glossary.json의 동의어는 규칙으로 덧붙인다 (모델이 빠뜨려도 보장)
- 검증: 생성된 문장 속 숫자가 원문에 없으면 그 필드(질문은 그 질문만)를 버린다
- 증분: 같은 모델·프롬프트 버전으로 이미 만든 청크는 다시 만들지 않는다

실행:
    python enrich.py                  # Ollama (기본 qwen3:8b, OLLAMA_MODEL로 변경)
    python enrich.py --offline        # LLM 없이 규칙 기반 (제목 경로 + 용어 사전), 강의장 백업
    python enrich.py --show           # 만든 결과 일부를 출력
    python enrich.py && python indexer.py
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import indexer
import ragkit

PROMPT_VERSION = "enrich-v1"   # 프롬프트나 스키마를 바꾸면 올린다 → 전체 다시 보강
EXAMPLES = ragkit.BASE / "examples" / "enrich_examples.json"
GLOSSARY = ragkit.BASE / "glossary.json"

DOC_SCHEMA = {
    "type": "object",
    "properties": {"summary": {"type": "string"}, "topics": {"type": "array", "items": {"type": "string"}}},
    "required": ["summary", "topics"],
}
CHUNK_SCHEMA = {
    "type": "object",
    "properties": {
        "context": {"type": "string"},
        "standalone": {"type": "string"},
        "questions": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 5},
        "keywords": {"type": "array", "items": {"type": "string"}, "maxItems": 8},
    },
    "required": ["context", "standalone", "questions", "keywords"],
}
SYSTEM = (
    "너는 중소 제조공장의 문서를 검색용으로 정리하는 도우미다. 주어진 청크만 근거로 JSON을 만든다.\n"
    "- context: 이 청크가 문서 전체에서 어떤 내용인지 한 문장\n"
    "- standalone: '위 조건', '이 설비', '해당 품목' 같은 지시어를 문서 제목·제목 경로의 실제 이름으로 바꿔, "
    "청크만 읽어도 이해되는 1~2문장 요약\n"
    "- questions: 현장 작업자가 실제로 물을 법한 짧은 질문 3~5개 (구어체, 동의어·줄임말 사용)\n"
    "- keywords: 검색에 도움이 되는 키워드와 동의어 최대 8개\n"
    "- 숫자와 단위는 청크에 있는 그대로만 쓴다. 청크에 없는 사실이나 숫자를 만들지 않는다\n"
    "- 모두 한국어로 쓴다"
)


def load_glossary() -> dict:
    data = json.loads(GLOSSARY.read_text(encoding="utf-8")) if GLOSSARY.exists() else {}
    return {k: v for k, v in data.items() if not k.startswith("_")}


def glossary_terms(text: str, glossary: dict) -> list[str]:
    # 앞에 한글이 붙어 있으면 다른 단어의 일부로 본다 ("커버"의 "버"는 burr가 아님)
    return [syn for term, syns in glossary.items() if re.search(rf"(?<![가-힣]){re.escape(term)}", text) for syn in syns]


def few_shot_messages() -> list[dict]:
    if not EXAMPLES.exists():
        return []
    msgs = []
    for ex in json.loads(EXAMPLES.read_text(encoding="utf-8")):
        msgs.append({"role": "user", "content": chunk_prompt(ex["doc_title"], "", ex["heading"], ex["chunk"])})
        msgs.append({"role": "assistant", "content": json.dumps(ex["output"], ensure_ascii=False)})
    return msgs


def chunk_prompt(title: str, summary: str, heading: str, text: str) -> str:
    return (f"[문서 제목] {title}\n" + (f"[문서 요약] {summary}\n" if summary else "") +
            f"[제목 경로] {heading}\n[청크]\n{text}")


def verify(fields: dict, allowed: set[str]) -> tuple[dict, list[str]]:
    """생성된 문장 속 숫자가 원문에 있는지 확인한다. 없으면 버린다."""
    out, dropped = {}, []
    for key in ("context", "standalone"):
        val = (fields.get(key) or "").strip()
        bad = ragkit.numbers(val) - allowed
        if bad:
            dropped.append(f"{key}: 근거 없는 숫자 {sorted(bad)}")
        elif val:
            out[key] = val
    for key in ("questions", "keywords"):
        keep = []
        for item in fields.get(key) or []:
            bad = ragkit.numbers(item) - allowed
            if bad:
                dropped.append(f"{key} '{item}': 근거 없는 숫자 {sorted(bad)}")
            elif item.strip():
                keep.append(item.strip())
        out[key] = keep
    return out, dropped


def rule_based(doc, c: dict) -> dict:
    """LLM 없이 만들 수 있는 보강: 제목 경로를 문장으로, 설비·품목, 제목의 단어."""
    facets = [v for k, v in doc.meta.items() if k in ("equipment", "item", "process", "line")]
    heading_words = [w for w in re.split(r"[\s>()·:]+", c["heading"]) if len(w) > 1 and not re.fullmatch(r"[\d.]+", w)]
    return {"context": f"{doc.title}의 '{c['heading'].split(' > ')[-1]}' 부분이다.",
            "standalone": "", "questions": [], "keywords": list(dict.fromkeys(facets + heading_words))[:8]}


def enrich_file(path: Path, model: str, offline: bool, glossary: dict, shots: list[dict], out=print) -> tuple[int, int]:
    text = path.read_text(encoding="utf-8")
    doc = indexer.doc_from_markdown(path, text, path.name)
    sidecar = path.with_name(path.name + ".enrich.json")
    old = json.loads(sidecar.read_text(encoding="utf-8")) if sidecar.exists() else {}
    engine = "rules" if offline else model
    reuse = old.get("chunks", {}) if old.get("engine") == engine and old.get("prompt_version") == PROMPT_VERSION else {}

    chunks = indexer.chunk(doc)
    todo = [c for c in chunks if ragkit.sha256(c["text"]) not in reuse]
    if not todo and set(reuse) == {ragkit.sha256(c["text"]) for c in chunks}:
        return 0, len(chunks)                                       # 바뀐 청크 없음

    summary = old.get("doc", {}).get("summary", "") if reuse else ""
    if not offline and not summary:                                 # 문서 요약은 1회만
        summary = ragkit.chat_json([{"role": "system", "content": "제조 문서를 한국어 두 문장으로 요약하고 주요 주제어를 뽑아라. 문서에 없는 내용은 쓰지 않는다."},
                                    {"role": "user", "content": f"[문서 제목] {doc.title}\n{doc.body[:4000]}"}],
                                   DOC_SCHEMA, model).get("summary", "")
    allowed = ragkit.numbers(doc.title + " " + doc.body)
    result = {}
    for c in chunks:
        h = ragkit.sha256(c["text"])
        if h in reuse:
            result[h] = reuse[h]
            continue
        if offline:
            fields, dropped = rule_based(doc, c), []
        else:
            msgs = [{"role": "system", "content": SYSTEM}] + shots + [
                {"role": "user", "content": chunk_prompt(doc.title, summary, c["heading"], c["text"])}]
            try:
                fields, dropped = verify(ragkit.chat_json(msgs, CHUNK_SCHEMA, model), allowed)
            except (json.JSONDecodeError, KeyError) as exc:          # 형식 오류 → 규칙 기반으로 대체하고 기록
                fields, dropped = rule_based(doc, c), [f"LLM 출력 오류: {type(exc).__name__}"]
        extra = [t for t in glossary_terms(c["text"] + " " + c["heading"], glossary) if t not in fields["keywords"]]
        fields["keywords"] = fields["keywords"] + extra             # 용어 사전 동의어는 규칙으로 보장
        if dropped:
            fields["dropped"] = dropped
        result[h] = fields
        for d in dropped:
            out(f"     ⚠️  {c['heading'].split(' > ')[-1]}: {d}")
    sidecar.write_text(json.dumps({
        "doc_id": doc.doc_id, "engine": engine, "prompt_version": PROMPT_VERSION,
        "enriched_at": datetime.now().isoformat(timespec="seconds"),
        "doc": {"summary": summary}, "chunks": result,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(todo), len(chunks) - len(todo)


def run(source_dir: Path = indexer.SOURCE_DIR, model: str = ragkit.LLM_MODEL, offline: bool = False,
        out=print) -> dict:
    glossary, shots = load_glossary(), ([] if offline else few_shot_messages())
    totals = {"docs": 0, "made": 0, "reused": 0}
    for path in sorted(source_dir.rglob("*.md")):
        made, reused = enrich_file(path, model, offline, glossary, shots, out)
        totals["docs"] += 1
        totals["made"] += made
        totals["reused"] += reused
        if made:
            out(f"  ✨ 보강  {path.relative_to(source_dir).as_posix()}  (새로 {made} · 재사용 {reused})")
    out(f"  ── 문서 {totals['docs']}건 · 청크 새로 보강 {totals['made']} · 재사용 {totals['reused']}")
    return totals


def show(source_dir: Path, n: int = 3):
    for sidecar in sorted(source_dir.rglob("*.enrich.json"))[:n]:
        data = json.loads(sidecar.read_text(encoding="utf-8"))
        first = next(iter(data["chunks"].values()), {})
        print(f"\n📄 {data['doc_id']}  (엔진: {data['engine']})")
        print(json.dumps(first, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="청크 보강 (Ollama LLM 또는 규칙)")
    ap.add_argument("--source", default=str(indexer.SOURCE_DIR))
    ap.add_argument("--offline", action="store_true", help="LLM 없이 규칙 기반 보강")
    ap.add_argument("--model", default=ragkit.LLM_MODEL, help=f"Ollama 모델 (기본: {ragkit.LLM_MODEL}). 인덱싱은 배치 작업이라 큰 모델을 권장")
    ap.add_argument("--show", action="store_true", help="보강 결과 일부 출력")
    args = ap.parse_args()
    print(f"✨ 보강  {args.source}  (엔진: {'rules' if args.offline else args.model}, 프롬프트: {PROMPT_VERSION})")
    try:
        run(Path(args.source), args.model, args.offline)
    except ragkit.OllamaUnavailable as exc:
        raise SystemExit(f"❌ {exc} (LLM 없이 해 보려면 --offline)")
    if args.show:
        show(Path(args.source))
