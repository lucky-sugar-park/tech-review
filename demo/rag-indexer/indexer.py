"""증분 인덱서 데모: 바뀐 문서만 다시 색인하고, 사라지거나 폐기된 문서는 검색에서 뺀다.

흐름:  scan(원천 읽기) → plan(문서 기록표와 비교) → chunk(유형별 청킹) → enrich(맥락 보강) → embed → store

- 원천: sources/ 아래 md·txt(앞머리에 메타데이터), csv(DB 행 1건 = 문서 1건)
  DOCX·PPTX·TXT 등 원본은 convert.py가 raw/ → sources/converted/*.md로 변환해 둔다
- 문서 기록표(documents)에 doc_id, 내용 해시, 개정판, 상태, 임베딩 모델, 청킹 버전을 남긴다
- 내용 해시와 설정이 같으면 건너뛰고, 다르면 그 문서의 청크만 교체한다
- 원천에서 사라진 문서는 삭제하고, status가 '폐기'인 문서는 청크를 지워 검색에서 뺀다

실행:
    python indexer.py --offline            # Ollama 없이 (오프라인 해시 임베딩, 강의장 백업)
    python indexer.py                      # Ollama 임베딩 (기본 bge-m3)
    python indexer.py --contextualize      # + Ollama LLM으로 청크마다 맥락 문장 생성
    python indexer.py --dry-run            # 무엇이 바뀔지 계획만 출력
    python indexer.py --offline --watch 10 # 10초마다 원천을 다시 확인
"""

import argparse
import csv
import json
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import ragkit

CHUNKER_VERSION = "md-heading-v1"   # 청킹 규칙을 바꾸면 이 값을 올린다 → 전체 재색인
MAX_CHARS = 600
SOURCE_DIR = ragkit.BASE / "sources"


@dataclass
class SourceDoc:
    doc_id: str
    path: str
    title: str
    doc_type: str
    revision: str
    status: str
    meta: dict
    body: str                          # 청킹할 본문 (md)
    is_record: bool = False            # DB 행에서 만든 문서인가
    enrichment: dict = field(default_factory=dict)   # enrich.py가 만든 보강 정보 (청크 해시 → 필드)

    @property
    def content_hash(self) -> str:     # 본문 + 메타데이터 + 보강 정보가 바뀌면 다시 색인
        meta = json.dumps(self.meta, ensure_ascii=False, sort_keys=True)
        enr = json.dumps(self.enrichment, ensure_ascii=False, sort_keys=True) if self.enrichment else ""
        return ragkit.sha256("\n".join([self.title, self.doc_type, self.revision, self.status, meta, self.body, enr]))


# ── 1. scan: 원천 읽기 ────────────────────────────────────────────────────
def parse_front_matter(text: str) -> tuple[dict, str]:
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, flags=re.S)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, text[m.end():]


def doc_from_markdown(path: Path, text: str, rel: str) -> SourceDoc:
    meta, body = parse_front_matter(text)
    sidecar = path.with_name(path.name + ".enrich.json")   # enrich.py 결과 (원문은 그대로, 보강은 옆 파일)
    enrichment = json.loads(sidecar.read_text(encoding="utf-8")).get("chunks", {}) if sidecar.exists() else {}
    title = meta.pop("title", None) or next((ln.lstrip("# ").strip() for ln in body.splitlines() if ln.startswith("# ")), path.stem)
    return SourceDoc(
        doc_id=meta.pop("doc_id", rel), path=rel, title=title,
        doc_type=meta.pop("doc_type", "일반"), revision=meta.pop("revision", "-"),
        status=meta.pop("status", "유효"), meta=meta, body=body, enrichment=enrichment,
    )


def docs_from_csv(path: Path, rel: str) -> list[SourceDoc]:
    """DB 행 1건을 짧은 문서 1건으로 만든다 (불량 사례, 정비 이력 등)."""
    docs = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            body = (f"[불량 사례] {row['date']} · {row['line']} · {row['equipment']} · {row['item']} · {row['defect']}\n"
                    f"현상: {row['symptom']}\n원인: {row['cause']}\n조치: {row['action']}\n결과: {row['result']}")
            docs.append(SourceDoc(
                doc_id=row["case_id"], path=f"{rel}#{row['case_id']}", title=f"불량 사례 {row['case_id']} ({row['item']} {row['defect']})",
                doc_type="불량 사례", revision=row.get("updated_at", "-"), status="유효",
                meta={"equipment": row["equipment"], "item": row["item"], "line": row["line"], "acl": "품질, 생산"},
                body=body, is_record=True,
            ))
    return docs


def scan(source_dir: Path) -> tuple[list[SourceDoc], list[str]]:
    docs, warnings = [], []
    for path in sorted(source_dir.rglob("*")):
        if not path.is_file() or path.name.startswith(".") or path.name.endswith(".meta.json"):
            continue
        rel = path.relative_to(source_dir).as_posix()
        suffix = path.suffix.lower()
        if suffix in (".md", ".txt"):
            docs.append(doc_from_markdown(path, path.read_text(encoding="utf-8"), rel))
        elif suffix == ".csv":
            docs += docs_from_csv(path, rel)
        elif suffix in (".pdf", ".docx", ".pptx", ".xlsx", ".doc", ".ppt", ".hwp", ".hwpx"):
            warnings.append(f"{rel}: 원본 문서는 convert.py로 먼저 마크다운으로 변환하세요 (raw/ → sources/converted/)")
    # 같은 doc_id가 두 번 나오면 (복사본) 첫 번째만 쓴다
    seen, unique = {}, []
    for d in docs:
        if d.doc_id in seen:
            warnings.append(f"{d.path}: doc_id {d.doc_id}가 {seen[d.doc_id]}와 중복되어 건너뜀")
            continue
        seen[d.doc_id] = d.path
        unique.append(d)
    return unique, warnings


# ── 2. chunk: 문서 유형별 청킹 ────────────────────────────────────────────
def chunk_markdown(body: str) -> list[dict]:
    """제목(#) 단위로 나누고 제목 경로를 기억한다. 표는 행마다 헤더를 붙여 청크로 만든다."""
    chunks, path, buf = [], [], []

    def flush():
        text = "\n".join(buf).strip()
        buf.clear()
        if not text:
            return
        heading = " > ".join(path)
        lines, para = text.splitlines(), []
        i = 0
        while i < len(lines):
            if lines[i].lstrip().startswith("|"):                      # 표 블록
                table = []
                while i < len(lines) and lines[i].lstrip().startswith("|"):
                    table.append(lines[i]); i += 1
                cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in table]
                header, rows = cells[0], [r for r in cells[1:] if not set("".join(r)) <= set("-: ")]
                for r in rows:
                    chunks.append({"heading": heading, "kind": "table-row",
                                   "text": " · ".join(f"{h}: {v}" for h, v in zip(header, r))})
            else:
                para.append(lines[i]); i += 1
        prose = "\n".join(para).strip()
        if prose:                                                      # 긴 본문은 문단 단위로 MAX_CHARS 안에서 묶기
            piece = ""
            for p in re.split(r"\n\s*\n", prose):
                if piece and len(piece) + len(p) > MAX_CHARS:
                    chunks.append({"heading": heading, "kind": "text", "text": piece.strip()}); piece = ""
                piece += p + "\n\n"
            if piece.strip():
                chunks.append({"heading": heading, "kind": "text", "text": piece.strip()})

    for line in body.splitlines():
        m = re.match(r"^(#{1,6})\s+(.*)", line)
        if m:
            flush()
            level = len(m.group(1))
            path[:] = path[:level - 1] + [m.group(2).strip()]
        else:
            buf.append(line)
    flush()
    return chunks


def chunk(doc: SourceDoc) -> list[dict]:
    if doc.is_record:                       # 사례 1건 = 청크 1개
        return [{"heading": "사례", "kind": "record", "text": doc.body}]
    return chunk_markdown(doc.body)


# ── 3. enrich: 청크에 맥락 붙이기 ─────────────────────────────────────────
def enrich(con, doc: SourceDoc, chunks: list[dict], contextualize: bool) -> None:
    facets = " · ".join(f"{k}: {v}" for k, v in doc.meta.items() if k in ("equipment", "process", "item", "line"))
    for c in chunks:
        c["context"] = ""
        if contextualize:                   # Contextual Retrieval: LLM이 '이 청크가 문서에서 무슨 내용인지' 한 문장
            key = f"ctx:{ragkit.LLM_MODEL}:{ragkit.sha256(doc.content_hash + c['text'])}"
            c["context"] = ragkit.cache_get(con, key) or ""
            if not c["context"]:
                prompt = (f"다음은 제조 현장 문서 '{doc.title}'의 일부다.\n[문서 앞부분]\n{doc.body[:1500]}\n\n"
                          f"[청크]\n{c['text']}\n\n이 청크가 문서 안에서 어떤 내용인지 검색에 도움이 되도록 한국어 한 문장으로만 써라.")
                c["context"] = ragkit.generate(prompt).splitlines()[0][:200]
                ragkit.cache_put(con, key, c["context"])
        e = doc.enrichment.get(ragkit.sha256(c["text"]), {})   # enrich.py 보강: 원문은 그대로 두고 검색용 필드만 덧붙임
        if e and not c["context"]:
            c["context"] = e.get("context", "")
        c["embed_text"] = "\n".join(x for x in [
            f"[{doc.doc_type}] {doc.title} > {c['heading']}",   # 제목 경로
            facets,                                             # 설비·공정·품목
            c["context"],                                       # 맥락 문장 (LLM)
            e.get("standalone", ""),                            # 지시어를 푼 요약 (enrich.py)
            ("키워드: " + ", ".join(e["keywords"])) if e.get("keywords") else "",
            ("예상 질문: " + " / ".join(e["questions"])) if e.get("questions") else "",
            c["text"],
        ] if x)


# ── 4. plan & store ──────────────────────────────────────────────────────
def plan(con, docs: list[SourceDoc], embed_model: str) -> list[tuple[str, SourceDoc | None, str, str]]:
    """(동작, 문서, doc_id, 사유) 목록. 동작: add / update / skip / withdraw / remove"""
    records = {r["doc_id"]: r for r in con.execute("SELECT * FROM documents")}
    actions = []
    for d in docs:
        rec = records.get(d.doc_id)
        if d.status == "폐기":
            if rec and rec["status"] != "폐기":
                actions.append(("withdraw", d, d.doc_id, f"{d.revision} 폐기 → 검색에서 제외"))
            else:
                actions.append(("skip", d, d.doc_id, "폐기 문서"))
        elif rec is None:
            actions.append(("add", d, d.doc_id, "새 문서"))
        else:
            reasons = []
            if rec["status"] == "폐기":
                reasons.append("폐기 해제")
            if rec["content_hash"] != d.content_hash:
                reasons.append(f"내용 변경 ({rec['revision']} → {d.revision})" if rec["revision"] != d.revision else "내용 변경")
            if rec["embed_model"] != embed_model:
                reasons.append(f"임베딩 모델 변경 ({rec['embed_model']} → {embed_model})")
            if rec["chunker_version"] != CHUNKER_VERSION:
                reasons.append(f"청킹 규칙 변경 ({rec['chunker_version']} → {CHUNKER_VERSION})")
            actions.append(("update", d, d.doc_id, ", ".join(reasons)) if reasons else ("skip", d, d.doc_id, "변경 없음"))
    seen = {d.doc_id for d in docs}
    for doc_id, rec in records.items():
        if doc_id not in seen:
            actions.append(("remove", None, doc_id, f"원천에서 사라짐 ({rec['source_path']})"))
    return actions


def store(con, doc: SourceDoc, chunks: list[dict], vectors: list, embed_model: str) -> None:
    con.execute("DELETE FROM chunks WHERE doc_id=?", (doc.doc_id,))       # 이 문서의 옛 청크만 교체
    for i, (c, v) in enumerate(zip(chunks, vectors)):
        con.execute("INSERT INTO chunks VALUES (?,?,?,?,?,?,?,?,?)", (
            f"{doc.doc_id}#{i:03d}", doc.doc_id, i, c["heading"], c["text"], c["context"], c["embed_text"],
            json.dumps(v), json.dumps({"kind": c["kind"]}, ensure_ascii=False)))
    record_doc(con, doc, embed_model, len(chunks))


def record_doc(con, doc: SourceDoc, embed_model: str, n_chunks: int) -> None:
    con.execute("INSERT OR REPLACE INTO documents VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", (
        doc.doc_id, doc.path, doc.content_hash, doc.title, doc.doc_type, doc.revision, doc.status,
        json.dumps(doc.meta, ensure_ascii=False), CHUNKER_VERSION, embed_model, n_chunks,
        datetime.now().isoformat(timespec="seconds")))


ICON = {"add": "➕ 추가", "update": "♻️  갱신", "skip": "⏭  유지", "withdraw": "🚫 폐기", "remove": "🗑  삭제"}


def run(source_dir: Path = SOURCE_DIR, embed_model: str = ragkit.EMBED_MODEL, contextualize: bool = False,
        dry_run: bool = False, verbose: bool = False, con=None, out=print) -> dict:
    con = con or ragkit.connect()
    docs, warnings = scan(source_dir)
    actions = plan(con, docs, embed_model)
    counts = {k: 0 for k in ICON}
    for act, doc, doc_id, reason in actions:
        counts[act] += 1
        if act != "skip" or verbose:
            out(f"  {ICON[act]}  {doc_id:<16} {reason}")
        if dry_run or act == "skip":
            continue
        if act == "remove":
            con.execute("DELETE FROM chunks WHERE doc_id=?", (doc_id,))
            con.execute("DELETE FROM documents WHERE doc_id=?", (doc_id,))
        elif act == "withdraw":
            con.execute("DELETE FROM chunks WHERE doc_id=?", (doc_id,))   # 감사용 원본은 원천에 남아 있음
            record_doc(con, doc, embed_model, 0)
        else:
            chunks = chunk(doc)
            enrich(con, doc, chunks, contextualize)
            vectors = ragkit.embed(con, [c["embed_text"] for c in chunks], embed_model)
            store(con, doc, chunks, vectors, embed_model)
        con.commit()
    for w in warnings:
        out(f"  ⚠️  {w}")
    total = con.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
    out(f"  ── 문서 {len(docs)}건: 추가 {counts['add']} · 갱신 {counts['update']} · 유지 {counts['skip']} · "
        f"폐기 {counts['withdraw']} · 삭제 {counts['remove']}  |  검색 가능한 청크 {total}개"
        + ("  (dry-run: 반영 안 함)" if dry_run else ""))
    if not dry_run:
        con.execute("INSERT INTO runs(started_at, added, updated, skipped, removed, withdrawn, embed_model, note) "
                    "VALUES (?,?,?,?,?,?,?,?)", (datetime.now().isoformat(timespec="seconds"), counts["add"],
                    counts["update"], counts["skip"], counts["remove"], counts["withdraw"], embed_model,
                    "contextualize" if contextualize else ""))
        con.commit()
    return counts


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="증분 인덱서 데모")
    ap.add_argument("--source", default=str(SOURCE_DIR), help="원천 문서 폴더 (기본: sources/)")
    ap.add_argument("--offline", action="store_true", help="Ollama 없이 오프라인 해시 임베딩 사용")
    ap.add_argument("--embed-model", default=None, help=f"Ollama 임베딩 모델 (기본: {ragkit.EMBED_MODEL})")
    ap.add_argument("--contextualize", action="store_true", help="Ollama LLM으로 청크마다 맥락 문장 생성")
    ap.add_argument("--dry-run", action="store_true", help="변경 계획만 출력")
    ap.add_argument("--verbose", action="store_true", help="변경 없는 문서도 출력")
    ap.add_argument("--watch", type=int, default=0, help="N초마다 다시 확인 (Ctrl+C로 종료)")
    args = ap.parse_args()
    model = ragkit.OFFLINE_MODEL if args.offline else (args.embed_model or ragkit.EMBED_MODEL)
    if args.offline and args.contextualize:
        raise SystemExit("--contextualize는 Ollama LLM이 필요해서 --offline과 함께 쓸 수 없습니다.")
    try:
        while True:
            print(f"📚 인덱싱 {datetime.now():%H:%M:%S}  원천: {args.source}  임베딩: {model}  청킹: {CHUNKER_VERSION}")
            run(Path(args.source), model, args.contextualize, args.dry_run, args.verbose)
            if not args.watch:
                break
            time.sleep(args.watch)
    except ragkit.OllamaUnavailable as exc:
        raise SystemExit(f"❌ {exc}")
    except KeyboardInterrupt:
        pass
