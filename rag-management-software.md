# RAG 관리 소프트웨어 조사: 상용 · 오픈소스

> 작성일: 2026-11-20
> 관련 문서: [RAG 인덱싱 모범 사례](./rag-indexing-best-practices.md) · [증분 인덱서 데모](./demo/rag-indexer/) · [AI 에이전트 플랫폼 제안서](./proposal/ai-agent-platform-proposal.md)
> 전제: 사내 서버(Ollama·vLLM)로 RAG를 운영하려는 제조기업. 대외비 문서가 많고, 사내 에이전트 플랫폼(가칭 에이전트 스튜디오)과 연결해야 한다.
> 주의: 2026년 11월 웹 검색 기준이다. 비교 사이트·2차 보도가 많아 버전·라이선스·가격은 도입 전에 공식 문서로 다시 확인한다.

---

## 1. 요약: 내 생각

1. **"RAG 관리"는 검색 엔진이 아니라 문서의 일생을 관리하는 일이다.** 수집 → 변환(파싱) → 청크·보강 → 인덱싱 → 갱신·삭제 → 권한 → 평가까지 맡아 주는지가 핵심이다. 벡터 DB만으로는 관리가 안 된다.
2. **오픈소스 중에서는 RAGFlow · Dify · Onyx 세 가지가 성격이 다른 대표 선수다.**
   - **RAGFlow**: 문서를 가장 잘 읽는 "지식 엔진". 표·복잡한 PDF 파싱, 청크 검수, 지식 컴파일(위키·그래프·트리). 2026년 11월 v1.0.0 발표.
   - **Dify**: 에이전트 앱 빌더에 지식 파이프라인이 붙은 형태. 제안서의 "에이전트 스튜디오" 기반 후보와 같은 제품이라 연결이 가장 쉽다.
   - **Onyx**: 커넥터 40여 개로 사내 시스템을 긁어 오는 "전사 검색"형. 원본 권한 동기화는 유료(Enterprise) 기능이다.
3. **파서는 따로 고른다.** 결과 품질의 절반은 파싱에서 갈린다. 온프레미스는 Docling(오픈소스, 리눅스 재단), 한국어·표가 많은 문서는 업스테이지 Document Parse, 어려운 표는 LlamaParse가 자주 거론된다. HWP 지원 여부는 반드시 직접 확인한다.
4. **상용은 "어느 클라우드를 쓰느냐"로 거의 결정된다.** AWS Bedrock Managed Knowledge Base, Azure AI Search, Vertex AI RAG Engine이 3강이다. 대외비를 밖에 못 내보내면 온프레미스가 되는 국내 제품(올거나이즈, 코난테크놀로지 등)이나 오픈소스가 현실적이다.
5. **우리에게 맞는 출발점(권장)**: **Dify(에이전트·지식) + Docling 또는 업스테이지(파싱) + Qdrant/pgvector + vLLM/Ollama + Langfuse(관측)**로 파일럿을 시작한다. 문서 품질이 부족하면 **RAGFlow를 지식 엔진으로 붙여** Dify의 "외부 지식베이스"로 연결한다. 어느 쪽이든 **우리 평가 질문 세트로 PoC**해서 고른다(7장).

---

## 2. 무엇을 보고 골라야 하나 (평가 기준)

[인덱싱 모범 사례](./rag-indexing-best-practices.md)에서 정리한 원칙을 제품 선정 기준으로 바꾸면 다음과 같다.

| 기준 | 확인할 것 | 왜 중요한가 |
|---|---|---|
| **수집(커넥터)** | 파일 서버, 그룹웨어, 문서관리, 웹, DB에서 자동으로 가져오는가 | 사람이 올리는 방식은 금방 멈춘다 |
| **파싱 품질** | 표·도면·스캔본·한글 문서(HWP 포함)를 구조를 살려 읽는가 | 검색 품질의 절반이 여기서 갈린다 |
| **청크 검수** | 변환·분할 결과를 사람이 보고 고칠 수 있는가 | 틀린 청크는 틀린 답이 된다 |
| **증분 갱신·삭제** | 바뀐 문서만 다시 처리하고, 폐기 문서를 지우는가. 개정판을 구분하는가 | 오래된 기준서로 답하는 사고를 막는다 |
| **권한(ACL)** | 원본 시스템의 권한을 따라 검색 결과를 거르는가 | 볼 수 없는 문서가 답에 섞이면 보안 사고다 |
| **검색 방식** | 하이브리드(벡터 + 키워드), 재순위, 메타데이터 필터 | 품번·LOT 같은 정확한 용어는 키워드 검색이 필요하다 |
| **근거 표시** | 답마다 원문 위치(문서·개정판·페이지)를 보여 주는가 | 현장이 답을 믿게 하는 장치 |
| **평가·관측** | 질문 세트로 적중률을 재고, 실행 기록을 남기는가 | 바꿨을 때 좋아졌는지 알 수 있어야 한다 |
| **모델 연결** | Ollama·vLLM 등 사내 모델, OpenAI 호환 API를 쓰는가 | 대외비를 밖으로 보내지 않으려면 필수 |
| **연결 방식** | REST API, MCP 서버로 에이전트에 붙일 수 있는가 | 에이전트 플랫폼과 따로 놀면 안 된다 |
| **라이선스·운영** | 상업 이용·멀티테넌트 제한, 구성 요소 수, 커뮤니티 활동 | 숨은 제약과 운영 부담 |

---

## 3. 한눈에 보는 지도

| 분류 | 오픈소스 | 상용 |
|---|---|---|
| **올인원 RAG 엔진 (지식 관리 중심)** | RAGFlow, R2R, Kotaemon | LlamaCloud, Vectara, 올거나이즈 Alli, 코난 RAG-X |
| **에이전트·앱 빌더 + 지식 기능** | Dify, FastGPT, MaxKB, Flowise·Langflow | Microsoft Copilot Studio, Gemini Enterprise 등 |
| **채팅 UI + 지식** | Open WebUI, AnythingLLM | ChatGPT Enterprise, Claude 프로젝트 등 |
| **전사 검색 (커넥터·권한)** | Onyx | Glean, Elastic |
| **관리형 클라우드 RAG** | — | AWS Bedrock Managed Knowledge Base, Azure AI Search, Vertex AI RAG Engine |
| **개발 프레임워크** | LlamaIndex, Haystack, LangChain·LangGraph, LightRAG·GraphRAG | (각 회사의 클라우드 버전) |
| **부품: 파서** | Docling, Unstructured, MarkItDown | 업스테이지 Document Parse, LlamaParse, Azure Document Intelligence |
| **부품: 저장·검색** | Qdrant, Milvus, Weaviate, pgvector, OpenSearch·Elasticsearch | Pinecone 등 각 클라우드 버전 |
| **부품: 평가·관측** | Ragas, DeepEval, Langfuse, Arize Phoenix | LangSmith, Arize 등 |

---

## 4. 오픈소스 상세

### 4.1 올인원 · 빌더 · UI형

| 제품 | 라이선스 | 강점 | 주의 | 우리에게 |
|---|---|---|---|---|
| **RAGFlow** (InfiniFlow) | Apache 2.0 | 딥러닝 기반 문서 파서(DeepDoc)로 복잡한 PDF·표·혼합 레이아웃 처리. 12개 내장 파서를 파이프라인으로 통합(1.0). 사이트맵 수집, 문서 메타데이터 일괄 관리. **지식 컴파일**(위키·그래프·트리·PageIndex·마인드맵·타임라인 생성) | 1.0이 2026-11-06 발표(공식 변경 기록 기준)로 막 나왔다. 기존 GraphRAG·RAPTOR 기능은 지식 컴파일로 대체됨. 구성 요소가 많아 운영이 무겁다 | **문서 품질이 핵심일 때의 지식 엔진** 1순위 |
| **Dify** | Apache 2.0 기반 + 추가 조건(멀티테넌트 SaaS 운영 등 제한) | **지식 파이프라인**: 데이터 소스(플러그인) → 추출 → 처리 → 저장을 캔버스로 만들고 노드마다 시험 실행. 검색 테스트(recall test), 인덱스·임베딩·검색 전략 변경. **외부 지식베이스 API 연결**. 만든 지식을 워크플로·에이전트 앱이 바로 사용 | 파싱 자체는 플러그인(LlamaParse, Unstructured 등)에 기댄다. 라이선스 조건 법무 검토 필요 | **에이전트 스튜디오 기반 후보**. 지식과 에이전트를 한 곳에서 |
| **Onyx** (옛 Danswer) | 핵심 MIT + Enterprise 라이선스 | 커넥터 40여 개, 백그라운드 연속 인덱싱, 검색 전에 권한 필터링, 에이전트·딥리서치 | **원본 권한 동기화는 Enterprise(유료) 기능이고 일부 커넥터만** 지원. 인덱스는 마지막 동기화 시점 기준. Zoom 합류 보도가 있으나 단일 출처라 확인 필요 | 그룹웨어·문서관리 **전사 검색**이 목적일 때 |
| **AnythingLLM** | MIT | 워크스페이스 = 지식베이스. Ollama·Qdrant 연결이 쉬움. 데스크톱·도커 | 팀·개인 단위 도구. 대규모 거버넌스·권한 동기화는 약함 | 부서 단위 빠른 시범 |
| **Open WebUI** | 자체 라이선스(브랜딩 조건, 확인 필요) | 채팅 중심 + 지식(Knowledge) 기능, 기본 ChromaDB, Ollama와 궁합 | RAG는 부가 기능. 문서 수명 관리 기능은 약함 | 사내 채팅 UI가 필요할 때 |
| **MaxKB** (FIT2CLOUD) | GPL-3.0 | 지식베이스 Q&A, 워크플로 | GPL 조건, 중국 생태계 중심 | 참고 |
| **FastGPT** | 자체 오픈소스 라이선스(멀티테넌트 SaaS는 별도 허가) | 지식베이스 + 워크플로 | 라이선스 조건 확인 필요 | 참고 |
| **R2R** (SciPhi) | MIT | REST API로 수집·하이브리드 검색·지식 그래프·에이전트 검색 제공 | **2025년 중반 이후 릴리스가 확인되지 않음** → 유지보수 리스크 | 신규 도입은 비권장 |
| **Kotaemon** | 확인 필요 | 문서 Q&A UI | 이번 조사에서 최신 상태 미확인 | 참고 |

### 4.2 부품: 파서 · 저장 · 평가

| 영역 | 제품 | 메모 |
|---|---|---|
| 파서 | **Docling** | IBM이 만들어 2025년 4월 리눅스 재단(LF AI & Data)에 기증. 구조를 살린 변환에 강함, 온프레미스 가능. 2026년 1월 Granite-Docling-258M(Apache 2.0) 공개. 대량 처리 시 메모리 사용량이 단점으로 거론됨. **우리 `convert.py`의 1순위 변환기** |
| 파서 | **Unstructured** | 다양한 형식의 대량 수집·청크에 강함(오픈소스 + 상용 플랫폼) |
| 파서 | **MarkItDown** | 가볍고 빠름. 품질보다 속도 (`convert.py`의 2순위) |
| 저장·검색 | **Qdrant · Milvus · Weaviate · pgvector · OpenSearch** | 하이브리드 검색과 메타데이터 필터 지원 여부로 고른다. 기존 PostgreSQL이 있으면 pgvector로 시작하는 것도 방법 |
| 평가 | **Ragas · DeepEval** | 점수(근거 충실도, 적중률 등)를 내는 라이브러리. 운영 기록 저장소는 없다 |
| 관측 | **Langfuse** | 자체 호스팅 실행 기록·프롬프트·비용 관리 |
| 관측 | **Arize Phoenix** | RAG 평가와 OpenTelemetry 기반 추적. 라이선스(ELv2 등) 확인 필요 |

> 흔한 조합: **Ragas로 점수, Langfuse나 Phoenix로 운영 기록**. 우리 데모의 `evaluate.py`(Hit@1·Hit@3·MRR)는 이 역할의 축소판이다.

---

## 5. 상용 상세

### 5.1 관리형 클라우드

| 제품 | 특징 | 주의 |
|---|---|---|
| **AWS Bedrock Managed Knowledge Base** | 완전 관리형 RAG로 2026-06-17 정식 출시. 여러 단계·여러 지식베이스를 넘나드는 에이전트형 검색. Neptune 기반 GraphRAG 옵션 | 지식베이스를 지워도 Neptune 그래프는 남아 과금될 수 있다는 지적 |
| **Azure AI Search** | 하이브리드 검색 + 시맨틱 재순위가 강점. 질문을 하위 질의로 나눠 병렬 검색하는 에이전트형 검색 정식 출시(2026-04-01 REST API 기준) | 검색 엔진이지 완성된 앱이 아니다 |
| **Vertex AI RAG Engine** | Gemini와 밀접, 서버리스, Pinecone·Weaviate 등 벡터 DB 교체 가능 | 제품 이름·구성이 자주 바뀐다 |
| **LlamaCloud / LlamaParse** | 관리형 파싱·인덱스. 페이지(크레딧) 과금 | 무료 한도·가격은 출처마다 다름. 기업용 자체 호스팅·VPC 조건은 미확인 |

공통적으로 **이미 쓰는 클라우드를 따라가는 것**이 합리적이고, 검색만을 위해 클라우드를 옮기는 것은 손해라는 평가가 많다. 또 셋 다 **데이터 거버넌스(권한·계보)는 별도로** 챙겨야 한다.

### 5.2 기업 검색 · RAG 전문

| 제품 | 특징 | 배포 |
|---|---|---|
| **Glean** | 100개 이상 업무 앱 연결, 각 앱의 원래 권한을 검색 단계에서 적용 | 클라우드 전용(경쟁사 자료 기준) |
| **Vectara** | 패키지형 기업 RAG, 메타데이터 기반 접근 제어 | SaaS · VPC · 온프레미스 |
| **Elastic (Elasticsearch)** | 온프레미스 가능한 검색 인프라, 벡터·하이브리드 지원 | 온프레미스 가능하나 구축 공수 큼. 별도 Enterprise Search 제품군은 유지보수 모드 |

### 5.3 국내

| 제품 | 특징 | 확인할 것 |
|---|---|---|
| **올거나이즈 Alli** | 한국어 RAG 평가 체계(알리 RAG 리더보드, 금융·공공·의료·법률·커머스). 표가 많은 문서 처리, 답변 근거 원문 하이라이트. ACL 2026 논문 채택 보도 | 온프레미스 조건, 제조 문서 레퍼런스 |
| **코난테크놀로지 Konan RAG-X** | 내부 문서·DB와 웹을 함께 검색해 답변, 산업별 맞춤 | 자료가 2025년 브로슈어 기준 |
| **업스테이지 Document Parse** | RAG용 문서 파서(100쪽을 1분 안에 처리한다고 소개). 표·차트가 많은 문서용 Enhanced 모드, AWS Marketplace 제공 | 온프레미스 제공 범위와 가격은 미확인 |

> 이번 검색으로 확인하지 못한 국내 후보(사이냅소프트 등)는 RFP 단계에서 같은 기준표로 받는다.

---

## 6. 우리 상황에 맞춘 추천 조합

| 안 | 구성 | 언제 | 장점 | 단점 |
|---|---|---|---|---|
| **A. 파일럿 표준안 (권장 출발점)** | Dify(에이전트·지식 파이프라인) + Docling/업스테이지(파싱) + Qdrant 또는 pgvector + vLLM/Ollama + Langfuse | 에이전트 스튜디오 파일럿과 함께 | 제품 하나로 지식과 에이전트를 같이 관리, 화면 완성도 | 어려운 문서의 파싱·청크 품질은 파서에 좌우 |
| **B. 문서 품질 강화안** | A + **RAGFlow를 지식 엔진**으로, Dify에는 외부 지식베이스(API)나 MCP로 연결 | 매뉴얼·기준서에 표·도면이 많아 A의 품질이 부족할 때 | 파싱·청크 검수·지식 컴파일 | 시스템이 둘, 운영 부담 증가 |
| **C. 전사 검색안** | **Onyx**(+ 권한 동기화가 필요하면 Enterprise) | 그룹웨어·문서관리 전체를 검색하는 것이 1차 목표일 때 | 커넥터·권한 | 에이전트 업무 자동화는 별도 |
| **D. 상용 패키지안** | 국내 온프레미스 RAG 제품 또는 이미 쓰는 클라우드의 관리형 RAG | 내부 인력이 매우 적을 때 | 빠른 구축, 유지보수 계약 | 비용, 종속, 사내 MES·ERP 도구 연결은 여전히 직접 |

어느 안이든 **MES·ERP 조회는 RAG가 아니라 도구(MCP)로** 한다. RAG는 규정·매뉴얼·사례 같은 **문서 지식**을 맡고, 숫자는 시스템 조회값에서 가져온다는 원칙([제안서 4.4](./proposal/ai-agent-platform-proposal.md))은 그대로다.

---

## 7. 고르는 방법: 2주 PoC

1. **같은 문서**: [데모의 원본 문서](./demo/rag-indexer/raw/) + 실제 사내 문서 100건(표 많은 기준서, 스캔본, HWP, 개정판이 있는 문서 포함).
2. **같은 질문**: [`eval/questions.json`](./demo/rag-indexer/eval/questions.json) 형식으로 부서별 실제 질문 50개와 정답 문서·조항.
3. **잴 것**

| 항목 | 측정 |
|---|---|
| 검색 품질 | Hit@1 · Hit@3 · MRR (데모 `evaluate.py`와 같은 방식) |
| 근거 정확도 | 답에 붙은 문서·개정판·페이지가 맞는가 |
| 파싱 품질 | 표 20개를 사람이 검수해 깨진 비율 |
| 갱신 | 문서 1건 개정·폐기 후 검색 결과에 반영되기까지 걸린 시간, 옛 판이 남는지 |
| 권한 | 권한 없는 사용자에게 문서가 새는지 |
| 운영 | 설치 구성 요소 수, 장애 시 복구 난이도, 사내 모델(vLLM) 연결 |
| 라이선스 | 상업 이용·멀티테넌트·브랜딩 조건 |

4. **판정**: 품질이 비슷하면 **운영이 단순하고 에이전트 플랫폼과 붙이기 쉬운 쪽**을 고른다.

---

## 8. 주의사항

- 이번 조사의 상당수는 비교 사이트·2차 보도다. 특히 RAGFlow 1.0 발표일, Onyx의 Zoom 합류, Azure·AWS 기능 출시일, 각 제품 라이선스는 공식 문서로 다시 확인한다.
- 오픈소스 라이선스는 "오픈소스"라는 이름과 달리 조건이 붙은 경우가 많다(Dify, FastGPT, Open WebUI 등). 사내 전용으로 쓰더라도 법무 검토를 거친다.
- 별 개수·버전은 출처마다 다르다. 최근 릴리스 날짜와 이슈 응답 속도로 활동성을 본다(R2R 사례).

---

## 참고 자료

**오픈소스**
- [RAGFlow 변경 기록](https://ragflow.io/changelog) · [RAGFlow 릴리스](https://github.com/infiniflow/ragflow/releases) · [RAGFlow README](https://cdn.jsdelivr.net/gh/infiniflow/ragflow@main/README.md) · [What changed in the latest RAGFlow release (Zilliz)](https://zilliz.com/ai-faq/what-changed-in-the-latest-ragflow-release)
- [Dify: Introducing Knowledge Pipeline](https://www.dify.ai/blog/introducing-knowledge-pipeline) · [Dify Knowledge Pipeline 문서](https://docs.dify.ai/en/guides/knowledge-base/knowledge-pipeline/readme) · [Dify 지식베이스(자체 호스팅)](https://docs.dify.ai/en/self-host/use-dify/knowledge/readme)
- [Onyx 커넥터](https://onyx.app/connectors) · [Onyx: self-hosted RAG](https://onyx.app/insights/self-hosted-rag) · [Onyx 검토 (agence-scroll)](https://agence-scroll.com/en/blog/onyx-a-serious-solution-for-enterprise-rag-deployment) · [Open WebUI vs Onyx](https://wz-it.com/en/blog/open-webui-vs-onyx-comparison/)
- [AnythingLLM vs Open WebUI](https://localaimaster.com/blog/anythingllm-vs-open-webui) · [Open WebUI vs AnythingLLM vs LibreChat 2026](https://toolhalla.ai/blog/open-webui-vs-anythingllm-vs-librechat-2026)
- [R2R GitHub](https://github.com/SciPhi-AI/r2r) · [R2R 프로필 (dev.co)](https://dev.co/ai/rag/r2r) · [R2R vs RAGFlow](https://www.respan.ai/market-map/compare/r2r-vs-ragflow)
- [MaxKB vs FastGPT](https://fastgpt.io/compare/maxkb-vs-fastgpt) · [FastGPT vs MaxKB (openalternative)](https://openalternative.co/compare/fastgpt/vs/maxkb)
- [Open-source RAG frameworks (Olostep)](https://olostep.com/blog/open-source-rag-frameworks) · [OSS RAG frameworks guide (Morphik)](https://www.morphik.ai/blog/guide-to-oss-rag-frameworks-for-developers)

**파서 · 평가**
- [IBM, Docling 등을 리눅스 재단에 기증](https://www.ibm.com/new/announcements/ibm-adds-open-source-projects-docling-beeaI-and-data-prep-kit-added-to-the-linux-foundation) · [Red Hat: What is Docling](https://www.redhat.com/en/topics/ai/docling) · [DocLang 워킹그룹 (IT Brief)](https://itbrief.co.uk/story/linux-foundation-launches-doclang-group-for-ai-documents) · [Docling vs Unstructured](https://respan.ai/market-map/compare/docling-vs-unstructured)
- [RAG document parsing 2026: LlamaParse vs Unstructured vs Docling vs Azure DI](https://ecorpit.com/rag-document-parsing-llamaparse-unstructured-docling-2026/) · [Best document parsers for RAG in 2026 (LlamaIndex)](https://www.llamaindex.ai/agents/best-document-parsers-for-rag-in-2026)
- [업스테이지 Document Parse 소개](https://www.upstage.ai/blog/en/let-llms-read-your-documents-with-speed-and-accuracy) · [Document Parse Enhanced (AWS Marketplace)](https://aws.amazon.com/marketplace/pp/prodview-x6enp3hgvrqhc)
- [Best RAG evaluation tools 2026 (Future AGI)](https://futureagi.com/blog/best-rag-evaluation-tools-2026/) · [Phoenix vs Ragas](https://www.respan.ai/market-map/compare/phoenix-arize-vs-ragas) · [LLMOps observability 비교 (Kanerika)](https://medium.com/@kanerika/llmops-observability-langsmith-vs-arize-vs-langfuse-vs-w-b-f1baeabd1bbf)

**상용**
- [Amazon Bedrock Managed Knowledge Base 정식 출시 (AWS)](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/) · [AWS News Blog](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/)
- [Enterprise RAG platforms comparison (Atlan)](https://atlan.com/know/enterprise-rag-platforms-comparison/) · [RAG in 2026: open-source vs managed (DEV)](https://dev.to/moksh/rag-in-2026-picking-between-open-source-frameworks-and-managed-platforms-5e84) · [Best enterprise RAG platforms 2026 (Sphere)](https://www.sphereinc.com/blogs/best-enterprise-rag-platforms-2026)
- [LlamaIndex 가격 분석 (ZenML)](https://www.zenml.io/blog/llamaindex-pricing) · [LlamaCloud build vs buy](https://callsphere.ai/blog/td30-fw-llamacloud-managed-rag-build-vs-buy-2026)
- [Glean: document permissions](https://www.glean.com/perspectives/top-ai-assistants-for-document-permissions-management) · [RAG platforms for regulated industries](https://www.beri.net/article/best-enterprise-rag-platforms-regulated-industries-2026) · [Vectara 팟캐스트 요약](https://www.pulse.bot/ai/podcasts/enterprise-ai-search-rag-agents-at-scale-with-vectara-a5c518c2-ee5d-497a-91ab-67eb8f11cd6a/)
- [올거나이즈 알리 RAG 리더보드 (CIO Korea)](https://www.cio.com/article/3521951/%EC%98%AC%EA%B1%B0%EB%82%98%EC%9D%B4%EC%A6%88-%EC%95%8C%EB%A6%AC-rag-%EB%A6%AC%EB%8D%94%EB%B3%B4%EB%93%9C-%EA%B3%B5%EA%B0%9C%C2%B7%C2%B7%C2%B7-%EA%B8%88%EC%9C%B5-%EA%B3%B5.html) · [올거나이즈 ACL 2026 (벤처스퀘어)](https://www.venturesquare.net/tag/%ec%98%ac%ea%b1%b0%eb%82%98%ec%9d%b4%ec%a6%88/) · [코난 RAG-X 브로슈어](https://brochure.konantech.com/wp-content/uploads/2025/04/코난RAG-X_e브로슈어_코난테크놀로지.pdf)
