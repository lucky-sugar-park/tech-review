package com.techreview.common;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * LangGraph의 StateGraph를 흉내 낸 최소 구현: 이름 붙은 노드를 간선 순서대로 실행하며 하나의 상태 객체를 갱신한다.
 * 데모 흐름은 직선(collect → analyze → …)이라 조건 분기는 넣지 않았다.
 * 분기·병렬·체크포인트가 필요하면 LangGraph4j(org.bsc.langgraph4j)를 쓰면 된다.
 */
public final class StateGraph<S> {
    public static final String START = "__start__";
    public static final String END = "__end__";

    private final Map<String, Consumer<S>> nodes = new LinkedHashMap<>();
    private final Map<String, String> edges = new HashMap<>();

    public StateGraph<S> addNode(String name, Consumer<S> node) {
        nodes.put(name, node);
        return this;
    }

    public StateGraph<S> addEdge(String from, String to) {
        edges.put(from, to);
        return this;
    }

    /** START부터 END까지 간선을 따라가며 실행 순서를 확정한다. */
    public Compiled<S> compile() {
        List<String> order = new ArrayList<>();
        String cur = edges.get(START);
        while (cur != null && !cur.equals(END)) {
            if (!nodes.containsKey(cur)) {
                throw new IllegalStateException("정의되지 않은 노드: " + cur);
            }
            if (order.contains(cur)) {
                throw new IllegalStateException("순환이 있습니다: " + cur);
            }
            order.add(cur);
            cur = edges.get(cur);
        }
        if (cur == null) {
            throw new IllegalStateException("END로 가는 간선이 없습니다");
        }
        return new Compiled<>(order, nodes);
    }

    public record Compiled<S>(List<String> order, Map<String, Consumer<S>> nodes) {
        public S invoke(S state) {
            for (String name : order) {
                nodes.get(name).accept(state);
            }
            return state;
        }
    }
}
