package com.techreview.rag;

import com.techreview.common.Cli;
import com.techreview.common.Json;
import com.techreview.common.Ollama;
import com.techreview.common.Text;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * 인덱스 검색 (search.py의 Java 버전): 벡터 + BM25 하이브리드 검색, 출처·개정판 표시.
 *
 * - 질의 임베딩은 인덱스에 기록된 임베딩 모델과 같은 모델을 자동으로 쓴다 (모델이 섞이면 경고)
 * - 벡터 순위와 BM25 순위를 RRF(Reciprocal Rank Fusion)로 합친다
 */
public final class Search {
    /** 검색 결과 1건. */
    public static final class Hit {
        public String docId;
        public String title;
        public String docType;
        public String revision;
        public String sourcePath;
        public String headingPath;
        public String text;
        public String embedText;
        public double[] vector;
        public String docMeta;
        public double score;
        public int vecRank;
        public int kwRank;
    }

    public record Result(List<Hit> hits, String model) {}

    private Search() {}

    static double[] bm25(List<String> query, List<List<String>> docs) {
        double k1 = 1.5;
        double b = 0.75;
        int n = docs.size();
        double avgdl = docs.stream().mapToInt(List::size).average().orElse(0);
        Map<String, Integer> df = new HashMap<>();
        docs.forEach(d -> new HashSet<>(d).forEach(t -> df.merge(t, 1, Integer::sum)));
        double[] scores = new double[n];
        Set<String> q = new HashSet<>(query);
        for (int i = 0; i < n; i++) {
            Map<String, Integer> tf = new HashMap<>();
            docs.get(i).forEach(t -> tf.merge(t, 1, Integer::sum));
            double s = 0;
            for (String t : q) {
                Integer f = tf.get(t);
                if (f != null) {
                    double idf = Math.log(1 + (n - df.get(t) + 0.5) / (df.get(t) + 0.5));
                    s += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * docs.get(i).size() / avgdl));
                }
            }
            scores[i] = s;
        }
        return scores;
    }

    static int[] ranks(double[] scores) {
        List<Integer> order = IntStream.range(0, scores.length).boxed()
                .sorted(Comparator.comparingDouble(i -> -scores[i])).toList();
        int[] r = new int[scores.length];
        for (int k = 0; k < order.size(); k++) {
            r[order.get(k)] = k + 1;
        }
        return r;
    }

    public static Result search(String query, int k, String docType, String equipment, Connection c) throws SQLException {
        List<String> models = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement("SELECT DISTINCT embed_model FROM documents WHERE n_chunks > 0");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                models.add(rs.getString(1));
            }
        }
        if (models.isEmpty()) {
            throw new Cli.Exit("인덱스가 비어 있습니다. 먼저 `index`를 실행하세요.");
        }
        if (models.size() > 1) {
            System.out.println("⚠️  인덱스에 임베딩 모델이 섞여 있습니다: " + models + ". 전체 재색인이 필요합니다.");
        }
        String model = models.get(0);
        List<Hit> rows = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement("SELECT c.*, d.title, d.doc_type, d.revision, d.source_path, d.meta AS doc_meta "
                + "FROM chunks c JOIN documents d ON c.doc_id = d.doc_id WHERE d.status = '유효'"); ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Hit h = new Hit();
                h.docId = rs.getString("doc_id");
                h.title = rs.getString("title");
                h.docType = rs.getString("doc_type");
                h.revision = rs.getString("revision");
                h.sourcePath = rs.getString("source_path");
                h.headingPath = rs.getString("heading_path");
                h.text = rs.getString("text");
                h.embedText = rs.getString("embed_text");
                h.vector = RagKit.parseVector(rs.getString("vector"));
                h.docMeta = rs.getString("doc_meta");
                rows.add(h);
            }
        }
        if (docType != null) {
            rows.removeIf(h -> !docType.equals(h.docType));
        }
        if (equipment != null) {
            rows.removeIf(h -> !Json.read(h.docMeta).path("equipment").asText("").contains(equipment));
        }
        if (rows.isEmpty()) {
            return new Result(rows, model);
        }
        double[] qvec = RagKit.embed(c, List.of(query), model).get(0);
        c.commit();
        double[] vec = rows.stream().mapToDouble(h -> RagKit.cosine(qvec, h.vector)).toArray();
        double[] kw = bm25(Text.tokenize(query), rows.stream().map(h -> Text.tokenize(h.embedText)).toList());
        int[] rv = ranks(vec);
        int[] rk = ranks(kw);
        for (int i = 0; i < rows.size(); i++) {
            Hit h = rows.get(i);
            h.score = 1.0 / (60 + rv[i]) + 1.0 / (60 + rk[i]);   // RRF
            h.vecRank = rv[i];
            h.kwRank = rk[i];
        }
        List<Hit> sorted = new ArrayList<>(rows);
        sorted.sort(Comparator.comparingDouble((Hit h) -> -h.score));
        return new Result(sorted.subList(0, Math.min(k, sorted.size())), model);
    }

    static String answer(String query, List<Hit> hits) {
        String sources = IntStream.range(0, hits.size()).mapToObj(i -> "[" + (i + 1) + "] " + hits.get(i).title + " ("
                + hits.get(i).revision + ") > " + hits.get(i).headingPath + "\n" + hits.get(i).text).collect(Collectors.joining("\n\n"));
        String prompt = "너는 중소 제조공장의 지식 도우미다. 아래 문서 조각만 근거로 한국어로 짧게 답하라.\n"
                + "- 문장 끝에 근거 번호를 [1]처럼 달 것\n- 문서에 없으면 '문서에서 찾지 못했습니다'라고 답할 것\n\n"
                + "[질문]\n" + query + "\n\n[문서 조각]\n" + sources + "\n";
        return Ollama.generate(prompt, Ollama.LLM_MODEL);
    }

    public static void main(String[] args) throws Exception {
        Cli cli = new Cli(args, Set.of("-k", "--doc-type", "--equipment"));
        if (cli.positional.isEmpty()) {
            throw new Cli.Exit("사용법: search \"질문\" [-k 3] [--doc-type 작업표준서] [--equipment 3호기] [--answer]");
        }
        String query = cli.positional.get(0);
        try (Connection c = RagKit.connect(RagKit.DB_PATH)) {
            Result r = search(query, cli.intOpt("-k", 3), cli.opt("--doc-type", null), cli.opt("--equipment", null), c);
            System.out.println("🔎 " + query + "   (임베딩: " + r.model() + ", 벡터 + BM25 하이브리드)\n");
            int i = 1;
            for (Hit h : r.hits()) {
                String text = h.text.replace("\n", " ");
                System.out.println("[" + i++ + "] " + h.title + " · " + h.revision + " · " + h.headingPath);
                System.out.println("    " + (text.length() > 160 ? text.substring(0, 160) + "…" : text));
                System.out.println("    출처: " + h.sourcePath + "  (벡터 " + h.vecRank + "위, 키워드 " + h.kwRank + "위)\n");
            }
            if (cli.flag("--answer") && !r.hits().isEmpty()) {
                System.out.println("💬 " + answer(query, r.hits()));
            }
        } catch (Ollama.Unavailable e) {
            throw new Cli.Exit("❌ " + e.getMessage());
        }
    }
}
