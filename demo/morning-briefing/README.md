# AI 공장장 아침 브리핑 데모

[강의안](../../lecture/mes-ai-plant-manager-lecture.md)의 장표 G에 나오는 **아침 브리핑**을 실제로 생성하는 짧은 데모입니다.
가상 중소기업의 MES 데이터(SQLite)를 조회해서 다음을 보여줍니다.
- 전일 생산·출하 실적
- 당일 생산 계획 수량과 출하 예정 수량 집계
- 출하 충족 여부
- 주의 사항

## 흐름

```
collect ─▶ analyze ─▶ advise ─▶ verify ─▶ render
MES 조회    출하 충족    주의 사항    LLM 문장의    브리핑
(읽기 전용)  계산(코드)   (LLM/규칙)  숫자 검증     출력
```

| 원칙 | 구현 위치 |
|---|---|
| 숫자는 MES에서 | `mes_tools.py`: SQL 집계, DB를 **읽기 전용**(`mode=ro`)으로 연결 |
| 계산은 코드가 | `analyze`: 출하 충족 = 완제품 재고 + 금일 생산 계획 − 출하 예정 |
| LLM은 해석과 권고만 | `advise`: Ollama가 주의 사항 문장만 작성 |
| 근거 없는 수치 차단 | `verify`: LLM 문장에 MES에 없는 숫자가 있으면 버리고 규칙 기반 문장으로 대체 |
| 강의장 백업 | Ollama가 꺼져 있거나 `--no-llm`이면 규칙 기반으로 자동 전환 |

## 실행

```bash
cd demo/morning-briefing
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python seed_mes.py              # 가상 MES DB(mes.db) 생성

# 1) LLM 없이 (백업 모드, 오프라인)
python briefing.py --no-llm

# 2) Ollama 사용
ollama pull qwen3:8b            # 사용할 모델 (다른 모델이면 OLLAMA_MODEL로 지정)
python briefing.py
OLLAMA_MODEL=qwen3.6:35b-a3b python briefing.py
```

환경 변수:
- `OLLAMA_MODEL`: 사용할 Ollama 모델 (기본값 `qwen3:8b`)
- `BRIEFING_DATE`: 브리핑 기준일 (기본값 `2026-10-20`, 샘플 데이터 날짜)
- Ollama 서버 주소를 바꾸려면 `OLLAMA_HOST`를 설정합니다.

## 출력 예시 (`--no-llm`)

```
📋 10월 20일(화) 아침 브리핑 — AI 공장장, 07:00 기준

1. 전일 실적 (10/19)
   구분            계획        실적       달성률
   생산        12,000    11,280     94.0%
   출하         9,500     9,500    100.0%

2. 금일 계획 (10/20)
   품목                 생산계획     출하예정    완제품재고   출하 충족
   A-101 (사출)        5,000    4,800    1,200   ✅ 여유 1,400
   B-205 (조립)        3,000    3,500      300   ⚠️ 부족 200
   C-310 (사출)        4,000    2,000    2,500   ✅ 여유 4,500
   합계               12,000   10,300

3. 주의 사항
   ⚠️ B-205 출하 200개 부족 예상 → 오전 중 조립2라인 우선 투입 권고
   ⚠️ 자재 A (PP 수지) 입고 지연 가능성 (다온케미칼, 납기 회신 미수신) → 구매팀 확인 필요
   ⚠️ 3호기 사출기 진동 최근 3일 상승 추세 → 점심시간 점검 권고

* 수치 출처: MES (작업지시, 작업실적, 출하계획, 출하실적, 완제품 재고 2026-10-20 07:00 기준)
* 주의 사항 작성: rules
```

## 강의에서 보여줄 포인트

1. **`mes_tools.py`를 먼저 보여준다.** "숫자는 전부 여기서 SQL로 나옵니다. LLM은 계산하지 않습니다."
2. **`--no-llm`과 LLM 모드를 나란히 실행한다.** 표의 숫자는 같고, 주의 사항 문장만 LLM이 다듬는다는 점을 보여준다.
3. **`verify` 노드를 보여준다.** "LLM이 근거 없는 숫자를 쓰면 자동으로 버립니다." AI-ready 설계의 예시다.
4. **실제 MES에 붙이려면** `mes_tools.py`의 SQL을 MES 조회 API나 MCP 서버 호출로 바꾸면 된다.

> 모든 회사명, 품목, 수치는 강의용 가상 데이터입니다.
