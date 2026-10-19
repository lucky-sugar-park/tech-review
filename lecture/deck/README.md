# 강의 슬라이드 덱 생성

`../mes-ai-plant-manager.pptx`(22장, 발표자 노트 포함)를 만드는 스크립트입니다.

```bash
npm install pptxgenjs
node build_deck.js                      # ../mes-ai-plant-manager.pptx 생성
```

- 그림은 `../images/architecture.png`, `../images/briefing-sequence.png`를 사용합니다.
- 테마 색상(슬레이트·앰버)은 생성 후 테마 적용 도구로 입힙니다. 그 도구가 없는 환경에서 다시 만들면 색이 기본 Office 팔레트로 보이므로, 문구만 고칠 때는 PowerPoint에서 직접 수정하는 편이 간단합니다.
- 글꼴은 맑은 고딕(Malgun Gothic)입니다.
