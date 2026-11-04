# RAG 인덱싱을 동적으로 관리하는 시스템: 모범 사례 조사

> 작성일: 2026-11-04
> 관련 문서: [AI 공장장 보고서](./ai-plant-manager.md) · [강의안 (지식 도우미)](./lecture/mes-ai-plant-manager-lecture.md)
> 전제: 사내 서버에서 Ollama로 RAG를 구축하는 중소 제조기업. 대상 문서는 MES 사용 매뉴얼, 작업표준서, 검사 기준서, 설비 매뉴얼, 불량·정비 이력.

---

## 1. 요약: 내 생각

1. **인덱싱은 한 번 하는 작업이 아니라 계속 도는 파이프라인이다.** 문서는 추가되고, 개정되고, 폐기된다. 성공한 시스템은 모두 "무엇이 바뀌었는지 알고, 바뀐 것만 다시 처리하고, 사라진 것은 지운다"를 자동으로 한다.
2. **사람이 md를 일일이 만드는 대신, md는 시스템이 만드는 '중간 산출물'로 둔다.** 원본(PDF, DOCX, 엑셀, DB)은 그대로 두고, 변환된 md와 청크를 사람이 **검수하고 고칠 수 있게** 보여주는 구조가 가장 현실적이다 (RAGFlow의 청크 확인·수정 기능과 같은 발상).
3. **인덱스 품질의 대부분은 파싱과 청킹에서 결정된다.** 표, 목차, 절차 순서를 보존하는 파서(Docling, RAGFlow DeepDoc)를 쓰고, 문서 유형마다 다른 청킹 규칙(매뉴얼, 표, 사례)을 적용한다.
4. **청크에 맥락을 붙여야 검색이 된다.** 제목 경로(문서 > 장 > 절), 설비·공정·품목 같은 메타데이터, 짧은 맥락 문장을 청크에 더하면 검색 실패가 크게 줄어든다 (Anthropic Contextual Retrieval의 보고: 상위 20개 검색 실패율 35~67% 감소).
5. **모든 청크에 '출생 기록'을 남긴다.** 문서 ID, 내용 해시, 개정판, 유효 여부, 임베딩 모델, 청킹 버전, 권한. 이 기록이 있어야 증분 갱신, 폐기 문서 제거, 모델 교체, 출처 표시가 모두 가능하다.
6. **임베딩 모델이나 청킹 방식을 바꿀 때는 새 인덱스를 옆에 만들고 별칭(alias)으로 전환한다** (blue-green). 기존 인덱스를 덮어쓰지 않는다.
7. **Ollama 환경에서도 전부 오픈소스로 구현할 수 있다.** 파싱 Docling, 오케스트레이션 LlamaIndex IngestionPipeline 또는 LangChain Indexing API(또는 CocoIndex), 임베딩 bge-m3/qwen3-embedding, 저장 pgvector/Qdrant + BM25.

---

## 2. 왜 '동적 관리'가 어려운가

| 문제 | 현장에서 생기는 일 | 관리하지 않으면 |
|---|---|---|
| 문서 추가·수정 | 작업표준서 개정, 매뉴얼 업데이트 | 옛 내용으로 답한다 |
| 문서 삭제·폐기 | 구 개정판 폐기, 단종 품목 문서 | **폐기된 기준으로 답한다** (제조에서 가장 위험) |
| 중복 | 같은 파일이 여러 폴더에 복사됨 | 같은 청크가 검색 상위를 점령한다 |
| 권한 | 품질 클레임 문서, 원가 자료 | 볼 수 없는 사람에게 답이 나간다 |
| 형식 다양성 | 스캔 PDF, 표 많은 엑셀, 도면 | 표가 깨지고 절차 순서가 섞인다 |
| 모델·설정 교체 | 더 좋은 임베딩 모델로 변경 | 벡터 차원이 안 맞거나 품질이 몰래 떨어진다 |
| 구조화 데이터 | 불량 사례, 정비 이력이 DB에 있음 | 문서만 색인하고 가장 값진 사례를 놓친다 |

---

## 3. 사례 분석

### 3.1 증분 인덱싱 엔진 (변경 감지와 동기화)

| 사례 | 방식 | 배울 점 |
|---|---|---|
| **LangChain Indexing API** | 문서마다 해시를 계산해 **Record Manager**에 해시·기록 시각·출처 ID를 저장. 다시 실행하면 이미 색인된 것은 건너뜀. 정리 모드 3가지: `incremental`(같은 출처의 옛 청크를 색인 중에 바로 삭제), `full`(로더가 반환하지 않은 문서를 끝나고 삭제), `scoped_full` | **"출처 ID + 내용 해시" 기록표가 증분 인덱싱의 핵심.** `full` 모드는 로더가 전체를 반환해야 하므로 주의 |
| **LlamaIndex IngestionPipeline** | 노드 + 변환 조합을 해시로 **캐시**(같은 입력은 재처리 안 함). **docstore**에 doc_id → 해시를 저장해 해시가 바뀐 문서만 재처리하고, 벡터 저장소가 있으면 upsert | 변환 단계별 캐시로 LLM 보강 비용을 아낀다. 문서 ID를 안정적으로 정하는 것이 전제 |
| **CocoIndex** | "목표 상태"를 선언하면 엔진이 변경 감지, 의존성 추적, 추가·수정·삭제 반영을 처리. 주기적 전체 점검 + 원천별 변경 알림(예: Google Drive 최근 변경 폴링). 2026년 V1으로 재설계 | 증분 로직을 직접 짜지 않고 선언형으로. **주기적 전체 대조 + 실시간 변경 감지의 이중 구조** |
| **Pathway (Live RAG)** | 스트리밍 엔진이 로컬 폴더, Google Drive, SharePoint, S3 등의 추가·삭제·수정을 계속 반영. 벡터(USearch) + BM25(Tantivy) 하이브리드 인덱스를 자동 갱신 | 인덱스를 **항상 살아 있는 서비스**로 운영하는 방식 |

### 3.2 관리형 서비스 (클라우드)

| 사례 | 방식 | 배울 점 |
|---|---|---|
| **Azure AI Search 인덱서** | 저장소의 수정 시각으로 변경을 감지. **삭제는 자동으로 추적하지 않아** 소프트 삭제(저장소 기능 또는 `IsDeleted` 메타데이터) 정책을 따로 둬야 함. 정책은 첫 실행부터 있어야 함 | **삭제 감지는 별도 설계 대상.** 제조에서는 '폐기' 상태 메타데이터가 이 역할 |
| **Amazon Bedrock Knowledge Bases** | 동기화는 증분(추가·수정·삭제분만 처리), 첫 동기화만 전체. 문서 옆에 `.metadata.json`을 두어 메타데이터 필터링. 메타데이터만 바뀌면 재색인 없이 반영되는 경우가 있음 | **메타데이터는 색인할 때 붙여야** 나중에 필터링이 된다. 메타데이터를 임베딩에 넣을지 여부도 선택 |
| **Onyx (오픈소스 사내 검색)** | 커넥터가 원천과 주기적으로 동기화. **원천의 권한(ACL)을 가져와** 사용자가 볼 수 있는 문서만 검색(엔터프라이즈 기능). 정리(prune)·갱신 주기 설정, 색인 시도 이력 | **권한 동기화**와 **색인 이력 화면**이 운영의 기본 |

### 3.3 파싱과 청킹 (인덱스 품질)

| 사례 | 방식 | 배울 점 |
|---|---|---|
| **Docling (IBM, MIT 라이선스)** | 레이아웃 분석과 표 구조 인식(TableFormer)으로 PDF를 Markdown·JSON으로 변환. 로컬 실행. **HybridChunker**는 문서 구조를 따라 나누고, 임베딩 모델 토크나이저 기준으로 크기를 맞추고, 표가 나뉘면 헤더를 반복 | 사내 서버 RAG의 표준 파서 후보. 무손실 JSON을 보관해 재처리·디버깅에 쓴다 |
| **RAGFlow (DeepDoc)** | OCR, 표 구조 인식, 레이아웃 인식 후 **문서 유형별 청킹 템플릿**(General, Manual, Laws, Table, Q&A 등) 적용. Table은 행마다 헤더를 붙인 청크. **청크 결과를 보고 사람이 수정** 가능 | **문서 유형별 템플릿 + 사람의 검수**. 매뉴얼은 절차 순서 보존, 표는 행 단위 |
| **Unstructured** | 문서를 요소(제목, 본문, 표, 목록)로 나누고 `by_title`로 장·절 경계를 넘지 않게 청킹. 표는 항상 따로. 청크가 원 요소와 페이지 좌표를 기억 | 청크가 **원문 위치로 거슬러 올라갈 수 있어야** 출처 표시가 된다 |
| **Dify 지식 파이프라인** | 부모-자식 청킹: 작은 자식 청크로 검색하고, 큰 부모 청크로 LLM에 맥락 제공. 원천 시스템 ID를 메타데이터로 저장해 다음 동기화 때 같은 문서를 찾아 갱신 | **검색 단위와 답변 단위를 분리.** 외부 ID로 동기화 |

### 3.4 청크 보강 (검색 성능)

| 사례 | 방식 | 배울 점 |
|---|---|---|
| **Anthropic Contextual Retrieval** | 청크마다 "이 청크가 문서 전체에서 어떤 내용인지" 50~100토큰 맥락 문장을 LLM으로 생성해 붙인 뒤 임베딩과 BM25 색인. 보고된 상위 20개 검색 실패율: 맥락 임베딩 35% 감소, + BM25 49% 감소, + 재순위 67% 감소 | 소형 로컬 모델로도 할 수 있는 **가장 효과가 큰 보강**. 단, 수치는 검색 지표이며 최종 답변 품질과는 다르다 |
| **GraphRAG (Microsoft) / LightRAG** | 문서에서 개체·관계를 뽑아 지식 그래프를 만든다. GraphRAG는 `graphrag update`로 새 문서만 처리해 병합. LightRAG는 새 문서를 기존 그래프에 삽입 (Ollama 사용 시 컨텍스트 32k 권장) | "설비–알람–원인–조치"처럼 **관계 질문**에 강하다. 비용이 크므로 2단계 이후 선택 |
| **Cognite (산업)** | P&ID 도면에서 설비 태그·기호·연결을 인식해 지식 그래프에 연결. 문서 파싱으로 데이터시트·사양서의 값을 추출 (일부 기능은 얼리 어답터·베타) | 제조 문서는 **설비 태그로 MES·설비 데이터와 연결**할 때 가치가 커진다 |

### 3.5 인덱스 버전 관리

| 사례 | 방식 | 배울 점 |
|---|---|---|
| **Qdrant 임베딩 모델 무중단 교체** | 새 컬렉션을 옆에 만들고, 이행 중에는 양쪽에 쓰고(dual write) 검색은 옛 컬렉션에서. 재임베딩이 끝나면 별칭을 새 컬렉션으로 전환 | **blue-green + 별칭.** 옛 인덱스는 롤백 기간 동안 보관 |
| **Open WebUI (Ollama 연동)** | 임베딩 모델을 바꾸면 지식 베이스를 재색인해야 함. 384차원 → 1024차원으로 바꾸며 pgvector 테이블을 지워야 했던 사례 보고 | 소규모 도구에서도 **모델 교체 = 전체 재색인**. 처음부터 버전 필드를 둔다 |

---

## 4. 공통 모범 사례 10가지

| # | 원칙 | 구체적 방법 |
|---|---|---|
| 1 | **원본은 그대로, 인덱스는 파생물** | 문서 관리 폴더(또는 DB)를 유일한 원천으로. md·청크·벡터는 언제든 다시 만들 수 있는 산출물 |
| 2 | **구조를 보존해 변환한다** | Docling 등으로 표·목차·절차 순서·페이지를 살린 md/JSON 생성. 스캔 문서는 OCR |
| 3 | **문서 유형별 청킹 템플릿** | 매뉴얼·작업표준서는 장·절 단위, 표(검사 기준·공정 조건표)는 행 + 헤더, 불량·정비 사례는 사례 1건 = 청크 1개, FAQ는 질문-답 쌍 |
| 4 | **청크에 맥락을 붙인다** | 제목 경로, 문서 메타데이터, LLM 맥락 문장, 필요하면 예상 질문. 검색은 벡터 + BM25 하이브리드, 가능하면 재순위 |
| 5 | **해시 기반 변경 감지와 기록표** | 문서 ID + 내용 해시로 바뀐 것만 재처리. 변환 단계별 캐시로 LLM 비용 절약 |
| 6 | **삭제와 폐기를 명시적으로 처리** | 원본이 사라지면 청크 삭제. 개정되면 이전판은 `status=폐기`로 검색에서 제외(감사용 보관은 별도) |
| 7 | **이벤트 + 주기 대조의 이중 트리거** | 파일 감시·문서 승인 이벤트로 즉시 반영, 야간 전체 대조로 누락·삭제 보정 |
| 8 | **권한을 메타데이터로 동기화** | 원천의 부서·역할 권한을 청크에 붙이고, 검색 시 사용자 권한으로 필터 |
| 9 | **설정과 모델을 버전으로 관리** | 청크마다 임베딩 모델·청킹 버전 기록. 바꿀 때는 새 인덱스 + 별칭 전환 |
| 10 | **사람은 검수와 예외 처리만** | 변환·청크 미리보기 화면, 실패·저품질 문서 대기열, 골든 질문셋으로 갱신 후 회귀 평가 |

---

## 5. Ollama 기반 제조 RAG 인덱싱 구성 제안

```
[원천]                      [인덱싱 파이프라인 (Python, 사내 서버)]                         [저장]
문서 관리 폴더 ──┐
 (PDF·DOCX·XLSX)  │  ① 변경 감지    ② 변환          ③ 분류·청킹       ④ 보강              ⑤ 임베딩
MES 매뉴얼 ───────┼─▶ 해시·수정시각 ▶ Docling      ▶ 유형별 템플릿  ▶ Ollama LLM:       ▶ Ollama:        ▶ pgvector/Qdrant
불량·정비 DB ─────┘   (이벤트+야간)    → md/JSON 보관   매뉴얼·표·사례    맥락 문장·키워드     bge-m3 또는        + BM25
 (updated_at 기준)                                                     메타데이터 추출      qwen3-embedding    + 기록표(Postgres)
                                          │                                                        │
                                          └──── 검수 화면: 변환 md, 청크, 실패 대기열 ◀──── 골든 질문셋 회귀 평가
```

### 5.1 청크 메타데이터 스키마 (예시)

| 필드 | 예시 | 쓰임 |
|---|---|---|
| `doc_id` | `WI-ASSY2-B205` | 동기화 기준 (파일 경로가 아니라 문서 번호) |
| `doc_type` | 작업표준서 / 설비 매뉴얼 / 검사 기준 / 불량 사례 / MES 매뉴얼 | 청킹 템플릿 선택, 검색 필터 |
| `equipment`, `process`, `item` | 3호기 / 사출 / B-205 | MES 데이터와 연결, 질문 범위 좁히기 |
| `revision`, `status`, `effective_date` | Rev.4 / 유효 / 2026-09-01 | **폐기판 제외**, 답변에 개정판 표시 |
| `heading_path` | 5장 > 5.2 금형 교체 | 맥락 보강, 출처 표시 |
| `acl` | 품질팀, 생산관리 | 권한 필터 |
| `source_uri`, `page` | `\\fs\표준\WI-....pdf`, p.12 | 원문 링크 |
| `content_hash` | `sha256:…` | 변경 감지 |
| `embed_model`, `chunker_version` | `bge-m3`, `manual-v2` | 재색인 판단, blue-green 전환 |

### 5.2 구조화 데이터(DB)도 문서처럼 색인한다

불량 사례, 정비 이력, 클레임은 가장 값진 지식인데 DB에 있다. **행 1건을 템플릿으로 짧은 문서로 만들어** 색인한다.

```
[불량 사례] 2026-08-14 · 사출2라인 · 3호기 · C-310 · 버(burr)
현상: 파팅라인 버 발생, 불량률 4.2%
원인: 금형 온도 편차 (설정 60℃, 실측 52℃)
조치: 냉각수 유량 조정, 금형 청소
결과: 불량률 0.8%로 회복
```

- `updated_at` 기준으로 바뀐 행만 다시 만든다 (증분).
- 수치(재고, 실적)는 색인하지 않는다. **현재 수치는 MES 조회 도구에서**, RAG는 "어떻게 해결했나"에만.

### 5.3 사람이 만든 md와 자동 변환의 역할 분담

| 구분 | 방식 | 대상 |
|---|---|---|
| 자동 변환 (기본) | 원본 → Docling → md → 자동 청킹·보강 | 대부분의 문서 |
| 자동 + 검수 | 변환 결과를 검수 화면에서 확인, 표나 순서가 깨진 곳만 수정 | 표가 많은 문서, 스캔 문서 |
| 사람이 작성 (골든 문서) | 자주 묻는 질문, 현장 노하우, 문서에 없는 판단 기준 | 숙련자 인터뷰, FAQ |

사람이 고친 md는 **원본과 같은 doc_id에 '수정본' 표시**를 달아 두고, 원본이 개정되면 수정본도 다시 검토하도록 알린다.

---

## 6. 단계별 도입

| 단계 | 할 일 | 도구 |
|---|---|---|
| 1. 작게 시작 | 설비 1~2대 매뉴얼 + 알람 코드표 + 불량 사례. 변환 → 청킹 → 임베딩, 해시 기록표로 재실행 시 바뀐 것만 처리 | Docling, LlamaIndex IngestionPipeline 또는 LangChain Indexing API, Ollama, pgvector |
| 2. 자동 동기화 | 문서 폴더 감시 + 야간 전체 대조, 폐기판 제외, 실패 대기열 | watchdog/스케줄러, 또는 CocoIndex |
| 3. 품질 고도화 | 맥락 문장 보강, 하이브리드 검색 + 재순위, 골든 질문셋 회귀 평가, 검수 화면 | Ollama LLM, BM25, bge-reranker |
| 4. 확장 | 권한 동기화, 설비 태그로 MES 데이터 연결, 필요하면 지식 그래프 | Onyx 방식 ACL, LightRAG/GraphRAG |

**프레임워크 선택 기준**
- 파이프라인을 직접 통제하고 싶다 → LlamaIndex IngestionPipeline(캐시 + docstore) 또는 LangChain Indexing API(Record Manager)
- 증분 로직을 직접 짜고 싶지 않다 → CocoIndex
- 완성형 화면이 필요하다 → RAGFlow(문서 유형 템플릿 + 청크 검수) 또는 Dify, Open WebUI(소규모)

---

## 7. 주의사항

- 효과 수치(Contextual Retrieval 35~67%)는 Anthropic이 보고한 **검색 실패율** 지표이며, 원문 대신 2차 출처로 확인했다. 최종 답변 품질은 직접 평가해야 한다.
- 한국어 임베딩 성능(bge-m3 vs qwen3-embedding)을 직접 비교한 공개 자료는 찾지 못했다. **자사 문서와 질문으로 10~20개 골든셋을 만들어 비교**하는 것을 권한다.
- Ollama의 bge-m3는 dense 벡터만 제공한다(sparse·multi-vector 미지원). 키워드 검색은 BM25를 따로 둔다.
- RAGFlow 템플릿 수, Cognite 기능의 성숙도, Bedrock 메타데이터 전용 갱신 조건 등은 버전마다 다르다. 도입 전 최신 문서로 확인한다.
- 증분 인덱싱의 `full` 정리 모드는 로더가 일부만 반환하면 정상 문서까지 지운다. 부분 동기화에는 `incremental` 방식을 쓴다.

---

## 참고 자료

**증분 인덱싱 엔진**
- [LangChain – Indexing API reference](https://reference.langchain.com/python/langchain-core/indexing/api/index) · [langchain_core.indexing.api.index](https://python.langchain.com/api_reference/core/indexing/langchain_core.indexing.api.index.html)
- [LlamaIndex – Ingestion Pipeline](https://developers.llamaindex.ai/python/framework/module_guides/loading/ingestion_pipeline/) · [Document Management Pipeline](https://developers.llamaindex.ai/python/examples/ingestion/document_management_pipeline/)
- [CocoIndex Changelog 2025-04-05 (change detection)](https://cocoindex.io/blogs/cocoindex-changelog-2025-04-05) · [CocoIndex blog (V1)](https://cocoindex.io/blogs/tags/feature/)
- [Pathway – Real-time RAG with Live Data Framework](https://pathway.com/developers/showcases/llm-app-pathway/) · [Pathway demo question answering](https://pathway.com/developers/templates/rag/demo-question-answering)

**관리형 서비스**
- [Azure AI Search – Change and delete detection for Azure Storage](https://learn.microsoft.com/en-us/Azure/search/search-howto-index-changed-deleted-blobs)
- [Amazon Bedrock – Sync data source](https://docs.aws.amazon.com/us_en/bedrock/latest/userguide/kb-data-source-sync-ingest.md) · [S3 data source connector](https://docs.aws.amazon.com/bedrock/latest/userguide/s3-data-source-connector.md) · [Ingestion and isolation patterns](https://hidekazu-konishi.com/entry/amazon_bedrock_knowledge_bases_ingestion_and_isolation_patterns.html)
- [Onyx – Connectors overview](https://docs.onyx.app/admins/connectors/overview.md) · [Onyx connectors](https://onyx.app/connectors)

**파싱·청킹**
- [Docling – PDF to searchable AI data](https://newsletter.codecut.ai/p/transform-any-pdf-into-searchable) · [Evaluating document parsers for air-gapped RAG](https://dev.to/ashokan/from-pdfs-to-markdown-evaluating-document-parsers-for-air-gapped-rag-systems-58eh)
- [RAGFlow – Configure knowledge base (chunk methods)](https://huggingface.co/spaces/retopara/ragflow/blob/faeb38fcc15606a43daecc0c0e65622e4ed02bc3/docs/guides/configure_knowledge_base.md?code=true) · [DataCamp RAGFlow tutorial](https://www.datacamp.com/ko/tutorial/ragflow)
- [Unstructured – Chunking](https://docs.unstructured.io/open-source/core-functionality/chunking.md)
- [Dify – Knowledge pipeline orchestration](https://docs.dify.ai/versions/3-6-x/en/user-guide/knowledge-base/knowledge-pipeline/knowledge-pipeline-orchestration) · [Dify knowledge API guide](https://docs.dify.ai/en/api-reference/guides/knowledge.md)

**보강·그래프**
- [Contextual Retrieval 요약 (Maginative)](https://www.maginative.com/article/anthropics-contextual-retrieval-technique-enhances-rag-accuracy-by-67) · [Gradient Flow 해설](https://gradientflow.com/contextual-retrieval-rag/) · [비판적 관점](https://medium.com/almond-ai/responding-to-anthropics-contextual-retrieval-for-rag-apps-why-context-is-not-all-you-need-af503985aa55)
- [Microsoft Research – Moving to GraphRAG 1.0 (update 명령)](https://www.microsoft.com/en-us/research/blog/moving-to-graphrag-1-0-streamlining-ergonomics-for-developers-and-users/) · [GraphRAG accelerator 증분 미지원 Q&A](https://learn.microsoft.com/en-us/answers/questions/5578950/how-do-i-add-new-documents-to-my-microsoft-graph-r)
- [LightRAG (README mirror)](https://github.com/fredatgithub/LightRAG)
- [Cognite – Parse diagrams](https://docs.cognite.com/cdf/integration/guides/contextualization/parse_diagrams) · [Document parsing overview](https://hub.cognite.com/contextualization-402/overview-of-document-parsing-capabilities-cognite-official-4740)

**버전 관리·Ollama**
- [Qdrant – Migrate to a new embedding model with zero downtime](https://qdrant.tech/documentation/tutorials-operations/embedding-model-migration/) · [Embedding migrations are the new schema migrations](https://tianpan.co/blog/2026-04-27-embedding-migrations-new-schema-migrations)
- [Open WebUI RAG settings tune](https://www.simplified.guide/open-webui/rag-settings-tune)
- [Best Ollama embedding models](https://localaimaster.com/blog/best-ollama-embedding-models) · [Ollama embedding models (bge-m3 dense only)](https://www.morphllm.com/ollama-embedding-models)
