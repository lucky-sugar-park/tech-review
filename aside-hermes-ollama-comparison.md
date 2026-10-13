# Aside · Hermes Agent · Ollama 비교 분석 (2026년 10월 기준)

> 작성일: 2026-10-13
> 관련 문서: [AI 공장장](./ai-plant-manager.md) · [AI 오케스트레이션](./ai-orchestration-2026.md)

---

## 1. 요약

**세 제품은 경쟁 관계가 아니다. 서로 다른 계층의 제품이다.**

| | Aside (어사이드) | Hermes Agent (헤르미스) | Ollama (올라마) |
|---|---|---|---|
| **한 줄 정의** | 로그인된 웹사이트에서 일을 대신 해 주는 **AI 에이전트 브라우저** | 메모리와 스킬이 쌓이는 **개인용 자율 에이전트 프레임워크** | 로컬에서 오픈 모델을 돌리는 **LLM 실행 엔진** (v0.32부터 내장 에이전트 추가) |
| **계층** | 사용자 앱 (브라우저와 에이전트) | 에이전트 (두뇌 루프, 메모리, 도구) | 모델 실행 (추론 서버) |
| **만든 곳** | Aside Computer Inc. (YC F25, 한국인 창업팀) | Nous Research | Ollama |
| **라이선스·가격** | 상용 SaaS (무료 / Pro 월 20달러 / Max 월 200달러, 한 자료 기준) | 오픈소스 (MIT) | 오픈소스 (MIT), 일부 클라우드 기능은 로그인 필요 |
| **모델** | 주로 호스팅 모델 (로컬 LLM 연결 여부는 확인 안 됨) | 모델 무관: 클라우드 API 또는 **Ollama 로컬** | 오픈 모델 직접 실행 (Qwen, Gemma, gpt-oss 등) |
| **비유** | 일 잘하는 **비서가 앉아 있는 브라우저** | 경험이 쌓이는 **개인 비서의 두뇌** | 비서들이 쓰는 **엔진** |

**조합 관계**
```
[Aside]                     [Hermes Agent]                 [사내 웹 앱·LangGraph 등]
 웹 업무 자동화 (브라우저)      개인 비서 (메신저·터미널)          조직용 에이전트
     │ 호스팅 모델                 │ 모델 무관                        │
     ▼                            ▼                                ▼
 (클라우드 LLM)          ┌──────── Ollama (로컬 모델 실행) ◀──────────┘
                         └─ Qwen / Gemma / gpt-oss / Hermes 4.x 모델 ...
```
- **Hermes와 Ollama는 함께 쓰는 경우가 많다.** Hermes를 두뇌로, Ollama를 엔진으로 두면 API 키 없이 완전한 로컬 에이전트가 된다.
- **Aside**는 다른 축이다. **웹 화면(GUI)을 조작하는 일**에 특화돼 있다.

> **이름 주의:** 'Hermes'는 Nous Research의 **LLM 모델군**(Hermes 4.x)을 가리킬 때도 있다. 이 문서는 **Hermes Agent**(에이전트 프레임워크)를 다룬다. Hermes Agent는 Hermes 4.x 모델로도, 다른 모델로도 돌릴 수 있다.

---

## 2. 개별 분석

### 2.1 Ollama: 로컬 LLM 실행 엔진

| 항목 | 내용 |
|---|---|
| **본질** | 오픈 모델을 내려받아 로컬 GPU·CPU에서 실행하고, **OpenAI 호환 API**로 제공하는 런타임 |
| **강점** | 설치와 모델 교체가 매우 쉬움, 데이터가 밖으로 나가지 않음, 사실상 로컬 LLM의 표준 진입점, 대부분의 프레임워크(LangChain, LangGraph, Hermes 등)가 지원 |
| **최근 변화** | 2025년 데스크톱 앱 출시(파일 드래그 앤 드롭, 이미지 입력). 2025년 9월 웹 검색 API. **v0.32(2026.07)부터 `ollama` 실행 시 코딩·작업 위임용 내장 에이전트** 제공. v0.32.4부터는 모델이 스스로 스킬을 불러올 때 사용자 승인 필요 |
| **약점** | 대규모 동시 사용자 서빙에는 vLLM 등이 더 적합. 내장 에이전트는 세션 간 메모리, 스킬 체계, 메신저 연동이 없는 **단일 머신용**. 데스크톱 앱에 외부 RAG나 MCP를 연결하는 공식 기능은 확인되지 않음 |
| **주의** | 내장 에이전트는 **실행한 폴더에서 코드를 실행**한다. 프로젝트 폴더 안에서 쓰는 것이 권장된다. 웹 검색 등 일부 기능은 Ollama 계정 로그인(클라우드 경유)이 필요하므로, 민감한 환경에서는 꺼야 한다 |

### 2.2 Hermes Agent: 성장하는 개인 자율 에이전트

| 항목 | 내용 |
|---|---|
| **본질** | Nous Research의 MIT 라이선스 자율 에이전트. **세션 간 지속 메모리**와 **스스로 만드는 스킬**로 쓸수록 똑똑해지는 것이 핵심 콘셉트 |
| **메모리 구조** (리뷰 기준) | ① `MEMORY.md`(에이전트 메모)와 `USER.md`(사용자 프로필)를 세션 시작 시 프롬프트에 주입 ② 대화 이력을 **SQLite + FTS5 전문 검색**으로 저장·검색 ③ 추가 검색 계층 |
| **스킬** | 완료한 작업을 마크다운 스킬 파일로 만들어 재사용. 스킬이 쌓이면 비슷한 작업이 빨라진다는 주장이 있음(예: 약 40%, 검증되지 않은 수치) |
| **인터페이스** | 터미널, 그리고 **Telegram, Discord, Slack, WhatsApp, Signal, 이메일** 게이트웨이. 데스크톱 앱은 공개 프리뷰로 보도됨 |
| **도구** | 웹 브라우징, 코드 실행, 파일 접근, MCP 연동 |
| **모델** | OpenRouter, Anthropic, OpenAI 등 클라우드가 기본이지만 **Ollama로 완전 로컬 실행 가능**(공식 가이드 있음). 노트북 메모리 8~16GB부터 가능하다는 가이드가 있음 |
| **채택** | GitHub 스타 수가 매우 빠르게 늘었다는 보도가 있음(수치는 출처마다 다름) |
| **약점·위험** | ① **권한을 많이 요구함:** 개인 데이터 접근 + 신뢰할 수 없는 콘텐츠 처리 + 외부 행동 능력이 결합된 이른바 '치명적 삼박자' 위험 ② **자동 생성 스킬은 감사하기 어렵고**, 외부 스킬을 들여오면 공급망 위험 ③ 개인용 설계라 **조직용 권한, 감사, 승인 체계가 약함** |
| **보안 대응** | 공식 문서에는 위험 명령 승인, 컨테이너 격리, MCP 하위 프로세스 자격증명 필터링, 컨텍스트 파일의 프롬프트 인젝션 검사 등 다층 방어가 설명돼 있음. **Docker나 LXD 같은 격리 환경**에서 실행하고, 스킬을 검토한 뒤 켜는 것이 권장됨 |

### 2.3 Aside: AI 에이전트 브라우저

| 항목 | 내용 |
|---|---|
| **본질** | API 연동 없이 **이미 로그인된 웹사이트 안에서** 에이전트가 여러 단계의 웹 업무를 수행하는 브라우저 |
| **만든 곳** | Aside Computer Inc., Y Combinator 2025 가을 배치, 한국인 창업팀 |
| **로컬 우선 설계** | 작업 기록과 결과물은 로컬 폴더에 저장하고, 호스팅 모델에는 작업에 필요한 문맥만 보낸다고 설명함. 작업마다 로컬 실행과 클라우드 실행을 고를 수 있다는 리뷰도 있음. 다만 **"모든 처리가 내 PC 안에서만 이뤄진다"는 뜻은 아님** |
| **메모리** | 브라우징 기록을 **기기에 마크다운 파일**로 저장하고, 사용자가 열어서 편집할 수 있음 |
| **보안 설계** | 비밀번호를 **에이전트에게 노출하지 않고** 자동 입력. 2026년 6월에 사이트 간 에이전트 자동 입력을 차단함 |
| **연동** | 코딩 에이전트(Claude Code 등)를 위한 MCP·CLI 접근 언급 (Product Hunt) |
| **플랫폼·가격** | macOS 중심 (Windows 지원 여부는 자료마다 다름). 무료 / Pro 월 20달러 / Max 월 200달러 (한 자료 기준) |
| **약점·위험** | **로컬 LLM 연결 여부를 확인하지 못함.** 에이전트 브라우저 전반에 **프롬프트 인젝션 위험**이 있음. 웹 페이지에 숨긴 지시로 에이전트 행동을 조작하는 공격이며, OpenAI, Anthropic 등도 계속 대응 중인 미해결 과제. 출시 시기와 지원 OS 정보가 자료마다 달라 성숙도를 판단하기 어려움 |

---

## 3. 항목별 비교

| 비교 항목 | Aside | Hermes Agent | Ollama |
|---|---|---|---|
| **주 용도** | 웹 업무 자동화 (포털, SaaS, 사내 웹 시스템 조작) | 개인 비서: 리서치, 자동화, 메신저 응대, 코딩 | 로컬 모델 실행. 내장 에이전트로 코딩·작업 위임 |
| **사용자** | 지식 노동자 (비개발자 포함) | 개발자, 파워 유저 | 개발자, 다른 앱의 백엔드 |
| **데이터 주권** | 중간 (로컬 저장 + 호스팅 모델) | **높음** (Ollama와 쓰면 완전 로컬) | **매우 높음** (모델이 로컬에서 실행. 클라우드 기능은 끌 수 있음) |
| **메모리** | 마크다운 파일 (편집 가능) | **3계층 지속 메모리** (가장 발달) | 없음 (내장 에이전트도 세션 간 메모리 없음) |
| **학습·성장** | 메모리 축적 | **스킬 자동 생성** | 없음 |
| **확장성** | MCP·CLI (코딩 에이전트에서 호출) | MCP, 스킬, 메신저 게이트웨이 | API, 다른 프레임워크가 감싸서 사용 |
| **GUI 조작** | **웹 GUI 조작에 특화** | 브라우징 도구 있음 (범용) | 없음 |
| **오픈소스** | ❌ | ✅ MIT | ✅ MIT |
| **비용** | 구독 | 무료 (모델·인프라 비용만) | 무료 (하드웨어 비용만) |
| **주요 위험** | 프롬프트 인젝션, 로그인 세션 오남용, 클라우드로 데이터 전송 | 과도한 권한, 감사하기 어려운 자동 스킬, 공급망 | 상대적으로 낮음 (내장 에이전트의 코드 실행 범위는 주의) |
| **조직 거버넌스** | 낮음~중간 (개인·팀 도구) | 낮음 (개인용 설계) | 해당 없음 (인프라 구성요소) |
| **성숙도** | 초기 (2025~2026 출시) | 빠르게 성장 중 (2026 급부상) | **높음** (사실상 표준) |

---

## 4. 제조·AI 공장장 관점의 평가

| 제품 | AI 공장장에서의 위치 | 권장 |
|---|---|---|
| **Ollama** | **모델 실행 계층(L5의 LLM 엔진)으로 바로 쓸 수 있음.** 사내망 완결형 구성의 핵심 | ✅ PoC와 소규모 운영에 채택. 사용자가 많아지면 vLLM 병행. 클라우드 기능(웹 검색, 로그인)은 OT 망에서 끔 |
| **Hermes Agent** | AI 공장장 자체로 쓰기는 부적합. 개인용 설계라 **권한 위임표, BPMN 승인, 감사, 역할 기반 접근 통제** 같은 조직 거버넌스가 없음. 자동 생성 스킬은 "모든 판단의 근거와 버전 기록" 원칙과 충돌 | ⚠️ **설계 참고용**(메모리 3계층, 스킬 축적 방식은 사례 메모리 설계에 참고할 만함). 개인 생산성 용도라면 **격리 환경에서만**, 공장·OT 시스템에는 연결하지 않음 |
| **Aside** | **API가 없는 웹 시스템**(구형 사내 웹 ERP, 공급사 포털, 고객 포털) 업무 자동화에 의미가 있음 | ⚠️ 사무·구매·영업 지원의 **제한된 파일럿**만. 처리 데이터가 클라우드 모델로 갈 수 있으므로 보안 검토 필수. 결제, 발주 확정 같은 되돌리기 어려운 행동은 사람이 확인. OT와 설비 시스템에는 사용하지 않음 |

### 종합 판단

- **AI 공장장 아키텍처에서 세 제품 중 핵심 구성요소가 될 수 있는 것은 Ollama 하나뿐이다.**
- Hermes와 Aside는 **개인 생산성 도구**에 가깝다. 조직의 판단과 실행을 맡기려면 권한, 승인, 감사 체계가 필요하고, 그것은 앞서 설계한 **LangGraph + BPMN + 거버넌스 계층**이 맡아야 한다.
- 다만 두 제품의 아이디어는 참고할 가치가 있다.
  - Hermes의 **지속 메모리와 스킬 축적**은 AI 공장장의 사례 메모리 설계에 쓸 수 있다. 단, 자동 생성 대신 **검토 후 등록** 방식으로 바꿔야 한다.
  - Aside의 **"비밀번호를 에이전트에게 노출하지 않는 자동 입력"**은 에이전트가 레거시 웹 시스템을 다룰 때 참고할 자격증명 격리 패턴이다.

---

## 5. 상황별 선택 가이드

| 하고 싶은 일 | 선택 |
|---|---|
| 사내망에서 오픈 모델을 돌려 우리 앱·에이전트의 엔진으로 쓰기 | **Ollama** (규모가 커지면 vLLM) |
| 내 PC에서 API 비용 없이 기억하고 성장하는 개인 비서 | **Hermes Agent + Ollama** (격리 환경에서) |
| 메신저(Slack 등)로 부르는 개인 자동화 비서 | **Hermes Agent** |
| API 없는 웹사이트에서 반복 업무를 맡기기 | **Aside** (보안 검토 후) |
| 공장 단위 AI 공장장 (권한, 승인, 감사 필요) | 세 제품 모두 단독으로는 부적합. **LangGraph + BPMN + Ollama/vLLM** 조합 |

---

## 6. 주의사항

- 세 제품 모두 2025~2026년에 빠르게 변하고 있다. 이 문서의 기능, 가격, 수치는 대부분 **2차 자료(리뷰, 블로그, 애그리게이터)** 기준이고 자료끼리 엇갈리는 부분도 있다. 예: Aside의 출시 시기·지원 OS·가격, Hermes의 GitHub 스타 수·출시 시기, Ollama v0.32 세부 기능.
- **Aside의 로컬 LLM 지원 여부는 확인하지 못했다.**
- '어사이드'와 '헤르미스'를 각각 Aside(AI 에이전트 브라우저)와 Hermes Agent(Nous Research)로 해석했다. 다른 제품을 뜻했다면 분석 대상이 달라진다.

---

## 참고 자료

**Ollama**
- [Ollama 블로그 – Ollama's new app](https://registry.ollama.ai/blog/new-app)
- [Ollama 블로그 – Web search](https://registry.ollama.ai/blog/web-search) · [문서 – Web search](https://docs.ollama.com/capabilities/web-search.md)
- [AlternativeTo – Ollama launches web search API (2025.09)](https://alternativeto.net/news/2025/9/ollama-launches-web-search-api-to-boost-ai-model-accuracy-and-reduce-hallucinations/)
- [releases.sh – Ollama v0.32 릴리스](https://releases.sh/release/rel_D6qSrybtJZMBrloIVZEcE)
- [LocalAIMaster – Ollama Agent Mode](https://localaimaster.com/blog/ollama-agent-mode)
- [AI Video Sensei – Ollama Agent Mode Guide](https://aivideosensei.com/guides/ollama-agent-mode-guide)
- [Markaicode – Hermes Agent vs Ollama (2026)](https://markaicode.com/vs/hermes-agent-vs-ollama/)

**Hermes Agent**
- [Nous Research 공식 문서 – Run Hermes Locally with Ollama](https://hermes-agent.nousresearch.com/docs/guides/local-ollama-setup)
- [Agentic AI Docs – Hermes Agent (Nous Research)](https://agentic-ai.readthedocs.io/en/latest/AgentPlatforms/hermes-agent/)
- [Fast.io – Hermes Agent Review 2026](https://fast.io/resources/hermes-agent-review-2026/) · [Hermes Agent with Ollama](https://fast.io/resources/hermes-agent-ollama-local-llm/)
- [PromptQuorum – Hermes Agent Review 2026](https://www.promptquorum.com/power-local-llm/hermes-agent-review-2026)
- [Besthub – Hermes Agent Memory Architecture](https://www.besthub.dev/articles/deep-dive-into-hermes-agent-the-memory-architecture-that-makes-ai-smarter-793fd6bfa32c)
- [UC Strategies – Hermes 2026 Definitive Guide](https://ucstrategies.com/news/hermes-2026-a-definitive-guide-to-the-autonomous-ai-agent/)
- [Agentpedia – Hermes Agent Guide](https://agentpedia.codes/blog/hermes-agent-guide)
- [Pooya Golchian – Hermes Agent + Ollama](https://pooyagolchian.com/blog/hermes-agent-ollama-local-ai-agent-2026/)
- [Kunal Ganglani – Hermes Agent Desktop with Local LLMs](https://www.kunalganglani.com/blog/hermes-agent-desktop-free-local-llm.md)
- [Snapcraft – Hermes Agent](https://snapcraft.io/install/hermes-agent/kde-neon)
- [BuildBetter – Best Hermes Agent Alternatives 2026](https://blog.buildbetter.ai/best-hermes-agent-alternatives-in-2026-local-first-personal-ai-agents-compared/)
- [BuildBetter – OpenAGI vs Hermes vs LittleBird vs OpenClaw vs PicoClaw](https://blog.buildbetter.ai/openagi-vs-hermes-vs-littlebird-vs-openclaw-vs-picoclaw-2026-local-ai-agent-comparison/)
- [Respan – Hermes Agent vs Llama Stack](https://www.respan.ai/market-map/compare/hermes-agent-vs-llama-stack)
- [AInauten – Hermes Open Source AI](https://news.ainauten.com/en/story/hermes-open-source-ai-die-ihre-eigenen-skills-automatisch-baut)
- [Glukhov – Hermes AI Assistant Skills](https://glukhov.org/tags/hermes/)

**Aside**
- [Product Hunt – Aside](https://www.producthunt.com/products/aside-6)
- [eesel – Aside AI browser explained](https://www.eesel.ai/blog/aside-ai-browser) · [Review](https://www.eesel.ai/blog/aside-ai-browser-review) · [Pricing](https://www.eesel.ai/blog/aside-ai-browser-pricing)
- [Aside Help Center – Changelog](https://docs.aside.com/changelog/components)
- [Tabbit – Aside AI Browser Review](https://go.tabbit.ai/aside-ai-browser) · [Aside vs Chrome](https://go.tabbit.ai/aside-vs-chrome)
- [Bits and Bucks – Aside AI Browser](https://bitsandbucks.de/blog/en/aside-ai-browser.html)
- [onei.ai – Aside](https://onei.ai/apps/aside.com)
- [디지털마케터 – Aside(어사이드) 브라우저 사용 후기](https://www.digitalmarketer.co.kr/insights/aside-browser-review)

**에이전트 브라우저 보안 (일반)**
- [Anthropic – Prompt injection defenses](https://anthropic.com/research/prompt-injection-defenses)
- [arXiv – BrowseSafe](https://arxiv.org/html/2511.20597v1)
- [Auth0 – Prompt injection in AI browsers](https://auth0.com/blog/prompt-injection-ai-browser.md)
- [SoftwareSeni – Agentic browser security risks](https://www.softwareseni.com/agentic-browser-security-risks-prompt-injection-owasp-mapping-and-the-absent-safeguards)
