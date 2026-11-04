# MES 도구 서버 (MCP) 데모

[아침 브리핑 데모](../morning-briefing/)의 `mes_tools.py`(읽기 전용 조회)를 **MCP 서버**로 감싸고, **승인을 거쳐야만 실행되는 지시 도구**를 더한 데모입니다.
LangGraph 에이전트, Ollama 에이전트, Claude Desktop·Claude Code 같은 MCP 클라이언트가 **같은 도구를 그대로** 씁니다.

## 핵심: AI는 제안하고, 사람이 승인해야 MES가 바뀐다

```
[AI 에이전트]  Ollama 에이전트 · LangGraph · Claude 등 MCP 클라이언트
      │ MCP (stdio)
[MCP 서버]     mes_mcp_server.py
      ├ 🔍 조회·계산·지식 도구 ──────────▶ MES (읽기 전용) · 지식 색인
      └ ✋ propose_work_order_reorder ──▶ 승인 대기열 (approvals.db)      ← MES는 아직 그대로
                                              │
[사람]         approve.py (= 공장장실 승인함) ─┘ 승인
                                              ▼
[MES]          mes_api.reorder_work_order (쓰기 API) ─▶ 작업지시 순서 변경 + 변경 이력
```

| 도구 | 종류 | 하는 일 |
|---|---|---|
| `get_production_summary` | 조회 | 전일 생산·출하 계획 대비 실적 |
| `get_shipment_coverage` | 조회 + 계산 | 품목별 출하 충족 (재고 + 계획 − 출하 예정, **코드가 계산**) |
| `get_item_detail` | 조회 | 품목 하나의 전일·금일 숫자 (원인 분석용) |
| `get_work_order_sequence` | 조회 | 라인의 작업지시 순서와 상태 |
| `get_material_risks` | 조회 | 확정되지 않은 자재 입고 |
| `get_equipment_signals` | 조회 | 설비 이상 징후 |
| `search_knowledge` | 지식 | 작업표준·매뉴얼·사례 원문 검색 ([증분 인덱서](../rag-indexer/)의 색인 사용) |
| `propose_work_order_reorder` | **제안** | 순서 변경 미리보기를 만들어 **승인 대기열에 올림. 실행하지 않음** |
| `get_approval_status`, `list_pending_approvals` | 조회 | 제안의 처리 상태 |

**승인·실행 도구는 MCP로 노출하지 않습니다.** AI가 아무리 판단을 잘못해도 MES는 사람이 승인하기 전까지 바뀌지 않습니다.

## 설계 규칙 (코드 위치)

| 규칙 | 구현 |
|---|---|
| 업무 단위 도구, DB 직접 접근 없음 | 도구는 "출하 충족 조회"처럼 업무 의미 단위. 계산은 도구 안의 코드가 함 |
| 읽기 전용 | 조회는 `mes_tools`의 읽기 전용 연결(`mode=ro`). 도구에 `readOnlyHint` 표시 |
| 출처와 기준 시각 | 모든 조회 결과에 `source`, `as_of` |
| 쓰기는 두 단계 | `propose_*` → 승인 대기열 → 사람 승인(`approve.py`) → MES 쓰기 API |
| 변경 미리보기 | 제안에 변경 전·후 순서, 되돌리기 가능 여부, 위험 등급 |
| 동시성 보호 | 제안 시점의 순서를 스냅숏으로 저장. 승인 시점에 다르면 **실행하지 않음** |
| 멱등성 | 승인 ID를 MES API의 `request_id`로 사용. 같은 요청은 한 번만 반영 |
| 상태 확인 | 이미 시작·완료된 작업지시는 바꾸지 않음 (MES API에서 확인) |
| 감사 로그 | 제안·승인·거절·실패를 `audit_log`에, MES 변경은 `mes_change_log`에 기록 |

## 실행

준비물: Python 3.10 이상, `pip install -r requirements.txt` (MCP Python SDK 1.x, 2.x 모두 동작).

```bash
cd demo/mes-mcp
pip install -r requirements.txt
python setup_demo.py             # 데모용 MES DB(mes.db) 생성, 승인 대기열 초기화

# 1) LLM 없이 흐름 보기: 조회 → 제안 → (MES 그대로) → 사람 승인 → MES 반영 → 재승인 차단
python demo_client.py

# 2) Ollama가 도구를 골라 쓰는 에이전트
ollama pull qwen3:8b             # 도구 호출을 지원하는 모델
python agent_ollama.py "오늘 출하 부족한 품목 있어? 있으면 조치를 제안해 줘"
python approve.py list           # AI가 올린 제안 확인
python approve.py approve AP-1104-001 --by 이OO
python approve.py audit          # 감사 로그

# (선택) 지식 검색 도구를 쓰려면 증분 인덱서 색인을 먼저 만든다
cd ../rag-indexer && python indexer.py --offline && cd ../mes-mcp
```

Windows에서도 명령은 같습니다(`python` 대신 `py`).

`demo_client.py` 출력 (요약):

```
━━ 2. 조회·계산: 오늘 출하 충족
  B-205  재고   300 + 계획 3,000 - 출하 3,500 =   -200  부족
  조립2라인 순서: 1. WO-1020-04(B-207) → 2. WO-1020-02(B-205)
━━ 3. 제안: B-205 작업지시를 1순위로 (MES는 아직 그대로)
  AP-1104-001 · 대기 · 승인 대기열에 올렸습니다. 담당자가 승인해야 MES에 반영됩니다.
  현재 MES 순서: WO-1020-04 → WO-1020-02   ← 바뀌지 않음
━━ 4. 사람이 승인함에서 승인
  AP-1104-001 · 실행됨 · 결정 생산관리자 이OO
  현재 MES 순서: 1. WO-1020-02(B-205) → 2. WO-1020-04(B-207)   ← 반영됨
━━ 5. 같은 승인을 다시 누르면?
  이미 '실행됨' 처리된 요청입니다
```

## 다른 MCP 클라이언트에서 쓰기

같은 서버를 다른 AI 도구에 연결할 수 있습니다. 경로는 절대 경로로 바꿉니다.

```bash
# Claude Code
claude mcp add ai-plant-mes -- python /절대경로/demo/mes-mcp/mes_mcp_server.py
```

```json
// Claude Desktop (claude_desktop_config.json)
{ "mcpServers": { "ai-plant-mes": { "command": "python", "args": ["/절대경로/demo/mes-mcp/mes_mcp_server.py"] } } }
```

> 클라우드 LLM에 연결하면 도구 결과(MES 데이터)가 외부로 나갑니다. 이 연결은 **가상 데이터로 시험할 때만** 쓰고, 실제 공장 데이터는 사내 Ollama 같은 온프레미스 모델에 연결하세요.

LangGraph에서는 `langchain-mcp-adapters`로 이 서버의 도구를 그대로 불러올 수 있습니다.

## 실제 시스템으로 키울 때

| 데모 | 실제 시스템 |
|---|---|
| SQLite 가상 MES | MES 조회 API 또는 읽기 전용 DB 뷰, ERP 인터페이스 |
| `mes_api.reorder_work_order` | MES 벤더의 쓰기 API. **API가 없으면** 승인된 지시를 담당자 할 일로 보내 사람이 입력 |
| `approve.py` (CLI) | 공장장실 승인함 화면, 메신저 승인 버튼 |
| `MES_MCP_USER` 환경 변수 | 질문한 사용자의 계정과 역할. 조회·제안 모두 그 권한 안에서만 |
| stdio 연결 | 사내망 HTTP(streamable-http) + 인증 |
| 도구 10개 | 업무별로 추가: 발주 제안, 보전 작업 요청, LOT 추적, 이벤트 구독 등. 처음엔 10~15개로 |

> 모든 회사명, 품목, 수치는 강의용 가상 데이터입니다. 승인 ID의 날짜 부분(AP-MMDD-…)은 실행한 날짜로 바뀝니다.
