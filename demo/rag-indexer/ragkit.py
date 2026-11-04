"""증분 인덱서 데모의 공통 모듈: 저장소(SQLite), 임베딩, 토큰화.

- 저장소: 문서 기록표(documents), 청크(chunks), 단계별 캐시(cache), 실행 이력(runs)
- 임베딩: Ollama(/api/embed) 또는 오프라인 해시 임베딩(강의장 백업용)
- 토큰화: 공백 단어 + 한글 2글자 묶음 (BM25 키워드 검색용)
"""

import hashlib
import json
import math
import os
import re
import sqlite3
import urllib.error
import urllib.request
from pathlib import Path

BASE = Path(__file__).parent
DB_PATH = Path(os.environ.get("RAG_DB", BASE / "index.db"))
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "bge-m3")
LLM_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:8b")
OFFLINE_MODEL = "offline-hash-v1"   # Ollama 없이 쓰는 해시 임베딩의 '모델 이름'
OFFLINE_DIM = 512

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (      -- 문서 기록표: 증분 인덱싱의 핵심
    doc_id TEXT PRIMARY KEY,                -- 파일 경로가 아니라 문서 번호
    source_path TEXT, content_hash TEXT,    -- 변경 감지
    title TEXT, doc_type TEXT, revision TEXT, status TEXT,
    meta TEXT,                              -- 설비, 품목, 권한 등 (JSON)
    chunker_version TEXT, embed_model TEXT, -- 설정이 바뀌면 다시 색인
    n_chunks INTEGER, indexed_at TEXT
);
CREATE TABLE IF NOT EXISTS chunks (
    chunk_id TEXT PRIMARY KEY, doc_id TEXT, seq INTEGER,
    heading_path TEXT, text TEXT, context TEXT, embed_text TEXT,
    vector TEXT, meta TEXT
);
CREATE INDEX IF NOT EXISTS ix_chunks_doc ON chunks(doc_id);
CREATE TABLE IF NOT EXISTS cache (          -- 단계별 캐시: 같은 입력은 LLM·임베딩을 다시 부르지 않음
    key TEXT PRIMARY KEY, value TEXT
);
CREATE TABLE IF NOT EXISTS runs (
    run_id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT,
    added INTEGER, updated INTEGER, skipped INTEGER, removed INTEGER, withdrawn INTEGER,
    embed_model TEXT, note TEXT
);
"""


def connect(db_path: Path = DB_PATH) -> sqlite3.Connection:
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    return con


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ── 캐시 ─────────────────────────────────────────────────────────────────
def cache_get(con, key):
    row = con.execute("SELECT value FROM cache WHERE key=?", (key,)).fetchone()
    return json.loads(row["value"]) if row else None


def cache_put(con, key, value):
    con.execute("INSERT OR REPLACE INTO cache(key, value) VALUES(?, ?)", (key, json.dumps(value, ensure_ascii=False)))


# ── 토큰화 (BM25와 오프라인 임베딩 공용) ──────────────────────────────────
def tokenize(text: str) -> list[str]:
    words = re.findall(r"[0-9A-Za-z][0-9A-Za-z\-\.]*|[가-힣]+", text.lower())
    tokens = []
    for w in words:
        tokens.append(w)
        if re.fullmatch(r"[가-힣]+", w) and len(w) > 2:   # 한글은 조사가 붙으므로 2글자 묶음도 추가
            tokens += [w[i:i + 2] for i in range(len(w) - 1)]
    return tokens


# ── 임베딩 ───────────────────────────────────────────────────────────────
def _offline_embed(text: str) -> list[float]:
    vec = [0.0] * OFFLINE_DIM
    for tok in tokenize(text):
        h = int(hashlib.md5(tok.encode("utf-8")).hexdigest(), 16)
        vec[h % OFFLINE_DIM] += 1.0 if (h >> 9) & 1 else -1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _post(path: str, payload: dict, timeout: int = 120) -> dict:
    req = urllib.request.Request(OLLAMA_HOST + path, data=json.dumps(payload).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


class OllamaUnavailable(RuntimeError):
    pass


def embed(con, texts: list[str], model: str) -> list[list[float]]:
    """텍스트 목록을 임베딩한다. (모델, 텍스트 해시) 단위로 캐시한다."""
    out, todo = [None] * len(texts), []
    for i, t in enumerate(texts):
        hit = cache_get(con, f"emb:{model}:{sha256(t)}")
        if hit is not None:
            out[i] = hit
        else:
            todo.append(i)
    if todo:
        if model == OFFLINE_MODEL:
            vecs = [_offline_embed(texts[i]) for i in todo]
        else:
            try:
                vecs = _post("/api/embed", {"model": model, "input": [texts[i] for i in todo]})["embeddings"]
            except (urllib.error.URLError, OSError) as exc:
                raise OllamaUnavailable(
                    f"Ollama({OLLAMA_HOST})에 연결할 수 없습니다: {exc}. "
                    "Ollama를 실행하고 `ollama pull " + model + "`를 하거나, --offline으로 실행하세요.") from exc
        for i, v in zip(todo, vecs):
            out[i] = v
            cache_put(con, f"emb:{model}:{sha256(texts[i])}", v)
    return out


def generate(prompt: str, model: str = LLM_MODEL) -> str:
    """Ollama로 짧은 문장을 생성한다 (맥락 문장 보강, 답변 생성)."""
    try:
        res = _post("/api/generate", {"model": model, "prompt": prompt, "stream": False, "think": False,
                                      "options": {"temperature": 0}})
    except (urllib.error.URLError, OSError) as exc:
        raise OllamaUnavailable(f"Ollama({OLLAMA_HOST})에 연결할 수 없습니다: {exc}") from exc
    return re.sub(r"<think>.*?</think>", "", res.get("response", ""), flags=re.S).strip()


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)
