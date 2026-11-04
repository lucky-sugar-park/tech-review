# 증분 인덱서 데모 (RAG 인덱싱 동적 관리)

[RAG 인덱싱 모범 사례 보고서](../../rag-indexing-best-practices.md)의 핵심을 작게 구현한 데모입니다.
사람이 md를 일일이 만들지 않아도, 원천 문서가 바뀌면 **바뀐 것만 다시 색인하고, 사라지거나 폐기된 문서는 검색에서 뺍니다.**

## 흐름

```
scan ──▶ plan ──▶ chunk ──▶ enrich ──▶ embed ──▶ store
원천 읽기  기록표와   유형별     맥락 보강    Ollama      청크 교체
(md·csv·  비교       청킹       (제목 경로·  (또는 오프   + 기록표
 pdf·docx) (해시)                메타·LLM)   라인 해시)   갱신
```

| 모범 사례 | 구현 위치 |
|---|---|
| 원본은 그대로, 인덱스는 파생물 | `sources/`가 원천. `index.db`는 언제든 지우고 다시 만들 수 있음 |
| 문서 기록표 + 해시 변경 감지 | `documents` 테이블: doc_id, 내용 해시, 개정판, 상태, 임베딩 모델, 청킹 버전 (`ragkit.py`) |
| 바뀐 문서의 청크만 교체 | `indexer.py`의 `plan()` → `store()` |
| 삭제·폐기 처리 | 원천에서 사라지면 삭제, 앞머리 `status: 폐기`면 청크를 지워 검색 제외 |
| 문서 유형별 청킹 | md는 제목(#) 단위 + 제목 경로, 표는 행마다 헤더를 붙여 청크, DB 행은 1건 = 청크 1개 |
| 청크에 맥락 붙이기 | 제목 경로 + 설비·공정·품목 + (선택) Ollama LLM 맥락 문장 (`--contextualize`) |
| 단계별 캐시 | (모델, 텍스트 해시) 단위로 임베딩·맥락 문장을 `cache` 테이블에 저장. 같은 입력은 다시 계산하지 않음 |
| 설정 버전 관리 | 임베딩 모델이나 `CHUNKER_VERSION`이 바뀌면 해당 문서를 다시 색인 |
| 하이브리드 검색 + 출처 | `search.py`: 벡터 + BM25를 RRF로 합치고 문서·개정판·제목 경로·파일을 표시 |
| 실행 이력 | `runs` 테이블에 실행마다 추가·갱신·유지·폐기·삭제 건수 |

## 원천 문서 (`sources/`, 가상 데이터)

| 파일 | 문서 | 형식 |
|---|---|---|
| `manuals/mes-user-manual.md` | MES 사용 매뉴얼 | md + 앞머리 메타데이터 |
| `standards/wi-assy2-b205.md` | B-205 조립 작업표준서 (Rev.3) | md, 표 포함 |
| `equipment/injection-03-manual.md` | 3호기 사출기 매뉴얼 (알람 코드표, 히터 교체) | md, 표 포함 |
| `quality/inspection-c310.md` | C-310 외관 검사 기준서 | md, 표 포함 |
| `db/defect_cases.csv` | 불량 사례 (DB에서 내보낸 형태) | csv, 행 1건 = 문서 1건 |

md 앞머리 예시:

```yaml
---
doc_id: WI-ASSY2-B205      # 파일 경로가 아니라 문서 번호 (파일을 옮겨도 같은 문서)
title: 작업표준서 - B-205 브래킷 조립 (조립2라인)
doc_type: 작업표준서
revision: Rev.3
status: 유효               # 폐기로 바꾸면 검색에서 빠짐
equipment: 조립2라인
item: B-205
acl: 생산
---
```

PDF·DOCX는 [Docling](https://github.com/docling-project/docling)이 설치되어 있으면 md로 변환해 `converted/`에 저장한 뒤 색인합니다(사람이 검수할 수 있는 중간 산출물). 메타데이터는 `파일명.pdf.meta.json` 옆 파일에 둡니다.

## 실행

준비물: Python 3.10 이상. **필수 패키지는 없습니다**(표준 라이브러리만 사용). Ollama 모드를 쓰려면 Ollama를 설치하고 모델을 받아 둡니다.

```bash
cd demo/rag-indexer

# 1) 시나리오 데모: 개정, 사례 추가, 폐기, 삭제를 순서대로 보여줌
python demo_scenario.py --offline          # Ollama 없이 (강의장 백업)
python demo_scenario.py --offline --pause  # 단계마다 Enter

# 2) 직접 실행
python indexer.py --offline                # 색인 (다시 실행하면 바뀐 것만 처리)
python indexer.py --offline --dry-run      # 무엇이 바뀔지 계획만
python search.py "3호기 E-217 알람이 뭐야?"
python search.py "작업지시 순서는 어디서 바꿔?" -k 1
python search.py "히터 교체 절차" --equipment 3호기 -k 2
python search.py "B-205 체결 토크" --doc-type 작업표준서

# 3) Ollama 사용
ollama pull bge-m3                         # 임베딩 모델 (다국어)
ollama pull qwen3:8b                       # 맥락 문장·답변 생성용
python indexer.py                          # Ollama 임베딩
python indexer.py --contextualize          # + 청크마다 맥락 문장 (Contextual Retrieval)
python search.py "C-310 버 불량 해결 사례" --answer   # 출처 번호를 단 답변
python indexer.py --watch 10               # 10초마다 원천 확인 (파일을 고쳐 보세요)
```

Windows(PowerShell, cmd)에서도 명령은 같습니다. `python`이 안 되면 `py`를 씁니다. 환경 변수 설정 문법은 [아침 브리핑 데모 README](../morning-briefing/README.md#환경-변수)를 참고하세요.

| 환경 변수 | 의미 | 기본값 |
|---|---|---|
| `EMBED_MODEL` | Ollama 임베딩 모델 | `bge-m3` |
| `OLLAMA_MODEL` | 맥락 문장·답변 생성 모델 | `qwen3:8b` |
| `OLLAMA_HOST` | Ollama 서버 주소 | `http://localhost:11434` |
| `RAG_DB` | 인덱스 파일 | `index.db` |

## 시나리오 데모 출력 (`--offline`, 요약)

```
━━ 1. 처음 색인: 모든 문서를 변환·청킹·임베딩
  ── 문서 7건: 추가 7 · 갱신 0 · 유지 0 · 폐기 0 · 삭제 0  |  검색 가능한 청크 23개
━━ 2. 다시 실행: 바뀐 것이 없으면 아무것도 하지 않는다
  ── 문서 7건: 추가 0 · 갱신 0 · 유지 7 · 폐기 0 · 삭제 0
━━ 3. 작업표준서 개정 (Rev.3 → Rev.4, 체결 토크 9.0 → 9.5 N·m)
  ♻️  갱신  WI-ASSY2-B205    내용 변경 (Rev.3 → Rev.4)
  🔎 "B-205 볼트 체결 토크" → 작업표준서 · Rev.4 · … 체결 토크는 9.5 N·m이다
━━ 4. DB에 불량 사례 1건 추가 (행 1건 = 문서 1건)
  ➕ 추가  DC-1028          새 문서
━━ 5. 검사 기준서 폐기: 원본은 남지만 검색에서는 빠진다
  🚫 폐기  QS-C310-VIS      Rev.5 폐기 → 검색에서 제외
━━ 6. MES 매뉴얼 파일 삭제: 원천에서 사라진 문서는 인덱스에서도 삭제
  🗑  삭제  MES-UM-01        원천에서 사라짐 (manuals/mes-user-manual.md)
━━ 7. 청킹 규칙을 바꾸면? (dry-run: 계획만)
  ♻️  갱신  … 청킹 규칙 변경 (md-heading-v1 → md-heading-v2)   ← 모든 문서
```

## 강의·설명 포인트

1. **2단계가 핵심이다.** 다시 실행해도 아무 일도 일어나지 않는다. 해시 기록표 덕분에 문서 1만 건 중 3건이 바뀌면 3건만 처리한다.
2. **3단계: 개정판이 바뀌면 옛 청크가 통째로 교체된다.** 검색 결과에 `Rev.4`와 새 값이 나온다. 옛 기준으로 답하는 사고를 막는다.
3. **5단계: 폐기는 삭제와 다르다.** 원본은 감사용으로 남기고 검색에서만 뺀다.
4. **7단계: 설정이 바뀌면 전부 다시 색인해야 한다.** 운영에서는 기존 인덱스를 덮어쓰지 않고 새 인덱스를 옆에 만든 뒤 전환한다(blue-green).
   ```bash
   RAG_DB=index_v2.db python indexer.py --embed-model qwen3-embedding   # 새 인덱스를 옆에 생성
   # 골든 질문셋으로 비교 → 좋으면 애플리케이션의 RAG_DB를 index_v2.db로 전환, 옛 파일은 롤백용으로 보관
   ```
5. **수치는 색인하지 않는다.** 불량 사례는 "어떻게 해결했나"를 위해 색인하고, 지금의 재고·실적은 MES 조회 도구에서 가져온다.

## 오프라인 모드에 대해

`--offline`은 단어 해시로 만든 간이 벡터를 씁니다. **의미 검색 품질은 실제 임베딩 모델보다 낮고**, 증분 인덱싱의 동작(추가·갱신·폐기·삭제)을 보여주기 위한 백업 모드입니다. 오프라인 인덱스와 Ollama 인덱스는 벡터 공간이 다르므로 섞을 수 없습니다. 모델을 바꾸면 인덱서가 자동으로 해당 문서를 다시 색인합니다.

## 실제 시스템으로 키울 때

| 데모 | 실제 시스템 |
|---|---|
| SQLite에 벡터를 JSON으로 저장, 전체 비교 | pgvector 또는 Qdrant (+ 별칭으로 인덱스 전환) |
| 단어 해시 BM25 | PostgreSQL 전문 검색, OpenSearch, Tantivy 등 |
| 폴더 스캔 + `--watch` 폴링 | 문서 관리 시스템의 승인·개정 이벤트 + 야간 전체 대조 |
| `acl` 메타데이터 저장만 | 검색 시 사용자 권한으로 필터 |
| 앞머리 메타데이터를 사람이 작성 | 문서 관리 시스템 속성에서 자동으로 가져오기, 부족하면 LLM으로 추출 후 검수 |
| 직접 구현 | LlamaIndex IngestionPipeline, LangChain Indexing API, CocoIndex 등 (보고서 §3) |

> 모든 문서, 회사, 수치는 데모용 가상 데이터입니다.
