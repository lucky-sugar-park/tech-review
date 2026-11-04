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
import java.sql.Connection;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;

/**
 * 인덱싱 방식별 검색 품질 비교 (evaluate.py의 Java 버전): 같은 원본, 같은 질문으로 네 가지 인덱스를 만들어 적중률을 잰다.
 *
 * plain(문자열만 300자씩) / converted(구조화 md) / enriched(구조화 + 보강) / gold(Claude md)
 * 지표: Hit@1, Hit@3, MRR@5. 질문은 eval/questions.json.
 */
public final class Evaluate {
    static final Path WORK = Path.of("workspace", "eval");
    static final Path QUESTIONS = RagKit.BASE.resolve("eval").resolve("questions.json");
    static final Path GOLD = RagKit.BASE.resolve("gold");
    static final List<String> VARIANTS = List.of("plain", "converted", "enriched", "gold");
    static final Map<String, String> LABEL = Map.of("plain", "단순 추출", "converted", "구조화 md", "enriched", "구조화 + LLM 보강", "gold", "Claude md");

    record Question(String q, List<String> expect) {}

    record Score(List<Integer> ranks, double hit1, double hit3, double mrr, long chunks) {}

    private Evaluate() {}

    /** 마크다운 표시를 모두 지우고 글자만 남긴 뒤 300자씩 자른다 (흔한 단순 파이프라인). */
    static String plainText(String md) {
        String text = Pattern.compile("^---.*?---\\s*", Pattern.DOTALL).matcher(md).replaceFirst("");
        text = text.replaceAll("(?m)^\\|?\\s*-{3,}.*$", "");
        text = text.replaceAll("(?m)[#*|>]|^- ", " ");
        String words = String.join(" ", text.strip().split("\\s+"));
        List<String> pieces = new ArrayList<>();
        for (int i = 0; i < words.length(); i += 300) {
            pieces.add(words.substring(i, Math.min(words.length(), i + 300)));
        }
        return String.join("\n\n", pieces);
    }

    static void copyTree(Path from, Path to, Predicate<Path> skip) throws IOException {
        for (Path p : Indexer.walk(from)) {
            Path rel = from.relativize(p);
            if (skip.test(rel)) {
                continue;
            }
            Files.createDirectories(to.resolve(rel).getParent());
            Files.copy(p, to.resolve(rel));
        }
    }

    static void deleteTree(Path p) throws IOException {
        if (Files.exists(p)) {
            try (var s = Files.walk(p)) {
                s.sorted(Comparator.reverseOrder()).forEach(x -> x.toFile().delete());
            }
        }
    }

    static Path buildSources(String variant, Path root, String llmModel, boolean offline) throws IOException {
        Path src = root.resolve("sources");
        copyTree(Indexer.SOURCE_DIR, src, rel -> rel.startsWith("converted") || rel.toString().endsWith(".enrich.json"));   // 방해 문서 (공통)
        if (variant.equals("gold")) {
            copyTree(GOLD, src.resolve("gold"), rel -> false);
            return src;
        }
        Path conv = src.resolve("converted");
        Converter.run(Converter.RAW_DIR, conv, true, s -> { });
        if (variant.equals("plain")) {
            for (Path md : Indexer.walk(conv)) {
                String text = Files.readString(md);
                Map<String, String> meta = Indexer.parseFrontMatter(text).getKey();
                String name = Path.of(meta.get("source")).getFileName().toString();
                Files.writeString(md, "---\ndoc_id: " + meta.get("doc_id") + "\ntitle: " + name + "\n---\n\n" + plainText(text) + "\n", StandardCharsets.UTF_8);
            }
        }
        if (variant.equals("enriched")) {
            Enrich.run(conv, llmModel, offline, s -> { });
        }
        return src;
    }

    static String norm(String s) {
        return s.replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    static Score evaluate(String variant, List<Question> questions, String embedModel, String llmModel, boolean offline) throws Exception {
        Path root = WORK.resolve(variant);
        deleteTree(root);
        Files.createDirectories(root);
        Path src = buildSources(variant, root, llmModel, offline);
        try (Connection c = RagKit.connect(root.resolve("index.db"))) {
            Indexer.run(src, embedModel, false, false, false, c, s -> { });
            List<Integer> ranks = new ArrayList<>();
            for (Question q : questions) {
                List<Search.Hit> hits = Search.search(q.q(), 5, null, null, c).hits();
                Integer rank = null;
                for (int i = 0; i < hits.size() && rank == null; i++) {
                    String t = norm(hits.get(i).text);
                    if (q.expect().stream().allMatch(e -> t.contains(norm(e)))) {
                        rank = i + 1;
                    }
                }
                ranks.add(rank);
            }
            int n = questions.size();
            return new Score(ranks,
                    ranks.stream().filter(r -> r != null && r == 1).count() / (double) n,
                    ranks.stream().filter(r -> r != null && r <= 3).count() / (double) n,
                    ranks.stream().filter(r -> r != null).mapToDouble(r -> 1.0 / r).sum() / n,
                    Indexer.count(c, "SELECT COUNT(*) FROM chunks"));
        }
    }

    public static void main(String[] args) throws Exception {
        Cli cli = new Cli(args, Set.of("--variants", "--model"));
        boolean offline = cli.flag("--offline");
        String embedModel = offline ? RagKit.OFFLINE_MODEL : RagKit.EMBED_MODEL;
        String llmModel = cli.opt("--model", Ollama.LLM_MODEL);
        List<Question> questions = new ArrayList<>();
        for (JsonNode q : Json.read(Files.readString(QUESTIONS))) {
            questions.add(new Question(q.get("q").asText(), Enrich.strings(q.get("expect"))));
        }
        List<String> variants = Arrays.stream(cli.opt("--variants", String.join(",", VARIANTS)).split(",")).map(String::strip).toList();
        System.out.printf("📏 평가: 질문 %d개 · 임베딩 %s · 보강 %s%n%n", questions.size(), embedModel, offline ? "rules" : llmModel);
        Map<String, Score> results = new LinkedHashMap<>();
        try {
            for (String v : variants) {
                results.put(v, evaluate(v, questions, embedModel, llmModel, offline));
            }
        } catch (Ollama.Unavailable e) {
            throw new Cli.Exit("❌ " + e.getMessage() + " (Ollama 없이 해 보려면 --offline)");
        }
        System.out.println(Text.padDisplay("방식", 34) + String.format("%7s%7s%7s%6s", "Hit@1", "Hit@3", "MRR@5", "청크"));
        results.forEach((v, r) -> System.out.println(Text.padDisplay(v + " (" + LABEL.get(v) + ")", 34)
                + String.format("%6.0f%%%6.0f%%%7.2f%6d", r.hit1() * 100, r.hit3() * 100, r.mrr(), r.chunks())));
        if (cli.flag("--detail")) {
            System.out.println("\n질문별 정답 순위 (- = 5위 안에 없음)");
            for (int i = 0; i < questions.size(); i++) {
                StringBuilder cells = new StringBuilder();
                for (var e : results.entrySet()) {
                    Integer r = e.getValue().ranks().get(i);
                    cells.append(e.getKey(), 0, 4).append(':').append(r == null ? "-" : r.toString()).append("  ");
                }
                System.out.println("  " + cells + " " + questions.get(i).q());
            }
        }
    }
}
