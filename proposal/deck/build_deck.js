// 경영진 보고 덱: 사내 AI 에이전트 플랫폼 도입 제안
// 사용법: node build_deck.js [출력 파일]   (pptxgenjs 필요, 테마 적용 도구 경로는 APPLY_THEME 환경 변수)
// 근거 문서: ../ai-agent-platform-proposal.md (숫자와 출처는 이 문서와 같아야 한다)
const path = require("path");
const pptxgen = require("pptxgenjs");

const OUT = process.argv[2] || path.join(__dirname, "..", "ai-agent-platform-proposal.pptx");

const THEME = {
  name: "AI Agent Platform Proposal",
  headFontFace: "Malgun Gothic",
  bodyFontFace: "Malgun Gothic",
  colors: {
    dk1: "1E293B", lt1: "FFFFFF", dk2: "0F1B33", lt2: "F1F5F9",
    accent1: "F59E0B", // 앰버: 강조
    accent2: "0F766E", // 청록: 플랫폼·제안
    accent3: "64748B", // 슬레이트: 보조 텍스트
    accent4: "DC2626", // 빨강: 위험
    accent5: "16A34A", // 초록: 효과
    accent6: "4F46E5", // 남색: 기술
    hlink: "0F766E", folHlink: "4F46E5",
  },
};
const HEX = THEME.colors;
const BORDER = "CBD5E1";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.title = "사내 AI 에이전트 플랫폼 도입 제안";
pres.author = "tech-review";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ── 레이아웃 ─────────────────────────────────────────────────────────────
pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", align: "left", x: 0.8, y: 1.7, w: 11.7, h: 1.7, fontSize: 40, bold: true, color: C.background1, valign: "bottom", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.6, w: 11.7, h: 0.9, fontSize: 20, color: C.accent1, valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", align: "left", x: 0.6, y: 0.35, w: 12.1, h: 0.8, fontSize: 30, bold: true, color: C.text1, valign: "middle", margin: 0 }, text: "" } },
    { text: { text: "사내 AI 에이전트 플랫폼 도입 제안", options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: C.accent3, margin: 0 } } },
  ],
  slideNumber: { x: 12.3, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.accent3 },
});

// ── 도우미 ───────────────────────────────────────────────────────────────
let objN = 0;
const nm = (p) => `${p}-${++objN}`;
function txt(slide, text, o) {
  slide.addText(text, { isTextBox: true, margin: 0, color: C.text1, fontSize: 14, valign: "top", objectName: nm("text"), ...o });
}
function card(slide, x, y, w, h, fill = C.background2, line) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill },
    line: line ? { color: line, width: 1.25 } : { type: "none" }, objectName: nm("card") });
}
function badge(slide, x, y, label, fill = C.accent1, color = C.text2, d = 0.46) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { type: "none" }, objectName: nm("badge") });
  txt(slide, label, { x, y, w: d, h: d, fontSize: 15, bold: true, color, align: "center", valign: "middle" });
}
function arrowR(slide, x, y, w, color = C.accent3) {
  slide.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color, width: 2, endArrowType: "triangle" }, objectName: nm("arrow") });
}
function arrowD(slide, x, y, h, color = C.accent3) {
  slide.addShape(pres.shapes.LINE, { x, y, w: 0, h, line: { color, width: 2, endArrowType: "triangle" }, objectName: nm("arrow") });
}
function content(title, section) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  return s;
}
function source(slide, text) {
  txt(slide, text, { x: 0.6, y: 6.62, w: 12.1, h: 0.3, fontSize: 10, color: C.accent3 });
}
const hdr = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text1 }, valign: "middle" } });

// ═════════════════════════════════════════════════════════════════════════
// 1. 표지 · 요약
// ═════════════════════════════════════════════════════════════════════════
const S1 = "요약";
pres.addSection({ title: S1 });
{
  const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: S1 });
  s.addText("모든 직원이 자신의 AI 동료를 만든다", { placeholder: "title" });
  s.addText("사내 AI 에이전트 플랫폼(가칭 에이전트 스튜디오) 도입 제안 · 경영진 보고", { placeholder: "body" });
  const tags = ["회계", "제조", "품질", "개발", "일상 업무"];
  tags.forEach((t, i) => {
    const x = 0.8 + i * 2.38;
    card(s, x, 5.2, 2.18, 0.62, C.text1);
    txt(s, t, { x, y: 5.2, w: 2.18, h: 0.62, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
  });
  s.addNotes(
    "오늘 드릴 말씀은 하나입니다. 직원들은 이미 AI를 쓰고 있습니다. 문제는 쓰느냐가 아니라, 회사가 통제하고 쌓아 가는 방식으로 쓰느냐입니다.\n" +
    "그래서 직원 누구나 화면에서 자기 업무용 AI 에이전트를 만들고 실행하고 공유하는 사내 플랫폼을 제안합니다. 회계, 제조, 품질, 개발, 일상 업무까지 하나의 기반 위에서 씁니다.\n" +
    "결론부터 말씀드리면, 오늘 요청드리는 것은 전체 투자가 아니라 6개월 약 3.4억 원 규모의 1단계 파일럿 승인입니다."
  );
}
{
  const s = content("한 장 요약: 6개월 파일럿으로 시작해 성과로 확대를 결정한다", S1);
  const boxes = [
    ["문제", "직원 45~49%가 승인되지 않은 AI를 이미 사용\n회사 데이터 유출 위험, 노하우는 개인에 머묾\nERP·MES와 단절돼 반쪽짜리 활용", C.accent4],
    ["제안", "직원이 화면에서 AI 에이전트를 만들고·실행하고·공유\n사내 시스템은 표준 도구(MCP)로 연결\n대외비는 사내 모델, 시스템 변경은 사람 승인", C.accent2],
    ["효과", "활성 사용자 주 2~4시간 절감 보고 (외부 조사)\n기준 시나리오: 3년차 누적 손익분기, 이후 연 5억 원+\n섀도 AI를 통제된 공식 경로로 흡수", C.accent5],
    ["요청", "1단계 파일럿 승인: 6개월, 약 3.4억 원\n제조·품질·회계 3개 부서 + 전사 규정 Q&A\n6개월 뒤 정해 둔 지표로 확대 여부 결정", C.accent1],
  ];
  boxes.forEach(([t, d, col], i) => {
    const x = 0.6 + (i % 2) * 6.15, y = 1.35 + Math.floor(i / 2) * 2.65;
    card(s, x, y, 5.95, 2.45, C.background2);
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.3, w: 0.22, h: 0.22, fill: { color: col }, line: { type: "none" }, objectName: nm("dot") });
    txt(s, t, { x: x + 0.65, y: y + 0.18, w: 5.0, h: 0.45, fontSize: 20, bold: true, valign: "middle" });
    txt(s, d, { x: x + 0.65, y: y + 0.75, w: 5.1, h: 1.55, fontSize: 15, color: C.text1, paraSpaceAfter: 4 });
  });
  s.addNotes(
    "한 장으로 요약하면 이렇습니다.\n" +
    "문제: 직원 절반 가까이가 승인되지 않은 AI를 이미 쓰고 있고, 회사 데이터가 그쪽으로 흘러갑니다. 잘 쓰는 사람의 노하우는 개인에게 머물고, ERP나 MES와 연결되지 않아 효과도 반쪽입니다.\n" +
    "제안: 직원이 직접 에이전트를 만드는 사내 플랫폼. 사내 시스템은 표준으로 연결하고, 대외비는 사내 모델에서만 처리하고, 시스템을 바꾸는 일은 사람이 승인합니다.\n" +
    "효과: 외부 조사 기준 주 2~4시간 절감. 보수적으로 계산해도 기준 시나리오에서 3년차에 누적 손익분기입니다.\n" +
    "요청: 6개월 파일럿만 먼저 승인해 주십시오. 지표로 확대를 결정하겠습니다."
  );
}

// ═════════════════════════════════════════════════════════════════════════
// 2. 문제
// ═════════════════════════════════════════════════════════════════════════
const S2 = "문제";
pres.addSection({ title: S2 });
{
  const s = content("직원들은 이미 AI를 쓰고 있다. 다만 회사 밖에서", S2);
  const stats = [
    ["45%", "업무 기기에서 AI를\n정기적으로 쓰는 직원\n(전년 15%의 3배)", "Verizon DBIR 2026", C.accent2],
    ["49%", "회사가 승인하지 않은\nAI 도구를 쓰는 직원\n(500명 이상 기업)", "BlackFog 2026", C.accent1],
    ["33%", "승인되지 않은 도구에\n연구 자료·데이터를\n넣어 본 직원", "BlackFog 2026", C.accent4],
    ["43%", "침해 사고 조직 중\n섀도 AI 관련 사고\n(전년 20%)", "IBM 2026", C.accent4],
  ];
  stats.forEach(([n, d, src, col], i) => {
    const x = 0.6 + i * 3.08;
    card(s, x, 1.4, 2.86, 3.55, C.background2);
    txt(s, n, { x: x + 0.25, y: 1.6, w: 2.4, h: 1.0, fontSize: 52, bold: true, color: col });
    txt(s, d, { x: x + 0.25, y: 2.7, w: 2.45, h: 1.4, fontSize: 15 });
    txt(s, src, { x: x + 0.25, y: 4.45, w: 2.45, h: 0.3, fontSize: 11, color: C.accent3 });
  });
  card(s, 0.6, 5.25, 12.1, 1.2, C.text1);
  txt(s, [
    { text: "금지만으로는 막히지 않는다", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "임원의 65%가 승인되지 않은 AI를 쓴다(직원 31%). 더 편하고 안전한 공식 경로를 주는 것이 현실적인 대응이다", options: { color: C.background1 } },
  ], { x: 0.9, y: 5.25, w: 11.6, h: 1.2, fontSize: 15, valign: "middle" });
  source(s, "출처: Verizon 2026 DBIR·IBM 2026(2차 보도), BlackFog 2026, TrustedTech·Censuswide. 조사마다 정의가 달라 방향성 지표로 본다");
  s.addNotes(
    "직원들은 이미 AI를 쓰고 있습니다. 문제는 회사 밖에서 쓴다는 것입니다.\n" +
    "업무 기기에서 AI를 정기적으로 쓰는 직원이 45%로 1년 만에 3배가 됐고, 승인되지 않은 도구를 쓰는 직원이 절반 가까이 됩니다. 3명 중 1명은 연구 자료나 데이터를 거기에 넣어 봤다고 답했습니다.\n" +
    "IBM 보고에 따르면 침해 사고를 겪은 조직의 43%가 섀도 AI 관련 사고를 겪었고, 평균 피해가 일반 사고보다 큽니다.\n" +
    "흥미로운 점은 임원이 직원보다 두 배 더 많이 승인되지 않은 도구를 쓴다는 것입니다. 금지로는 막을 수 없습니다. 더 좋은 공식 길을 줘야 합니다.\n" +
    "(국내에서도 2023년 대기업 직원이 소스 코드를 외부 AI에 입력해 사용을 제한한 사례가 있었습니다.)"
  );
}
{
  const s = content("개인 단위의 AI 활용은 조직의 힘이 되지 않는다", S2);
  const probs = [
    ["재사용 안 됨", "잘 쓰는 사람의 프롬프트와 노하우가 개인 PC에 머문다. 같은 일을 부서마다 따로 시도한다"],
    ["사내 시스템과 단절", "ERP·MES·그룹웨어 데이터에 닿지 못해 복사·붙여넣기로 일한다. 답의 근거를 확인할 수 없다"],
    ["통제 불가", "누가 어떤 데이터를 어디에 넣었는지 모른다. 비용도, 품질도 관리되지 않는다"],
  ];
  probs.forEach(([t, d], i) => {
    const y = 1.4 + i * 1.3;
    badge(s, 0.6, y + 0.12, String(i + 1), C.accent4, C.background1);
    txt(s, t, { x: 1.3, y, w: 5.6, h: 0.5, fontSize: 19, bold: true, valign: "middle" });
    txt(s, d, { x: 1.3, y: y + 0.5, w: 5.6, h: 0.7, fontSize: 14, color: C.accent3 });
  });
  card(s, 7.3, 1.4, 5.4, 3.75, C.background2);
  txt(s, "국내 기업: 도입은 했지만 정착은 못 했다", { x: 7.6, y: 1.6, w: 4.9, h: 0.4, fontSize: 15, bold: true });
  const bars = [["AI 도입 기업", 69.5, C.accent3], ["업무 표준으로 정착", 12.5, C.accent4]];
  bars.forEach(([l, v, col], i) => {
    const y = 2.3 + i * 1.15;
    txt(s, l, { x: 7.6, y, w: 4.9, h: 0.35, fontSize: 13, color: C.accent3 });
    s.addShape(pres.shapes.RECTANGLE, { x: 7.6, y: y + 0.4, w: 4.2 * v / 70, h: 0.45, fill: { color: col }, line: { type: "none" }, objectName: nm("bar") });
    txt(s, `${v}%`, { x: 7.7 + 4.2 * v / 70, y: y + 0.4, w: 1.0, h: 0.45, fontSize: 18, bold: true, valign: "middle" });
  });
  txt(s, "기업 관계자 2,078명 조사 (조코딩AX파트너스)", { x: 7.6, y: 4.65, w: 4.9, h: 0.3, fontSize: 11, color: C.accent3 });
  card(s, 0.6, 5.4, 12.1, 1.0, "FEF3C7");
  txt(s, "필요한 것은 더 좋은 챗봇이 아니라, 사내 시스템에 연결되고 조직이 함께 쌓아 가는 '에이전트 기반'이다", { x: 0.9, y: 5.4, w: 11.6, h: 1.0, fontSize: 17, bold: true, valign: "middle" });
  s.addNotes(
    "회사 차원의 문제는 세 가지입니다. 첫째, 재사용이 안 됩니다. 잘 쓰는 사람의 노하우가 개인 PC에 머뭅니다. 둘째, 사내 시스템과 단절돼 있어 ERP나 MES 데이터를 복사해 붙여 넣으며 일합니다. 셋째, 통제가 안 됩니다.\n" +
    "국내 조사에서도 AI를 도입했다는 기업은 70% 가까이지만, 업무 표준으로 자리 잡은 곳은 12.5%에 불과합니다. 대한상의 조사에서도 필요성 공감은 78%인데 실제 활용은 30%대입니다.\n" +
    "결국 필요한 것은 더 좋은 챗봇이 아니라, 사내 시스템에 연결되고 조직이 함께 쌓아 가는 기반입니다."
  );
}
{
  const s = content("왜 지금인가: 챗봇에서 에이전트로, 그리고 표준이 정해졌다", S2);
  const trends = [
    ["33%", "2028년까지 기업 소프트웨어 중\n에이전트 AI를 포함하는 비율", "Gartner", C.accent6],
    ["15%", "2028년까지 자율적으로\n이뤄질 일상 업무 결정", "Gartner", C.accent6],
    ["79%", "2026년 생성형 AI 예산을\n늘리는 국내 기업", "CIO Korea 2026 조사", C.accent2],
  ];
  trends.forEach(([n, d, src, col], i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 1.35, 3.9, 2.35, C.background2);
    txt(s, n, { x: x + 0.3, y: 1.5, w: 3.3, h: 0.9, fontSize: 44, bold: true, color: col });
    txt(s, d, { x: x + 0.3, y: 2.45, w: 3.4, h: 0.8, fontSize: 14 });
    txt(s, src, { x: x + 0.3, y: 3.3, w: 3.4, h: 0.3, fontSize: 11, color: C.accent3 });
  });
  const facts = [
    ["연결 표준 확정", "AI와 사내 시스템을 잇는 MCP가 리눅스 재단 산하 Agentic AI Foundation으로 이관(2025.12). Claude·Copilot·Gemini·ChatGPT 지원", C.accent2],
    ["제도 시행", "AI 기본법 시행(2026.1.22): 생성물 표시, 사전 고지, 고영향 AI 관리. 통제 체계가 필요해졌다", C.accent1],
    ["경고", "Gartner: 에이전트 AI 프로젝트 40% 이상이 2027년까지 취소. 원인은 비용, 불분명한 가치, 리스크 통제 부족", C.accent4],
  ];
  facts.forEach(([t, d, col], i) => {
    const y = 3.95 + i * 0.85;
    s.addShape(pres.shapes.OVAL, { x: 0.65, y: y + 0.12, w: 0.22, h: 0.22, fill: { color: col }, line: { type: "none" }, objectName: nm("dot") });
    txt(s, t, { x: 1.05, y, w: 2.3, h: 0.5, fontSize: 16, bold: true, valign: "middle" });
    txt(s, d, { x: 3.4, y, w: 9.3, h: 0.7, fontSize: 14, valign: "middle" });
  });
  s.addNotes(
    "왜 지금인가. 업무 소프트웨어가 에이전트로 바뀌고 있습니다. Gartner는 2028년까지 기업 소프트웨어의 3분의 1이 에이전트를 포함하고, 일상 업무 결정의 15%가 자율적으로 이뤄질 것으로 봅니다. 국내 기업 79%가 내년 AI 예산을 늘립니다.\n" +
    "결정적인 변화는 표준입니다. AI와 사내 시스템을 잇는 MCP라는 표준이 작년 12월 리눅스 재단으로 넘어갔고, 주요 AI가 모두 지원합니다. 지금 도구를 만들면 나중에 어떤 AI로 바꿔도 그대로 씁니다.\n" +
    "AI 기본법도 올해 1월 시행됐습니다. 통제 체계가 필요해졌습니다.\n" +
    "다만 경고도 있습니다. 에이전트 프로젝트의 40% 이상이 취소될 것이라는 전망입니다. 원인은 비용, 불분명한 가치, 리스크 통제 부족입니다. 이 제안은 그 세 가지에 맞춰 설계했습니다."
  );
}

// ═════════════════════════════════════════════════════════════════════════
// 3. 제안
// ═════════════════════════════════════════════════════════════════════════
const S3 = "제안";
pres.addSection({ title: S3 });
{
  const s = content("제안: 직원이 직접 만드는 사내 AI 에이전트 플랫폼", S3);
  card(s, 0.6, 1.3, 12.1, 0.85, C.text2);
  txt(s, "에이전트 스튜디오 (가칭) = 코딩 없이 화면에서 자기 업무용 AI 에이전트를 만들고, 실행하고, 동료와 공유하는 사내 플랫폼",
    { x: 0.9, y: 1.3, w: 11.6, h: 0.85, fontSize: 17, bold: true, color: C.background1, valign: "middle" });
  const fns = [
    ["만들기", "목표를 말로 적고\n쓸 도구와 지식을 고른다\n부서 템플릿에서 시작"],
    ["실행하기", "대화로 바로, 또는\n예약(매월 말일·매일 07:00)\n사건(불량 급증) 발생 시"],
    ["승인하기", "시스템 변경은 제안만\n사람이 승인함에서\n승인해야 실행"],
    ["공유하기", "검증된 에이전트를\n팀·전사 갤러리에\n→ 조직의 자산"],
    ["관리하기", "권한 · 데이터 등급\n모델 선택 · 비용 한도\n실행 기록 · 감사"],
  ];
  fns.forEach(([t, d], i) => {
    const x = 0.6 + i * 2.46;
    card(s, x, 2.5, 2.26, 3.0, i === 2 ? "FEF3C7" : C.background2, i === 2 ? C.accent1 : undefined);
    badge(s, x + 0.2, 2.7, String(i + 1), C.accent2, C.background1, 0.44);
    txt(s, t, { x: x + 0.75, y: 2.7, w: 1.45, h: 0.44, fontSize: 18, bold: true, valign: "middle" });
    txt(s, d, { x: x + 0.2, y: 3.4, w: 1.95, h: 1.9, fontSize: 14 });
    if (i < fns.length - 1) arrowR(s, x + 2.28, 4.0, 0.16);
  });
  txt(s, "핵심은 화면이 아니라 우리 회사의 도구(ERP·MES 연결)와 지식(규정·매뉴얼·사례)을 회사가 소유하는 것", { x: 0.6, y: 5.8, w: 12.1, h: 0.5, fontSize: 16, bold: true, color: C.accent2 });
  s.addNotes(
    "제안하는 것은 가칭 에이전트 스튜디오입니다. 직원이 코딩 없이 화면에서 자기 업무용 AI 에이전트를 만들고, 실행하고, 공유합니다.\n" +
    "다섯 가지 기능입니다. 만들기: 목표를 말로 적고 쓸 도구와 지식을 고릅니다. 실행하기: 대화로 바로, 또는 매월 말일 같은 예약이나 불량 급증 같은 사건에 반응해 자동으로. 승인하기: 시스템을 바꾸는 일은 에이전트가 제안만 하고 사람이 승인합니다. 공유하기: 잘 만든 에이전트가 팀과 전사의 자산이 됩니다. 관리하기: 권한, 데이터 등급, 비용, 감사.\n" +
    "핵심은 화면이 아닙니다. 우리 회사의 도구와 지식을 회사가 소유하는 것입니다."
  );
}
{
  const s = content("에이전트를 만드는 방법: 회계팀 '월말 거래처 대사' 예시", S3);
  const steps = [
    ["목표 적기", "“매월 말일, 주요 거래처 50곳의 채권과 회신 잔액을 비교해 차이를 정리해 줘”"],
    ["도구 고르기", "ERP 매출채권 조회 · 메일함(거래처 회신) 읽기 · 엑셀 보고서 만들기"],
    ["지식 연결", "회계 규정 · 대사 업무 매뉴얼"],
    ["규칙 정하기", "조회는 자동 · 거래처 메일 발송은 담당자 승인 후 · 1회 실행 비용 한도"],
    ["실행·예약", "매월 말일 09:00 자동 실행 → 차이 목록과 원인 후보 → 담당자 검토"],
  ];
  steps.forEach(([t, d], i) => {
    const y = 1.35 + i * 0.98;
    card(s, 0.6, y, 7.6, 0.82, i === 3 ? "FEF3C7" : C.background2);
    badge(s, 0.8, y + 0.18, String(i + 1), C.accent2, C.background1, 0.46);
    txt(s, t, { x: 1.45, y, w: 1.7, h: 0.82, fontSize: 16, bold: true, valign: "middle" });
    txt(s, d, { x: 3.2, y, w: 4.85, h: 0.82, fontSize: 13.5, valign: "middle" });
  });
  card(s, 8.55, 1.35, 4.15, 4.74, C.text1);
  txt(s, [
    { text: "결과", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "담당자가 하던 반나절 대사 작업이 차이 검토 30분으로", options: { color: C.background1, breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "공유", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "영업팀은 같은 'ERP 채권 조회' 도구로 미수금 알림 에이전트를 만든다", options: { color: C.background1, breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "통제", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "전표 수정·외부 메일은 사람이 승인. 모든 실행이 기록된다", options: { color: C.background1 } },
  ], { x: 8.85, y: 1.6, w: 3.6, h: 4.3, fontSize: 14 });
  source(s, "효과 수치는 설명용 예시이며 파일럿에서 실측한다");
  s.addNotes(
    "직원이 실제로 어떻게 만드는지 회계팀 예시로 보겠습니다. 다섯 단계입니다.\n" +
    "목표를 말로 적고, 쓸 도구를 고르고(ERP 채권 조회, 메일함, 엑셀), 참고할 지식을 연결하고, 규칙을 정합니다. 조회는 자동이지만 거래처에 메일을 보내는 것은 담당자 승인 후입니다. 그리고 매월 말일 아침에 자동으로 돌게 예약합니다.\n" +
    "결과적으로 반나절 걸리던 대사가 차이 검토 위주로 바뀝니다. 그리고 영업팀은 같은 ERP 채권 조회 도구로 미수금 알림 에이전트를 만들 수 있습니다. 도구 하나가 여러 부서에서 재사용됩니다.\n" +
    "수치는 예시이고 파일럿에서 실측합니다."
  );
}
{
  const s = content("부서별 활용: 반복 업무는 에이전트가, 판단은 사람이", S3);
  const depts = [
    ["회계", ["거래처 잔액 대사", "경비 증빙 규정 위반 후보", "월 결산 보고서 초안"], "전표 수정 승인", C.accent6],
    ["제조", ["아침 브리핑 (생산·출하·재고)", "긴급 주문 재계획 시나리오", "설비 알람 원인 진단"], "계획 변경 승인", C.accent2],
    ["품질", ["불량 급증 원인 후보 (4M)", "8D 보고서 초안", "검사 기준·과거 사례 Q&A"], "원인 확정, 대외 회신", C.accent4],
    ["개발", ["설계 문서·사양 검색", "장애 로그 분석", "코드 리뷰·테스트 보조"], "설계 결정, 배포 승인", C.accent1],
    ["일상 업무", ["회의록 요약·할 일", "사내 규정 Q&A", "보고서 양식·메일 초안"], "내용 확인 후 발송", C.accent5],
  ];
  depts.forEach(([t, items, human, col], i) => {
    const x = 0.6 + i * 2.46;
    card(s, x, 1.35, 2.26, 4.85, C.background2);
    s.addShape(pres.shapes.OVAL, { x: x + 0.22, y: 1.6, w: 0.24, h: 0.24, fill: { color: col }, line: { type: "none" }, objectName: nm("dot") });
    txt(s, t, { x: x + 0.55, y: 1.5, w: 1.6, h: 0.45, fontSize: 18, bold: true, valign: "middle" });
    txt(s, items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < items.length - 1 } })),
      { x: x + 0.2, y: 2.15, w: 1.95, h: 2.6, fontSize: 13.5, paraSpaceAfter: 8 });
    txt(s, "사람의 몫", { x: x + 0.22, y: 5.0, w: 1.9, h: 0.3, fontSize: 11, bold: true, color: C.accent3 });
    txt(s, human, { x: x + 0.22, y: 5.3, w: 1.95, h: 0.7, fontSize: 13, bold: true });
  });
  source(s, "제조 브리핑·품질 Q&A·승인 흐름은 사내 데모로 이미 검증 (부록)");
  s.addNotes(
    "부서별로 보면 이렇습니다. 원칙은 같습니다. 반복 업무는 에이전트가, 판단은 사람이.\n" +
    "회계는 대사, 증빙 검토, 결산 보고서 초안. 제조는 아침 브리핑, 긴급 주문 재계획, 설비 알람 진단. 품질은 불량 원인 후보, 8D 보고서 초안, 검사 기준 Q&A. 개발은 문서 검색, 장애 로그 분석, 코드 리뷰 보조. 그리고 전 직원의 일상 업무: 회의록, 규정 Q&A, 보고서와 메일 초안.\n" +
    "아래 줄이 사람의 몫입니다. 전표 수정, 계획 변경, 원인 확정, 대외 회신은 사람이 결정합니다.\n" +
    "제조 브리핑과 품질 Q&A, 승인 흐름은 이미 데모로 검증했습니다."
  );
}
{
  const s = content("구조: 기존 시스템은 그대로, 그 위에 연결한다", S3);
  const layers = [
    ["사용자 화면", "웹: 에이전트 만들기 · 실행 · 승인함 · 갤러리   |   사내 메신저", C.text1, C.background1],
    ["에이전트 플랫폼", "에이전트 빌더 · 실행 엔진(대화·예약·이벤트) · 승인 대기열 · 감사 로그 · 비용 관리", C.accent2, C.background1],
    ["도구와 지식", "도구(MCP 표준): ERP·MES 조회, 메일, 문서, 제안(승인 필요)   |   지식(RAG): 규정·매뉴얼·사례", C.accent6, C.background1],
    ["모델 게이트웨이", "데이터 등급에 따라 자동 선택:  대외비 → 사내 모델(vLLM)   |   일반 → 클라우드 모델", C.accent1, C.text2],
    ["기존 시스템", "ERP · MES · 그룹웨어 · 문서 관리  (교체하지 않는다)", C.background2, C.text1],
  ];
  layers.forEach(([t, d, f, col], i) => {
    const y = 1.3 + i * 1.05;
    card(s, 0.6, y, 8.6, 0.88, f);
    txt(s, t, { x: 0.85, y, w: 2.3, h: 0.88, fontSize: 16, bold: true, color: col, valign: "middle" });
    txt(s, d, { x: 3.15, y, w: 5.9, h: 0.88, fontSize: 12.5, color: col, valign: "middle" });
  });
  const pts = [
    ["도구는 한 번 만들면 모든 에이전트가 재사용", "ERP 채권 조회 도구 하나를 회계·영업·경영지원이 함께 쓴다"],
    ["모델은 갈아 끼울 수 있다", "OpenAI 호환 API와 MCP 표준. 특정 회사에 묶이지 않는다"],
    ["기존 시스템 투자를 살린다", "ERP·MES는 교체하지 않고 조회 도구와 승인된 쓰기만 연결"],
  ];
  pts.forEach(([t, d], i) => {
    const y = 1.3 + i * 1.75;
    badge(s, 9.5, y + 0.05, String(i + 1), C.accent2, C.background1, 0.44);
    txt(s, t, { x: 10.1, y, w: 2.6, h: 0.75, fontSize: 15, bold: true });
    txt(s, d, { x: 10.1, y: y + 0.78, w: 2.6, h: 0.85, fontSize: 12.5, color: C.accent3 });
  });
  s.addNotes(
    "구조는 다섯 층입니다. 맨 아래 ERP, MES, 그룹웨어는 그대로 둡니다. 교체하지 않습니다.\n" +
    "그 위에 모델 게이트웨이가 데이터 등급을 보고 모델을 고릅니다. 원가, 설계, 품질, 인사 같은 대외비는 사내 모델에서만, 일반 업무는 클라우드 모델도 씁니다.\n" +
    "도구와 지식 층이 핵심 자산입니다. 도구는 MCP라는 표준으로 만들기 때문에 한 번 만들면 모든 에이전트가 재사용하고, 나중에 AI 모델이나 플랫폼을 바꿔도 그대로 씁니다.\n" +
    "그 위에 플랫폼과 화면이 있습니다."
  );
}
{
  const s = content("보안과 통제: 금지가 아니라 통제된 공식 경로", S3);
  const rows = [
    [hdr("데이터 등급"), hdr("예"), hdr("처리 모델")],
    ["공개·일반", "규정 Q&A, 회의록, 일반 문서", { text: "클라우드 모델 허용", options: { color: HEX.accent5, bold: true } }],
    ["대외비", "원가, 설계, 품질, 인사 데이터", { text: "사내 모델만 (vLLM)", options: { color: HEX.accent4, bold: true } }],
    ["개인정보", "고객·직원 개인정보", { text: "가림(마스킹) 후 사내 모델", options: { color: HEX.accent4, bold: true } }],
  ];
  s.addTable(rows, { x: 0.6, y: 1.35, w: 6.6, colW: [1.6, 2.7, 2.3], rowH: 0.62, fontSize: 13, color: HEX.dk1,
    border: { type: "solid", pt: 0.75, color: BORDER }, valign: "middle", margin: [0, 0.1, 0, 0.1], objectName: nm("table") });
  txt(s, "게이트웨이가 데이터 등급을 보고 자동으로 모델을 고른다", { x: 0.6, y: 3.95, w: 6.6, h: 0.35, fontSize: 13, italic: true, color: C.accent3 });
  const rules = [
    ["권한 = 사용자 권한", "에이전트는 실행한 사람이 볼 수 있는 데이터만. 'AI 만능 계정' 없음"],
    ["쓰기는 승인", "조회는 자동, 시스템 변경은 제안 → 사람 승인 → 실행"],
    ["기록과 감사", "누가·무엇을·어떤 근거(문서 개정판)로 했는지 모두 기록"],
    ["공유 전 검토", "전사 공개 전 추진 조직이 권한·데이터 등급 검토"],
    ["비용 한도", "사용자·부서별 한도, 반복 작업은 사내 모델로"],
  ];
  rules.forEach(([t, d], i) => {
    const y = 1.35 + i * 1.0;
    card(s, 7.5, y, 5.2, 0.86, C.background2);
    txt(s, t, { x: 7.75, y: y + 0.08, w: 4.8, h: 0.38, fontSize: 15, bold: true });
    txt(s, d, { x: 7.75, y: y + 0.45, w: 4.8, h: 0.38, fontSize: 12, color: C.accent3 });
  });
  card(s, 0.6, 4.5, 6.6, 1.85, C.text1);
  txt(s, [
    { text: "섀도 AI를 공식 경로로 흡수", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "쓰고 싶은 기능을 공식 플랫폼이 더 편하게 주면 외부로 데이터가 나갈 이유가 줄어든다. 도입 후 외부 AI 트래픽 감소를 지표로 본다", options: { color: C.background1, breakLine: true } },
    { text: "AI 기본법(2026.1): 대외 생성물 표시·고지 규칙 반영", options: { color: "CBD5E1" } },
  ], { x: 0.9, y: 4.6, w: 6.1, h: 1.65, fontSize: 14, valign: "middle" });
  s.addNotes(
    "보안과 통제입니다. 금지가 아니라 통제된 공식 경로를 주는 것이 전략입니다.\n" +
    "데이터 등급에 따라 모델을 나눕니다. 공개·일반 데이터는 성능 좋은 클라우드 모델을 허용하고, 원가·설계·품질·인사 같은 대외비는 사내 서버의 모델에서만 처리합니다. 이 선택은 사람이 아니라 게이트웨이가 자동으로 합니다.\n" +
    "그리고 다섯 가지 규칙: 에이전트는 실행한 사람의 권한만큼만 보고, 시스템을 바꾸는 일은 사람이 승인하고, 모든 실행을 기록하고, 전사 공유 전에 검토하고, 비용 한도를 둡니다.\n" +
    "이렇게 공식 경로가 편해지면 섀도 AI가 줄어듭니다. 외부 AI 트래픽 감소를 지표로 보겠습니다."
  );
}

// ═════════════════════════════════════════════════════════════════════════
// 4. 투자와 효과
// ═════════════════════════════════════════════════════════════════════════
const S4 = "투자와 효과";
pres.addSection({ title: S4 });
{
  const s = content("투자와 효과: 3년차 누적 손익분기, 이후 연 5억 원 이상", S4);
  s.addChart(pres.charts.BAR, [
    { name: "비용", labels: ["1년차", "2년차", "3년차", "4년차"], values: [7.8, 9.8, 8.0, 8.0] },
    { name: "효과 (기준 시나리오)", labels: ["1년차", "2년차", "3년차", "4년차"], values: [3.4, 9.3, 13.1, 13.1] },
  ], {
    x: 0.6, y: 1.3, w: 7.2, h: 4.4, barDir: "col", barGapWidthPct: 60,
    chartColors: [HEX.accent3, HEX.accent2],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 12, dataLabelColor: HEX.dk1, dataLabelFormatCode: "0.0",
    catAxisLabelColor: HEX.accent3, valAxisLabelColor: HEX.accent3, catAxisLabelFontSize: 12, valAxisLabelFontSize: 11,
    catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt", titleFontFace: "+mn-lt",
    valGridLine: { color: "E2E8F0", size: 0.75 }, catGridLine: { style: "none" },
    valAxisMinVal: 0, valAxisMaxVal: 16, valAxisMajorUnit: 4,
    showLegend: true, legendPos: "b", legendFontSize: 12, legendColor: HEX.dk1,
    showTitle: true, title: "연간 비용과 효과 (억 원, 기준 시나리오)", titleFontSize: 14, titleColor: HEX.dk1,
    objectName: nm("chart"),
  });
  const rows = [
    [hdr("시나리오"), hdr("3년 누적"), hdr("4년 누적")],
    ["보수 (주 1.5시간)", "−7.0", "−5.2"],
    [{ text: "기준 (주 2.5시간)", options: { bold: true } }, { text: "+0.2", options: { bold: true } }, { text: "+5.3", options: { bold: true, color: HEX.accent5 } }],
    ["낙관 (주 4시간)", "+10.9", { text: "+21.0", options: { color: HEX.accent5 } }],
  ];
  s.addTable(rows, { x: 8.1, y: 1.3, w: 4.6, colW: [2.2, 1.2, 1.2], rowH: 0.5, fontSize: 13, color: HEX.dk1, align: "center",
    border: { type: "solid", pt: 0.75, color: BORDER }, valign: "middle", margin: [0, 0.08, 0, 0.08], objectName: nm("table") });
  card(s, 8.1, 3.55, 4.6, 2.15, C.text1);
  txt(s, [
    { text: "연간 운영비 회수 조건", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "활성 사용자 300명이 주 1.4시간만 실제로 아끼면 된다", options: { bold: true, color: C.background1, breakLine: true } },
    { text: "외부 조사 보고치는 주 2.2~3.8시간. 자동화 업무 30개를 넣으면 주 0.5시간", options: { color: "CBD5E1" } },
  ], { x: 8.35, y: 3.6, w: 4.15, h: 2.05, fontSize: 14, valign: "middle", paraSpaceAfter: 4 });
  source(s, "가정: 대상 600명 중 활성 120→300→360명, 시간당 4만 원, 절감 시간의 50%만 가치로 계산, 자동화 업무 1개 연 0.16억. 비용은 개략 추정 (근거 문서 6장)");
  s.addNotes(
    "투자와 효과입니다. 숫자를 부풀리지 않으려고 보수적으로 계산했습니다. 아낀 시간의 절반만 가치로 셌습니다.\n" +
    "기준 시나리오에서 1~2년차는 투자 구간이고, 3년차에 누적 손익분기, 그 이후 매년 5억 원 이상의 순효과가 납니다.\n" +
    "가장 중요한 숫자는 오른쪽 아래입니다. 연간 운영비를 회수하려면 활성 사용자 300명이 일주일에 1.4시간만 실제로 아끼면 됩니다. 외부 조사에서 보고된 절감 시간은 주 2.2~3.8시간입니다. 반복 업무 자동화 30개의 효과까지 넣으면 주 30분이면 됩니다.\n" +
    "그리고 이 계산에는 보안 리스크 감소가 빠져 있습니다. 섀도 AI 관련 침해 사고 한 건의 평균 피해가 70억 원대입니다. 한 건만 막아도 3년 투자액을 넘습니다.\n" +
    "가정은 모두 근거 문서에 있고, 우리 회사 숫자로 바꾸면 바로 다시 계산됩니다."
  );
}
{
  const s = content("구축 방식: 오픈소스 기반 자체 구축 + 모델 혼합 운영을 권장", S4);
  const rows = [
    [hdr("방식"), hdr("장점"), hdr("단점"), hdr("판단")],
    ["A. 상용 에이전트 플랫폼\n(Copilot Studio, Gemini Enterprise 등)", "빠른 시작, 높은 모델 품질, 업무 도구 통합", "사용자 수만큼 구독료, 데이터 외부 처리, 사내 ERP·MES 연결 어려움, 종속", "문서·메일 중심 부서에 일부"],
    ["B. 오픈소스 기반 자체 구축\n(에이전트 빌더 + LangGraph + MCP + vLLM)", "데이터 통제, 사내 시스템 연결 자유, 비용 예측, 종속 없음", "구축·운영 인력 필요, 화면 완성도는 직접 다듬어야", "사내 연결이 핵심인 우리에게 적합"],
    [{ text: "C. 혼합 (권장)", options: { bold: true } }, { text: "B를 기반으로, 모델은 대외비=사내 / 일반=클라우드. 상용 협업 도구는 필요 부서만", options: { bold: true } }, "두 체계를 관리해야 함", { text: "권장", options: { bold: true, color: HEX.accent5 } }],
  ];
  const hot = (r, i) => i === 3 ? r.map((c) => (typeof c === "string" ? { text: c, options: { fill: { color: "FEF3C7" } } } : { ...c, options: { ...c.options, fill: { color: "FEF3C7" } } })) : r;
  s.addTable(rows.map(hot), { x: 0.6, y: 1.35, w: 12.1, colW: [3.3, 3.4, 3.4, 2.0], rowH: [0.5, 1.05, 1.05, 1.05], fontSize: 13, color: HEX.dk1,
    border: { type: "solid", pt: 0.75, color: BORDER }, valign: "middle", margin: [0, 0.1, 0, 0.1], objectName: nm("table") });
  card(s, 0.6, 5.2, 12.1, 1.2, C.text1);
  txt(s, [
    { text: "차별점은 플랫폼 화면이 아니라 '우리 도구와 지식'", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "ERP·MES 연결 도구와 규정·매뉴얼·사례 지식은 회사가 소유한다. 오픈 표준을 따르면 플랫폼이나 모델을 바꿔도 그대로 쓴다", options: { color: C.background1 } },
  ], { x: 0.9, y: 5.2, w: 11.6, h: 1.2, fontSize: 15, valign: "middle" });
  source(s, "오픈소스 후보의 라이선스는 서로 다르다(예: Dify 조건부 Apache 2.0, n8n 소스 공개형, Langflow MIT). 도입 전 법무 검토 필요");
  s.addNotes(
    "구축 방식은 세 가지를 비교했습니다.\n" +
    "상용 플랫폼은 빨리 시작할 수 있지만, 사용자 수만큼 구독료가 늘고, 데이터가 외부에서 처리되고, 우리 공장의 ERP와 MES에 연결하기 어렵습니다.\n" +
    "오픈소스 기반 자체 구축은 인력이 필요하지만 데이터 통제와 사내 연결이 자유롭습니다.\n" +
    "권장안은 혼합입니다. 오픈소스 기반으로 사내에 플랫폼을 두고, 모델은 대외비는 사내, 일반 업무는 클라우드로 나눕니다. 문서나 메일 위주 부서에는 상용 협업 도구를 선택적으로 씁니다.\n" +
    "결국 차별점은 화면이 아니라 우리 도구와 지식입니다. 이건 우리가 소유해야 합니다."
  );
}

// ═════════════════════════════════════════════════════════════════════════
// 5. 실행 계획
// ═════════════════════════════════════════════════════════════════════════
const S5 = "실행 계획";
pres.addSection({ title: S5 });
{
  const s = content("단계별 추진: 성과 지표를 넘어야 다음 단계로 간다", S5);
  const phases = [
    ["1단계 파일럿", "0~6개월 · 약 3.4억 원", ["제조·품질·회계 3개 부서", "+ 전사 규정 Q&A", "사용자 60명, 조회 전용", "핵심 도구 10개, 템플릿 10개"], "FEF3C7", C.accent1],
    ["2단계 확산", "6~18개월", ["전 부서, 셀프 빌더 공개", "승인형 쓰기 도구 도입", "사용자 300명", "자동화 업무 15개"], C.background2, undefined],
    ["3단계 전사·고도화", "18~36개월", ["이벤트 기반 자동화", "부서 간 에이전트 협업", "역할별 화면 (공장장실 등)", "자동화 업무 30개"], C.background2, undefined],
  ];
  phases.forEach(([t, when, items, fill, line], i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 1.35, 3.85, 3.2, fill, line);
    txt(s, t, { x: x + 0.3, y: 1.5, w: 3.3, h: 0.45, fontSize: 19, bold: true });
    txt(s, when, { x: x + 0.3, y: 1.98, w: 3.3, h: 0.35, fontSize: 13, bold: true, color: C.accent2 });
    txt(s, items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < items.length - 1 } })),
      { x: x + 0.3, y: 2.45, w: 3.35, h: 2.0, fontSize: 14, paraSpaceAfter: 5 });
    if (i < phases.length - 1) {
      arrowR(s, x + 3.88, 2.95, 0.2, C.accent1);
    }
  });
  card(s, 0.6, 4.8, 12.1, 1.6, C.text1);
  txt(s, "1단계 → 2단계 확대 조건 (Go/No-go)", { x: 0.9, y: 4.9, w: 11.6, h: 0.4, fontSize: 15, bold: true, color: C.accent1 });
  const kpis = ["주간 활성 사용률 60% 이상", "1인 주 1.5시간 이상 절감 (표본 측정)", "만족도 4.0 / 5 이상", "보안 사고 0건", "부서별 성공 사례 2건 이상"];
  kpis.forEach((k, i) => {
    const x = 0.9 + i * 2.36;
    txt(s, "✓ " + k, { x, y: 5.4, w: 2.26, h: 0.85, fontSize: 13, color: C.background1, valign: "middle" });
  });
  source(s, "추진 조직: AI 추진 조직(CoE) 3~5명 + 부서별 AI 챔피언 1명 (업무를 아는 사람이 만들고 동료를 돕는다)");
  s.addNotes(
    "추진은 3단계입니다. 핵심은 성과 지표를 넘어야 다음 단계로 간다는 것입니다.\n" +
    "1단계 6개월 파일럿: 제조, 품질, 회계 3개 부서와 전사 규정 Q&A로 시작합니다. 사용자 60명, 조회 전용으로 위험을 낮춥니다.\n" +
    "6개월 뒤 다섯 가지 지표로 판단합니다. 주간 활성 사용률 60%, 1인 주 1.5시간 절감, 만족도 4.0, 보안 사고 0건, 부서별 성공 사례 2건. 이걸 넘으면 2단계로 전 부서에 셀프 빌더를 열고 승인형 쓰기 도구를 도입합니다.\n" +
    "조직은 작은 AI 추진 조직과 부서별 챔피언입니다. 업무를 아는 사람이 직접 만들어야 성공합니다."
  );
}
{
  const s = content("리스크와 대응: 실패하는 이유에 맞춰 설계했다", S5);
  const rows = [
    [hdr("리스크"), hdr("대응")],
    ["프로젝트 실패 (Gartner: 40% 이상 취소, 원인은 비용·가치 불명확·통제 부족)", "단계별 투자와 Go/No-go 지표 · 실제 업무 템플릿에서 시작 · 거버넌스 처음부터 내장"],
    ["틀린 답 (환각)", "숫자는 시스템 조회 도구에서만, LLM은 해석만 · 답마다 근거(문서 개정판) 표시 · 변경은 승인"],
    ["데이터 유출", "데이터 등급별 모델 선택 · 대외비는 사내 모델 · 권한 = 사용자 권한 · 감사 로그"],
    ["비용 증가", "사용량 한도 · 반복 작업은 사내 모델 · 월별 비용 보고"],
    ["현장 반발·미사용", "반복 업무 제거가 목적(인력 대체 아님) · 부서 챔피언 · 쉬운 템플릿"],
    ["특정 회사 종속", "오픈 표준(MCP, OpenAI 호환 API) · 도구와 지식은 자체 소유"],
    ["규제", "AI 기본법 표시·고지 반영 · 채용·평가 등 인사 판단에는 쓰지 않음"],
  ];
  s.addTable(rows, { x: 0.6, y: 1.3, w: 12.1, colW: [4.9, 7.2], rowH: [0.45, 0.72, 0.62, 0.62, 0.55, 0.55, 0.55, 0.55], fontSize: 13, color: HEX.dk1,
    border: { type: "solid", pt: 0.75, color: BORDER }, valign: "middle", margin: [0, 0.12, 0, 0.12], objectName: nm("table") });
  s.addNotes(
    "리스크와 대응입니다. 앞서 말씀드린 Gartner의 실패 원인, 비용·가치 불명확·통제 부족에 맞춰 설계했습니다.\n" +
    "특히 틀린 답 문제는 구조로 막습니다. 숫자는 시스템 조회 도구에서만 가져오고, AI는 해석만 합니다. 답마다 근거 문서와 개정판을 표시하고, 시스템 변경은 사람이 승인합니다. 이 방식은 데모로 검증했습니다.\n" +
    "현장 반발에 대해서는 분명히 해 두겠습니다. 목적은 인력 대체가 아니라 반복 업무 제거입니다. 채용이나 평가 같은 인사 판단에는 쓰지 않습니다."
  );
}
{
  const s = content("이미 검증한 것: 핵심 기술은 데모로 확인했다", S5);
  const demos = [
    ["아침 브리핑", "MES를 읽기 전용으로 조회하고 숫자는 코드가 계산. 근거 없는 숫자는 자동 차단", C.accent2],
    ["지식 도우미", "문서를 자동 변환·색인, 개정·폐기 반영, 출처와 개정판 표시", C.accent6],
    ["시스템 도구 (MCP)", "AI는 제안만, 사람이 승인해야 시스템 변경. 파이썬·Java 구현, 다른 언어 에이전트도 같은 도구 사용", C.accent1],
    ["사용자 화면 시안", "대화 중심 화면, 승인 카드, 설비 페이지", C.accent5],
  ];
  demos.forEach(([t, d, col], i) => {
    const x = 0.6 + (i % 2) * 6.15, y = 1.35 + Math.floor(i / 2) * 2.05;
    card(s, x, y, 5.95, 1.85, C.background2);
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.32, w: 0.24, h: 0.24, fill: { color: col }, line: { type: "none" }, objectName: nm("dot") });
    txt(s, t, { x: x + 0.7, y: y + 0.2, w: 5.0, h: 0.45, fontSize: 18, bold: true, valign: "middle" });
    txt(s, d, { x: x + 0.7, y: y + 0.75, w: 5.0, h: 0.95, fontSize: 14, color: C.accent3 });
  });
  card(s, 0.6, 5.55, 12.1, 0.85, "FEF3C7");
  txt(s, "1단계 파일럿의 기술 위험은 낮다. 남은 과제는 기술이 아니라 확산과 운영이다", { x: 0.9, y: 5.55, w: 11.6, h: 0.85, fontSize: 17, bold: true, valign: "middle" });
  s.addNotes(
    "마지막으로, 핵심 기술은 이미 데모로 확인했습니다.\n" +
    "아침 브리핑은 MES를 읽기 전용으로 조회하고 AI가 근거 없는 숫자를 쓰면 자동으로 막습니다. 지식 도우미는 문서를 자동으로 색인하고 개정판을 관리합니다. 시스템 도구는 표준 MCP로 만들어 AI는 제안만 하고 사람이 승인해야 시스템이 바뀌는 흐름을 파이썬과 Java로 모두 구현했습니다.\n" +
    "그래서 파일럿의 기술 위험은 낮습니다. 남은 과제는 기술이 아니라 확산과 운영입니다. (시간이 있으면 데모를 보여 드립니다.)"
  );
}

// ═════════════════════════════════════════════════════════════════════════
// 6. 요청
// ═════════════════════════════════════════════════════════════════════════
const S6 = "요청";
pres.addSection({ title: S6 });
{
  const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: S6 });
  s.addText("오늘 결정을 요청드립니다", { placeholder: "title" });
  s.addText("전체 3년 투자가 아니라, 6개월 파일럿으로 시작합니다", { placeholder: "body" });
  const asks = [
    ["1단계 파일럿 승인", "6개월 · 약 3.4억 원 (인력 3명, GPU 서버 1대, 모델 사용료, 교육)"],
    ["AI 추진 조직 구성", "CoE 3명 + 파일럿 3개 부서 챔피언 지정"],
    ["데이터 등급 정책 위임", "정보보호 조직과 1개월 안에 대외비 범위·모델 사용 규칙 확정"],
    ["6개월 뒤 Go/No-go 보고", "정해 둔 다섯 가지 지표로 확대 여부 결정"],
  ];
  asks.forEach(([t, d], i) => {
    const y = 4.55 + i * 0.62;
    badge(s, 0.8, y + 0.04, String(i + 1), C.accent1, C.text2, 0.44);
    txt(s, t, { x: 1.45, y, w: 3.6, h: 0.52, fontSize: 17, bold: true, color: C.background1, valign: "middle" });
    txt(s, d, { x: 5.1, y, w: 7.6, h: 0.52, fontSize: 14, color: "CBD5E1", valign: "middle" });
  });
  s.addNotes(
    "오늘 결정을 요청드립니다. 전체 3년 투자가 아니라 6개월 파일럿입니다.\n" +
    "첫째, 1단계 파일럿 승인: 6개월, 약 3.4억 원. 둘째, 작은 AI 추진 조직과 부서 챔피언 지정. 셋째, 정보보호 조직과 데이터 등급 정책을 한 달 안에 확정하도록 위임. 넷째, 6개월 뒤 정해 둔 지표로 확대 여부를 다시 보고드리겠습니다.\n" +
    "직원들은 이미 AI를 쓰고 있습니다. 회사가 그 흐름을 통제하고 자산으로 쌓을지, 밖으로 흘려보낼지를 결정하는 자리입니다. 감사합니다.\n" +
    "예상 질문: 비용 근거는? → 근거 문서 6장, 견적으로 확정 예정. 왜 상용 제품을 안 쓰나? → 사내 ERP·MES 연결과 데이터 통제. 실패하면? → 6개월 뒤 지표 미달 시 확대하지 않으며 손실은 파일럿 비용으로 제한."
  );
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  if (process.env.APPLY_THEME) {
    const { applyTheme } = require(process.env.APPLY_THEME);
    await applyTheme(OUT, THEME);
  } else {
    console.warn("APPLY_THEME가 지정되지 않아 테마 색상을 적용하지 않았습니다 (기본 Office 팔레트로 보임).");
  }
  console.log("written", OUT);
})();
