package com.techreview.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.techreview.common.Json;
import com.techreview.common.Ollama;
import com.techreview.common.Text;

import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * 증분 인덱서 데모의 공통 모듈 (ragkit.py의 Java 버전): 저장소(SQLite), 임베딩, 캐시.
 *
 * 원천 문서·변환본·보강 파일(.enrich.json)은 파이썬 데모 폴더(demo/rag-indexer)를 함께 쓴다.
 * 인덱스 DB는 따로 둔다 (기본 rag-index.db).
 */
public final class RagKit {
    /** 원천 데이터가 있는 폴더: 환경 변수 RAG_BASE, 없으면 ../rag-indexer */
    public static final Path BASE = resolveBase();
    public static final Path DB_PATH = Path.of(Ollama.env("RAG_DB", "rag-index.db"));
    public static final String EMBED_MODEL = Ollama.env("EMBED_MODEL", "bge-m3");
    public static final String OFFLINE_MODEL = "offline-hash-v1";   // Ollama 없이 쓰는 해시 임베딩의 '모델 이름'
    static final int OFFLINE_DIM = 512;

    static final String SCHEMA = """
            CREATE TABLE IF NOT EXISTS documents (
                doc_id TEXT PRIMARY KEY, source_path TEXT, content_hash TEXT,
                title TEXT, doc_type TEXT, revision TEXT, status TEXT, meta TEXT,
                chunker_version TEXT, embed_model TEXT, n_chunks INTEGER, indexed_at TEXT);
            CREATE TABLE IF NOT EXISTS chunks (
                chunk_id TEXT PRIMARY KEY, doc_id TEXT, seq INTEGER, heading_path TEXT, text TEXT,
                context TEXT, embed_text TEXT, vector TEXT, meta TEXT);
            CREATE INDEX IF NOT EXISTS ix_chunks_doc ON chunks(doc_id);
            CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS runs (
                run_id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT, added INTEGER, updated INTEGER,
                skipped INTEGER, removed INTEGER, withdrawn INTEGER, embed_model TEXT, note TEXT);
            """;

    private RagKit() {}

    private static Path resolveBase() {
        String env = System.getenv("RAG_BASE");
        if (env != null && !env.isBlank()) {
            return Path.of(env).toAbsolutePath().normalize();
        }
        Path sibling = Path.of("..", "rag-indexer").toAbsolutePath().normalize();
        return Files.isDirectory(sibling) ? sibling : Path.of(".").toAbsolutePath().normalize();
    }

    public static Connection connect(Path dbPath) {
        try {
            Path parent = dbPath.toAbsolutePath().getParent();
            Files.createDirectories(parent);
            Connection c = DriverManager.getConnection("jdbc:sqlite:" + dbPath);
            try (Statement st = c.createStatement()) {
                for (String sql : SCHEMA.split(";")) {
                    if (!sql.isBlank()) {
                        st.executeUpdate(sql);
                    }
                }
            }
            c.setAutoCommit(false);
            return c;
        } catch (Exception e) {
            throw new IllegalStateException("인덱스 DB 열기 실패: " + e.getMessage(), e);
        }
    }

    // ── 캐시 ─────────────────────────────────────────────────────────────
    static String cacheGet(Connection c, String key) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT value FROM cache WHERE key=?")) {
            ps.setString(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString(1) : null;
            }
        }
    }

    static void cachePut(Connection c, String key, String jsonValue) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("INSERT OR REPLACE INTO cache(key, value) VALUES(?, ?)")) {
            ps.setString(1, key);
            ps.setString(2, jsonValue);
            ps.executeUpdate();
        }
    }

    // ── 임베딩 ───────────────────────────────────────────────────────────
    static double[] offlineEmbed(String text) {
        double[] vec = new double[OFFLINE_DIM];
        for (String tok : Text.tokenize(text)) {
            BigInteger h = Text.md5Int(tok);
            vec[h.mod(BigInteger.valueOf(OFFLINE_DIM)).intValue()] += h.testBit(9) ? 1.0 : -1.0;
        }
        double norm = 0;
        for (double v : vec) {
            norm += v * v;
        }
        norm = norm == 0 ? 1.0 : Math.sqrt(norm);
        for (int i = 0; i < vec.length; i++) {
            vec[i] /= norm;
        }
        return vec;
    }

    /** 텍스트 목록을 임베딩한다. (모델, 텍스트 해시) 단위로 캐시한다. */
    public static List<double[]> embed(Connection c, List<String> texts, String model) throws SQLException {
        List<double[]> out = new ArrayList<>();
        List<Integer> todo = new ArrayList<>();
        for (int i = 0; i < texts.size(); i++) {
            String hit = cacheGet(c, "emb:" + model + ":" + Text.sha256(texts.get(i)));
            out.add(hit == null ? null : parseVector(hit));
            if (hit == null) {
                todo.add(i);
            }
        }
        if (!todo.isEmpty()) {
            List<double[]> vecs;
            if (model.equals(OFFLINE_MODEL)) {
                vecs = todo.stream().map(i -> offlineEmbed(texts.get(i))).toList();
            } else {
                try {
                    vecs = Ollama.embed(model, todo.stream().map(texts::get).toList());
                } catch (Ollama.Unavailable e) {
                    throw new Ollama.Unavailable(e.getMessage() + ". Ollama를 실행하고 `ollama pull " + model
                            + "`를 하거나, --offline으로 실행하세요.", e);
                }
            }
            for (int k = 0; k < todo.size(); k++) {
                int i = todo.get(k);
                out.set(i, vecs.get(k));
                cachePut(c, "emb:" + model + ":" + Text.sha256(texts.get(i)), Json.write(vecs.get(k)));
            }
        }
        return out;
    }

    static double[] parseVector(String json) {
        JsonNode node = Json.read(json);
        double[] v = new double[node.size()];
        for (int i = 0; i < v.length; i++) {
            v[i] = node.get(i).asDouble();
        }
        return v;
    }

    static double cosine(double[] a, double[] b) {
        double dot = 0;
        double na = 0;
        double nb = 0;
        for (int i = 0; i < Math.min(a.length, b.length); i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        return dot / ((na == 0 ? 1 : Math.sqrt(na)) * (nb == 0 ? 1 : Math.sqrt(nb)));
    }
}
