# AI 오케스트레이션 동향 및 아키텍처 (2026년 10월 기준)

> 작성일: 2026-10-12
> 범위: LLM 기반 **AI 에이전트 오케스트레이션**. 단일 에이전트 워크플로부터 멀티에이전트 시스템, 상호운용 프로토콜, 엔터프라이즈 플랫폼, 운영·거버넌스 계층까지 다룬다.
> 전통적인 ML 파이프라인 오케스트레이션(Airflow, Kubeflow 등)은 범위에서 제외하고, 연결 지점만 간단히 언급한다.

---

## 1. 요약

- **용어의 무게중심이 이동했다.** "AI 오케스트레이션"은 원래 모델 학습·배포 파이프라인을 자동화한다는 뜻이었다. 2025~2026년에는 **여러 LLM 에이전트, 도구, 데이터, 사람의 작업 흐름을 조율하는 제어 계층**이라는 의미로 주로 쓰인다.
- **프레임워크는 춘추전국 시대를 지나 정리 단계에 들어섰다.** 2025년에 난립했던 멀티에이전트 프레임워크는 2026년 들어 정리되고 있다.
  - AutoGen은 유지보수 모드로 전환됐고, 후속인 **Microsoft Agent Framework 1.0**이 나왔다.
  - 그 밖의 주요 선택지는 **LangGraph**(상태 기반·내구성 실행), **CrewAI**(역할 기반 팀), **Google ADK 2.0**, **OpenAI Agents SDK**, **Claude Agent SDK** 등이다.
- **프로토콜이 표준화되고 있다.**
  - **MCP**(에이전트와 도구·데이터 연결)는 2025년 12월 Linux Foundation 산하 **Agentic AI Foundation(AAIF)**에 기증됐다.
  - **A2A**(에이전트 간 통신)도 Linux Foundation이 관리한다.
  - 두 프로토콜이 서로 보완하는 구도가 굳어졌다.
- **경쟁의 초점이 실행에서 통제로 옮겨가고 있다.** 에이전트를 만드는 것보다 **운영·관측·거버넌스(Agent Control Plane)**가 더 어려운 과제가 됐다. Microsoft Agent 365, ServiceNow AI Control Tower 같은 거버넌스 제품이 등장했다.
- **기대와 경고가 함께 나온다.** Gartner는 2026년까지 엔터프라이즈 앱의 40%에 작업 특화 에이전트가 탑재되고, 2030년에는 조직의 60%가 기존 업무 시스템 공급사가 아닌 외부 벤더의 오케스트레이션 플랫폼을 쓸 것이라고 전망했다. 동시에 **에이전틱 AI 프로젝트의 40% 이상이 2027년 말까지 취소될 수 있다**는 경고도 함께 내놓았다.

---

## 2. 개념: 무엇을 오케스트레이션하는가

| 구분 | 1세대: ML 오케스트레이션 | 2세대: LLM 체인 | 3세대: 에이전트 오케스트레이션 |
|---|---|---|---|
| 시기 | ~2022 | 2023~2024 | 2025~ |
| 조율 대상 | 데이터 처리, 학습, 배포 작업 | 프롬프트, 검색(RAG), 도구 호출 | 자율 에이전트, 도구, 사람, 다른 에이전트 |
| 제어 흐름 | 정적 DAG | 정적 체인 | **동적**: LLM이 실행 중에 다음 단계를 결정 |
| 대표 도구 | Airflow, Kubeflow, MLflow | LangChain, LlamaIndex | LangGraph, Agent Framework, ADK, Agents SDK |
| 핵심 과제 | 재현성, 스케줄링 | 프롬프트 품질 | 상태·메모리, 신뢰성, 비용, 안전성, 거버넌스 |

**워크플로와 에이전트의 구분** (Anthropic의 *Building effective agents* 정의)
- **워크플로(Workflow):** LLM과 도구가 **미리 정해진 코드 경로**를 따라 움직인다. 예측 가능하고 일관성이 높다.
- **에이전트(Agent):** LLM이 **스스로 다음 단계와 도구 사용을 결정**한다. 유연하지만 비용과 오류 위험이 크다.
- 권장 원칙은 **"가장 단순한 패턴부터 시작하고, 복잡도가 효과로 입증될 때만 자율성을 높여라"**이다.

---

## 3. 레퍼런스 아키텍처

```
┌──────────────────────────────────────────────────────────────────┐
│ ⑥ 거버넌스/컨트롤 플레인                                           │
│   에이전트 레지스트리 · ID/권한 · 정책 · 감사 · 비용 한도 · HITL 승인  │
├──────────────────────────────────────────────────────────────────┤
│ ⑤ 관측/평가                                                       │
│   트레이싱(OTel GenAI) · 평가(Evals) · 가드레일 · 피드백 루프          │
├──────────────────────────────────────────────────────────────────┤
│ ④ 오케스트레이션 엔진                                              │
│   계획/라우팅 · 상태 그래프 · 에이전트 간 위임(A2A) · 내구성 실행        │
│   (체크포인트, 재시도, 일시정지/재개)                                 │
├───────────────────────┬──────────────────────┬───────────────────┤
│ ③ 에이전트 런타임        │ ② 메모리/컨텍스트       │ ① 도구/데이터 연결   │
│  LLM 호출 루프          │  단기(세션 상태)        │  MCP 서버           │
│  (추론→행동→관찰)        │  장기(벡터/그래프 DB)    │  API · DB · SaaS    │
│  샌드박스 실행 환경       │  컨텍스트 압축/요약      │  코드 실행·브라우저   │
├───────────────────────┴──────────────────────┴───────────────────┤
│ ⓪ 모델 계층: 모델 게이트웨이(라우팅·폴백·캐싱·레이트리밋) · 여러 LLM   │
└──────────────────────────────────────────────────────────────────┘
```

### 계층별 핵심 구성요소

| 계층 | 역할 | 주요 기술·제품 예시 |
|---|---|---|
| ⓪ 모델 게이트웨이 | 여러 모델 사이의 라우팅(작업 난이도별로 큰/작은 모델 배분), 폴백, 캐싱, 비용 통제 | LiteLLM, 클라우드 AI 게이트웨이, 프롬프트 캐싱 |
| ① 도구·데이터 연결 | 에이전트가 외부 시스템을 쓰는 표준 인터페이스 | **MCP**, OpenAPI, 함수 호출(function calling) |
| ② 메모리·컨텍스트 | 세션 상태, 장기 기억, 컨텍스트 윈도 관리 | 벡터 DB, 그래프 DB, 체크포인터, 컨텍스트 압축 |
| ③ 에이전트 런타임 | 추론→행동→관찰을 반복하는 ReAct 루프, 코드·브라우저 샌드박스 | Claude Agent SDK, OpenAI Agents SDK(네이티브 실행 환경) |
| ④ 오케스트레이션 엔진 | 제어 흐름, 위임, 병렬화, 장기 실행의 신뢰성 | LangGraph, MS Agent Framework, Google ADK, CrewAI, **Temporal** 같은 내구성 실행 엔진 |
| ⑤ 관측·평가 | 실행 경로 추적, 품질 평가, 가드레일 | OpenTelemetry GenAI 시맨틱 컨벤션, LangSmith, Langfuse, Galileo 등 |
| ⑥ 거버넌스 | 에이전트 인벤토리, 권한, 감사, 정책 | Microsoft Agent 365, ServiceNow AI Control Tower, AWS Bedrock AgentCore(인프라형) |

---

## 4. 오케스트레이션 패턴

### 4.1 워크플로 패턴 (Anthropic 분류)

| 패턴 | 구조 | 적합한 경우 |
|---|---|---|
| **프롬프트 체이닝** | A → B → C로 순차 처리하고, 단계 사이에 검증 게이트를 둔다 | 고정된 단계로 나눌 수 있는 작업. 지연을 감수하고 정확도를 얻는다 |
| **라우팅** | 분류기가 입력을 전문 핸들러나 모델로 보낸다 | 문의 유형별 처리, 난이도별 모델 선택 |
| **병렬화** | 독립 하위작업을 동시 실행하는 *섹셔닝*과, 같은 작업을 여러 번 돌려 다수결하는 *보팅*이 있다 | 속도 향상, 신뢰도 향상(검토·보안 점검 등) |
| **오케스트레이터-워커** | 중앙 LLM이 **실행 중에** 하위작업을 정해 워커에 위임하고 결과를 종합한다 | 하위작업을 미리 알 수 없는 복잡한 작업(코딩, 리서치) |
| **평가자-최적화** | 생성 → 비평 → 개선 루프를 반복한다 | 평가 기준이 명확하고 반복 개선이 효과적인 경우(번역, 문서 작성) |

### 4.2 멀티에이전트 토폴로지

```
 (a) 슈퍼바이저           (b) 계층형                (c) 네트워크/P2P        (d) 핸드오프
     ┌───┐                  ┌───┐                  A ◄──► B             A ──► B ──► C
     │ S │                  │ S │                  ▲ ╲  ╱ ▲            (제어권을 순서대로
     └┬┬┬┘                ┌─┴─┐ └─┐                │  ╳   │             넘김)
   ┌──┘│└──┐            ┌─┴┐  ┌┴─┐               ▼ ╱  ╲ ▼
   W1  W2  W3           │S1│  │S2│               C ◄──► D
                        └┬┘   └┬┘
                        W..   W..
```

| 토폴로지 | 장점 | 단점 | 대표 구현 |
|---|---|---|---|
| **슈퍼바이저(오케스트레이터-워커)** | 제어가 명확하고, 워커마다 **독립된 새 컨텍스트**를 준다 | 슈퍼바이저가 병목이자 단일 장애점이 된다 | LangGraph Supervisor, Claude 서브에이전트 |
| **계층형** | 대규모 작업을 분해할 수 있다 | 지연과 비용이 늘고, 디버깅이 어렵다 | ADK의 중첩 에이전트, CrewAI hierarchical |
| **네트워크/P2P** | 유연하고, 조직 경계를 넘어 협업할 수 있다 | 수렴을 보장하기 어렵고, 루프·비용이 폭주할 위험이 있다 | **A2A** 기반 이기종 에이전트 연동 |
| **핸드오프** | 단순하고, 대화형 서비스에 적합하다 | 병렬성이 낮다 | OpenAI Agents SDK의 handoff |

> **실무 관찰:** 멀티에이전트의 이점은 주로 **컨텍스트 분리**(하위 에이전트마다 깨끗한 컨텍스트)와 **병렬 탐색**에서 나온다. 사례로 Anthropic의 리서치 시스템은 리드 에이전트와 서브에이전트 구조로 단일 에이전트보다 내부 평가에서 크게 앞섰다고 보고됐다. 대신 토큰 사용량이 크게 늘기 때문에, 작업 가치가 비용을 정당화하는지 판단해야 한다.

### 4.3 신뢰성 패턴

- **내구성 실행(Durable Execution):** 이벤트 히스토리를 기록하고, 장애가 나면 이를 재생(replay)해 복구한다. 몇 시간에서 며칠씩 걸리는 장기 작업도 일시정지·재개·재시도할 수 있다.
  - Temporal 같은 워크플로 엔진과 LangGraph 체크포인팅이 대표적이다.
  - 최근에는 **LLM 호출과 도구 호출을 각각 하나의 "액티비티"로 감싸는 방식**이 표준적인 구현으로 자리잡고 있다.
- **Human-in-the-Loop(HITL):** 결제, 삭제, 외부 발송처럼 되돌리기 어려운 행동 앞에 승인 단계를 둔다. 인터럽트·재개 API로 구현한다.
- **사가(Saga)와 보상 트랜잭션:** 여러 시스템에 걸친 작업이 실패하면 이미 실행한 단계를 되돌린다.
- **예산·한도:** 에이전트별 토큰·비용·반복 횟수 상한과 타임아웃을 둔다. 무한 루프를 막는 핵심 장치다.

---

## 5. 상호운용 프로토콜

| 프로토콜 | 방향 | 역할 | 거버넌스·현황 |
|---|---|---|---|
| **MCP (Model Context Protocol)** | 클라이언트 → 서버 (에이전트 → 도구·데이터) | 도구, 리소스, 프롬프트를 노출하는 표준 인터페이스. "AI용 USB-C" | Anthropic이 2024년 11월 공개하고 2025년 12월 9일 AAIF(Linux Foundation)에 기증. 2026년 로드맵의 중점은 전송 확장성, 에이전트 간 통신, 거버넌스 성숙, 엔터프라이즈 준비도. 2차 출처 기준으로 SDK 월 다운로드가 9,700만 회를 넘는다고 함 |
| **A2A (Agent2Agent)** | 피어 ↔ 피어 (에이전트 ↔ 에이전트) | 에이전트 능력 광고(Agent Card), 작업 위임, 상태·결과 교환 | Google이 공개하고 2025년 6월 Linux Foundation에 기증. 2차 출처 기준으로 150개 이상 조직이 지원한다고 함 |
| **OpenTelemetry GenAI 시맨틱 컨벤션** | 관측 | 에이전트, LLM, 도구, MCP 호출의 트레이스 스키마(`invoke_agent`, `gen_ai.tool.name` 등) | 2026년 6월 별도 저장소로 분리됨. 안정화 여부는 출처마다 엇갈린다(아래 주의사항 참고) |

**정리:** **MCP는 수직**(에이전트와 그 아래 도구), **A2A는 수평**(에이전트와 에이전트), **OTel은 관측** 계층을 맡는다. 셋을 조합하면 벤더 종속 없이 이기종 에이전트를 운영할 수 있는 구조가 된다.

---

## 6. 프레임워크·SDK 비교 (2026)

| 프레임워크 | 성격 | 강점 | 약점·고려사항 |
|---|---|---|---|
| **LangGraph** | 상태 그래프 기반의 저수준 오케스트레이션 | 체크포인트·내구성 실행·HITL, 운영 검증 사례가 가장 많음 | 학습 곡선이 가파름 |
| **Microsoft Agent Framework 1.0** | AutoGen과 Semantic Kernel의 후계 | .NET·Python 지원, Azure Foundry와 통합 | AutoGen 사용자는 마이그레이션 필요 |
| **Google ADK 2.0** | 멀티언어 에이전트 개발 키트 | 계층형 멀티에이전트, Vertex AI·A2A와 통합 | Google 생태계 의존도가 높음 |
| **OpenAI Agents SDK** | 경량 Python·TS SDK | 핸드오프, 가드레일, 트레이싱 내장, 네이티브 실행 환경 | 복잡한 상태 관리는 직접 구현해야 함 |
| **Claude Agent SDK** | Claude Code의 에이전트 루프를 SDK로 공개 | 도구 사용, 서브에이전트, 컨텍스트 관리, MCP 네이티브 | Claude 모델 중심 |
| **CrewAI** | 역할 기반 팀 구성 | YAML 설정으로 빠르게 프로토타입을 만들 수 있음 | 정교한 제어 흐름에는 한계가 있음 |
| **Temporal 등 워크플로 엔진** | 범용 내구성 실행 엔진 | 장기 실행, 재시도, 감사 추적 | 에이전트 추상화는 직접 구성해야 함 |

**선택 가이드**
1. **단일 에이전트와 도구 몇 개로 충분하면** 모델 벤더의 SDK(Claude Agent SDK, OpenAI Agents SDK)를 쓴다.
2. **복잡한 분기, 장기 실행, HITL이 필요하면** LangGraph를 쓰거나 Temporal 같은 내구성 엔진과 조합한다.
3. **클라우드 표준화가 우선이면** MS Agent Framework(Azure)나 Google ADK(GCP)를 쓴다. AWS는 Bedrock AgentCore를 인프라로 깔고 프레임워크는 자유롭게 고른다.
4. 어떤 경우든 **도구는 MCP로, 외부 에이전트 연동은 A2A로** 추상화해 프레임워크를 교체할 여지를 남긴다.

---

## 7. 엔터프라이즈 플랫폼 동향

| 벤더 | 플랫폼 | 포지셔닝 |
|---|---|---|
| **Salesforce** | Agentforce (Atlas Reasoning Engine) | CRM에 내장된 에이전트. 영업·서비스·마케팅용 사전 구축 에이전트 제공 |
| **ServiceNow** | AI Agent Orchestrator, AI Control Tower | IT·업무 워크플로 내 에이전트 조율과 전사 거버넌스 |
| **Microsoft** | Copilot Studio, Azure AI Foundry Agent Service, Agent 365 | 로우코드(Studio)와 프로코드(Foundry)로 나뉨. Agent 365는 출처와 무관하게 에이전트를 관리하는 거버넌스 컨트롤 플레인 |
| **AWS** | Bedrock AgentCore | 서버리스 런타임, ID, 메모리, 게이트웨이를 제공하는 **인프라형**. 오케스트레이션 로직은 사용자가 구현하며, 지원하는 프레임워크 폭이 넓음 |
| **Google** | Vertex AI Agent Builder / Agent Engine, Agentspace | ADK와 A2A 중심의 개방형 생태계 |

**흐름 정리**
- 시장이 **업무 시스템 내장형**(Salesforce, ServiceNow)과 **수평 플랫폼형**(클라우드 3사, 독립 벤더)으로 나뉘고 있다.
- Gartner의 "2030년 60%가 외부 오케스트레이션 플랫폼 채택" 전망은 수평 플랫폼 쪽이 커질 것이라는 신호로 읽을 수 있다.
- 기존 챗봇, RPA, 정적 워크플로를 "에이전트"로 이름만 바꾸는 **에이전트 워싱**에 대한 경계도 커지고 있다.

---

## 8. 국내 동향

- **삼성SDS:** CES 2026에서 NVIDIA, OpenAI와 협력해 AI 에이전트 사업을 확대한다고 발표했다. 2026년 10월 'AI페스타 2026'에서는 여러 제조사의 로봇과 설비에 작업을 배분하는 **로봇 오케스트레이션 플랫폼**과 협력 생태계 '팀 렉스'를 공개했다. 현재 10개 기업과 협력을 시작한 단계로, 에이전트 오케스트레이션이 물리 세계로 넓어지는 사례다.
- **SK AX(구 SK C&C):** 에이전틱 AI 플랫폼 **AXgenticWire**를 기반으로 ESG 컴플라이언스 등 업무 특화 에이전트를 출시하고 있다.
- **LG CNS:** 업종별 AX 사업을 확대하고 있다. 오케스트레이션 플랫폼의 구체적 내용은 이번 조사에서 확인되지 않았다.
- **시장 규모 참고:** 한 시장보고서는 에이전틱 AI 오케스트레이션·메모리 시스템 시장이 2025년 64.9억 달러에서 2026년 90억 달러로 성장할 것으로 추정했다(CAGR 38.7%). 단일 보고서 추정치이므로 참고용이다.

---

## 9. 주요 과제

1. **신뢰성:** 단계가 늘수록 오류가 누적된다. 단계별 성공률이 95%라도 20단계를 거치면 전체 성공률은 약 36%에 그친다. 따라서 검증 게이트, 재시도, 사람의 개입 지점을 함께 설계해야 한다.
2. **비용과 지연:** 멀티에이전트는 토큰 사용량을 몇 배로 늘린다. 이를 줄이는 수단으로 모델 라우팅(작은 모델 우선), 프롬프트 캐싱, 컨텍스트 압축이 쓰인다.
3. **보안:**
   - 프롬프트 인젝션, 특히 도구 결과나 외부 문서를 통한 간접 인젝션
   - 권한이 과도한 에이전트
   - MCP 서버의 공급망 위험
   - 대응책은 최소 권한, 샌드박스, 에이전트별 ID와 감사 기록이다.
4. **평가:** 비결정적인 다단계 시스템은 회귀 테스트가 어렵다. 그래서 실행 경로 단위의 평가(trajectory eval)와 운영 중 온라인 평가가 필요하다.
5. **거버넌스:** 조직 곳곳에 생겨나는 "섀도 에이전트"를 관리해야 한다. 에이전트 인벤토리, 소유자 지정, 정책 적용이 필요하다.
6. **ROI:** Gartner는 비용, 불분명한 가치, 위험 통제 부족 때문에 에이전틱 프로젝트의 40% 이상이 취소될 수 있다고 경고했다.

---

## 10. 전망과 도입 권고

**전망**
- **2026~2027:** 작업 특화 에이전트가 앱 안에 탑재되는 흐름이 확산된다. MCP와 A2A가 사실상 표준으로 굳어지고, 관측·거버넌스 제품군이 성숙한다.
- **2027~2029:** 한 애플리케이션 안의 에이전트 협업을 넘어, 조직과 벤더 경계를 넘는 **멀티에이전트 생태계**로 발전할 것으로 보인다(Gartner). 로봇과 설비 같은 물리 세계로의 확장(Physical AI 오케스트레이션)도 진행된다.

**도입 권고**
1. **워크플로부터 시작한다.** 체이닝이나 라우팅으로 풀리는 문제에 에이전트를 쓰지 않는다. 자율성은 측정된 효과가 있을 때만 높인다.
2. **프로토콜 우선으로 설계한다.** 도구는 MCP, 에이전트 간 연동은 A2A, 관측은 OTel로 통일해 프레임워크와 모델을 바꿀 수 있게 한다.
3. **내구성을 기본으로 한다.** 장기 실행 작업은 체크포인트와 내구성 실행 엔진 위에 올린다. 되돌리기 어려운 행동에는 HITL 승인을 둔다.
4. **관측과 평가를 처음부터 넣는다.** 트레이싱과 평가 세트 없이는 운영 단계로 넘어가지 않는다.
5. **에이전트를 직원처럼 관리한다.** 에이전트마다 ID, 권한, 소유자, 예산 한도, 감사 로그를 둔다.

---

## 주의사항

- 프레임워크 비교와 채택 수치(MCP 다운로드 수, A2A 지원 조직 수, AAIF 회원 수 등)는 상당수가 벤더 블로그나 2차 자료에서 나왔다. 공식 발표로 교차 확인하지는 못했다.
- A2A가 AAIF로 편입됐는지, 그리고 그 시점은 출처마다 엇갈린다(2025년 6월 Linux Foundation 기증은 공통). 이 보고서는 "Linux Foundation이 관리한다"는 수준으로만 기술했다.
- OpenTelemetry GenAI 시맨틱 컨벤션의 상태도 출처마다 다르다. 2026년 6월 안정화됐다는 보도가 있는 반면, 8월 기준 아직 Development 단계라는 보도도 있다. 공식 저장소에서 확인이 필요하다.
- Gartner 수치는 대부분 2차 보도를 통해 확인한 것이다.

---

## 참고 자료

**패턴·아키텍처**
- [Anthropic – Building effective agents](https://www.anthropic.com/research/building-effective-agents)
- [Spring AI – Building Effective Agents](https://docs.spring.io/spring-ai/reference/api/effective-agents.html)
- [Lyzr – Agentic Workflows](https://lyzr.ai/blog/agentic-workflows/)
- [Supervisor / Orchestrator-Worker Pattern](https://learn.traeai.com/t/ai-engineering/phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern)
- [Temporal Workflows: Durable Orchestration for Microservices and Agents](https://www.storytel.com/sg/books/temporal-workflows-durable-orchestration-for-microservices-and-agents-13803734)
- [mcp-agent Temporal 예제](https://glama.ai/mcp/servers/@Nghiauet/mcp-agent/blob/af33d97f68224302046f9062ead41711f21d4373/examples/temporal/README.md)

**프레임워크**
- [LangChain – The best AI agent frameworks in 2026](https://langchain.com/resources/ai-agent-frameworks)
- [GuruSup – Best Multi-Agent Frameworks in 2026](https://gurusup.com/blog/best-multi-agent-frameworks-2026)
- [Future AGI – Best multi agent frameworks 2026](https://futureagi.com/blog/best-multi-agent-frameworks-2026)
- [RaftLabs – AI agent framework comparison](https://www.raftlabs.com/blog/ai-agent-framework-comparison)
- [TrueFoundry – Agentic AI frameworks](https://www.truefoundry.com/blog/agentic-ai-frameworks)
- [Hightower – LangGraph vs CrewAI vs Claude Agent SDK](https://rickhigh.substack.com/p/langgraph-vs-crewai-vs-claude-agent)

**프로토콜**
- [FlowHunt – A2A Joins MCP at the Linux Foundation](https://www.flowhunt.io/blog/agentic-ai-foundation-a2a-mcp-standards/)
- [Philipp Dubach – MCP vs A2A in 2026](https://philippdubach.com/posts/mcp-vs-a2a-in-2026-how-the-ai-protocol-war-ends/)
- [MCP 2026 Roadmap](https://mcpplaygroundonline.com/blog/mcp-2026-roadmap-whats-changing-for-developers)
- [Tarry Singh – The agent stack just became a standard](https://tarrysingh.com/blog/the-agent-stack-just-became-a-standard)

**관측·거버넌스**
- [TrueFoundry – OpenTelemetry GenAI semantic conventions](https://www.truefoundry.com/blog/opentelemetry-genai-semantic-conventions)
- [Galileo – AI Observability Trends in 2026](https://galileo.ai/blog/ai-observability-trends-2026)
- [Business Tech Navigator – OTel GenAI conventions for agents](https://businesstechnavigator.com/news/opentelemetry-genai-semantic-conventions-agents-2026)

**엔터프라이즈 플랫폼·시장**
- [Enterprise Agentic AI Platforms (2026)](https://agentic-ai.readthedocs.io/en/latest/AgentPlatforms/enterprise-platforms-2026/)
- [Enterprise AI Agent Platforms 2026: Frontier vs Agent365 vs AgentCore vs Vertex AI](https://wetheflywheel.com/en/guides/enterprise-ai-agent-platforms-2026/)
- [Constellation ShortList – Agentic Platforms of the Enterprise](https://www.constellationr.com/research/constellation-shortlist-agentic-platforms-of-the-enterprise)
- [Kissflow – Gartner Hype Cycle for Agentic Automation](https://kissflow.com/no-code/gartner-hype-cycle-agentic-automation/)
- [Digit – Agentic AI in enterprise (Gartner)](https://www.digit.fyi/agentic-ai-in-enterprise-gartner/)
- [JIT – Gartner 2026 multiagent systems](https://jit.pro/blog/gartner-2026-multiagent-systems-enterprise-architecture)

**국내**
- [머니투데이 – 삼성SDS, 엔비디아·오픈AI 손잡고 'AI 에이전트' 사업 확대 (2026.01)](https://www.mt.co.kr/industry/2026/01/08/2026010806051917918)
- [meeco – 삼성SDS 로봇 오케스트레이션 플랫폼](https://meeco.kr/news/42236006)
- [NextPlatform – 국내 SI 3사 AI 동향](https://nextplatform.net/best-ai-company-samsung-sds-lg-cns-hyundai-autoever-sk-ax/)
- [CIO Korea – 60개 넘는 플랫폼, 어떻게 고르나: AI 에이전트 오케스트레이션](https://www.cio.com/article/4206067)
- [ITWorld – 에이전트 배포보다 어려운 건 통제: AI 오케스트레이션](https://www.itworld.co.kr/article/4209005/)
- [GII – Agentic AI Orchestration 시장 보고서](https://www.giikorea.co.kr/report/tbrc1987567-agentic-artificial-intelligence-ai-orchestration.html)
