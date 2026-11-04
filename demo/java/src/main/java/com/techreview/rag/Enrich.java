package com.techreview.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.techreview.common.Cli;
import com.techreview.common.Json;
import com.techreview.common.Ollama;
import com.techreview.common.Text;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 청크 보강 (enrich.py의 Java 버전): Ollama LLM으로 검색용 필드를 만들어 원문 옆에 붙인다 ("다시 쓰지 말고, 덧붙인다").
 *
 * 흐름:  md 읽기 → 인덱서와 같은 규칙으로 청킹 → 문서 요약(1회) → 청크마다 보강(구조화 출력) → 숫자 검증 → 옆 파일 저장
 *
 * - 원문 md는 바꾸지 않는다. 결과는 `문서.md.enrich.json`에 청크 해시별로 저장한다 (파이썬 버전과 같은 형식)
 * - 필드: context(문서 속 위치), standalone(지시어를 푼 요약), questions(예상 질문 3~5개), keywords(키워드·동의어)
 * - few-shot: examples/enrich_examples.json, 용어 사전: glossary.json
 * - 검증: 생성된 문장 속 숫자가 원문에 없으면 그 필드(질문은 그 질문만)를 버린다
 */
public final class Enrich {
    static final String PROMPT_VERSION = "enrich-v1";   // 프롬프트나 스키마를 바꾸면 올린다 → 전체 다시 보강
    static final Path EXAMPLES = RagKit.BASE.resolve("examples").resolve("enrich_examples.json");
    static final Path GLOSSARY = RagKit.BASE.resolve("glossary.json");

    static final Map<String, Object> DOC_SCHEMA = Json.obj(
            "type", "object",
            "properties", Json.obj("summary", Json.obj("type", "string"), "topics", Json.obj("type", "array", "items", Json.obj("type", "string"))),
            "required", List.of("summary", "topics"));
    static final Map<String, Object> CHUNK_SCHEMA = Json.obj(
            "type", "object",
            "properties", Json.obj(
                    "context", Json.obj("type", "string"),
                    "standalone", Json.obj("type", "string"),
                    "questions", Json.obj("type", "array", "items", Json.obj("type", "string"), "minItems", 3, "maxItems", 5),
                    "keywords", Json.obj("type", "array", "items", Json.obj("type", "string"), "maxItems", 8)),
            "required", List.of("context", "standalone", "questions", "keywords"));
    static final String SYSTEM = """
            너는 중소 제조공장의 문서를 검색용으로 정리하는 도우미다. 주어진 청크만 근거로 JSON을 만든다.
            - context: 이 청크가 문서 전체에서 어떤 내용인지 한 문장
            - standalone: '위 조건', '이 설비', '해당 품목' 같은 지시어를 문서 제목·제목 경로의 실제 이름으로 바꿔, 청크만 읽어도 이해되는 1~2문장 요약
            - questions: 현장 작업자가 실제로 물을 법한 짧은 질문 3~5개 (구어체, 동의어·줄임말 사용)
            - keywords: 검색에 도움이 되는 키워드와 동의어 최대 8개
            - 숫자와 단위는 청크에 있는 그대로만 쓴다. 청크에 없는 사실이나 숫자를 만들지 않는다
            - 모두 한국어로 쓴다""";

    private Enrich() {}

    static Map<String, List<String>> loadGlossary() throws IOException {
        Map<String, List<String>> g = new LinkedHashMap<>();
        if (Files.exists(GLOSSARY)) {
            Json.read(Files.readString(GLOSSARY)).fields().forEachRemaining(e -> {
                if (!e.getKey().startsWith("_")) {
                    List<String> syns = new ArrayList<>();
                    e.getValue().forEach(v -> syns.add(v.asText()));
                    g.put(e.getKey(), syns);
                }
            });
        }
        return g;
    }

    /** 앞에 한글이 붙어 있으면 다른 단어의 일부로 본다 ("커버"의 "버"는 burr가 아님). */
    static List<String> glossaryTerms(String text, Map<String, List<String>> glossary) {
        List<String> out = new ArrayList<>();
        glossary.forEach((term, syns) -> {
            if (Pattern.compile("(?<![가-힣])" + Pattern.quote(term)).matcher(text).find()) {
                out.addAll(syns);
            }
        });
        return out;
    }

    static String chunkPrompt(String title, String summary, String heading, String text) {
        return "[문서 제목] " + title + "\n" + (summary.isEmpty() ? "" : "[문서 요약] " + summary + "\n")
                + "[제목 경로] " + heading + "\n[청크]\n" + text;
    }

    static List<Map<String, String>> fewShotMessages() throws IOException {
        List<Map<String, String>> msgs = new ArrayList<>();
        if (Files.exists(EXAMPLES)) {
            for (JsonNode ex : Json.read(Files.readString(EXAMPLES))) {
                msgs.add(Map.of("role", "user", "content", chunkPrompt(ex.get("doc_title").asText(), "", ex.get("heading").asText(), ex.get("chunk").asText())));
                msgs.add(Map.of("role", "assistant", "content", Json.write(ex.get("output"))));
            }
        }
        return msgs;
    }

    static List<String> strings(JsonNode node) {
        List<String> out = new ArrayList<>();
        if (node != null) {
            node.forEach(v -> out.add(v.asText()));
        }
        return out;
    }

    /** 생성된 문장 속 숫자가 원문에 있는지 확인한다. 없으면 버린다. dropped에 사유를 남긴다. */
    static Map<String, Object> verify(JsonNode fields, Set<String> allowed, List<String> dropped) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (String key : List.of("context", "standalone")) {
            String val = fields.path(key).asText("").strip();
            Set<String> bad = new LinkedHashSet<>(Text.numbers(val));
            bad.removeAll(allowed);
            if (!bad.isEmpty()) {
                dropped.add(key + ": 근거 없는 숫자 " + bad);
            } else if (!val.isEmpty()) {
                out.put(key, val);
            }
        }
        for (String key : List.of("questions", "keywords")) {
            List<String> keep = new ArrayList<>();
            for (String item : strings(fields.get(key))) {
                Set<String> bad = new LinkedHashSet<>(Text.numbers(item));
                bad.removeAll(allowed);
                if (!bad.isEmpty()) {
                    dropped.add(key + " '" + item + "': 근거 없는 숫자 " + bad);
                } else if (!item.isBlank()) {
                    keep.add(item.strip());
                }
            }
            out.put(key, keep);
        }
        return out;
    }

    /** LLM 없이 만들 수 있는 보강: 제목 경로를 문장으로, 설비·품목, 제목의 단어. */
    static Map<String, Object> ruleBased(SourceDoc doc, Indexer.Chunk c) {
        Set<String> kw = new LinkedHashSet<>();
        doc.meta.forEach((k, v) -> {
            if (Set.of("equipment", "item", "process", "line").contains(k)) {
                kw.add(v);
            }
        });
        for (String w : c.heading.split("[\\s>()·:]+")) {
            if (w.length() > 1 && !w.matches("[\\d.]+")) {
                kw.add(w);
            }
        }
        String[] parts = c.heading.split(" > ");
        return Json.obj("context", doc.title + "의 '" + parts[parts.length - 1] + "' 부분이다.", "standalone", "",
                "questions", new ArrayList<String>(), "keywords", new ArrayList<>(kw.stream().limit(8).toList()));
    }

    @SuppressWarnings("unchecked")
    static int[] enrichFile(Path path, String model, boolean offline, Map<String, List<String>> glossary,
                            List<Map<String, String>> shots, Consumer<String> out) throws IOException {
        SourceDoc doc = Indexer.docFromMarkdown(path, Files.readString(path), path.getFileName().toString());
        Path sidecar = path.resolveSibling(path.getFileName() + ".enrich.json");
        Map<String, Object> old = Files.exists(sidecar) ? Json.readMap(Files.readString(sidecar)) : Map.of();
        String engine = offline ? "rules" : model;
        Map<String, Object> reuse = engine.equals(old.get("engine")) && PROMPT_VERSION.equals(old.get("prompt_version"))
                ? (Map<String, Object>) old.getOrDefault("chunks", Map.of()) : Map.of();

        List<Indexer.Chunk> chunks = Indexer.chunk(doc);
        Set<String> hashes = chunks.stream().map(c -> Text.sha256(c.text)).collect(Collectors.toCollection(LinkedHashSet::new));
        long todo = hashes.stream().filter(h -> !reuse.containsKey(h)).count();
        if (todo == 0 && reuse.keySet().equals(hashes)) {
            return new int[]{0, chunks.size()};                                      // 바뀐 청크 없음
        }
        String summary = reuse.isEmpty() ? "" : String.valueOf(((Map<String, Object>) old.getOrDefault("doc", Map.of())).getOrDefault("summary", ""));
        if (!offline && summary.isEmpty()) {                                         // 문서 요약은 1회만
            summary = Ollama.chatJson(List.of(
                    Map.of("role", "system", "content", "제조 문서를 한국어 두 문장으로 요약하고 주요 주제어를 뽑아라. 문서에 없는 내용은 쓰지 않는다."),
                    Map.of("role", "user", "content", "[문서 제목] " + doc.title + "\n" + doc.body.substring(0, Math.min(4000, doc.body.length())))),
                    DOC_SCHEMA, model).path("summary").asText("");
        }
        Set<String> allowed = Text.numbers(doc.title + " " + doc.body);
        Map<String, Object> result = new LinkedHashMap<>();
        for (Indexer.Chunk c : chunks) {
            String h = Text.sha256(c.text);
            if (reuse.containsKey(h)) {
                result.put(h, reuse.get(h));
                continue;
            }
            List<String> dropped = new ArrayList<>();
            Map<String, Object> fields;
            if (offline) {
                fields = ruleBased(doc, c);
            } else {
                List<Map<String, String>> msgs = new ArrayList<>();
                msgs.add(Map.of("role", "system", "content", SYSTEM));
                msgs.addAll(shots);
                msgs.add(Map.of("role", "user", "content", chunkPrompt(doc.title, summary, c.heading, c.text)));
                try {
                    fields = verify(Ollama.chatJson(msgs, CHUNK_SCHEMA, model), allowed, dropped);
                } catch (IllegalArgumentException e) {                              // 형식 오류 → 규칙 기반으로 대체하고 기록
                    fields = ruleBased(doc, c);
                    dropped.add("LLM 출력 오류: " + e.getClass().getSimpleName());
                }
            }
            List<String> keywords = new ArrayList<>((List<String>) fields.get("keywords"));
            for (String t : glossaryTerms(c.text + " " + c.heading, glossary)) {    // 용어 사전 동의어는 규칙으로 보장
                if (!keywords.contains(t)) {
                    keywords.add(t);
                }
            }
            fields.put("keywords", keywords);
            if (!dropped.isEmpty()) {
                fields.put("dropped", dropped);
            }
            result.put(h, fields);
            String[] parts = c.heading.split(" > ");
            dropped.forEach(d -> out.accept("     ⚠️  " + parts[parts.length - 1] + ": " + d));
        }
        Files.writeString(sidecar, Json.pretty(Json.obj("doc_id", doc.docId, "engine", engine, "prompt_version", PROMPT_VERSION,
                "enriched_at", LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString(),
                "doc", Json.obj("summary", summary), "chunks", result)), StandardCharsets.UTF_8);
        return new int[]{(int) todo, chunks.size() - (int) todo};
    }

    public static int[] run(Path sourceDir, String model, boolean offline, Consumer<String> out) throws IOException {
        Map<String, List<String>> glossary = loadGlossary();
        List<Map<String, String>> shots = offline ? List.of() : fewShotMessages();
        int docs = 0;
        int made = 0;
        int reused = 0;
        for (Path p : Indexer.walk(sourceDir)) {
            if (!p.toString().endsWith(".md")) {
                continue;
            }
            int[] r = enrichFile(p, model, offline, glossary, shots, out);
            docs++;
            made += r[0];
            reused += r[1];
            if (r[0] > 0) {
                out.accept("  ✨ 보강  " + sourceDir.relativize(p).toString().replace('\\', '/') + "  (새로 " + r[0] + " · 재사용 " + r[1] + ")");
            }
        }
        out.accept("  ── 문서 " + docs + "건 · 청크 새로 보강 " + made + " · 재사용 " + reused);
        return new int[]{docs, made, reused};
    }

    public static void main(String[] args) throws Exception {
        Cli cli = new Cli(args, Set.of("--source", "--model"));
        Path source = Path.of(cli.opt("--source", Indexer.SOURCE_DIR.toString()));
        String model = cli.opt("--model", Ollama.LLM_MODEL);
        boolean offline = cli.flag("--offline");
        System.out.println("✨ 보강  " + source + "  (엔진: " + (offline ? "rules" : model) + ", 프롬프트: " + PROMPT_VERSION + ")");
        try {
            run(source, model, offline, System.out::println);
        } catch (Ollama.Unavailable e) {
            throw new Cli.Exit("❌ " + e.getMessage() + " (LLM 없이 해 보려면 --offline)");
        }
        if (cli.flag("--show")) {
            Indexer.walk(source).stream().filter(p -> p.toString().endsWith(".enrich.json")).limit(3).forEach(p -> {
                try {
                    JsonNode d = Json.read(Files.readString(p));
                    System.out.println("\n📄 " + d.path("doc_id").asText() + "  (엔진: " + d.path("engine").asText() + ")");
                    System.out.println(Json.pretty(d.path("chunks").elements().next()));
                } catch (IOException e) {
                    throw new IllegalStateException(e);
                }
            });
        }
    }
}
