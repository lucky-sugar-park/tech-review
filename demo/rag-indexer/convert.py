"""원본 문서(DOCX·PPTX·TXT 등)를 인덱싱용 마크다운으로 변환한다.

흐름:  raw/ 원본 ──▶ 변환기 ──▶ 후처리 ──▶ 앞머리 메타데이터 ──▶ 품질 점검 ──▶ sources/converted/*.md ──▶ indexer.py

- 변환기는 Docling → MarkItDown → 내장 변환기 순으로 쓸 수 있는 것을 고른다 (--engine으로 지정 가능)
  내장 변환기는 표준 라이브러리만으로 DOCX(제목 스타일·표·목록), PPTX(슬라이드·표·발표자 노트), TXT를 처리한다
- 구형 DOC·PPT는 LibreOffice(soffice)로 DOCX·PPTX로 바꾼 뒤 변환한다
- 원본 해시를 앞머리에 기록해 두고, 원본이 바뀐 파일만 다시 변환한다. 원본이 사라지면 변환본도 지운다
- 품질 점검에 걸린 문서는 앞머리에 review 사유를 남기고 검수 목록으로 출력한다

실행:
    python convert.py                  # raw/ → sources/converted/ (바뀐 것만)
    python convert.py --engine builtin # 내장 변환기만 사용
    python convert.py --force          # 모두 다시 변환
    python convert.py && python indexer.py --offline
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from collections import Counter
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET

BASE = Path(__file__).parent
RAW_DIR = BASE / "raw"
OUT_DIR = BASE / "sources" / "converted"
SUPPORTED = {".docx", ".pptx", ".txt", ".md", ".pdf", ".xlsx", ".doc", ".ppt", ".hwp", ".hwpx"}
FOLDER_TYPES = {"standards": "작업표준서", "training": "교육 자료", "notices": "공지", "equipment": "설비 매뉴얼",
                "quality": "검사 기준", "manuals": "MES 매뉴얼"}   # 폴더 이름으로 문서 유형 추정

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def md_table(rows: list[list[str]]) -> str:
    rows = [[c.replace("|", "/").replace("\n", " ").strip() for c in r] for r in rows if any(c.strip() for c in r)]
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    lines = ["| " + " | ".join(rows[0]) + " |", "| " + " | ".join(["---"] * width) + " |"]
    return "\n".join(lines + ["| " + " | ".join(r) + " |" for r in rows[1:]])


# ── 내장 변환기 (표준 라이브러리) ─────────────────────────────────────────
def builtin_docx(path: Path) -> tuple[str, dict]:
    with zipfile.ZipFile(path) as z:
        body = ET.fromstring(z.read("word/document.xml")).find(f"{W}body")
        styles = {}
        if "word/styles.xml" in z.namelist():
            for s in ET.fromstring(z.read("word/styles.xml")).iter(f"{W}style"):
                name = s.find(f"{W}name")
                styles[s.get(f"{W}styleId")] = (name.get(f"{W}val") if name is not None else "").lower()
        core = ET.fromstring(z.read("docProps/core.xml")) if "docProps/core.xml" in z.namelist() else None
    out, stats = [], {"tables": 0}
    for el in body:
        if el.tag == f"{W}p":
            text = "".join(t.text or "" for t in el.iter(f"{W}t")).strip()
            if not text:
                continue
            ps = el.find(f"{W}pPr/{W}pStyle")
            style = styles.get(ps.get(f"{W}val"), ps.get(f"{W}val").lower()) if ps is not None else ""
            m = re.match(r"(?:heading|제목)\s*(\d)", style)
            if style == "title" or m:                               # Word의 제목 스타일 → #, ##
                out.append("#" * (int(m.group(1)) if m else 1) + " " + text)
            elif el.find(f"{W}pPr/{W}numPr") is not None or style.startswith("list"):
                out.append("- " + text)
            else:
                out.append(text)
        elif el.tag == f"{W}tbl":
            stats["tables"] += 1
            rows = [["".join(t.text or "" for t in tc.iter(f"{W}t")) for tc in tr.iter(f"{W}tc")] for tr in el.iter(f"{W}tr")]
            out.append(md_table(rows))
    title = core.findtext("{http://purl.org/dc/elements/1.1/}title") if core is not None else ""
    stats["title"] = (title or "").strip()
    return "\n\n".join(out), stats


def builtin_pptx(path: Path) -> tuple[str, dict]:
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        slides = sorted((n for n in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)), key=lambda n: int(re.search(r"\d+", n.split("/")[-1]).group()))
        out, stats = [], {"tables": 0, "image_only_slides": []}
        for i, sn in enumerate(slides, 1):
            root = ET.fromstring(z.read(sn))
            title, texts = "", []
            for sp in root.iter(f"{P}sp"):
                ph = sp.find(f".//{P}nvPr/{P}ph")
                paras = ["".join(t.text or "" for t in p.iter(f"{A}t")).strip() for p in sp.iter(f"{A}p")]
                paras = [p for p in paras if p]
                if ph is not None and ph.get("type") in ("title", "ctrTitle") and not title:
                    title = " ".join(paras)
                else:
                    texts += paras
            tables = []
            for tbl in root.iter(f"{A}tbl"):
                stats["tables"] += 1
                tables.append(md_table([["".join(t.text or "" for t in tc.iter(f"{A}t")) for tc in tr.iter(f"{A}tc")] for tr in tbl.iter(f"{A}tr")]))
            pics = len(list(root.iter(f"{P}pic")))
            notes = ""
            rels = sn.replace("slides/", "slides/_rels/") + ".rels"
            if rels in names:
                for rel in ET.fromstring(z.read(rels)):
                    if rel.get("Target", "").endswith(".xml") and "notesSlide" in rel.get("Target", ""):
                        nroot = ET.fromstring(z.read("ppt/notesSlides/" + rel.get("Target").split("/")[-1]))
                        for sp in nroot.iter(f"{P}sp"):
                            ph = sp.find(f".//{P}nvPr/{P}ph")
                            if ph is not None and ph.get("type") == "body":
                                notes = " ".join("".join(t.text or "" for t in p.iter(f"{A}t")) for p in sp.iter(f"{A}p")).strip()
            block = [f"## 슬라이드 {i}" + (f": {title}" if title else "")]   # 슬라이드 1장 = 섹션 1개
            block += [f"- {t}" for t in texts] + tables
            if pics and not texts and not tables:
                block.append(f"(그림 {pics}개, 텍스트 없음)")
                stats["image_only_slides"].append(i)
            if notes:
                block.append(f"**발표자 노트:** {notes}")
            out.append("\n\n".join(block))
            if i == 1 and title:
                stats["title"] = title                                   # 첫 슬라이드 제목 = 문서 제목
    return "\n\n".join(out), stats


def read_text(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "cp949"):        # 국내 PC의 TXT는 cp949(EUC-KR)인 경우가 많다
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def builtin_txt(path: Path) -> tuple[str, dict]:
    text = read_text(path).replace("\r\n", "\n")
    pages = text.split("\f")
    firsts = Counter(p.strip().splitlines()[0].strip() for p in pages if p.strip())
    repeated = {ln for ln, n in firsts.items() if n >= 2}            # 페이지마다 반복되는 머리말
    out = []
    for page in pages:
        for ln in page.splitlines():
            s = ln.strip()
            if not s or s in repeated or re.fullmatch(r"[-–]?\s*\d+\s*[-–]?|page \d+|\d+\s*/\s*\d+", s, flags=re.I):
                continue                                              # 빈 줄, 머리말, 페이지 번호 제거
            if re.match(r"^\d+\.\d+\.?\s+\S", s):
                out.append("### " + s)                               # 1.1 → ###
            elif re.match(r"^\d+\.\s+\S", s):
                out.append("## " + s)                                # 1.  → ##
            elif re.match(r"^[가-하]\.\s+\S", s):
                out.append("- " + s)                                 # 가. → 목록
            else:
                out.append(s)
    if out and not out[0].startswith("#"):
        out[0] = "# " + out[0]                                       # 첫 줄을 문서 제목으로
    md = "\n\n".join(out)
    return re.sub(r"\n\n(- )", r"\n\1", md), {"tables": 0}


BUILTIN = {".docx": builtin_docx, ".pptx": builtin_pptx, ".txt": builtin_txt, ".md": builtin_txt}


# ── 외부 변환기 ──────────────────────────────────────────────────────────
def via_docling(path: Path) -> str:
    from docling.document_converter import DocumentConverter
    return DocumentConverter().convert(str(path)).document.export_to_markdown()


def via_markitdown(path: Path) -> str:
    from markitdown import MarkItDown
    md = MarkItDown().convert(str(path)).text_content
    if path.suffix.lower() == ".pptx":   # 슬라이드 표시를 내장 변환기와 같은 형식으로 맞춘다
        md = re.sub(r"<!-- Slide number: (\d+) -->\s*\n# (.+)", r"## 슬라이드 \1: \2", md)
        md = re.sub(r"<!-- Slide number: (\d+) -->", r"## 슬라이드 \1", md)
        md = md.replace("### Notes:\n", "**발표자 노트:** ")
    return md


def legacy_to_ooxml(path: Path, tmp: Path) -> Path | None:
    """구형 DOC·PPT를 LibreOffice로 DOCX·PPTX로 바꾼다."""
    target = {".doc": "docx", ".ppt": "pptx"}[path.suffix.lower()]
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        return None
    subprocess.run([soffice, "--headless", "--convert-to", target, "--outdir", str(tmp), str(path)],
                   capture_output=True, timeout=180)
    out = tmp / (path.stem + "." + target)
    return out if out.exists() else None


def convert_file(path: Path, engine: str) -> tuple[str, str, dict, list[str]]:
    """(마크다운, 사용한 변환기, 통계, 경고) 를 돌려준다."""
    warnings = []
    suffix = path.suffix.lower()
    with tempfile.TemporaryDirectory() as tmp:
        if suffix in (".doc", ".ppt"):
            conv = legacy_to_ooxml(path, Path(tmp))
            if conv is None:
                raise RuntimeError("LibreOffice(soffice)가 없어 구형 문서를 변환할 수 없음")
            warnings.append(f"LibreOffice로 {conv.suffix} 변환 후 처리")
            path, suffix = conv, conv.suffix
        if suffix in (".hwp", ".hwpx"):
            try:
                from ureca_document_parser import convert as hwp_convert   # 선택 설치
            except ImportError as exc:
                raise RuntimeError("HWP는 한컴오피스에서 DOCX·PDF로 일괄 변환하거나 ureca_document_parser를 설치하세요") from exc
            out = Path(tmp) / "out.md"
            hwp_convert(str(path), str(out))
            return out.read_text(encoding="utf-8"), "ureca", {"tables": 0}, warnings

        ref, stats = BUILTIN[suffix](path) if suffix in BUILTIN else ("", {"tables": 0})   # 내장 결과는 교차 점검에도 쓴다
        order = {"auto": ["docling", "markitdown", "builtin"], "docling": ["docling"],
                 "markitdown": ["markitdown"], "builtin": ["builtin"]}[engine]
        if suffix in (".txt", ".md"):
            order = ["builtin"]                                          # TXT는 변환이 아니라 구조 추론
        for name in order:
            try:
                if name == "builtin":
                    if suffix not in BUILTIN:
                        raise RuntimeError(f"내장 변환기는 {suffix}를 지원하지 않음")
                    return ref, "builtin", stats, warnings
                md = via_docling(path) if name == "docling" else via_markitdown(path)
                stats["ref_chars"] = len(re.sub(r"\s", "", ref))
                return md, name, stats, warnings
            except Exception as exc:                                     # 미설치·실패 → 다음 변환기
                warnings.append(f"{name} 사용 불가: {str(exc).splitlines()[0][:80]}")
        raise RuntimeError("; ".join(warnings) or "변환 실패")


# ── 메타데이터, 품질 점검, 저장 ──────────────────────────────────────────
def infer_meta(path: Path, md: str, stats: dict, raw_dir: Path = RAW_DIR) -> dict:
    meta = {}
    sidecar = path.with_name(path.name + ".meta.json")   # 옆 파일의 메타데이터가 최우선
    if sidecar.exists():
        meta.update(json.loads(sidecar.read_text(encoding="utf-8")))
    m = re.match(r"^([A-Z]{2,}(?:-[A-Z0-9]+)+)", path.stem)             # 파일명 규칙: 문서번호_Rev2
    meta.setdefault("doc_id", m.group(1) if m else path.stem)
    rv = re.search(r"Rev\.?\s*(\d+)", path.stem, flags=re.I)
    meta.setdefault("revision", f"Rev.{rv.group(1)}" if rv else "-")
    parts = path.relative_to(raw_dir).parts
    top = parts[0] if len(parts) > 1 else ""
    meta.setdefault("doc_type", FOLDER_TYPES.get(top, "일반"))
    h1 = re.search(r"^# (.+)$", md, flags=re.M)
    meta.setdefault("title", stats.get("title") or (h1.group(1).strip() if h1 else path.stem))
    meta.setdefault("status", "유효")
    return meta


def quality_check(md: str, stats: dict) -> list[str]:
    issues = []
    body = re.sub(r"\s", "", md)
    if len(body) < 150:
        issues.append(f"내용이 너무 짧음 ({len(body)}자)")
    if not re.search(r"^#{1,6} ", md, flags=re.M):
        issues.append("제목 구조 없음 (청킹 품질 저하)")
    if stats.get("tables") and "| --- |" not in md and "|---|" not in md.replace(" ", ""):
        issues.append(f"표 누락 의심 (원본 표 {stats['tables']}개)")
    if stats.get("image_only_slides"):
        issues.append(f"그림 위주 슬라이드 {stats['image_only_slides']} (설명 추가 필요)")
    if stats.get("ref_chars") and len(body) < 0.7 * stats["ref_chars"]:
        issues.append(f"내용 누락 의심 (내장 추출 대비 {len(body) / stats['ref_chars']:.0%})")
    return issues


def front_matter(meta: dict) -> str:
    order = ["doc_id", "title", "doc_type", "revision", "status"]
    keys = order + [k for k in meta if k not in order]
    return "---\n" + "\n".join(f"{k}: {meta[k]}" for k in keys if meta.get(k) not in (None, "")) + "\n---\n\n"


def existing_hash(out: Path) -> str | None:
    if not out.exists():
        return None
    m = re.search(r"^source_hash: (\S+)$", out.read_text(encoding="utf-8")[:2000], flags=re.M)
    return m.group(1) if m else None


def _show(p: Path) -> str:
    try:
        return p.resolve().relative_to(BASE.resolve()).as_posix()
    except ValueError:
        return str(p)


def run(raw_dir: Path = RAW_DIR, out_dir: Path = OUT_DIR, engine: str = "auto", force: bool = False, out=print) -> dict:
    counts = {"converted": 0, "skipped": 0, "removed": 0, "failed": 0}
    review, seen = [], set()
    for path in sorted(raw_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED or path.name.startswith(("~$", ".")):
            continue
        rel = path.relative_to(raw_dir).as_posix()
        target = out_dir / (rel + ".md")
        seen.add(target.resolve())
        src_hash = hashlib.sha256(path.read_bytes() + (path.with_name(path.name + ".meta.json").read_bytes()
                                  if path.with_name(path.name + ".meta.json").exists() else b"")).hexdigest()[:16]
        if not force and existing_hash(target) == src_hash:
            counts["skipped"] += 1
            continue
        try:
            md, used, stats, warns = convert_file(path, engine)
        except Exception as exc:
            counts["failed"] += 1
            out(f"  ❌ 실패  {rel}: {exc}")
            continue
        md = re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"
        md = re.sub(r"^(- .*)\n\n(?=- )", r"\1\n", md, flags=re.M)        # 목록 항목 사이 빈 줄 제거
        md = re.sub(r"^(- .*)\n\n(?=- )", r"\1\n", md, flags=re.M)
        meta = infer_meta(path, md, stats, raw_dir)
        issues = quality_check(md, stats)
        meta.update({"source": f"raw/{rel}", "source_hash": src_hash, "converter": used,
                     "converted_at": datetime.now().isoformat(timespec="seconds")})
        if issues:
            meta["review"] = "필요 - " + "; ".join(issues)
            review.append((rel, issues))
        if not re.match(r"^# ", md):
            md = f"# {meta['title']}\n\n" + md
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(front_matter(meta) + md, encoding="utf-8")
        counts["converted"] += 1
        out(f"  📝 변환  {rel}  →  {_show(target)}  [{used}]")
        for w in warns:
            out(f"           · {w}")
    if out_dir.exists():                                                  # 원본이 사라진 변환본 정리
        for md_file in out_dir.rglob("*.md"):
            if md_file.resolve() not in seen:
                md_file.unlink()
                counts["removed"] += 1
                out(f"  🗑  삭제  {_show(md_file)} (원본 없음)")
    out(f"  ── 변환 {counts['converted']} · 유지 {counts['skipped']} · 삭제 {counts['removed']} · 실패 {counts['failed']}")
    if review:
        out("  🔍 검수 필요:")
        for rel, issues in review:
            out(f"     - {rel}: " + "; ".join(issues))
    return counts


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="원본 문서를 인덱싱용 마크다운으로 변환")
    ap.add_argument("--raw", default=str(RAW_DIR), help="원본 폴더 (기본: raw/)")
    ap.add_argument("--out", default=str(OUT_DIR), help="출력 폴더 (기본: sources/converted/)")
    ap.add_argument("--engine", choices=["auto", "docling", "markitdown", "builtin"], default="auto")
    ap.add_argument("--force", action="store_true", help="바뀌지 않은 파일도 다시 변환")
    args = ap.parse_args()
    print(f"🔄 변환  {args.raw}  →  {args.out}  (변환기: {args.engine})")
    run(Path(args.raw), Path(args.out), args.engine, args.force)
