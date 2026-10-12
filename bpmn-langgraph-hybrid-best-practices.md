# BPMN과 LangGraph 하이브리드 모범사례 (2026년 10월 기준)

> 작성일: 2026-10-12
> 범위: BPMN 프로세스 엔진(Camunda 8 중심)이 바깥 프로세스를 맡고, LangGraph 에이전트가 안쪽 추론을 맡는 하이브리드 구조의 설계·통합·운영 모범사례
> 관련 문서: [ai-orchestration-2026.md](./ai-orchestration-2026.md)

---

## 1. 요약

- **핵심 원칙은 "에이전트를 프로세스 안에 둔다"는 것이다.** 프로세스 바깥에 에이전트를 따로 두지 않는다. 역할 분담은 다음과 같다.
  - **BPMN:** 업무 흐름, 사람 결재, 시스템 연동, SLA, 감사를 맡는다(결정적 영역).
  - **LangGraph:** 흐름을 미리 정할 수 없는 추론을 맡는다(동적 영역).
  - Camunda도 공식 가이드에서 "BPMN은 흐름 지도, DMN은 결정 가드레일, 커넥터는 도구 호출 통제, 사람은 적절한 게이트웨이에서 개입"이라는 구도를 제시한다.
- **통합 방식이 표준화되고 있다.**
  - ① 잡 워커 패턴: 범용적이며 지금 바로 쓸 수 있다.
  - ② **A2A Client 커넥터:** Camunda 8.9(2026년 4월)부터 제공된다.
  - ③ **외부 에이전트 마커(`agentType="external"`)와 Agent Instance API:** Camunda 8.10에서 제공 예정이며, 문서상 아직 미출시다.
  - ④ 반대 방향 연동: LangGraph가 Camunda 8.9에 내장된 MCP 서버나 REST API로 BPMN 프로세스를 도구처럼 호출한다.
- **가장 흔한 실패는 경계 설계에서 나온다.** 사람 결재나 컴플라이언스 판단을 에이전트 안에 숨기거나, 반대로 추론 루프 한 단계 한 단계를 BPMN 활동으로 쪼개는 경우다. 앞의 경우는 감사가 불가능해지고, 뒤의 경우는 오버헤드와 경직성이 생긴다.
- **운영의 핵심은 세 가지 연결고리다.** 상관관계 ID(프로세스 인스턴스와 LangGraph 스레드), 오류 의미 매핑(BPMN 에러, incident, 재시도), 세 겹의 버전 관리(프로세스, 그래프, 프롬프트)다.

---

## 2. 역할 분담

### 2.1 어디까지 BPMN이고 어디부터 에이전트인가

| 판단 기준 | BPMN에 둘 것 | LangGraph에 둘 것 |
|---|---|---|
| 흐름을 미리 정할 수 있는가 | 예 (순서와 분기가 정해져 있음) | 아니오 (입력마다 경로가 다름) |
| 규제·감사 대상인가 | 예 (승인, 한도, 법적 판단) | 근거 수집, 초안 작성, 분류처럼 감사 대상이 아닌 작업 |
| 사람이 개입하는가 | 업무 결재, 예외 승인, 담당자 배정 | 에이전트 내부 확인(되묻기) 정도 |
| 결과가 외부에 영향을 주는가 | 결제, 발송, 계약 체결 같은 **되돌리기 어려운 행동** | 조회, 분석, 초안 같은 부작용 없는 작업 |
| 실행 시간 | 분에서 몇 달 (타이머, 대기, 기한) | 초에서 분 (단일 추론 세션) |
| 규칙이 명확한가 | 명확한 규칙은 **DMN**으로 | 규칙으로 표현하기 어려운 판단 |

**경험칙:** "이 판단이 틀리면 누가 책임지는가?"를 묻는다. 답이 '조직'이라면 BPMN이나 DMN, 또는 사람 결재로 드러나 있어야 한다. 에이전트는 그 판단을 위한 **재료**(분석, 추천, 초안)를 만든다.

### 2.2 LangGraph와 Camunda 네이티브 AI Agent 중 무엇을 쓸까

Camunda 8.8부터는 엔진 안에서 에이전트를 직접 돌릴 수 있다. AI Agent 커넥터와 ad-hoc 서브프로세스를 조합하는 방식이다. 그러니 LangGraph가 늘 필요한 것은 아니다.

| 상황 | 권장 |
|---|---|
| 도구 선택 루프가 단순하고, 도구 대부분이 이미 BPMN 활동이나 커넥터로 있음 | **Camunda 네이티브 AI Agent** (구성 요소가 적고 감사 기록이 자동으로 남음) |
| 멀티에이전트 구조, 정교한 컨텍스트 관리, 스트리밍, 상태 모델을 직접 설계해야 함 | **LangGraph를 외부 에이전트로** 연결 |
| 다른 팀이나 벤더가 운영하는 에이전트 | **A2A**로 연결 |
| 에이전트가 이미 LangGraph로 만들어져 있음 | 외부 에이전트로 연결 |

---

## 3. 통합 패턴

### 패턴 A: 잡 워커 (범용, 즉시 적용 가능)

```
BPMN: ──▶ [Service Task: type="langgraph-claim-triage"] ──▶ (결과 변수로 분기) ──▶ ...
                     │  잡 활성화                 ▲ complete / throwError / fail
                     ▼                          │
          ┌───────────── 에이전트 워커 서비스 ──────────────┐
          │ 1) 잡 변수 → 그래프 입력 스키마로 검증           │
          │ 2) thread_id = f"{processInstanceKey}:{elementInstanceKey}" │
          │ 3) graph.invoke(input, config={thread_id})   │
          │ 4) 출력 스키마 검증 → 잡 완료 / 오류 처리         │
          └─────────────────────────────────────────────┘
```

- **동기 방식:** 몇 초에서 몇 분 안에 끝나는 에이전트에 쓴다. 잡 타임아웃은 에이전트 최대 실행 시간보다 넉넉하게 잡는다.
- **비동기 방식(장기 실행에 권장):** 서비스 태스크는 에이전트 작업을 **시작만** 하고 바로 완료한다. 이어서 **Receive Task나 메시지 중간 이벤트**에서 결과를 기다린다. 에이전트는 작업이 끝나면 메시지를 보내 결과를 전달한다(상관 키는 업무 키나 인스턴스 키). 기다리는 쪽에는 **타이머 경계 이벤트**를 달아 시간 초과 시 사람에게 넘긴다.

### 패턴 B: 외부 에이전트 마커와 Agent Instance API (Camunda 8.10, 미출시)

- 에이전트를 호스팅하는 서비스 태스크에 `zeebe:agentDefinition` 확장을 붙이고 `agentType="external"`로 지정한다. 에이전트 런타임(LangGraph, Bedrock, 직접 만든 코드)은 그 잡 타입을 구독하는 워커로 동작한다.
- 런타임은 **Agent Instance API**로 에이전트 인스턴스를 만들고 다음 정보를 보고한다.
  - 상태
  - 사용량(토큰 등)
  - 사용한 도구
  - 대화 이력
- 이 정보는 Operate와 Optimize에 그대로 보인다. 마커가 없어도 에이전트는 돌아가지만 **Operate와 Optimize에는 나타나지 않는다.**
- 의미: 패턴 A에서 가장 아쉬웠던 **블랙박스 문제**(엔진 쪽에서 에이전트 내부가 안 보이는 문제)를 플랫폼 차원에서 해결한다. 8.10을 쓸 수 있게 되면 패턴 A에 이 마커를 더하는 방식이 권장안이 될 것으로 보인다.

### 패턴 C: A2A Client 커넥터 (Camunda 8.9)

- BPMN에서 A2A 규격을 따르는 에이전트를 Agent Card URL로 호출한다. 응답은 폴링이나 웹훅으로 받는다.
- 에이전트를 다른 팀이 운영하거나 서로 다른 프레임워크를 섞어 쓸 때, **워커 코드 없이 프로토콜만으로** 연결할 수 있다.
- 주의: 알파 버전 시기에 커넥터 오류를 보고한 커뮤니티 사례가 있다. 운영 투입 전에 사용하는 버전에서 검증해야 한다.

### 패턴 D: 역방향 연동 (LangGraph → BPMN)

- 에이전트가 **업무 프로세스를 도구로** 호출하는 방식이다. 예: "환불 프로세스 시작", "결재 요청 생성".
- 쓸 수 있는 수단은 Camunda 8.9에 내장된 MCP 서버, 또는 Orchestration Cluster REST API(프로세스 인스턴스 생성, 메시지 발행)다.
- **모범사례:** 에이전트가 되돌리기 어려운 행동을 **직접 하지 않게** 한다. 대신 그 행동을 맡은 **BPMN 프로세스를 시작**하게 한다. 그러면 승인, 한도 검사, 감사가 자동으로 붙는다.

### 패턴 선택 요약

| 요구 | 패턴 |
|---|---|
| 지금 바로, 범용으로 | A (짧으면 동기, 길면 비동기) |
| Operate·Optimize에서 에이전트 내부까지 보기 | A + B (8.10 이후) |
| 외부 팀이나 벤더의 에이전트 | C |
| 에이전트가 통제된 방식으로 업무 행동을 실행 | D |

---

## 4. 설계 모범사례

### 4.1 계약(Contract) 우선 설계
- 에이전트 경계마다 **입력·출력 JSON 스키마**를 정하고 버전을 붙인다. 출력은 LLM의 구조화 출력(structured output)으로 받고, 워커에서 다시 검증한다(Pydantic 등).
- 출력에는 **판단 결과 외에도** 근거(rationale), 신뢰도(confidence), 사용한 출처, 그리고 `needs_human: bool`을 넣는다. 그래야 BPMN 게이트웨이와 DMN이 이 값을 보고 분기할 수 있다.
- 프로세스 변수에는 **요약된 결과만** 넣는다. 대화 이력이나 대용량 문서는 외부 저장소에 두고 참조 ID만 넘긴다. 프로세스 변수가 비대해지는 것을 막기 위해서다.

### 4.2 상태의 주인은 하나
| 상태 | 저장 위치 |
|---|---|
| 업무 상태 (어느 단계인지, 승인 여부, 기한) | **BPMN 엔진** (유일한 기준) |
| 에이전트 내부 상태 (메시지, 중간 계획, 도구 결과) | **LangGraph 체크포인터** (Postgres 등) |
| 둘을 잇는 고리 | `thread_id`에 프로세스 인스턴스 키와 요소 인스턴스 키를 넣음 |

- LangGraph 상태에 "승인됨" 같은 **업무 상태를 중복 저장하지 않는다.** 두 곳에 있으면 결국 어긋난다.

### 4.3 멱등성과 재시도
- 잡은 **최소 한 번 이상 실행**될 수 있다(at-least-once). 워커가 죽거나 시간이 초과되면 같은 잡이 다시 실행된다.
  - 같은 `thread_id`로 다시 호출하면 체크포인트에서 이어서 실행되도록 설계한다.
  - 에이전트가 부작용 있는 도구를 쓴다면 **멱등 키**(예: `{processInstanceKey}-{toolCall}`)를 함께 보낸다.
- 재시도는 **한 곳에서만** 한다. 엔진 재시도(잡 retries)와 LangGraph·SDK 내부 재시도가 겹치면 호출 횟수가 곱으로 불어난다.
  - 권장: LLM API의 일시 오류는 SDK의 짧은 재시도로, 워커나 에이전트 전체의 실패는 엔진 재시도로 처리한다.

### 4.4 오류의 의미 구분
| 상황 | 처리 | BPMN 표현 |
|---|---|---|
| 일시적 장애 (LLM API 장애, 네트워크) | 엔진 재시도, 백오프 | `failJob(retries-1)` → 재시도 소진 시 **incident** |
| **업무 예외** (판단 불가, 정보 부족, 정책 위반 감지) | 프로세스가 정한 대체 경로로 | `throwError("AGENT_UNCERTAIN")` → **에러 경계 이벤트** → 사람 작업 |
| 출력 스키마 검증 실패 | 한 번 재생성하고, 그래도 실패하면 업무 예외로 | 위와 같음 |
| 예산·시간 초과 | 중단하고 사람에게 넘김 | 타이머 경계 이벤트 / 에러 이벤트 |

- 핵심은 **"모르겠다"를 정상적인 결과로 설계하는 것**이다. Camunda도 에이전트가 확신하지 못하면(모호함, 윤리적 문제) 사람 작업으로 넘기고, 에이전트마다 **결정적인 탈출 경로**를 두라고 권장한다.

### 4.5 사람 개입(HITL)은 BPMN에
- **업무 결재와 예외 승인은 BPMN 사용자 작업으로** 만든다. 태스크 목록, 담당자 배정, 기한, 대리 처리, 감사 기록이 기본으로 따라온다.
- LangGraph의 `interrupt()`는 **에이전트 내부의 짧은 확인**에만 쓴다(예: 대화형 서비스에서 사용자에게 되묻기). 결재처럼 몇 시간에서 며칠 걸리는 대기를 LangGraph 안에 두면 다음 문제가 생긴다.
  - 기한 관리가 안 된다. LangGraph에는 기본 TTL이 없어서 방치된 스레드를 따로 정리해야 한다.
  - 태스크 목록이 없다.
  - 감사 기록이 흩어진다.

### 4.6 가드레일은 세 겹으로
```
[사전 DMN: 처리 대상인지, 한도, 정책 확인] → [에이전트 (내부 가드레일)] → [사후 검증: DMN / 검증 에이전트] → 게이트웨이 → 자동 처리 / 사람 검토
```
1. **에이전트 앞(BPMN/DMN):** 에이전트를 탈 대상인지 거른다. 금액 한도, 고객 등급, 규제 대상 여부 등을 본다.
2. **에이전트 안(LangGraph):** 도구 허용 목록, 최대 반복 횟수와 토큰 상한, 입력 정화(프롬프트 인젝션 대응), 구조화 출력을 적용한다. Camunda 네이티브 에이전트도 최대 모델 호출 수와 토큰 상한을 설정할 수 있다.
3. **에이전트 뒤(BPMN/DMN):** 신뢰도 임계값, 규칙 기반 검증(DMN), 검증 에이전트 같은 "가드레일 샌드위치"를 거쳐 자동 처리할지 사람이 검토할지 정한다.

### 4.7 관측: 하나로 이어진 추적
- 상관 키를 **양쪽에** 모두 남긴다.
  - LangGraph·LangSmith 트레이스의 메타데이터에 `processInstanceKey`, `processDefinitionId` 버전, 업무 키를 넣는다.
  - BPMN 변수에는 `agentThreadId`와 트레이스 URL을 남긴다.
- OpenTelemetry 트레이스 컨텍스트를 잡 변수로 전달해 엔진, 워커, LLM 호출을 하나의 트레이스로 묶는다.
- 업무 지표(처리 시간, 자동 처리율, 사람에게 넘어간 비율)는 **Optimize**에서 본다. 에이전트 지표(토큰, 도구 성공률, 노드별 지연)는 **LangSmith나 OTel 백엔드**에서 본다. 8.10의 Agent Instance API가 나오면 이 둘의 간격이 줄어든다.

### 4.8 세 겹의 버전 관리
| 대상 | 방법 |
|---|---|
| BPMN 프로세스 | 엔진 버전 관리. 실행 중인 인스턴스는 기존 버전을 유지하고, 필요하면 마이그레이션 |
| LangGraph 그래프와 코드 | 워커 배포 버전. 잡 타입에 버전을 넣거나(`triage-v2`) 변수로 지정 |
| 프롬프트와 모델 | 프롬프트 레지스트리로 버전 관리와 롤백. 결과 변수에 사용한 `promptVersion`과 `model` 기록 |

- 결과마다 **어떤 프로세스, 어떤 그래프, 어떤 프롬프트, 어떤 모델**이 판단했는지 남아야 감사와 회귀 분석이 가능하다.

### 4.9 보안
- 에이전트 워커의 API 권한은 **필요한 프로세스와 동작으로만** 제한한다(최소 권한). 8.10 외부 에이전트를 쓰려면 해당 프로세스 정의에 대한 API 권한이 필요하다.
- 시스템 연동 자격증명은 **엔진의 커넥터 시크릿**에 둔다. 에이전트는 자격증명을 직접 갖지 않고, BPMN 활동이나 커넥터를 통해서만 외부 시스템을 건드린다(패턴 D).
- 에이전트가 읽는 외부 문서나 메일은 **신뢰할 수 없는 입력**으로 취급한다. 간접 프롬프트 인젝션이 일어나도 패턴 D와 사후 가드레일 덕분에 피해가 제한된다.

### 4.10 테스트
- **BPMN 경로 테스트:** 에이전트 워커를 모킹하고 정상, 업무 예외, 시간 초과, 사람에게 넘기는 경로를 모두 검증한다.
- **에이전트 평가:** 업무 케이스로 회귀 평가 세트를 만들고, 프롬프트·모델·그래프를 바꿀 때마다 돌린다. 최종 답뿐 아니라 실행 경로(trajectory)도 평가한다.
- **섀도 운영:** 처음에는 에이전트 결과를 **추천으로만** 보여주고 사람이 최종 판단한다. 일치율이 기준을 넘으면 낮은 위험군부터 자동 처리로 바꾼다. 이 전환도 DMN 임계값 하나로 조정할 수 있게 해 둔다.

---

## 5. 레퍼런스 아키텍처 예시: 보험 청구 처리

```
┌──────────────────────────── Camunda (BPMN) ────────────────────────────┐
│                                                                        │
│ (청구 접수) → [DMN: 처리 대상 판별] ─┬─ 대상 아님 → [사람: 일반 심사]       │
│                                  │                                     │
│                                  └─ 대상 → [Service Task: 청구 분석 에이전트] ──┐
│                                             agentType=external (8.10)  │
│                                             ⏱ 타이머 경계: 10분 → 사람 심사 │
│                                             ⚡ 에러 경계: AGENT_UNCERTAIN → 사람 심사
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┘
│  ▼
│ [DMN: 사후 검증 (금액 한도, 신뢰도 ≥ 0.85, 사기 점수)]
│     ├─ 자동 승인 → [커넥터: 지급 시스템] → [커넥터: 고객 통지] → (종료)
│     └─ 검토 필요 → [사람: 심사자 검토 (에이전트 근거 표시)] → ...
└────────────────────────────────────────────────────────────────────────┘
                 │ 잡 활성화                      ▲ complete / throwError
                 ▼                                │
┌──────────────── 에이전트 워커 (LangGraph) ──────────────────────────────┐
│  입력 검증 → [문서 추출] → [약관 검색(RAG)] → [유사 사례 조회] → [판단 초안] │
│                 ↑______________ 정보 부족 시 반복 (최대 N회) ____________│
│  → 구조화 출력 {decision, amount, rationale, confidence, citations}     │
│  체크포인터: Postgres, thread_id = processInstanceKey:elementInstanceKey  │
│  도구: 조회 전용 (부작용 없음). 지급·통지는 BPMN 커넥터만 수행               │
└────────────────────────────────────────────────────────────────────────┘
```

### 워커 의사코드 (패턴 A)

> 아래는 구조를 설명하기 위한 의사코드다. 실제 클라이언트 API 이름은 사용하는 Camunda SDK에 맞춰야 한다.

```python
class ClaimTriageOutput(BaseModel):
    decision: Literal["approve", "reject", "needs_review"]
    amount: Decimal | None
    rationale: str
    confidence: float
    citations: list[str]

@worker(job_type="claim-triage-v2", timeout_ms=15 * 60_000)
def handle(job):
    inp = ClaimTriageInput.model_validate(job.variables)          # 1) 입력 계약 검증
    thread_id = f"{job.process_instance_key}:{job.element_instance_key}"
    config = {
        "configurable": {"thread_id": thread_id},                 # 2) 재실행 시 체크포인트에서 이어서
        "recursion_limit": 25,                                    # 3) 반복 상한
        "metadata": {"processInstanceKey": job.process_instance_key,
                     "promptVersion": PROMPT_VERSION},            # 4) 상관 키·버전을 트레이스에
    }
    try:
        result = graph.invoke({"claim": inp.model_dump()}, config)
        out = ClaimTriageOutput.model_validate(result["output"])  # 5) 출력 계약 검증
    except (ValidationError, GraphRecursionError) as e:
        return job.throw_error("AGENT_UNCERTAIN", str(e))         # 업무 예외 → 에러 경계 이벤트
    except TransientLLMError as e:
        return job.fail(retries=job.retries - 1, message=str(e))  # 일시 장애 → 엔진 재시도

    return job.complete({                                         # 6) 요약 결과만 변수로
        "triage": out.model_dump(mode="json"),
        "agentThreadId": thread_id,
        "promptVersion": PROMPT_VERSION,
        "model": MODEL_ID,
    })
```

---

## 6. 안티패턴

| 안티패턴 | 문제 | 대안 |
|---|---|---|
| **결재를 에이전트 안에 숨김** (LangGraph `interrupt`로 며칠 대기) | 기한·담당자·감사 관리가 안 되고, 방치된 스레드가 쌓임 | BPMN 사용자 작업 |
| **추론 단계마다 BPMN 활동으로 쪼갬** | 잡 오버헤드 때문에 지연이 늘고, 다이어그램이 복잡해지고, 유연성이 사라짐 | 추론은 하나의 에이전트 경계 안에서 처리 |
| **에이전트가 지급·발송 API를 직접 호출** | 승인과 한도 검사를 건너뛰고, 인젝션 피해가 커짐 | 패턴 D: BPMN 프로세스나 커넥터를 통해서만 실행 |
| **대화 이력 전체를 프로세스 변수에 저장** | 엔진 성능이 떨어지고, 민감정보가 퍼짐 | 요약과 참조 ID만 저장 |
| **엔진 재시도와 에이전트 재시도가 겹침** | LLM 호출과 비용이 폭증하고, 부작용이 중복됨 | 재시도는 한 계층에서만, 멱등 키 사용 |
| **"모르겠다"를 incident로 처리** | 운영팀에 업무 판단이 떠넘겨짐 | BPMN 에러 → 대체 경로(사람 작업) |
| **상관 키 없음** | 문제가 생겨도 어떤 인스턴스의 어떤 트레이스인지 찾을 수 없음 | thread_id와 메타데이터를 양쪽에 기록 |
| **처음부터 전면 자동화** | 신뢰를 얻기 전에 사고가 남 | 섀도 → 일부 자동 → 확대 |

---

## 7. 도입 체크리스트

**설계**
- [ ] 에이전트 경계마다 "틀리면 누가 책임지는가"를 확인하고, 책임 판단은 BPMN, DMN, 사람으로 드러나게 했다
- [ ] 입력·출력 스키마에 버전을 붙였고, 출력에 confidence, rationale, needs_human을 넣었다
- [ ] 되돌리기 어려운 행동은 모두 BPMN 활동이나 커넥터를 거친다
- [ ] 사전·사후 가드레일(DMN)과 사람 검토 경로가 있다

**신뢰성**
- [ ] 장기 실행 에이전트는 비동기 패턴과 타이머 경계 이벤트를 쓴다
- [ ] thread_id에 인스턴스 키를 넣어 재실행 시 이어서 실행된다
- [ ] 재시도 계층을 하나로 정했고, 멱등 키를 쓴다
- [ ] 업무 예외(BPMN 에러)와 기술 장애(incident)를 구분해 처리한다
- [ ] 반복, 토큰, 시간 상한을 설정했다

**운영**
- [ ] 상관 키가 엔진, LangSmith, OTel 양쪽에 남는다
- [ ] 결과마다 프로세스, 그래프, 프롬프트, 모델 버전을 기록한다
- [ ] 업무 지표(Optimize)와 에이전트 지표(트레이싱) 대시보드가 있다
- [ ] 8.10 이후에는 `agentType="external"` 마커와 Agent Instance API 보고를 적용할 계획이 있다

**도입 전략**
- [ ] 회귀 평가 세트가 있고, 변경할 때마다 돌린다
- [ ] 섀도 운영으로 일치율을 측정한 뒤 낮은 위험군부터 자동 처리로 바꾼다

---

## 8. 주의사항

- 이 문서의 근거 상당수는 **Camunda 공식 블로그와 문서**다. 하이브리드 구조가 낫다는 주장에는 벤더의 이해관계가 반영돼 있을 수 있다.
- **BPMN 엔진이 LangGraph를 오케스트레이션하는 실제 운영 사례를 공개한 독립 자료는 찾지 못했다.** 3장의 비동기 처리, 4.2~4.4의 상관 키·멱등성·재시도, 5장 예시 같은 세부 패턴은 공식 기능을 바탕으로 정리한 **권장 설계**다. 검증된 사례가 아니다.
- Camunda 8.10의 외부 에이전트 기능은 문서에 "8.10 (unreleased)"로 표시돼 있다. 출시 때 바뀔 수 있다.
- 이 환경의 네트워크 정책 때문에 공식 문서 원문을 직접 열지 못했다. 검색 결과에 나온 요약을 근거로 했으니, 적용 전에 원문을 확인해야 한다.
- 학술 쪽에서는 결정적 워크플로 엔진의 통제권을 유지하면서 그 주위에 정책 기반 에이전트 계층을 두는 **"process harness"** 접근(Fournier & Limonad)이 제안됐다. 이 문서의 원칙과 같은 방향이다.

---

## 참고 자료

**Camunda 공식**
- [Guardrails and Best Practices for Agentic Orchestration (2026.01)](https://camunda.com/blog/2026/01/guardrails-and-best-practices-for-agentic-orchestration/)
- [Key Principles in Designing Agents for Production – Part 1 (2026.05)](https://camunda.com/blog/2026/05/key-principles-in-designing-agents-for-production-part-1/)
- [Part 2 (2026.06)](https://camunda.com/blog/2026/06/key-principles-in-designing-agents-for-production-part-2/) · [Part 3](https://camunda.com/blog/2026/06/key-principles-in-designing-agents-for-production-part-3/) · [Part 4 – 가드레일](https://camunda.com/blog/2026/06/key-principles-in-designing-agents-for-production-part-4/)
- [AI Agent Design Patterns in Camunda (2025.05)](https://camunda.com/blog/2025/05/ai-agent-design-patterns-in-camunda/)
- [Agentic Orchestration FAQ](https://camunda.com/agentic-orchestration-faq/)
- [Build production-ready AI agents](https://camunda.com/platform/modeler/agents/)
- [Building Trustworthy AI Agents](https://camunda.com/?p=137829)
- [문서 – Agentic orchestration design](https://docs.camunda.io/docs/components/agentic-orchestration/ao-design/)
- [문서 – AI agents (8.8)](https://docs.camunda.io/docs/8.8/components/agentic-orchestration/ai-agents)
- [문서 – Connect an external agent (8.10, unreleased)](https://docs.camunda.io/docs/next/components/agentic-orchestration/connect-external-agent/)
- [문서 – Agent definitions and instances](https://docs.camunda.io/docs/next/components/agentic-orchestration/agent-definitions-and-instances/)
- [문서 – AI Agent connector](https://docs.camunda.io/docs/components/connectors/out-of-the-box-connectors/agentic-ai-aiagent/)
- [A2A, MCP and enhanced connectors with Camunda 8.9-alpha2 (2026.01)](https://camunda.com/blog/2026/01/a2a-mcp-and-enhanced-connectors-with-camunda-8-9-alpha2/)
- [Camunda 8.9 Release Notes](https://docs.camunda.io/docs/reference/announcements-release-notes/890/890-release-notes/)
- [What's new in 8.9](https://docs.camunda.io/docs/reference/announcements-release-notes/890/whats-new-in-89/)
- [Camunda Forum – A2A Protocol Integration 이슈](https://forum.camunda.io/t/challenges-camunda-a2a-protocol-integration-agentic-workflow/67083)

**LangGraph**
- [LangChain changelog – LangGraph 1.0](https://changelog.langchain.com/announcements/ann_lxOZRCoFw2Qn9)
- [LangChain – LangGraph vs Temporal](https://www.langchain.com/resources/langgraph-vs-temporal)
- [ActiveWizards – HITL engineering patterns with LangGraph interrupts](https://activewizards.com/blog/hitl-engineering-patterns-langgraph-interrupts/)
- [Human-in-the-loop with LangGraph: when (and how) to interrupt](https://rentierdigital.xyz/blog/human-in-the-loop-langgraph)
- [LangChain skills – langgraph-human-in-the-loop](https://skillselion.com/skills/langchain-ai/langchain-skills/langgraph-human-in-the-loop)
- [CloudThat – LangGraph persistence](https://www.cloudthat.com/resources/blog/building-stateful-ai-workflows-with-langgraph-persistence)

**연구·기타**
- [arXiv 2607.19297 – Graph-Based Agentic AI with LangGraph: Workflow Pathways for Long-Running Stateful Business Processes](https://arxiv.org/pdf/2607.19297)
- [Fournier & Limonad – Process harness for Agentic BPM (papers.cool 2606.27188)](https://papers.cool/arxiv/2606.27188)
- [viadee – Erfolg mit KI-Agenten: LangGraph vs Camunda 8 (독일어)](https://www.viadee.de/media/pages/persons/mario-micudaj/abe09e585e-1773830401/erfolg-mit-ki-agenten-langgraph-vs-camunda-8.pdf)
- [Auxiliobits – Orchestrating Long-Running Processes Using LangGraph Agents](https://www.auxiliobits.com/?p=19921)
- [Agentic AI is in desperate need of some Orchestration](https://sfrancisatx.substack.com/p/agentic-ai-is-in-desperate-need-of)
- [tSM – Agentic Process Automation](https://tsm.datalite.cz/docs/next/configuration/process-engine/agentic-process-automation/)
