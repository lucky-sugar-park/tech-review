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

준비물: Python 3.10 이상. Ollama 모드를 쓰려면 [Ollama](https://ollama.com/download)를 설치해 둡니다. Windows는 설치하면 백그라운드에서 서버가 자동으로 실행됩니다.

### macOS / Linux (bash, zsh)

```bash
cd demo/morning-briefing
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python seed_mes.py                          # 가상 MES DB(mes.db) 생성

# 1) LLM 없이 (백업 모드, 오프라인)
python briefing.py --no-llm

# 2) Ollama 사용
ollama pull qwen3:8b                        # 기본 모델
python briefing.py

# 다른 모델로 실행
OLLAMA_MODEL=qwen3.6:35b-a3b python briefing.py
```

### Windows (PowerShell)

```powershell
cd demo\morning-briefing
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

python seed_mes.py                          # 가상 MES DB(mes.db) 생성

# 1) LLM 없이 (백업 모드, 오프라인)
python briefing.py --no-llm

# 2) Ollama 사용
ollama pull qwen3:8b                        # 기본 모델
python briefing.py

# 다른 모델로 실행 (현재 PowerShell 창에서만 유효)
$env:OLLAMA_MODEL = "qwen3.6:35b-a3b"
python briefing.py
```

> `Activate.ps1`이 "스크립트를 실행할 수 없습니다" 오류로 막히면, 현재 창에서만 실행 정책을 풀고 다시 활성화합니다.
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
> .\.venv\Scripts\Activate.ps1
> ```

### Windows (명령 프롬프트, cmd)

```bat
cd demo\morning-briefing
py -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt

python seed_mes.py

python briefing.py --no-llm

ollama pull qwen3:8b
python briefing.py

rem 다른 모델로 실행 (현재 cmd 창에서만 유효, = 앞뒤에 공백 없이)
set OLLAMA_MODEL=qwen3.6:35b-a3b
python briefing.py
```

### Windows에서 `source`가 인식되지 않을 때

`source`는 bash·zsh 명령이라 PowerShell과 cmd에는 없습니다. 또 Windows 가상환경은 실행 파일이 `bin`이 아니라 `Scripts` 폴더에 있습니다.

| 터미널 | 가상환경 활성화 |
|---|---|
| PowerShell | `.\.venv\Scripts\Activate.ps1` |
| cmd | `.venv\Scripts\activate.bat` |
| Git Bash | `source .venv/Scripts/activate` (`source`는 되지만 경로가 `Scripts`) |

활성화가 계속 막히면 **활성화 없이** 가상환경의 파이썬을 직접 지정해서 실행해도 됩니다.

```powershell
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python seed_mes.py
.venv\Scripts\python briefing.py --no-llm
```

### 환경 변수

| 변수 | 의미 | 기본값 |
|---|---|---|
| `OLLAMA_MODEL` | 사용할 Ollama 모델 | `qwen3:8b` |
| `BRIEFING_DATE` | 브리핑 기준일 | `2026-10-20` (샘플 데이터 날짜) |
| `OLLAMA_HOST` | Ollama 서버 주소 (다른 PC의 Ollama를 쓸 때) | `http://localhost:11434` |

환경 변수 설정 문법은 셸마다 다릅니다.

| 셸 | 설정 | 해제 |
|---|---|---|
| bash / zsh | `export OLLAMA_MODEL=qwen3.6:35b-a3b` | `unset OLLAMA_MODEL` |
| PowerShell | `$env:OLLAMA_MODEL = "qwen3.6:35b-a3b"` | `Remove-Item Env:OLLAMA_MODEL` |
| cmd | `set OLLAMA_MODEL=qwen3.6:35b-a3b` | `set OLLAMA_MODEL=` |

### Windows에서 자주 겪는 문제

| 증상 | 원인과 해결 |
|---|---|
| `python`을 찾을 수 없음, 또는 Microsoft Store가 열림 | Python 설치 시 "Add python.exe to PATH"를 체크하지 않은 경우. `py` 런처를 쓰거나(`py seed_mes.py`), Python을 다시 설치하며 PATH 옵션을 켭니다 |
| 이모지(📋 ✅ ⚠️)가 네모로 보임 | 구형 콘솔의 글꼴 문제. **Windows Terminal**에서 실행하면 정상 표시됩니다 |
| 표의 열이 조금 어긋남 | 한글이 영문보다 폭이 넓어서 생기는 현상. 내용에는 문제가 없습니다 |
| 출력을 파일로 저장할 때 인코딩 오류 | 스크립트가 출력을 UTF-8로 고정하므로 `python briefing.py --no-llm > briefing.txt`로 저장하면 됩니다. 파일은 UTF-8로 열어 주세요 |
| `주의 사항 작성: rules (LLM 호출 실패: ConnectError)` | Ollama 서버가 실행 중이 아님. 시작 메뉴에서 Ollama를 실행하거나 `ollama serve`를 실행합니다 |

## 물어보기: `ask.py`

브리핑을 받은 뒤 "왜?"라고 묻는 장면을 보여주는 데모입니다. 흐름은 브리핑과 같습니다.

```
identify ─▶ investigate ─▶ analyze ─▶ explain ─▶ verify ─▶ render
품목 파악     MES 조회       원인 계산    원인 설명    LLM 문장의    답변
(코드 대조)   (읽기 전용)    (코드)      (LLM/규칙)  숫자 검증     출력
```

```bash
python ask.py "B-205는 왜 부족해?"              # Ollama 사용
python ask.py "B-205는 왜 부족해?" --no-llm     # 백업 모드
python ask.py "A-101 괜찮아?" --no-llm          # 부족하지 않은 품목
python ask.py "오늘 부족한 품목 있어?"            # 품목을 말하지 않으면 부족 품목 전체를 설명
```

Windows에서도 같은 명령을 그대로 씁니다(PowerShell, cmd 모두 질문을 큰따옴표로 감쌉니다).

출력 예시 (`--no-llm`):

```
❓ B-205는 왜 부족해?

   B-205 출하 부족 200개의 원인은 다음과 같습니다.
   전일 생산 미달: 계획 3,000개 중 2,900개만 생산해 100개 미달했고, 그 결과 오늘 아침 재고가 300개입니다.
   오늘 출하량 증가: 나래모빌리티 출하 예정이 3,500개로 전일 출하(3,000개)보다 500개 많습니다.
   권고: 오전 중 조립2라인 우선 투입으로 200개 추가 확보 검토 (생산관리자 확인 필요)

   계산 (B-205): 재고 300 + 금일 생산 계획 3,000 - 출하 예정 3,500 = -200개

* 수치 출처: MES (작업지시, 작업실적, 출하계획, 출하실적, 완제품 재고)
* 설명 작성: rules
```

- 원인 수치(전일 생산 미달 100개, 출하 증가 500개)는 `analyze` 단계에서 **코드가 계산**합니다. LLM은 이 수치를 사람이 읽기 좋게 설명만 합니다.
- LLM이 데이터에 없는 숫자(예: "350개 부족")를 쓰면 `verify`가 그 답을 버리고 규칙 기반 설명으로 바꿉니다.
- 실제 시스템에서는 이 기능을 브리핑 메시지에 답장하는 대화 창구로 붙입니다.

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
