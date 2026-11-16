# 경영진 보고 덱 생성

`../ai-agent-platform-proposal.pptx`(24장, 발표자 노트 포함)를 만드는 스크립트입니다. 숫자와 출처는 근거 문서 `../ai-agent-platform-proposal.md`와 같아야 합니다.

```bash
npm install pptxgenjs
node build_deck.js                      # ../ai-agent-platform-proposal.pptx 생성
```

- 투자·효과 숫자(17번 장표)는 근거 문서 8장의 가정으로 계산했습니다. 회사 실제 숫자로 바꾸면 `build_deck.js`의 차트 값과 표도 함께 고칩니다.
- 테마 색상은 생성 후 테마 적용 도구로 입힙니다(`APPLY_THEME` 환경 변수). 그 도구가 없는 환경에서 다시 만들면 기본 Office 팔레트로 보이므로, 문구만 고칠 때는 PowerPoint에서 직접 수정하는 편이 간단합니다.
- 글꼴은 맑은 고딕(Malgun Gothic)입니다.

## v2 (`build_deck_v2.js` → `../ai-agent-platform-proposal-v2.pptx`, 26장)

v1은 그대로 두고 따로 만든 버전입니다.

- 표지 하단 부서를 회계·영업·생산·보전·품질·구매·개발·일상 업무 8개로 바꿨습니다.
- 2번 한 장 요약을 **현행(AS-IS) → 제안(TO-BE)** 형식으로 바꾸고, v1의 3번 당위성 장표를 여기에 합쳤습니다.
- 대표 시나리오 맨 앞에 품질·영업·회계 3가지 시나리오 요약표를 넣었습니다.
- 대표 시나리오 뒤에 **"직원 한 명, 에이전트 여러 개"**(내 에이전트)와 **에이전트 관리 절차**(직원·팀장·AI 추진 조직 × 6단계) 장표를 추가했습니다.

```bash
node build_deck_v2.js
```
