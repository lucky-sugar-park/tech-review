# Java 버전 데모 (아침 브리핑 + 지식 도우미 RAG 인덱싱)

파이썬 데모 세 가지를 Java 17로 옮긴 것입니다. 동작, 프롬프트, 출력 형식은 파이썬 버전과 같습니다.

- [아침 브리핑 데모](../morning-briefing/) (`briefing.py`, `ask.py`)
- [증분 인덱서 데모](../rag-indexer/) (`convert.py`, `enrich.py`, `indexer.py`, `search.py`, `evaluate.py`, `demo_scenario.py`)
- [MES 도구 MCP 서버](../mes-mcp/) (`mes_mcp_server.py`, `approvals.py`, `approve.py`, `demo_client.py`): [공식 MCP Java SDK](https://github.com/modelcontextprotocol/java-sdk) 2.1.0 사용

## 파이썬 → Java 대응

| 파이썬 | Java (`src/main/java/com/techreview/`) | 명령 |
|---|---|---|
| `morning-briefing/seed_mes.py` | `briefing/SeedMes.java` | `seed` |
| `morning-briefing/mes_tools.py` | `briefing/MesTools.java` (읽기 전용 연결) | |
| `morning-briefing/briefing.py` | `briefing/Briefing.java` | `briefing [--no-llm]` |
| `morning-briefing/ask.py` | `briefing/Ask.java` | `ask "질문" [--no-llm]` |
| `rag-indexer/ragkit.py` | `rag/RagKit.java`, `rag/SourceDoc.java` | |
| `rag-indexer/convert.py` | `rag/Converter.java` | `convert [--force]` |
| `rag-indexer/enrich.py` | `rag/Enrich.java` | `enrich [--offline] [--model …] [--show]` |
| `rag-indexer/indexer.py` | `rag/Indexer.java` | `index [--offline] [--dry-run] [--contextualize] [--watch N]` |
| `rag-indexer/search.py` | `rag/Search.java` | `search "질문" [-k 3] [--doc-type …] [--equipment …] [--answer]` |
| `rag-indexer/evaluate.py` | `rag/Evaluate.java` | `evaluate [--offline] [--detail]` |
| `rag-indexer/demo_scenario.py` | `rag/DemoScenario.java` | `scenario [--offline] [--pause]` |
| `mes-mcp/setup_demo.py`, `mes_api.py` | `mcp/MesApi.java` | `mcp-setup` |
| `mes-mcp/mes_mcp_server.py` | `mcp/MesMcpServer.java` (공식 MCP Java SDK) | `mcp-server` |
| `mes-mcp/approvals.py` | `mcp/Approvals.java` | |
| `mes-mcp/approve.py` | `mcp/McpApprove.java` | `mcp-approve list\|show\|approve\|reject\|audit` |
| `mes-mcp/demo_client.py` | `mcp/McpDemo.java` (MCP 클라이언트도 Java SDK) | `mcp-demo` |
| LangGraph `StateGraph` | `common/StateGraph.java` (최소 구현) | |
| `langchain_ollama`, urllib | `common/Ollama.java` (`java.net.http`) | |

`make_samples.py`(샘플 원본 생성)는 옮기지 않았습니다. 샘플 파일은 `../rag-indexer/raw/`에 이미 들어 있습니다.

## 빌드

준비물: **JDK 17 이상**. 의존성은 SQLite JDBC, Jackson, 공식 MCP Java SDK(`mcp-core`, `mcp-json-jackson2`), slf4j-nop입니다.

```bash
cd demo/java

# Gradle
gradle fatJar                 # → build/libs/demo.jar

# 또는 Maven
mvn package                   # → target/demo.jar
```

## 실행

```bash
# 아침 브리핑
java -jar build/libs/demo.jar seed                          # data/mes.db 생성
java -jar build/libs/demo.jar briefing --no-llm             # 규칙 기반 (백업 모드)
java -jar build/libs/demo.jar briefing                      # Ollama
java -jar build/libs/demo.jar ask "B-205는 왜 부족해?" --no-llm

# 지식 도우미 (원천: ../rag-indexer 의 raw/, sources/, gold/, eval/ 등)
java -jar build/libs/demo.jar convert                       # raw/ → sources/converted/*.md
java -jar build/libs/demo.jar enrich --offline              # 청크 보강 (Ollama: enrich --model qwen3:14b)
java -jar build/libs/demo.jar index --offline               # 증분 색인 → rag-index.db
java -jar build/libs/demo.jar search "C-310 금형 온도 설정값"
java -jar build/libs/demo.jar scenario --offline --pause    # 개정·추가·폐기·삭제 시나리오
java -jar build/libs/demo.jar evaluate --offline --detail   # 인덱싱 방식별 적중률 비교

# MES 도구 MCP 서버
java -jar build/libs/demo.jar mcp-setup                     # data/mcp-mes.db 생성, 승인 대기열 초기화
java -jar build/libs/demo.jar mcp-demo                      # 조회 → 제안 → (MES 그대로) → 사람 승인 → 반영 → 재승인 차단
java -jar build/libs/demo.jar mcp-approve list              # 승인함: 대기 목록
java -jar build/libs/demo.jar mcp-approve approve AP-1104-001 --by 이OO
java -jar build/libs/demo.jar mcp-approve audit             # 감사 로그
```

인자 없이 실행하면 전체 사용법이 나옵니다. Windows(PowerShell, cmd)에서도 명령은 같습니다.

| 환경 변수 | 의미 | 기본값 |
|---|---|---|
| `OLLAMA_HOST` | Ollama 서버 주소 | `http://localhost:11434` |
| `OLLAMA_MODEL` | 브리핑·설명·보강·답변 모델 | `qwen3:8b` |
| `EMBED_MODEL` | 임베딩 모델 | `bge-m3` |
| `BRIEFING_DATE` | 브리핑 기준일 | `2026-10-20` |
| `MES_DB` | 가상 MES DB | `data/mes.db` |
| `RAG_BASE` | RAG 원천 폴더 | `../rag-indexer` |
| `RAG_DB` | 인덱스 DB | `rag-index.db` |
| `MCP_MES_DB` | MCP 데모용 MES DB | `data/mcp-mes.db` |
| `MCP_APPROVALS_DB` | 승인 대기열 | `data/mcp-approvals.db` |
| `MES_MCP_USER` | 제안을 올리는 주체 | `AI 공장장` |

## 파이썬 버전과 같은 점, 다른 점

**같은 점** (이 환경에서 직접 비교해 확인)
- 아침 브리핑 `--no-llm` 출력: 표의 숫자와 문구가 같습니다.
- `convert`: 샘플 3건(DOCX·PPTX·TXT)의 변환 결과가 파이썬 내장 변환기와 글자 단위로 같습니다(`converter`, `converted_at` 줄 제외).
- `scenario --offline`, `evaluate --offline`: 단계별 건수와 질문별 정답 순위가 파이썬과 같습니다. 오프라인 해시 임베딩을 같은 알고리즘(MD5, 512차원)으로 구현했기 때문입니다.
- 파일 형식: 변환본 md의 앞머리, `.enrich.json`, 프롬프트, JSON 스키마가 같습니다. **파이썬과 Java가 서로의 변환본과 보강 파일을 그대로 읽을 수 있습니다.**

**다른 점**
- **변환기:** Docling·MarkItDown은 파이썬 라이브러리라 Java 버전은 JDK만으로(zip + XML) 만든 내장 변환기만 씁니다. PDF·XLSX가 필요하면 파이썬 `convert.py`를 쓰거나, Docling을 REST 서비스(docling-serve)로 띄워 Java에서 호출하는 방식을 검토합니다. 구형 DOC·PPT는 LibreOffice로 변환합니다. HWP는 한컴오피스에서 미리 변환해 둡니다.
- **StateGraph:** LangGraph 대신 같은 개념(이름 붙은 노드, 간선, 상태 객체)의 최소 구현을 넣었습니다. 데모 흐름은 직선이라 충분합니다. 분기·병렬·체크포인트가 필요하면 [LangGraph4j](https://github.com/langgraph4j/langgraph4j)를 쓰면 됩니다.
- **인덱스 DB는 따로 둡니다** (`rag-index.db`). 내용 해시를 만드는 JSON 직렬화 형식이 달라서, 파이썬이 만든 `index.db`를 Java가 읽으면 모든 문서를 '변경'으로 판단해 다시 색인합니다.
- **보강 결과 표시:** `converter: java-builtin`으로 기록됩니다.

## MCP 서버: 다른 언어·다른 AI와 섞어 쓰기

MCP는 표준 규격이라 **서버와 클라이언트의 언어가 달라도** 됩니다. 이 환경에서 다음 조합을 직접 확인했습니다.

| 클라이언트 | 서버 | 결과 |
|---|---|---|
| Java (`mcp-demo`, 공식 SDK 클라이언트) | Java (`mcp-server`) | 파이썬 `demo_client.py`와 같은 출력 |
| 파이썬 MCP SDK 클라이언트 | Java (`mcp-server`) | 조회, 지식 검색, 제안, 오류 처리 모두 동작 |
| 파이썬 Ollama 에이전트 (`agent_ollama.py`) | Java (`mcp-server`) | 도구 선택 → 조회 → 제안 → 승인 대기 (Ollama는 가짜 서버로 확인) |

```bash
# 파이썬 Ollama 에이전트를 Java MCP 서버에 연결
cd demo/mes-mcp
MCP_SERVER="java -jar ../java/build/libs/demo.jar mcp-server" \
MCP_MES_DB=../java/data/mcp-mes.db MCP_APPROVALS_DB=../java/data/mcp-approvals.db \
python agent_ollama.py "오늘 출하 부족한 품목 있어? 있으면 조치를 제안해 줘"

# Claude Code에 연결 (가상 데이터로 시험할 때만)
claude mcp add ai-plant-mes-java -- java -jar /절대경로/demo/java/build/libs/demo.jar mcp-server
```

- `search_knowledge` 도구는 Java 인덱서의 색인(`rag-index.db`)을 씁니다. 먼저 `index --offline`을 실행해 두세요.
- stdio 서버라서 표준 출력에는 MCP 메시지 외에 아무것도 찍지 않습니다. 로그가 필요하면 표준 오류로 보냅니다.
- 실제 운영에서는 stdio 대신 사내망 HTTP(Streamable HTTP) 전송과 인증을 씁니다. 공식 Java SDK는 Spring WebFlux·WebMVC 연동도 제공합니다.

## 알아두실 점

- **리눅스에서 한글 인자가 깨지면** 로캘을 UTF-8로 지정합니다: `LANG=C.UTF-8 java -jar build/libs/demo.jar ask "B-205는 왜 부족해?"`. Java는 명령줄 인자를 운영체제 로캘로 해석합니다. 한국어 Windows와 macOS에서는 별도 설정이 필요 없습니다.
- 출력은 UTF-8로 고정합니다. Windows에서 이모지가 네모로 보이면 Windows Terminal에서 실행하세요.
- 이 환경에는 Ollama가 없어서, Ollama를 쓰는 경로(브리핑 LLM 권고, 질문 설명, 보강, 맥락 문장, 답변 생성)는 **가짜 Ollama 서버로 API 형식과 흐름만 확인**했습니다. 실제 모델의 응답 품질은 Ollama를 띄워 직접 확인해야 합니다.

> 모든 회사명, 품목, 수치는 강의용 가상 데이터입니다.
