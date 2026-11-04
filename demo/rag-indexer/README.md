# 증분 인덱서 데모 (RAG 인덱싱 동적 관리)

[RAG 인덱싱 모범 사례 보고서](../../rag-indexing-best-practices.md)의 핵심을 작게 구현한 데모입니다.
사람이 md를 일일이 만들지 않아도, 원천 문서가 바뀌면 **바뀐 것만 다시 색인하고, 사라지거나 폐기된 문서는 검색에서 뺍니다.**

## 흐름

```
convert.py:  raw/ 원본 (DOCX·PPTX·TXT·PDF·DOC·PPT·HWP) ──▶ sources/converted/*.md (앞머리 메타데이터 + 품질 점검)
                                                                   │
indexer.py:                                                        ▼
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

## 원본 문서를 마크다운으로: `convert.py`

인덱싱 대상은 엄밀히는 **청크**이고, 마크다운은 원본과 청크 사이의 **중간 산출물**입니다. 사람이 md를 직접 쓰지 않고, `convert.py`가 `raw/`의 원본을 `sources/converted/`에 마크다운으로 만들어 두면 인덱서가 그대로 색인합니다.

| 원본 (`raw/`, 가상 데이터) | 변환 결과 |
|---|---|
| `standards/WI-INJ02-C310_Rev2.docx` + `.meta.json` | Word 제목 스타일 → `#`, `##`, 표 → 마크다운 표, 머리말("사내 한정")은 제외. 메타데이터는 옆 파일에서 |
| `training/보전교육_사출기_일상점검.pptx` | 슬라이드 1장 = `## 슬라이드 N: 제목`, 표, **발표자 노트** 포함. 그림만 있는 슬라이드는 검수 대상으로 표시 |
| `notices/품질공지_2026-10.txt` (cp949) | 인코딩 자동 판별, 페이지마다 반복되는 머리말과 페이지 번호 제거, `1.` → `##`, `가.` → 목록 |

**변환기 선택 (`--engine auto`):** Docling → MarkItDown → 내장 변환기 순으로 쓸 수 있는 것을 고르고, 실패하면 다음 변환기로 넘어갑니다. 내장 변환기는 표준 라이브러리만으로 DOCX·PPTX·TXT를 처리하므로 **아무것도 설치하지 않아도 동작**합니다. 구형 DOC·PPT는 LibreOffice(`soffice`)로 DOCX·PPTX로 바꾼 뒤 처리하고, HWP는 한컴오피스에서 DOCX·PDF로 일괄 변환하거나 `ureca_document_parser`를 설치하면 처리합니다.

**메타데이터 결정 순서:** ① 원본 옆 `파일명.확장자.meta.json` ② 파일명 규칙(`WI-INJ02-C310_Rev2` → doc_id, Rev.2) ③ 폴더 이름(`standards/` → 작업표준서) ④ 문서 속성·첫 제목(제목).

**증분 변환:** 원본 해시를 앞머리 `source_hash`에 기록해 두고 원본이 바뀐 파일만 다시 변환합니다. 원본이 사라지면 변환본도 지우므로, 다음 인덱싱에서 인덱스에서도 빠집니다.

**품질 점검:** 내용이 너무 짧음, 제목 구조 없음, 표 누락 의심, 그림 위주 슬라이드, 내장 추출 대비 내용 누락 의심. 걸린 문서는 앞머리에 `review: 필요 - 사유`를 남기고 검수 목록으로 출력합니다.

변환 결과 예시 (`sources/converted/standards/WI-INJ02-C310_Rev2.docx.md`):

```markdown
---
doc_id: WI-INJ02-C310
title: C-310 커버 사출 작업표준서
doc_type: 작업표준서
revision: Rev.2
status: 유효
equipment: 3호기
item: C-310
source: raw/standards/WI-INJ02-C310_Rev2.docx
source_hash: 1e7bcba9b6f45207
converter: builtin
---

# C-310 커버 사출 작업표준서
## 1. 사출 조건
| 항목 | 설정값 | 허용 범위 |
| --- | --- | --- |
| 금형 온도 | 60 ℃ | ± 3 ℃ |
...
```

> 변환된 md는 원본에서 다시 만들 수 있는 **파생물**입니다. 직접 고치면 원본이 바뀔 때 덮어써지므로, 고칠 내용은 원본 문서에 반영하거나 별도 수정본으로 관리합니다.

## 청크 보강: `enrich.py` — "다시 쓰지 말고, 덧붙인다"

Claude가 만든 md가 검색을 크게 좋게 만드는 이유는 지시어 풀기, 동의어, 맥락 같은 **지식 재구성**에 있습니다. `enrich.py`는 이 일을 로컬 Ollama 모델이 **청크 단위의 좁은 작업**으로 하게 합니다.

```
md ──▶ 인덱서와 같은 규칙으로 청킹 ──▶ 문서 요약 (1회) ──▶ 청크마다 Ollama 구조화 출력 ──▶ 숫자 검증 ──▶ 문서.md.enrich.json
                                                          (few-shot: examples/)       (원문에 없는 숫자 → 버림)        │
                                                          (+ glossary.json 동의어)                                     ▼
                                                                                              indexer.py가 임베딩 텍스트에 덧붙임
```

| 필드 | 내용 | 예 |
|---|---|---|
| `context` | 이 청크가 문서에서 어떤 내용인지 | "C-310 사출 조건 표 중 금형 온도 설정값이다." |
| `standalone` | 지시어를 실제 이름으로 푼 요약 | "3호기에서 C-310을 사출할 때 금형 온도는 60 ℃ ± 3 ℃로 설정한다." |
| `questions` | 현장 말투의 예상 질문 3~5개 | "C-310 형온 몇 도야?" |
| `keywords` | 키워드와 동의어 (+ 용어 사전) | 몰드 온도, 형온, 금형 온도 |

- **원문 md는 바꾸지 않습니다.** 답변은 원문으로 하고, 보강 필드는 검색에만 씁니다. 작은 모델이 틀려도 원문은 오염되지 않습니다.
- **구조화 출력:** Ollama `format`에 JSON 스키마를 지정해 형식을 강제합니다.
- **few-shot 견본:** `examples/enrich_examples.json`. **Claude로 만든 결과를 이 파일에 문서 유형별로 1~2개씩 넣으면** 로컬 모델이 그 수준을 따라 합니다.
- **용어 사전:** `glossary.json`의 동의어(버 = burr = 바리 등)는 모델이 빠뜨려도 규칙으로 붙입니다.
- **증분:** 같은 모델·프롬프트 버전으로 이미 만든 청크는 재사용합니다. 인덱싱은 배치 작업이므로 **큰 모델**(`--model`)을 권합니다.

## 인덱싱 방식별 비교: `evaluate.py`

같은 원본(`raw/` 3건)을 네 가지 방식으로 색인하고, 기존 문서 7건을 방해 문서로 함께 넣은 뒤 같은 질문(`eval/questions.json`, 현장 말투 12개)으로 검색 적중률을 잽니다.

| 변형 | 만드는 방법 |
|---|---|
| `plain` | 문자열만 뽑아 300자씩 자름 (구조·메타데이터 없음) |
| `converted` | `convert.py` 구조화 md |
| `enriched` | `converted` + `enrich.py` |
| `gold` | Claude가 만든 md (`gold/`, 비교 기준) |

```bash
python evaluate.py                     # Ollama 임베딩 + Ollama 보강 (실제 비교는 이것으로)
python evaluate.py --offline --detail  # Ollama 없이 동작 확인
```

> ⚠️ **`--offline` 결과로 품질을 판단하지 마세요.** 오프라인 해시 임베딩은 의미를 거의 모르고, 보강도 규칙 기반이라 LLM 보강의 효과가 나타나지 않습니다. 또 지표가 "정답 문자열이 들어 있는 청크"를 세므로 **청크가 큰 `plain`이 덩치 덕분에 유리**하게 나옵니다 (참고: 오프라인 실행에서 Hit@3는 plain 75%, converted 67%, enriched 83%, gold 83%). 실제 비교는 bge-m3 같은 임베딩 모델과 Ollama 보강으로 실행하고, 질문셋은 자사 문서와 실제 현장 질문으로 20~30개 만들어 쓰는 것을 권합니다.

## 실행

준비물: Python 3.10 이상. **필수 패키지는 없습니다**(표준 라이브러리만 사용). 변환 품질을 높이려면 `pip install docling` 또는 `pip install 'markitdown[all]'`을 선택 설치합니다. Ollama 모드를 쓰려면 Ollama를 설치하고 모델을 받아 둡니다.

```bash
cd demo/rag-indexer

# 0) 원본 문서 → 마크다운 (raw/ → sources/converted/), 바뀐 것만 변환
python convert.py
python convert.py --engine builtin         # 내장 변환기만 사용
python enrich.py --offline                 # 청크 보강 (Ollama: python enrich.py --model qwen3:14b)
python indexer.py --offline                # 변환된 md까지 함께 색인 (문서 10건)
python evaluate.py --offline --detail      # 인덱싱 방식별 검색 적중률 비교
python search.py "C-310 금형 온도 설정값"
python search.py "안전문 인터록 확인 방법" -k 1

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
