# AI 공장장의 서비스, 화면, 상호작용 설계 제안

> 작성일: 2026-10-21
> 관련 문서: [AI 공장장 보고서](./ai-plant-manager.md) · [강의안](./lecture/mes-ai-plant-manager-lecture.md) · [화면 시안 (HTML)](./ux/ai-plant-manager-mockup.html)
> 성격: 사례 조사를 바탕으로 한 **설계 제안**이다. 사례 정보는 대부분 벤더 자료와 업계 기사이며, 화면 시안은 개념을 보여주기 위한 것이다.

---

## 1. 요약: 내 생각

1. **AI 공장장의 성패는 모델이 아니라 상호작용 설계에서 갈린다.** 같은 AI라도 사람이 찾아가야 하는 화면에 두면 기존 대시보드처럼 아무도 보지 않는다. 사람이 일하는 흐름(아침 회의, 교대, 현장 순회, 메신저) 안으로 들어가야 쓰인다.
2. **상호작용의 뼈대는 네 가지다: 알려주기 → 답하기 → 승인으로 실행하기 → 배우기.** 화면은 이 네 동작을 끊김 없이 잇는 도구다.
3. **화면의 단위는 '데이터'가 아니라 '결정해야 할 일'이다.** 카드 하나는 결정 하나다. "OEE 78%"가 아니라 "B-205 200개 부족: 조립2라인 우선 투입을 승인할까요?"다.
4. **신뢰는 화면에서 만들어진다.** MES에서 온 숫자와 AI가 쓴 문장을 눈으로 구분할 수 있게 하고, 근거와 데이터 기준 시각을 한 번의 클릭 거리에 둔다.
5. **AI 알림도 예산이 필요하다.** 공정 제어 분야가 30년 동안 배운 교훈(ISA-18.2 알람 관리, ISA-101 고성능 HMI)을 그대로 적용해야 한다. 알림이 넘치면 사람들은 다시 아무것도 보지 않는다.
6. **AI가 화면을 마음대로 만들게 하지 말고, 검증된 카드 부품을 골라 조합하게 한다** (통제된 생성형 UI). "지난주 B-205 추이 보여줘"라고 하면 AI가 차트 카드를 골라 띄우되, 차트 숫자는 MES 조회 결과로 채운다.
7. **새 앱부터 만들지 않는다.** 1단계는 사내 메신저의 브리핑과 질문, 2단계는 웹 '오늘' 화면과 승인함이다. 역할별 작업 화면과 현장 모바일은 그 뒤에 만든다.

---

## 2. 사례 조사와 시사점

| 사례 | 상호작용 방식 | 시사점 |
|---|---|---|
| **Siemens Industrial Copilot (Operations)** | 실시간 설비 데이터와 문서에 연결된 대화형 AI. 운영자가 설비 상태를 묻고 알람을 진단한다. 보전 담당자가 문제를 설명하고 제안을 논의한다. 이미지 입력(멀티모달)은 계획으로 발표됨 | 대화는 **데이터 + 문서**에 동시에 연결돼야 쓸모가 있다 |
| **Microsoft Factory Operations Agent** | IT·OT 데이터에 자연어로 질의. Copilot Studio 버전은 **Teams 등 업무 도구 안에서** 동작. 결과를 사후 검증하는 가드레일 | 새 앱보다 **이미 쓰는 협업 도구에 붙는 것**이 출발점으로 유리하다 |
| **Tulip Frontline Copilot / AI Agents** | 작업자용 채팅. SOP·매뉴얼 기반 답변에 **참조 문서 링크**를 붙인다. 에이전트는 품질 점검 강제, 작업 재일정 같은 행동까지 수행. 카메라와 비전-언어 모델로 현장 기록 재생(Factory Playback) | 답변마다 **출처 링크**. 대화에서 **행동**으로 이어지는 구조 |
| **Workerbase AI Shopfloor Copilot** | **한 번 탭**으로 답을 받는 설계. 타이핑과 검색이 없다. 고장 진단, 품종 교체, 교대 인수인계 요약 | 현장은 **타이핑 없는 상호작용**(버튼, 음성)이 기본이다 |
| **SymphonyAI Proceedix** | **오프라인 우선**. 역할 기반 AI 코파일럿 | 현장 단말은 네트워크가 불안정해도 동작해야 한다 |
| **Augmentir** | 역할별 개인화 지원, **선제적 인사이트**(먼저 알려주기) | 같은 AI라도 **역할마다 다른 화면과 말투**가 필요하다 |
| **Cognite Atlas AI / InField** | 에이전트가 작업 공간을 옮겨 다녀도 **대화와 운영 맥락을 유지**. 현장 앱은 점검표 중심 | 대화는 **보고 있는 화면의 맥락을 이어받아야** 한다 |
| **Google Gemini Enterprise (2026.04)** | 에이전트들을 한곳에서 지켜보는 **통합 인박스** | 여러 AI 작업의 결과와 승인 요청을 **한 곳에 모으는 인박스**가 필요하다 |
| **Rockwell FactoryTalk** | 설계 도구용 생성형 AI 코파일럿은 출시. 운영자용 HMI AI 어시스턴트는 2026년 소개 단계 | 운영자 화면의 AI는 아직 업계 전체가 **초기 단계**다 |

**공정 제어 분야의 교훈 (ISA 표준)**

| 표준 | 핵심 원칙 | AI 공장장에 적용 |
|---|---|---|
| **ISA-101 고성능 HMI** | 회색 계열의 차분한 바탕, 색은 이상 상황에만. 화면 4단계 계층(전체 개요 → 공정 단위 → 설비 상세 → 진단). 숫자보다 한눈에 읽히는 막대 표시 | 정상은 조용하게, **이상만 색으로**. 요약 → 근거 → 원천 데이터로 **내려가는 계층** |
| **ISA-18.2 알람 관리** | 알람 철학 문서, 우선순위, 성능 감시. 운영자 1인당 약 10분에 1건 이내를 권장하는 지침이 흔히 인용됨 | **AI 알림 철학**을 정한다. 우선순위 3단계, 1인당 알림 예산, 묶어 보내기 |

**에이전트 UX 연구의 교훈**
- 위험 수준에 따라 확인 단계를 다르게 둔다. 사람은 **모든 단계가 아니라 위험한 순간**에 개입한다.
- AI가 지금 무엇을 하고 있는지 보여주고, 멈춤 버튼은 언제나 한 번의 클릭 거리에 둔다.
- 설명이 상황에 맞지 않으면 오히려 AI를 과신하게 만든다. 설명은 **결정에 필요한 만큼만**, 더 보고 싶으면 펼쳐 보게 한다.

---

## 3. AI 공장장이 제공하는 서비스

| 상호작용 | 서비스 | 주 사용자 | 자율성 |
|---|---|---|---|
| **① 알려주기** | 아침 브리핑, 교대 인수인계 보고, 이상·예외 알림, 주간 개선 리포트 | 공장장, 팀장, 반장 | L1 |
| **② 답하기** | 생산 데이터 질의("2라인 어제 왜 느렸어?"), 문서 질의(매뉴얼·작업표준서), 원인 분석("B-205는 왜 부족해?"), 요청형 화면("지난주 불량 추이 보여줘") | 전체 | L1~L2 |
| **③ 제안하고 승인으로 실행하기** | 재계획 시나리오, 발주 제안, 정비 일정 제안, 기준정보 갱신 제안 | 생산관리, 구매, 보전 | L2~L3 |
| **④ 입력 돕기** | 음성·사진으로 실적·비가동 입력, 납품 메일에서 납기 추출, 거래명세서 OCR 입고 | 작업자, 구매·자재 | L1~L2 |
| **⑤ 배우기** | 피드백(맞음·틀림), 해결 사례 축적, 판단 기록과 결과 조회 | 전체 | — |
| **⑥ 관리하기** | 권한·위임표, 알림 설정, 감사 로그, AI 성능 지표 | IT, 공장장 | — |

---

## 4. 사용자와 채널

| 사용자 | 주로 하는 일 | 주 채널 | 화면 원칙 |
|---|---|---|---|
| **공장장·경영진** | 브리핑 확인, 예외 판단, 승인 | 메신저, 웹 '오늘' 화면 | 결정 카드 중심, 3분 안에 파악 |
| **생산관리·계획** | 일정 조정, 시나리오 비교 | 웹 작업 화면 | 시나리오 나란히 비교, 근거 깊게 |
| **품질 엔지니어** | 원인 분석, 검증 | 웹 작업 화면 | 데이터 탐색, 가설 검증 |
| **보전 담당** | 알람 진단, 정비 | 모바일, 현장 태블릿 | 설비 중심, 사진·음성 |
| **반장·작업자** | 실적·비가동 입력, 작업 지침 확인 | 현장 태블릿, 키오스크, 음성 | 큰 버튼, 한 번 탭, 타이핑 없음, 오프라인 |
| **회의 참석자** | 아침 회의 | 회의실 대형 화면 | 읽기 전용, 큰 글씨 |
| **IT 관리자** | 운영, 감시, 개선 | 운영 콘솔 | 실행 기록, 검증 실패, 피드백 통계 |

---

## 5. 화면 구성 제안

### 5.1 웹 '오늘' 화면 (공장장·관리자의 첫 화면)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 미래정밀 1공장 · 10월 20일(화)   데이터 기준 06:55 ✓ 전일 실적 마감   [🔍 무엇이든 물어보세요] │
├────────┬─────────────────────────────────────────────────┬───────────────────┤
│ 오늘     │ ① 아침 브리핑 (AI 요약)                              │ 💬 대화           │
│ 승인함 2 │  "B-205 출하 200개 부족 예상 외 2건이 주의 필요합니다" │                   │
│ 알림 3   │  [생산 94.0%] [출하 충족 2/3] [불량률 1.2%] [가동 3/3]│ 선택: B-205 부족   │
│ 질문기록 │                                                   │ ──────────────── │
│ 리포트   │ ② 주의가 필요한 일 (우선순위순)                        │ 나: 왜 부족해?     │
│ 설정     │  🔴 B-205 출하 200개 부족                            │ AI: 원인 2가지…    │
│         │     근거: 재고 300 + 계획 3,000 − 출하 3,500 [MES]    │  · 전일 미달 100   │
│         │     권고: 조립2라인 오전 우선 투입                      │  · 출하 증가 500   │
│         │     [왜?] [승인 요청] [나중에]                        │  출처: MES ▸       │
│         │  🟠 자재 A 입고 지연 가능성 (납기 회신 없음)             │                   │
│         │  🟠 3호기 사출기 진동 상승 추세                         │ [추천 질문 칩]     │
│         │                                                   │ [🎤] [입력창…] [↵] │
│         │ ③ 라인 상태 (정상은 회색, 이상만 색)                    │                   │
│         │  사출1 ▬▬▬▬▬▬▬ 정상  사출2 ▬▬▬▬▬▬ 주의  조립2 ▬▬▬▬ 정상 │                   │
├────────┴─────────────────────────────────────────────────┴───────────────────┤
│ AI 상태: 07:00 실행 · 모델 qwen3.6 · 근거 검증 통과 · 규칙 모드 아님      [■ AI 작업 멈춤] │
└──────────────────────────────────────────────────────────────────────────────┘
```

| 영역 | 역할 | 설계 원칙 |
|---|---|---|
| 상단 바 | 데이터 기준 시각, 마감 상태, 전역 질문창 | 데이터가 미마감이면 **주황 경고**로 바꾼다 |
| ① 브리핑 | AI 요약 한 문장 + 핵심 숫자 4개 | 숫자 카드에는 **MES 배지**, 요약 문장에는 **AI 배지** |
| ② 주의가 필요한 일 | 결정 카드 목록 | 카드 하나 = 결정 하나. 근거, 권고, 행동 버튼이 한 카드 안에 |
| ③ 라인 상태 | 공장 전체 개요 | ISA-101처럼 정상은 회색, 이상만 색 |
| 💬 대화 패널 | 선택한 카드의 맥락으로 질문 | 답변은 글 + 카드(표, 차트) + 출처. 추천 질문 칩 |
| 하단 상태줄 | AI가 언제, 무엇으로, 어떻게 판단했는지 | **멈춤 버튼**은 항상 보이게 |

### 5.2 승인 카드 (제안 → 실행)

```
┌─ 승인 요청 · 위험 등급 중 ─────────────────────────────────────────────┐
│ 조립2라인 오전 우선 투입 (B-205 200개 추가 확보)                         │
│                                                                    │
│ 영향        납기 충족 3/3 (현재 2/3)   잔업 0h   다른 주문 지연 없음       │
│ 근거 ▸      재고·계획·출하 계산 [MES]  ·  조립2라인 오전 여유 확인 [MES]    │
│ 실행 내용 ▸  MES 작업지시 2건 순서 변경 (WO-1020-02 ↑, WO-1020-05 ↓)      │
│ 되돌리기    가능 (작업 시작 전까지)                                      │
│                                                                    │
│ [✓ 승인]  [✎ 수정 후 승인]  [✕ 거절 (이유 선택)]        요청: AI 공장장 07:02 │
└────────────────────────────────────────────────────────────────────┘
```
- **실행 내용 미리보기**: 승인하면 MES에 무엇이 바뀌는지 정확히 보여준다.
- **되돌리기 가능 여부**를 표시한다. 되돌릴 수 없는 일은 위험 등급을 올린다.
- **거절 이유**를 칩으로 받는다("이미 조치함", "라인 사정", "데이터 틀림"). 학습 데이터가 된다.

### 5.3 역할별 작업 화면 (예시)

- **계획 담당: 시나리오 비교.** 시나리오 A·B·C를 세로 3열로 나란히 놓는다. 각 열에 납기 준수, 잔업, 금형 교체, 계획 변경량을 막대로 표시하고 미니 일정표를 붙인다. 권고안을 강조하고 [이 안으로 승인 요청] 버튼을 둔다.
- **품질 엔지니어: 원인 분석 작업대.** 왼쪽에 불량률 추이, 가운데에 원인 후보 순위와 근거 차트(예: 금형 온도와 불량률), 오른쪽에 과거 유사 사례를 둔다. 후보마다 [맞음/아님] 검증 버튼을 달아 결과를 학습에 쓴다.

### 5.4 현장 모바일·태블릿 (반장·보전·작업자)

```
┌──────────────────────┐
│ 조립2라인 · 반장 김OO  │
│ ⚠ 오전 B-205 우선 투입 │  ← 승인된 지시가 현장에 도착
│   (생산관리자 승인)     │
├──────────────────────┤
│ [ 우리 라인 지금 상태 ] │  ← 한 번 탭 버튼 (큰 글씨)
│ [ 알람 원인 알려줘    ] │
│ [ 비가동 입력 🎤📷    ] │
│ [ 교대 인계 요약      ] │
├──────────────────────┤
│   🎤 길게 눌러 말하기   │
└──────────────────────┘
```
- 장갑, 소음, 밝은 조명을 전제로 한다. **큰 터치 영역, 음성, 고대비.**
- 네트워크가 끊겨도 지침과 최근 데이터는 볼 수 있게 한다(오프라인 캐시).

### 5.5 사내 메신저 (1단계 출발점)

```
[AI 공장장] 📋 10/20 아침 브리핑 · 주의 3건
 🔴 B-205 출하 200개 부족 예상 → 조립2라인 우선 투입 권고
 🟠 자재 A 입고 지연 가능성  🟠 3호기 진동 상승
 [브리핑 전체 보기]  [승인함 열기]
   └ 답장: "B-205 왜 부족해?" → 원인 2가지 + 출처 (같은 스레드)
```
- 새 앱 설치 없이 시작할 수 있다. 질문은 브리핑 메시지에 **답장**으로 한다.

---

## 6. 상호작용 설계 원칙 12가지

| # | 원칙 | 구체적 장치 |
|---|---|---|
| 1 | **사람이 일하는 흐름 안으로 들어간다** | 아침 회의, 교대, 메신저에 붙는다. 새 화면을 강요하지 않는다 |
| 2 | **카드 하나 = 결정 하나** | 무엇이 문제인가, 근거, 권고, 행동 버튼을 한 카드에 |
| 3 | **숫자와 AI 문장을 구분한다** | MES 숫자에는 출처 배지, AI 문장에는 AI 표시 |
| 4 | **근거는 한 번 클릭 거리** | 요약 → 근거 → 원천 데이터로 펼쳐 보기 (ISA-101의 계층) |
| 5 | **위험 수준별로 상호작용을 다르게** | 조회는 즉시, 추천은 확인, 실행은 승인과 미리보기, 되돌릴 수 없는 일은 상위 승인 |
| 6 | **알림 예산을 정한다** | 우선순위 3단계, 1인당 하루 알림 상한, 낮은 우선순위는 묶어 보내기. AI 알림 철학 문서를 둔다 |
| 7 | **정상은 조용하게, 이상만 색으로** | 회색 바탕, 빨강·주황은 이상에만 |
| 8 | **대화는 맥락을 이어받는다** | 선택한 카드와 보고 있는 화면이 질문의 맥락이 된다. "왜?"만 물어도 통한다 |
| 9 | **AI 상태를 투명하게** | 무엇을 조회·계산 중인지, 데이터 기준 시각, 규칙 모드 여부. 멈춤 버튼 상시 노출 |
| 10 | **피드백은 한 번 탭** | 👍/👎와 이유 칩. 거절 이유와 검증 결과가 학습으로 이어진다 |
| 11 | **현장과 사무실은 다른 화면** | 현장은 큰 버튼, 음성, 오프라인. 사무실은 비교와 탐색 |
| 12 | **AI는 검증된 카드 부품만 조합한다** | 수치 카드, 표, 차트, 시나리오 비교, 승인 카드 같은 부품 목록 안에서 화면을 구성 (통제된 생성형 UI) |

---

## 7. 핵심 상호작용 흐름

```
[알려주기]           [답하기]              [실행하기]            [배우기]
07:00 브리핑   →   "B-205 왜 부족해?"  →   승인 카드 검토     →   결과 추적
메신저·오늘 화면      대화 패널, 출처 표시      미리보기 → 승인        09:00 투입 확인
                     원인 2가지 + 계산        → MES 작업지시 변경     → 출하 충족 ✓
                                                                 → 판단 기록·사례 축적
```

**실패했을 때의 상호작용도 설계한다**
- 데이터 미마감 → 브리핑 상단에 주황 경고와 담당자 독촉 버튼
- LLM 응답 불가 → "규칙 기반 요약으로 대체됨" 표시 (데모의 백업 모드와 같은 원리)
- 근거 없는 수치 감지 → 해당 문장을 숨기고 "검증 실패로 생략" 표시
- 승인 요청에 응답 없음 → 기한이 지나면 상위자에게 넘김

---

## 8. 단계별 도입

| 단계 | 화면 | 상호작용 | 만들 것 |
|---|---|---|---|
| **1. 메신저 참모** | 사내 메신저 | 알려주기, 답하기 | 브리핑 봇, 답장 질문 (데모 `briefing.py` + `ask.py` 수준) |
| **2. 오늘 화면과 승인함** | 웹 '오늘' 화면 | + 승인으로 실행하기 | 결정 카드, 대화 패널, 승인 카드, MES 쓰기 API 연동 |
| **3. 역할별 작업 화면** | 계획 비교, 원인 분석 | + 깊은 분석 | 시나리오 비교 화면, 원인 분석 작업대 |
| **4. 현장 확장** | 태블릿, 모바일, 음성 | + 입력 돕기 | 한 번 탭 버튼, 음성·사진 입력, 오프라인 |
| 상시 | 운영 콘솔 | 배우기, 관리하기 | 실행 기록, 피드백 통계, 알림 설정, 위임표 |

---

## 9. 주의사항

- 사례 정보는 대부분 벤더 자료와 업계 기사다. Siemens의 이미지 입력, Rockwell의 운영자용 AI 어시스턴트, Tulip의 MCP 지원처럼 **발표·계획 단계인 기능**이 섞여 있다.
- ISA-18.2의 '10분에 1건' 지침은 교육 자료에서 인용한 것이다. 표준 원문으로 확인하지 못했다.
- 화면 시안의 회사명, 수치, 모델명은 강의용 가상 데이터다.

---

## 참고 자료

**제조 AI 어시스턴트 사례**
- [Siemens – Industrial Copilot](https://www.siemens.com/en-us/company/insights/digital-transformation-industrial-copilot)
- [ARC – Siemens Industrial Copilot Empowers Manufacturers](https://www.arcweb.com/blog/siemens-industrial-copilot-empowers-manufacturers)
- [IIoT World – Siemens Expands Industrial Copilot](https://iiot-world.com/?p=34033)
- [Microsoft Learn – Factory Operations Agent (preview)](https://learn.microsoft.com/pt-br/industry/manufacturing/manufacturing-data-solutions/overview-copilot-factory-operations)
- [Microsoft – Simplify tasks for plant employees](https://adoption.microsoft.com/en-us/scenario-library/manufacturing/simplify-tasks-for-plant-employees/)
- [Microsoft – Safer & Efficient Factories with agentic AI](https://videos.microsoft.com/industrial-ai-in-action/watch/9HR35fRz3eJAo4ib982dMm)
- [Tulip – AI Manufacturing Copilot](https://tulip.co/blog/ai-manufacturing-copilot/) · [Why a copilot is the future of frontline operations](https://tulip.co/blog/why-a-copilot-is-the-future-of-frontline-operations/) · [Applying AI on the shop floor](https://tulip.co/blog/applying-ai-on-the-shop-floor/)
- [ARC – Tulip Unveils Composable AI Agents](https://www.arcweb.com/blog/tulip-unveils-composable-ai-agents-operations-calling) · [Tulip Expands Frontline Operations Platform](https://www.arcweb.com/node/164298)
- [Workerbase – AI Shopfloor Copilot](https://www.workerbase.com/features/ai-shopfloor-copilot)
- [Augmentir – What is Frontline Copilot Technology?](https://www.augmentir.com/?p=13720)
- [SymphonyAI – Proceedix Connected Worker](https://www.symphonyai.com/resources/proceedix-connected-worker-frontline-industrial-ai)
- [Acuvate – Factory Co-Pilots for Shop Floor Workers](https://acuvate.com/blog/factory-copilots-for-shop-floor-workers/)
- [Cognite – September 2026 Release](https://www.cognite.com/en/resources/blog/cognite-september-2026-release) · [Extensible AI Agents](https://cognite.com/en/resources/blog/streamline-industrial-workflows-and-collaboration-with-extensible-ai-agents)
- [Rockwell – FactoryTalk Design Studio Copilot](https://www.healthcarepackaging.com/home/article/22927841/rockwell-automations-factorytalk-design-studio-adds-generative-ai-copilot) · [AI Assistants with FT Optix and FT View (webinar)](https://www.rockwellautomation.com/en-gb/events/webinars/visualization-deep-dive-series-hmi-hardware-and-software-with-modern-architectures-and-ai.html)

**HMI·알람 관리 표준**
- [Control Global – Best Practices in High-Performance HMI Design](https://www.controlglobal.com/visualize/hmi/article/11380465/human-machine-interface-best-practices-in-high-performance-hmi-design)
- [Hexagon – High Performance HMI Principles](https://aliresources.hexagon.com/operations-risk-management/understanding-high-performance-hmi-principles-and-best-practices)
- [Open Exam Prep – HMI & High-Performance Graphics (ISA-101)](https://open-exam-prep.com/study-guides/isa-cap/system-design-hmi-alarms-enterprise/hmi-design-isa101)
- [ISA – ISA-18 Series of Standards](https://isa.org/standards-and-publications/isa-standards/isa-18-series-of-standards)
- [exida – Alarm Management and ISA-18](https://www.exida.com/Resources/Whitepapers/alarm-management-and-isa-18-a-journey-not-a-destination)
- [Nasby – Intro to Alarm Management (slides)](https://www.grahamnasby.com/files_publications/NasbyG_2013_IntroToAlarmMgmt_YorkRegion_oct2013_slides.pdf)
- [SciTePress – Situation Awareness-Oriented Alarm Visualizations](https://www.scitepress.org/Papers/2013/42085)

**에이전트 UX·생성형 UI**
- [arXiv – Human-AI Agent Interaction in a Business Context](https://arxiv.org/pdf/2606.18716)
- [Agentic Wire – Agent UX Design Patterns: A 2026 Checklist](https://www.agenticwire.news/article/agent-ux-design-patterns)
- [Thesys – Designing Human-in-the-Loop AI Interfaces](https://www.thesys.dev/blogs/designing-human-in-the-loop-ai-interfaces-that-empower-users) · [Agent UIs and Generative UI](https://www.thesys.dev/blogs/how-agent-uis-and-generative-ui-are-reshaping-enterprise-productivity)
- [Towards AI – 8 UX Patterns That Build Trust](https://pub.towardsai.net/designing-for-ai-agents-8-ux-patterns-that-build-trust-in-2026-713a0c926933)
- [AI Accelerator Institute – Nobody wants another chatbot](https://www.aiacceleratorinstitute.com/nobody-wants-another-chatbot-7-interface-architectures-worth-building/)
- [The New Stack – Agents deliver answers, not just reports](https://thenewstack.io/goodbye-dashboards-agents-deliver-answers-not-just-reports/)
- [Gemini Enterprise 2026: Agent Designer, Inbox](https://pasqualepillitteri.it/en/news/1431/gemini-enterprise-2026-agent-designer-inbox-practical-examples)
