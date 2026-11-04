package com.techreview.common;

import com.fasterxml.jackson.databind.JsonNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Ollama REST 클라이언트 (/api/embed, /api/generate, /api/chat). */
public final class Ollama {
    public static final String HOST = env("OLLAMA_HOST", "http://localhost:11434").replaceAll("/+$", "");
    public static final String LLM_MODEL = env("OLLAMA_MODEL", "qwen3:8b");
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    /** Ollama에 연결할 수 없을 때. 호출하는 쪽에서 규칙 기반(백업 모드)으로 전환한다. */
    public static final class Unavailable extends RuntimeException {
        public Unavailable(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private Ollama() {}

    public static String env(String key, String def) {
        String v = System.getenv(key);
        return v == null || v.isBlank() ? def : v;
    }

    private static JsonNode post(String path, Object payload, Duration timeout) {
        HttpRequest req = HttpRequest.newBuilder(URI.create(HOST + path))
                .timeout(timeout)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(Json.write(payload), StandardCharsets.UTF_8))
                .build();
        try {
            HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (res.statusCode() >= 400) {
                throw new Unavailable("Ollama 오류 " + res.statusCode() + ": " + res.body(), null);
            }
            return Json.read(res.body());
        } catch (IOException e) {
            throw new Unavailable("Ollama(" + HOST + ")에 연결할 수 없습니다: " + e, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new Unavailable("중단됨", e);
        }
    }

    public static List<double[]> embed(String model, List<String> inputs) {
        JsonNode res = post("/api/embed", Json.obj("model", model, "input", inputs), Duration.ofSeconds(120));
        List<double[]> out = new ArrayList<>();
        for (JsonNode vec : res.get("embeddings")) {
            double[] v = new double[vec.size()];
            for (int i = 0; i < v.length; i++) {
                v[i] = vec.get(i).asDouble();
            }
            out.add(v);
        }
        return out;
    }

    public static String generate(String prompt, String model) {
        JsonNode res = post("/api/generate", Json.obj("model", model, "prompt", prompt, "stream", false, "think", false,
                "options", Json.obj("temperature", 0)), Duration.ofSeconds(300));
        return Text.stripThink(res.path("response").asText(""));
    }

    /** 구조화 출력: JSON 스키마를 지정하면 작은 모델도 형식을 지킨다. */
    public static JsonNode chatJson(List<Map<String, String>> messages, Map<String, Object> schema, String model) {
        JsonNode res = post("/api/chat", Json.obj("model", model, "messages", messages, "format", schema, "stream", false,
                "think", false, "options", Json.obj("temperature", 0, "num_ctx", 8192)), Duration.ofSeconds(300));
        return Json.read(Text.stripThink(res.path("message").path("content").asText("")));
    }
}
