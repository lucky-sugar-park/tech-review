# 경영진 보고 덱 생성

`../ai-agent-platform-proposal.pptx`(22장, 발표자 노트 포함)를 만드는 스크립트입니다. 숫자와 출처는 근거 문서 `../ai-agent-platform-proposal.md`와 같아야 합니다.

```bash
npm install pptxgenjs
node build_deck.js                      # ../ai-agent-platform-proposal.pptx 생성
```

- 투자·효과 숫자(15번 장표)는 근거 문서 8장의 가정으로 계산했습니다. 회사 실제 숫자로 바꾸면 `build_deck.js`의 차트 값과 표도 함께 고칩니다.
- 테마 색상은 생성 후 테마 적용 도구로 입힙니다(`APPLY_THEME` 환경 변수). 그 도구가 없는 환경에서 다시 만들면 기본 Office 팔레트로 보이므로, 문구만 고칠 때는 PowerPoint에서 직접 수정하는 편이 간단합니다.
- 글꼴은 맑은 고딕(Malgun Gothic)입니다.
