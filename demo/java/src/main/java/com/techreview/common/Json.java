package com.techreview.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.util.LinkedHashMap;
import java.util.Map;

/** Jackson 래퍼. */
public final class Json {
    public static final ObjectMapper MAPPER = new ObjectMapper();
    private static final ObjectMapper PRETTY = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    private Json() {}

    public static String write(Object value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String pretty(Object value) {
        try {
            return PRETTY.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    public static JsonNode read(String json) {
        try {
            return MAPPER.readTree(json);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("JSON 파싱 실패: " + e.getOriginalMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> readMap(String json) {
        try {
            return MAPPER.readValue(json, LinkedHashMap.class);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("JSON 파싱 실패: " + e.getOriginalMessage(), e);
        }
    }

    /** 키-값 쌍으로 순서가 유지되는 Map을 만든다: Json.obj("a", 1, "b", 2) */
    public static Map<String, Object> obj(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }
}
