package com.techreview.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.techreview.common.Cli;
import com.techreview.common.Json;
import com.techreview.common.Ollama;
import com.techreview.common.Text;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 증분 인덱서 (indexer.py의 Java 버전): 바뀐 문서만 다시 색인하고, 사라지거나 폐기된 문서는 검색에서 뺀다.
 *
 * 흐름:  scan(원천 읽기) → plan(문서 기록표와 비교) → chunk(유형별 청킹) → enrich(맥락 보강) → embed → store
 */
public final class Indexer {
    public static String chunkerVersion = "md-heading-v1";   // 청킹 규칙을 바꾸면 이 값을 올린다 → 전체 재색인
    static final int MAX_CHARS = 600;
    public static final Path SOURCE_DIR = RagKit.BASE.resolve("sources");
    private static final Pattern FRONT = Pattern.compile("^---\\s*\\n(.*?)\\n---\\s*\\n", Pattern.DOTALL);
    private static final Pattern HEADING = Pattern.compile("^(#{1,6})\\s+(.*)");
    private static final Set<String> FACETS = Set.of("equipment", "process", "item", "line");
    private static final Set<String> RAW_TYPES = Set.of(".pdf", ".docx", ".pptx", ".xlsx", ".doc", ".ppt", ".hwp", ".hwpx");

    /** 청크 1개. */
    public static final class Chunk {
        public String heading;
        public String kind;
        public String text;
        public String context = "";
        public String embedText;

        Chunk(String heading, String kind, String text) {
            this.heading = heading;
            this.kind = kind;
            this.text = text;
        }
    }

    record Action(String act, SourceDoc doc, String docId, String reason) {}

    private Indexer() {}

    // ── 1. scan: 원천 읽기 ────────────────────────────────────────────────
    public static Map.Entry<Map<String, String>, String> parseFrontMatter(String text) {
        Matcher m = FRONT.matcher(text);
        Map<String, String> meta = new LinkedHashMap<>();
        if (!m.find() || m.start() != 0) {
            return Map.entry(meta, text);
        }
        for (String line : m.group(1).split("\n")) {
            int i = line.indexOf(':');
            if (i >= 0) {
                meta.put(line.substring(0, i).strip(), line.substring(i + 1).strip());
            }
        }
        return Map.entry(meta, text.substring(m.end()));
    }

    public static SourceDoc docFromMarkdown(Path path, String text, String rel) {
        var fm = parseFrontMatter(text);
        Map<String, String> meta = fm.getKey();
        String body = fm.getValue();
        SourceDoc d = new SourceDoc();
        Path sidecar = path.resolveSibling(path.getFileName() + ".enrich.json");   // enrich 결과 (원문은 그대로, 보강은 옆 파일)
        if (Files.exists(sidecar)) {
            JsonNode chunks = Json.read(read(sidecar)).path("chunks");
            chunks.properties().forEach(e -> d.enrichment.put(e.getKey(), Json.MAPPER.convertValue(e.getValue(), Map.class)));
        }
        String title = meta.remove("title");
        if (title == null) {
            title = body.lines().filter(ln -> ln.startsWith("# ")).map(ln -> ln.replaceAll("^[#\\s]+", "").strip()).findFirst()
                    .orElse(stem(path));
        }
        d.title = title;
        d.docId = orDefault(meta.remove("doc_id"), rel);
        d.path = rel;
        d.docType = orDefault(meta.remove("doc_type"), "일반");
        d.revision = orDefault(meta.remove("revision"), "-");
        d.status = orDefault(meta.remove("status"), "유효");
        d.meta = meta;
        d.body = body;
        return d;
    }

    /** DB 행 1건을 짧은 문서 1건으로 만든다 (불량 사례, 정비 이력 등). */
    static List<SourceDoc> docsFromCsv(Path path, String rel) {
        List<List<String>> rows = Csv.parse(read(path));
        List<String> header = rows.get(0);
        List<SourceDoc> docs = new ArrayList<>();
        for (List<String> r : rows.subList(1, rows.size())) {
            Map<String, String> row = new LinkedHashMap<>();
            for (int i = 0; i < header.size(); i++) {
                row.put(header.get(i), i < r.size() ? r.get(i) : "");
            }
            SourceDoc d = new SourceDoc();
            d.docId = row.get("case_id");
            d.path = rel + "#" + d.docId;
            d.title = "불량 사례 " + d.docId + " (" + row.get("item") + " " + row.get("defect") + ")";
            d.docType = "불량 사례";
            d.revision = row.getOrDefault("updated_at", "-");
            d.status = "유효";
            d.meta = new LinkedHashMap<>();
            d.meta.put("equipment", row.get("equipment"));
            d.meta.put("item", row.get("item"));
            d.meta.put("line", row.get("line"));
            d.meta.put("acl", "품질, 생산");
            d.body = "[불량 사례] " + row.get("date") + " · " + row.get("line") + " · " + row.get("equipment") + " · " + row.get("item")
                    + " · " + row.get("defect") + "\n현상: " + row.get("symptom") + "\n원인: " + row.get("cause")
                    + "\n조치: " + row.get("action") + "\n결과: " + row.get("result");
            d.isRecord = true;
            docs.add(d);
        }
        return docs;
    }

    static List<Path> walk(Path dir) {
        try (Stream<Path> s = Files.walk(dir)) {
            return s.filter(Files::isRegularFile).sorted().toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static Map.Entry<List<SourceDoc>, List<String>> scan(Path sourceDir) {
        List<SourceDoc> docs = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        for (Path p : walk(sourceDir)) {
            String name = p.getFileName().toString();
            if (name.startsWith(".") || name.endsWith(".meta.json")) {
                continue;
            }
            String rel = sourceDir.relativize(p).toString().replace('\\', '/');
            String suffix = suffix(name);
            if (suffix.equals(".md") || suffix.equals(".txt")) {
                docs.add(docFromMarkdown(p, read(p), rel));
            } else if (suffix.equals(".csv")) {
                docs.addAll(docsFromCsv(p, rel));
            } else if (RAW_TYPES.contains(suffix)) {
                warnings.add(rel + ": 원본 문서는 convert로 먼저 마크다운으로 변환하세요 (raw/ → sources/converted/)");
            }
        }
        Map<String, String> seen = new LinkedHashMap<>();   // 같은 doc_id가 두 번 나오면 (복사본) 첫 번째만 쓴다
        List<SourceDoc> unique = new ArrayList<>();
        for (SourceDoc d : docs) {
            if (seen.containsKey(d.docId)) {
                warnings.add(d.path + ": doc_id " + d.docId + "가 " + seen.get(d.docId) + "와 중복되어 건너뜀");
                continue;
            }
            seen.put(d.docId, d.path);
            unique.add(d);
        }
        return Map.entry(unique, warnings);
    }

    // ── 2. chunk: 문서 유형별 청킹 ────────────────────────────────────────
    /** 제목(#) 단위로 나누고 제목 경로를 기억한다. 표는 행마다 헤더를 붙여 청크로 만든다. */
    public static List<Chunk> chunkMarkdown(String body) {
        List<Chunk> chunks = new ArrayList<>();
        List<String> path = new ArrayList<>();
        List<String> buf = new ArrayList<>();
        for (String line : body.split("\n", -1)) {
            Matcher m = HEADING.matcher(line);
            if (m.matches()) {
                flush(chunks, path, buf);
                int level = m.group(1).length();
                List<String> next = new ArrayList<>(path.subList(0, Math.min(level - 1, path.size())));
                next.add(m.group(2).strip());
                path.clear();
                path.addAll(next);
            } else {
                buf.add(line);
            }
        }
        flush(chunks, path, buf);
        return chunks;
    }

    private static void flush(List<Chunk> chunks, List<String> path, List<String> buf) {
        String text = String.join("\n", buf).strip();
        buf.clear();
        if (text.isEmpty()) {
            return;
        }
        String heading = String.join(" > ", path);
        String[] lines = text.split("\n", -1);
        List<String> para = new ArrayList<>();
        int i = 0;
        while (i < lines.length) {
            if (lines[i].stripLeading().startsWith("|")) {                    // 표 블록
                List<List<String>> cells = new ArrayList<>();
                while (i < lines.length && lines[i].stripLeading().startsWith("|")) {
                    String row = lines[i].strip().replaceAll("^\\|+|\\|+$", "");
                    cells.add(Stream.of(row.split("\\|", -1)).map(String::strip).toList());
                    i++;
                }
                List<String> header = cells.get(0);
                for (List<String> r : cells.subList(1, cells.size())) {
                    if (String.join("", r).chars().allMatch(c -> "-: ".indexOf(c) >= 0)) {
                        continue;                                              // 구분선 |---|
                    }
                    List<String> parts = new ArrayList<>();
                    for (int k = 0; k < Math.min(header.size(), r.size()); k++) {
                        parts.add(header.get(k) + ": " + r.get(k));
                    }
                    chunks.add(new Chunk(heading, "table-row", String.join(" · ", parts)));
                }
            } else {
                para.add(lines[i++]);
            }
        }
        String prose = String.join("\n", para).strip();
        if (!prose.isEmpty()) {                                                // 긴 본문은 문단 단위로 MAX_CHARS 안에서 묶기
            StringBuilder piece = new StringBuilder();
            for (String p : prose.split("\\n\\s*\\n")) {
                if (piece.length() > 0 && piece.length() + p.length() > MAX_CHARS) {
                    chunks.add(new Chunk(heading, "text", piece.toString().strip()));
                    piece.setLength(0);
                }
                piece.append(p).append("\n\n");
            }
            if (!piece.toString().isBlank()) {
                chunks.add(new Chunk(heading, "text", piece.toString().strip()));
            }
        }
    }

    public static List<Chunk> chunk(SourceDoc doc) {
        if (doc.isRecord) {                                                    // 사례 1건 = 청크 1개
            return new ArrayList<>(List.of(new Chunk("사례", "record", doc.body)));
        }
        return chunkMarkdown(doc.body);
    }

    // ── 3. enrich: 청크에 맥락 붙이기 ─────────────────────────────────────
    @SuppressWarnings("unchecked")
    static void enrich(Connection c, SourceDoc doc, List<Chunk> chunks, boolean contextualize) throws SQLException {
        String facets = doc.meta.entrySet().stream().filter(e -> FACETS.contains(e.getKey()))
                .map(e -> e.getKey() + ": " + e.getValue()).collect(Collectors.joining(" · "));
        for (Chunk ch : chunks) {
            if (contextualize) {   // Contextual Retrieval: LLM이 '이 청크가 문서에서 무슨 내용인지' 한 문장
                String key = "ctx:" + Ollama.LLM_MODEL + ":" + Text.sha256(doc.contentHash() + ch.text);
                String hit = RagKit.cacheGet(c, key);
                if (hit != null) {
                    ch.context = Json.read(hit).asText();
                } else {
                    String prompt = "다음은 제조 현장 문서 '" + doc.title + "'의 일부다.\n[문서 앞부분]\n"
                            + doc.body.substring(0, Math.min(1500, doc.body.length())) + "\n\n[청크]\n" + ch.text
                            + "\n\n이 청크가 문서 안에서 어떤 내용인지 검색에 도움이 되도록 한국어 한 문장으로만 써라.";
                    String first = Ollama.generate(prompt, Ollama.LLM_MODEL).lines().findFirst().orElse("");
                    ch.context = first.substring(0, Math.min(200, first.length()));
                    RagKit.cachePut(c, key, Json.write(ch.context));
                }
            }
            Map<String, Object> e = (Map<String, Object>) doc.enrichment.getOrDefault(Text.sha256(ch.text), Map.of());
            if (!e.isEmpty() && ch.context.isEmpty()) {
                ch.context = String.valueOf(e.getOrDefault("context", ""));
            }
            List<String> keywords = (List<String>) e.getOrDefault("keywords", List.of());
            List<String> questions = (List<String>) e.getOrDefault("questions", List.of());
            ch.embedText = Stream.of(
                    "[" + doc.docType + "] " + doc.title + " > " + ch.heading,     // 제목 경로
                    facets,                                                        // 설비·공정·품목
                    ch.context,                                                    // 맥락 문장 (LLM)
                    String.valueOf(e.getOrDefault("standalone", "")),               // 지시어를 푼 요약 (enrich)
                    keywords.isEmpty() ? "" : "키워드: " + String.join(", ", keywords),
                    questions.isEmpty() ? "" : "예상 질문: " + String.join(" / ", questions),
                    ch.text).filter(x -> !x.isEmpty()).collect(Collectors.joining("\n"));
        }
    }

    // ── 4. plan & store ──────────────────────────────────────────────────
    static Map<String, Map<String, String>> records(Connection c) throws SQLException {
        Map<String, Map<String, String>> out = new LinkedHashMap<>();
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM documents"); ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Map<String, String> r = new LinkedHashMap<>();
                for (String col : List.of("doc_id", "source_path", "content_hash", "revision", "status", "embed_model", "chunker_version")) {
                    r.put(col, rs.getString(col));
                }
                out.put(r.get("doc_id"), r);
            }
        }
        return out;
    }

    static List<Action> plan(Connection c, List<SourceDoc> docs, String embedModel) throws SQLException {
        Map<String, Map<String, String>> recs = records(c);
        List<Action> actions = new ArrayList<>();
        for (SourceDoc d : docs) {
            Map<String, String> rec = recs.get(d.docId);
            if ("폐기".equals(d.status)) {
                if (rec != null && !"폐기".equals(rec.get("status"))) {
                    actions.add(new Action("withdraw", d, d.docId, d.revision + " 폐기 → 검색에서 제외"));
                } else {
                    actions.add(new Action("skip", d, d.docId, "폐기 문서"));
                }
            } else if (rec == null) {
                actions.add(new Action("add", d, d.docId, "새 문서"));
            } else {
                List<String> reasons = new ArrayList<>();
                if ("폐기".equals(rec.get("status"))) {
                    reasons.add("폐기 해제");
                }
                if (!d.contentHash().equals(rec.get("content_hash"))) {
                    reasons.add(rec.get("revision").equals(d.revision) ? "내용 변경" : "내용 변경 (" + rec.get("revision") + " → " + d.revision + ")");
                }
                if (!embedModel.equals(rec.get("embed_model"))) {
                    reasons.add("임베딩 모델 변경 (" + rec.get("embed_model") + " → " + embedModel + ")");
                }
                if (!chunkerVersion.equals(rec.get("chunker_version"))) {
                    reasons.add("청킹 규칙 변경 (" + rec.get("chunker_version") + " → " + chunkerVersion + ")");
                }
                actions.add(reasons.isEmpty() ? new Action("skip", d, d.docId, "변경 없음")
                        : new Action("update", d, d.docId, String.join(", ", reasons)));
            }
        }
        Set<String> seen = docs.stream().map(d -> d.docId).collect(Collectors.toSet());
        for (var e : recs.entrySet()) {
            if (!seen.contains(e.getKey())) {
                actions.add(new Action("remove", null, e.getKey(), "원천에서 사라짐 (" + e.getValue().get("source_path") + ")"));
            }
        }
        return actions;
    }

    static void store(Connection c, SourceDoc doc, List<Chunk> chunks, List<double[]> vectors, String embedModel) throws SQLException {
        exec(c, "DELETE FROM chunks WHERE doc_id=?", doc.docId);                // 이 문서의 옛 청크만 교체
        for (int i = 0; i < chunks.size(); i++) {
            Chunk ch = chunks.get(i);
            exec(c, "INSERT INTO chunks VALUES (?,?,?,?,?,?,?,?,?)", String.format("%s#%03d", doc.docId, i), doc.docId, i,
                    ch.heading, ch.text, ch.context, ch.embedText, Json.write(vectors.get(i)), Json.write(Map.of("kind", ch.kind)));
        }
        recordDoc(c, doc, embedModel, chunks.size());
    }

    static void recordDoc(Connection c, SourceDoc doc, String embedModel, int nChunks) throws SQLException {
        exec(c, "INSERT OR REPLACE INTO documents VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", doc.docId, doc.path, doc.contentHash(),
                doc.title, doc.docType, doc.revision, doc.status, Json.write(doc.meta), chunkerVersion, embedModel, nChunks,
                LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString());
    }

    static void exec(Connection c, String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                ps.setObject(i + 1, params[i]);
            }
            ps.executeUpdate();
        }
    }

    static long count(Connection c, String sql) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getLong(1) : 0;
        }
    }

    static final Map<String, String> ICON = new LinkedHashMap<>();

    static {
        ICON.put("add", "➕ 추가");
        ICON.put("update", "♻️  갱신");
        ICON.put("skip", "⏭  유지");
        ICON.put("withdraw", "🚫 폐기");
        ICON.put("remove", "🗑  삭제");
    }

    public static Map<String, Integer> run(Path sourceDir, String embedModel, boolean contextualize, boolean dryRun,
                                           boolean verbose, Connection c, Consumer<String> out) throws SQLException {
        var scanned = scan(sourceDir);
        List<SourceDoc> docs = scanned.getKey();
        List<Action> actions = plan(c, docs, embedModel);
        Map<String, Integer> counts = new LinkedHashMap<>();
        ICON.keySet().forEach(k -> counts.put(k, 0));
        for (Action a : actions) {
            counts.merge(a.act(), 1, Integer::sum);
            if (!a.act().equals("skip") || verbose) {
                out.accept(String.format("  %s  %-16s %s", ICON.get(a.act()), a.docId(), a.reason()));
            }
            if (dryRun || a.act().equals("skip")) {
                continue;
            }
            switch (a.act()) {
                case "remove" -> {
                    exec(c, "DELETE FROM chunks WHERE doc_id=?", a.docId());
                    exec(c, "DELETE FROM documents WHERE doc_id=?", a.docId());
                }
                case "withdraw" -> {
                    exec(c, "DELETE FROM chunks WHERE doc_id=?", a.docId());   // 감사용 원본은 원천에 남아 있음
                    recordDoc(c, a.doc(), embedModel, 0);
                }
                default -> {
                    List<Chunk> chunks = chunk(a.doc());
                    enrich(c, a.doc(), chunks, contextualize);
                    List<double[]> vectors = RagKit.embed(c, chunks.stream().map(ch -> ch.embedText).toList(), embedModel);
                    store(c, a.doc(), chunks, vectors, embedModel);
                }
            }
            c.commit();
        }
        scanned.getValue().forEach(w -> out.accept("  ⚠️  " + w));
        long total = count(c, "SELECT COUNT(*) FROM chunks");
        out.accept(String.format("  ── 문서 %d건: 추가 %d · 갱신 %d · 유지 %d · 폐기 %d · 삭제 %d  |  검색 가능한 청크 %d개%s", docs.size(),
                counts.get("add"), counts.get("update"), counts.get("skip"), counts.get("withdraw"), counts.get("remove"), total,
                dryRun ? "  (dry-run: 반영 안 함)" : ""));
        if (!dryRun) {
            exec(c, "INSERT INTO runs(started_at, added, updated, skipped, removed, withdrawn, embed_model, note) VALUES (?,?,?,?,?,?,?,?)",
                    LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString(), counts.get("add"), counts.get("update"),
                    counts.get("skip"), counts.get("remove"), counts.get("withdraw"), embedModel, contextualize ? "contextualize" : "");
        }
        c.commit();
        return counts;
    }

    // ── 도우미 ───────────────────────────────────────────────────────────
    static String read(Path p) {
        try {
            return Files.readString(p, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static String suffix(String name) {
        int i = name.lastIndexOf('.');
        return i < 0 ? "" : name.substring(i).toLowerCase();
    }

    static String stem(Path p) {
        String n = p.getFileName().toString();
        int i = n.lastIndexOf('.');
        return i < 0 ? n : n.substring(0, i);
    }

    static String orDefault(String v, String def) {
        return v == null ? def : v;
    }

    public static void main(String[] args) throws Exception {
        Cli cli = new Cli(args, Set.of("--source", "--embed-model", "--watch"));
        Path source = Path.of(cli.opt("--source", SOURCE_DIR.toString()));
        String model = cli.flag("--offline") ? RagKit.OFFLINE_MODEL : cli.opt("--embed-model", RagKit.EMBED_MODEL);
        if (cli.flag("--offline") && cli.flag("--contextualize")) {
            throw new Cli.Exit("--contextualize는 Ollama LLM이 필요해서 --offline과 함께 쓸 수 없습니다.");
        }
        int watch = cli.intOpt("--watch", 0);
        try (Connection c = RagKit.connect(RagKit.DB_PATH)) {
            while (true) {
                System.out.printf("📚 인덱싱 %s  원천: %s  임베딩: %s  청킹: %s%n",
                        LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss")), source, model, chunkerVersion);
                run(source, model, cli.flag("--contextualize"), cli.flag("--dry-run"), cli.flag("--verbose"), c, System.out::println);
                if (watch == 0) {
                    break;
                }
                Thread.sleep(watch * 1000L);
            }
        } catch (Ollama.Unavailable e) {
            throw new Cli.Exit("❌ " + e.getMessage());
        }
    }

    /** RFC 4180 형식의 간단한 CSV 파서 (따옴표 지원). */
    static final class Csv {
        static List<List<String>> parse(String text) {
            List<List<String>> rows = new ArrayList<>();
            List<String> row = new ArrayList<>();
            StringBuilder cell = new StringBuilder();
            boolean quoted = false;
            String t = text.startsWith("﻿") ? text.substring(1) : text;
            for (int i = 0; i < t.length(); i++) {
                char ch = t.charAt(i);
                if (quoted) {
                    if (ch == '"' && i + 1 < t.length() && t.charAt(i + 1) == '"') {
                        cell.append('"');
                        i++;
                    } else if (ch == '"') {
                        quoted = false;
                    } else {
                        cell.append(ch);
                    }
                } else if (ch == '"') {
                    quoted = true;
                } else if (ch == ',') {
                    row.add(cell.toString());
                    cell.setLength(0);
                } else if (ch == '\n' || ch == '\r') {
                    if (ch == '\r' && i + 1 < t.length() && t.charAt(i + 1) == '\n') {
                        i++;
                    }
                    row.add(cell.toString());
                    cell.setLength(0);
                    if (!(row.size() == 1 && row.get(0).isEmpty())) {
                        rows.add(row);
                    }
                    row = new ArrayList<>();
                } else {
                    cell.append(ch);
                }
            }
            if (cell.length() > 0 || !row.isEmpty()) {
                row.add(cell.toString());
                rows.add(row);
            }
            return rows;
        }
    }
}
