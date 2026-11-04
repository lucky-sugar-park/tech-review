package com.techreview.rag;

import com.techreview.common.Json;
import com.techreview.common.Text;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

/** 원천에서 읽은 문서 1건. */
public final class SourceDoc {
    public String docId;
    public String path;
    public String title;
    public String docType;
    public String revision;
    public String status;
    public Map<String, String> meta = new LinkedHashMap<>();
    public String body;                                        // 청킹할 본문 (md)
    public boolean isRecord;                                   // DB 행에서 만든 문서인가
    public Map<String, Object> enrichment = new LinkedHashMap<>();   // enrich가 만든 보강 정보 (청크 해시 → 필드)

    /** 본문 + 메타데이터 + 보강 정보가 바뀌면 다시 색인한다. */
    public String contentHash() {
        String enr = enrichment.isEmpty() ? "" : Json.write(new TreeMap<>(enrichment));
        return Text.sha256(String.join("\n", title, docType, revision, status, Json.write(new TreeMap<>(meta)), body, enr));
    }
}
