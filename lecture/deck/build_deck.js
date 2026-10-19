// 강의 슬라이드 덱 생성: 중소기업 MES와 AI 공장장 (50분, 발표 35분 + MES 데모 15분)
// 사용법: node build_deck.js [출력 파일]   (pptxgenjs 필요, apply_theme.js 경로는 APPLY_THEME 환경 변수로 지정 가능)
const path = require("path");
const pptxgen = require("pptxgenjs");

const OUT = process.argv[2] || path.join(__dirname, "..", "mes-ai-plant-manager.pptx");
const IMG = path.join(__dirname, "..", "images");

const THEME = {
  name: "MES AI Plant Manager",
  headFontFace: "Malgun Gothic",
  bodyFontFace: "Malgun Gothic",
  colors: {
    dk1: "1E293B", lt1: "FFFFFF", dk2: "0F172A", lt2: "F1F5F9",
    accent1: "F59E0B", // 앰버: 강조, AI 공장장
    accent2: "0E7490", // 청록: MES
    accent3: "64748B", // 슬레이트: 보조 텍스트
    accent4: "DC2626", // 빨강: 쓰기·경고
    accent5: "16A34A", // 초록: 읽기·정상
    accent6: "7C3AED", // 보라: 모델
    hlink: "0E7490", folHlink: "7C3AED",
  },
};
const HEX_BORDER = "CBD5E1";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.title = "중소기업 MES와 AI 공장장";
pres.author = "tech-review";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ── 레이아웃 ─────────────────────────────────────────────────────────────
pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", align: "left", x: 0.8, y: 1.9, w: 11.7, h: 1.5, fontSize: 40, bold: true, color: C.background1, valign: "bottom", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.55, w: 11.7, h: 1.0, fontSize: 20, color: C.accent1, valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "SECTION_DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 2.55, w: 8, h: 0.55, fontSize: 18, bold: true, color: C.accent1, margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", align: "left", x: 0.8, y: 3.1, w: 11.7, h: 1.2, fontSize: 40, bold: true, color: C.background1, valign: "top", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.3, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.accent3 },
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", align: "left", x: 0.6, y: 0.35, w: 12.1, h: 0.8, fontSize: 32, bold: true, color: C.text1, valign: "middle", margin: 0 }, text: "" } },
    { text: { text: "중소기업 MES와 AI 공장장", options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: C.accent3, margin: 0 } } },
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
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.08, fill: { color: fill },
    line: line ? { color: line, width: 1.25 } : { type: "none" }, objectName: nm("card"),
  });
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
function divider(label, title, section, notes) {
  pres.addSection({ title: section });
  const s = pres.addSlide({ masterName: "SECTION_DARK", sectionTitle: section });
  s.addText(label, { placeholder: "body" });
  s.addText(title, { placeholder: "title" });
  s.addNotes(notes);
  return s;
}
const hdr = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text1 }, valign: "middle" } });

// ═════════════════════════════════════════════════════════════════════════
// 오프닝
// ═════════════════════════════════════════════════════════════════════════
pres.addSection({ title: "오프닝" });
{
  const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "오프닝" });
  s.addText("중소기업 MES 위에 AI 공장장을 얹는다", { placeholder: "title" });
  s.addText("어떤 분야에서 AI를 어떻게 활용할 것인가 · IT 엔지니어를 위한 50분", { placeholder: "body" });
  const parts = ["MES 개관", "MES 데모", "AI 활용 지도", "AI 공장장", "아키텍처"];
  parts.forEach((p, i) => {
    const x = 0.8 + i * 2.38;
    card(s, x, 5.35, 2.18, 0.62, C.text1);
    txt(s, `${i + 1}  ${p}`, { x: x + 0.2, y: 5.35, w: 1.9, h: 0.62, fontSize: 15, color: C.background1, valign: "middle" });
  });
  s.addNotes(
    "[0:00] 인사와 자기소개.\n" +
    "오늘 50분은 다섯 부분입니다. 중소기업 MES를 짧게 훑고, 15분 동안 실제 MES를 보여드린 뒤, 모듈별로 AI를 어디에 붙일지, 그리고 그것들을 하나로 묶는 'AI 공장장'이라는 개념과 아키텍처를 이야기합니다.\n" +
    "청중이 IT 엔지니어이므로 끝에는 'AI-ready MES 체크리스트'라는 실무 결과물을 드립니다."
  );
}
{
  const s = content("MES의 진짜 문제는 기능이 아니다", "오프닝");
  txt(s, "“여러분이 만든 MES 대시보드, 현장에서 몇 명이나 볼까요?”", { x: 0.6, y: 1.3, w: 12.1, h: 0.5, fontSize: 20, italic: true, color: C.accent2 });
  const cols = [
    { x: 0.6, title: "입력되지 않는 데이터", items: ["실적을 몰아서 늦게 입력", "'기타' 불량 남발, 원인 미기록", "비가동 사유 칸이 비어 있음"], ai: "음성·사진 입력 · 수집 보완 · 이상 탐지" },
    { x: 6.85, title: "아무도 보지 않는 대시보드", items: ["화면은 많지만 매일 보는 사람은 소수", "모듈마다 따로 놀아 원인이 안 보임", "숫자는 있는데 '그래서 뭘 하라고?'"], ai: "아침 브리핑 · 자연어 질의 · 원인 분석 · 추천" },
  ];
  cols.forEach((c, i) => {
    card(s, c.x, 2.05, 5.85, 4.65);
    badge(s, c.x + 0.35, 2.35, String(i + 1));
    txt(s, c.title, { x: c.x + 1.0, y: 2.35, w: 4.6, h: 0.46, fontSize: 22, bold: true, valign: "middle" });
    txt(s, c.items.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < c.items.length - 1 } })),
      { x: c.x + 0.4, y: 3.05, w: 5.1, h: 1.65, fontSize: 16, paraSpaceAfter: 8 });
    card(s, c.x + 0.35, 4.95, 5.15, 1.45, C.background1, C.accent1);
    txt(s, "AI가 고치는 방법", { x: c.x + 0.6, y: 5.1, w: 4.7, h: 0.35, fontSize: 13, bold: true, color: C.accent1 });
    txt(s, c.ai, { x: c.x + 0.6, y: 5.5, w: 4.7, h: 0.75, fontSize: 15, bold: true });
  });
  s.addNotes(
    "[0:01] 질문으로 시작합니다. 손을 들어보게 해도 좋습니다.\n" +
    "중소기업 MES의 가장 큰 문제는 기능이 아니라 두 끝입니다. 입력 쪽은 데이터가 제때, 제대로 들어오지 않고, 활용 쪽은 대시보드를 아무도 보지 않습니다.\n" +
    "AI는 양쪽을 모두 고칠 수 있습니다. 입력 쪽은 음성·사진 입력과 이상 탐지로, 활용 쪽은 브리핑과 질의, 원인 분석으로. 이 두 끝이 오늘 강의의 프레임입니다."
  );
}
{
  const s = content("MES는 몸과 신경, AI 공장장은 두뇌", "오프닝");
  const layers = [
    { y: 1.5, fill: C.accent1, color: C.text2, t: "AI 공장장 · 두뇌", d: "판단 · 연결 · 권고 · 학습" },
    { y: 3.05, fill: C.accent2, color: C.background1, t: "MES · 몸과 신경", d: "기록 · 집계 · 실행 · 추적" },
    { y: 4.6, fill: C.text1, color: C.background1, t: "현장 · 손과 발", d: "설비 · 작업자 · 로봇 · 센서" },
  ];
  layers.forEach((l) => {
    card(s, 0.6, l.y, 6.0, 1.3, l.fill);
    txt(s, l.t, { x: 0.95, y: l.y + 0.2, w: 5.4, h: 0.5, fontSize: 22, bold: true, color: l.color });
    txt(s, l.d, { x: 0.95, y: l.y + 0.72, w: 5.4, h: 0.4, fontSize: 15, color: l.color });
  });
  const pts = [
    ["AI는 MES를 대체하지 않는다", "MES는 기록 시스템으로 그대로 둔다"],
    ["MES 데이터를 판단과 행동으로 잇는다", "보는 화면이 아니라 말을 거는 시스템"],
    ["오늘의 질문", "MES를 AI가 쓸 수 있게(AI-ready) 만들려면 무엇을 설계해야 하나?"],
  ];
  pts.forEach((p, i) => {
    const y = 1.5 + i * 1.55;
    badge(s, 7.2, y + 0.05, String(i + 1));
    txt(s, p[0], { x: 7.85, y, w: 4.85, h: 0.5, fontSize: 19, bold: true, valign: "middle" });
    txt(s, p[1], { x: 7.85, y: y + 0.55, w: 4.85, h: 0.8, fontSize: 15, color: C.accent3 });
  });
  s.addNotes(
    "[0:02] 오늘의 핵심 메시지입니다. MES는 공장의 몸과 신경, AI 공장장은 그 위에 얹히는 두뇌입니다.\n" +
    "AI는 MES를 대체하지 않습니다. MES 데이터가 판단과 행동으로 이어지게 만듭니다.\n" +
    "그래서 IT 엔지니어에게 남는 질문은 하나입니다. 우리가 만드는 MES를 AI가 쓸 수 있게 하려면 무엇을 설계해야 하는가. 마지막에 체크리스트로 답합니다."
  );
}

// ═════════════════════════════════════════════════════════════════════════
// PART 1 · MES 개관
// ═════════════════════════════════════════════════════════════════════════
const P1 = "PART 1 MES 개관";
divider("PART 1", "중소기업 MES 개관", P1, "[0:03] 첫 번째 부분: 중소기업 MES의 모듈과 데이터, 그리고 시간 계층. 8분.");
{
  const s = content("중소기업 MES 모듈 지도", P1);
  card(s, 0.6, 1.3, 12.1, 0.7, C.background2);
  txt(s, "기준정보   품목 · BOM · 공정/라우팅 · 설비 · 작업자 · 거래처 · 불량코드", { x: 0.9, y: 1.3, w: 11.6, h: 0.7, fontSize: 16, bold: true, valign: "middle" });
  const flow = ["영업·수주", "생산계획·작업지시", "작업실적(POP)", "품질검사", "출하"];
  const fw = 2.04, gap = 0.47;
  flow.forEach((f, i) => {
    const x = 0.6 + i * (fw + gap);
    card(s, x, 2.35, fw, 0.85, C.background1, C.accent2);
    txt(s, f, { x, y: 2.35, w: fw, h: 0.85, fontSize: 15, bold: true, align: "center", valign: "middle" });
    if (i < flow.length - 1) arrowR(s, x + fw + 0.06, 2.775, gap - 0.12, C.accent2);
  });
  const sub = [[1, "자재·재고 (LOT)"], [2, "설비·비가동"], [3, "불량·클레임"]];
  sub.forEach(([i, t]) => {
    const x = 0.6 + i * (fw + gap);
    arrowD(s, x + fw / 2, 3.25, 0.4, C.accent3);
    card(s, x, 3.7, fw, 0.75, C.background2);
    txt(s, t, { x, y: 3.7, w: fw, h: 0.75, fontSize: 14, bold: true, align: "center", valign: "middle" });
  });
  card(s, 0.6, 4.8, 7.6, 0.75, C.background2);
  txt(s, "모니터링·KPI   생산현황 · OEE · 불량률 · 납기", { x: 0.9, y: 4.8, w: 7.2, h: 0.75, fontSize: 15, valign: "middle" });
  card(s, 8.45, 4.8, 4.25, 0.75, C.background2);
  txt(s, "추적성   LOT 역추적", { x: 8.75, y: 4.8, w: 3.9, h: 0.75, fontSize: 15, valign: "middle" });
  card(s, 0.6, 5.85, 12.1, 0.8, C.text1);
  txt(s, "데이터 수집   POP 단말 · 바코드/QR · PLC/센서 (OPC UA, Modbus) · 수기 입력", { x: 0.9, y: 5.85, w: 11.6, h: 0.8, fontSize: 15, bold: true, color: C.background1, valign: "middle" });
  s.addNotes(
    "[0:04] 중소기업 MES는 보통 ERP 기능 일부(수주, 구매)까지 포함합니다.\n" +
    "가운데 흐름이 핵심입니다: 수주 → 계획·작업지시 → 실적(POP) → 품질검사 → 출하. 그 아래로 자재·재고, 설비·비가동, 불량·클레임이 붙고, 위에는 기준정보, 아래에는 데이터 수집이 깔립니다.\n" +
    "곧 데모에서 이 모듈들을 실제 화면으로 보게 됩니다."
  );
}
{
  const s = content("모듈마다 데이터 품질 문제가 다르다", P1);
  const rows = [
    [hdr("모듈"), hdr("핵심 데이터"), hdr("데이터 품질 문제 (중소기업 현실)")],
    ["기준정보", "품목, BOM, 표준 사이클타임", "표준값이 실제와 다름, 개정 누락"],
    ["생산계획·작업지시", "작업지시, 우선순위", "엑셀로 따로 관리, 현장에서 순서를 임의로 바꿈"],
    ["작업실적(POP)", "시작·종료, 수량, 작업자", "몰아서 입력, 누락, 시간 부정확"],
    ["품질", "검사 결과, 불량 유형", "'기타' 불량 남발, 원인 미기록"],
    ["설비", "가동·비가동, 보전 이력", "비가동 사유 미입력, 정비 내용이 자유 서술"],
    ["자재·재고", "입출고, LOT", "실물과 전산 재고의 불일치"],
  ];
  s.addTable(rows, {
    x: 0.6, y: 1.35, w: 12.1, colW: [2.6, 3.6, 5.9], rowH: 0.66, fontSize: 15, color: C.text1,
    border: { type: "solid", pt: 0.75, color: HEX_BORDER }, valign: "middle", margin: [0, 0.12, 0, 0.12], objectName: nm("table"),
  });
  card(s, 0.6, 6.2, 12.1, 0.6, C.background1, C.accent1);
  txt(s, "AI 판단 품질의 상한은 MES 데이터 품질이다", { x: 0.9, y: 6.2, w: 11.6, h: 0.6, fontSize: 17, bold: true, color: C.text1, valign: "middle" });
  s.addNotes(
    "[0:06] 각 모듈의 데이터가 현실에서 어떻게 망가지는지 보는 표입니다. 여러분도 다 겪어 보셨을 겁니다.\n" +
    "이 표가 중요한 이유: AI는 이 데이터 위에서 판단합니다. 그래서 AI 판단 품질의 상한은 MES 데이터 품질입니다. 뒤에서 '입력 쪽 AI'가 왜 먼저인지 이 표로 다시 돌아옵니다."
  );
}
{
  const s = content("AI가 들어갈 시간대는 따로 있다", P1);
  const rows = [
    ["ms ~ 초", "PLC · 설비 제어 · 안전", "AI가 관여하지 않음", false],
    ["초 ~ 분", "MES 실시간 처리 (실적 수집, 알람)", "이상 감지 ML 정도", false],
    ["분 ~ 일", "운영 판단 (재계획, 원인 분석, 정비 일정)", "LLM 에이전트 = AI 공장장의 영역", true],
    ["주 ~ 월", "계획 · 개선 · 보고", "최적화 + LLM", false],
  ];
  txt(s, "시간", { x: 0.9, y: 1.35, w: 2, h: 0.35, fontSize: 13, bold: true, color: C.accent3 });
  txt(s, "담당", { x: 3.2, y: 1.35, w: 5, h: 0.35, fontSize: 13, bold: true, color: C.accent3 });
  txt(s, "AI 역할", { x: 8.5, y: 1.35, w: 4, h: 0.35, fontSize: 13, bold: true, color: C.accent3 });
  rows.forEach(([t, who, ai, hot], i) => {
    const y = 1.8 + i * 1.2;
    card(s, 0.6, y, 12.1, 1.0, hot ? C.accent1 : C.background2);
    txt(s, t, { x: 0.9, y, w: 2.1, h: 1.0, fontSize: 22, bold: true, color: hot ? C.text2 : C.text1, valign: "middle" });
    txt(s, who, { x: 3.2, y, w: 5.1, h: 1.0, fontSize: 16, color: C.text1, valign: "middle" });
    txt(s, ai, { x: 8.5, y, w: 4.0, h: 1.0, fontSize: 16, bold: true, color: hot ? C.text2 : C.accent3, valign: "middle" });
  });
  txt(s, "실시간 제어와 안전은 PLC와 MES가 맡는다. LLM은 분 단위 이상의 판단에만 쓴다", { x: 0.6, y: 6.6, w: 12.1, h: 0.35, fontSize: 14, italic: true, color: C.accent3 });
  s.addNotes(
    "[0:08] IT 엔지니어에게 꼭 필요한 관점입니다. 공장의 일은 시간 단위가 다르고, 시간 단위마다 맞는 기술이 다릅니다.\n" +
    "밀리초~초는 PLC와 안전 시스템의 영역이라 AI가 들어가면 안 됩니다. 초~분은 MES의 실시간 처리, AI는 기껏해야 이상 감지 ML.\n" +
    "분~일, 즉 재계획, 원인 분석, 정비 일정 같은 운영 판단이 LLM 에이전트, 오늘 이야기할 AI 공장장의 영역입니다."
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MES 데모
// ═════════════════════════════════════════════════════════════════════════
pres.addSection({ title: "MES 데모" });
{
  const s = pres.addSlide({ masterName: "SECTION_DARK", sectionTitle: "MES 데모" });
  s.addText("LIVE DEMO · 15분", { placeholder: "body" });
  s.addText("멈춤 지점 = AI가 들어갈 자리", { placeholder: "title" });
  const stops = [
    ["작업지시·생산계획", "긴급 주문이 오면 이 순서를 누가 다시 짜나?"],
    ["작업실적·불량 입력", "'기타 불량'이 쌓이면 원인은 영영 모른다"],
    ["설비 비가동", "알람 이력과 정비 이력이 따로 논다"],
    ["모니터링 대시보드", "보는 화면에서 말을 거는 시스템으로"],
  ];
  stops.forEach(([t, d], i) => {
    const x = 0.8 + i * 2.98;
    card(s, x, 4.55, 2.78, 1.95, C.text1);
    badge(s, x + 0.25, 4.75, String(i + 1));
    txt(s, t, { x: x + 0.85, y: 4.75, w: 1.8, h: 0.46, fontSize: 14, bold: true, color: C.background1, valign: "middle" });
    txt(s, d, { x: x + 0.25, y: 5.4, w: 2.35, h: 0.95, fontSize: 13, color: "E2E8F0" });
  });
  s.addNotes(
    "[0:11] 데모 시작. 데모 중 네 곳에서 30초씩 멈춥니다.\n" +
    "① 작업지시 화면: '지금 긴급 주문이 들어오면, 이 순서를 누가 어떻게 다시 짤까요?' → 뒤의 시나리오 ①\n" +
    "② 실적·불량 입력: '여기 기타 불량이 쌓이면, 원인은 영영 모릅니다.' → 입력 쪽 AI, 시나리오 ②\n" +
    "③ 설비 비가동: '비가동 사유 칸이 비어 있죠. 알람 이력과 정비 이력은 따로 놉니다.' → 알람 진단\n" +
    "④ 대시보드: '이 화면을 매일 아침 보는 사람이 있다면, AI 공장장은 그 사람에게 먼저 말을 거는 대시보드입니다.' → 아침 브리핑\n" +
    "시간 관리: 세부 기능은 건너뛰고 멈춤 지점 네 곳만 확실히. [0:26]에 데모 종료."
  );
}

// ═════════════════════════════════════════════════════════════════════════
// PART 2 · AI 활용 지도
// ═════════════════════════════════════════════════════════════════════════
const P2 = "PART 2 AI 활용 지도";
divider("PART 2", "모듈별 AI 활용 지도", P2, "[0:26] 데모에서 멈췄던 자리에 어떤 AI를 어떤 수준으로 붙일지 정리합니다. 7분.");
{
  const s = content("어느 모듈에 어떤 AI를 어떤 수준으로", P2);
  const rows = [
    [hdr("MES 모듈"), hdr("AI 기술"), hdr("활용 예"), hdr("자율성"), hdr("난이도")],
    ["기준정보", "통계, LLM", "표준 vs 실적 사이클타임 차이 탐지, 갱신 제안", "L2", "낮음 ★"],
    ["생산계획", "솔버 + LLM", "긴급 주문 재계획 시나리오, 납기 영향 설명", "L2~L3", "중간"],
    ["작업실적(POP)", "음성·비전, 이상 탐지", "말·사진으로 실적 입력, 누락·이상값 경고", "L1~L2", "낮음"],
    ["품질", "ML, LLM, RAG", "불량 급증 시 4M 원인 후보, 8D 초안", "L2", "중간"],
    ["설비", "이상 감지, RAG", "알람 원인 진단, 매뉴얼 기반 조치 가이드", "L2", "중간"],
    ["자재·재고", "예측, LLM", "결품 위험 경고, 발주 제안", "L2", "중간"],
    ["모니터링", "LLM", "아침 브리핑, 교대 보고서, 자연어 질의", "L1", "낮음 ★"],
  ];
  const hot = new Set([1, 7]);
  const body = rows.map((r, i) => i === 0 ? r : r.map((c) => ({ text: c, options: hot.has(i) ? { fill: { color: "FEF3C7" }, bold: true } : {} })));
  s.addTable(body, {
    x: 0.6, y: 1.3, w: 12.1, colW: [2.0, 2.4, 5.5, 1.1, 1.1], rowH: 0.62, fontSize: 14, color: C.text1,
    border: { type: "solid", pt: 0.75, color: HEX_BORDER }, valign: "middle", margin: [0, 0.1, 0, 0.1], objectName: nm("table"),
  });
  txt(s, "★ 읽기 전용이라 위험이 낮고 효과가 바로 보이는 출발점", { x: 0.6, y: 6.4, w: 12.1, h: 0.4, fontSize: 14, color: C.accent3 });
  s.addNotes(
    "[0:27] 모듈별 AI 활용 지도입니다. 자율성은 L1 참모, L2 추천, L3 승인형 실행입니다(뒤에서 설명).\n" +
    "강조 표시한 두 줄, 기준정보와 모니터링이 출발점입니다. 둘 다 읽기 전용이라 위험이 낮고 바로 효과가 보입니다.\n" +
    "생산계획은 솔버가 계산하고 LLM은 설명합니다. 품질과 설비는 RAG와 이상 감지가 결합됩니다."
  );
}
{
  const s = content("핵심 통찰 세 가지", P2);
  const ins = [
    ["가장 쉬운 곳에서 효과가 가장 크다", "브리핑, 자연어 질의, 기준정보 보정은 읽기 전용이라 위험이 낮고 바로 체감된다"],
    ["가치는 모듈 사이에 있다", "실적 + 품질 + 설비 + 자재를 엮을 때 AI의 가치가 커진다. 그래서 'AI 공장장'이 필요하다"],
    ["AI 품질의 상한은 MES 데이터 품질이다", "입력 쪽 AI(음성·사진 입력, 이상 탐지)가 결국 활용 쪽 AI의 성능을 끌어올린다"],
  ];
  ins.forEach(([t, d], i) => {
    const x = 0.6 + i * 4.15;
    card(s, x, 1.5, 3.8, 5.0);
    txt(s, String(i + 1), { x: x + 0.35, y: 1.75, w: 1.2, h: 1.1, fontSize: 60, bold: true, color: C.accent1 });
    txt(s, t, { x: x + 0.35, y: 3.0, w: 3.1, h: 1.2, fontSize: 22, bold: true });
    txt(s, d, { x: x + 0.35, y: 4.35, w: 3.1, h: 1.9, fontSize: 17, color: C.accent3 });
  });
  s.addNotes(
    "[0:31] 지도를 세 문장으로 줄이면 이렇습니다.\n" +
    "첫째, 쉬운 곳에서 효과가 가장 큽니다. 둘째, 가치는 모듈 사이에 있습니다. 하나의 모듈 안에서는 안 보이던 것이 모듈을 엮으면 보입니다. 이것이 바로 AI 공장장이 필요한 이유이고, 다음 파트로 넘어가는 다리입니다.\n" +
    "셋째, AI 품질의 상한은 데이터 품질입니다."
  );
}

// ═════════════════════════════════════════════════════════════════════════
// PART 3 · AI 공장장
// ═════════════════════════════════════════════════════════════════════════
const P3 = "PART 3 AI 공장장";
divider("PART 3", "AI 공장장: 개념과 시나리오", P3, "[0:33] 오늘의 절정. 모듈을 엮어 판단하는 AI 공장장. 10분.");
{
  const s = content("AI 공장장이란", P3);
  card(s, 0.6, 1.35, 5.6, 5.3);
  txt(s, "정의", { x: 0.95, y: 1.6, w: 5, h: 0.4, fontSize: 15, bold: true, color: C.accent1 });
  txt(s, "공장장의 판단 루프를 공장 전체 범위에서 수행하는 AI", { x: 0.95, y: 2.05, w: 4.95, h: 1.0, fontSize: 21, bold: true });
  const loop = ["상황 파악", "진단", "판단", "검증", "지시", "학습"];
  loop.forEach((l, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.95 + col * 1.65, y = 3.35 + row * 0.85;
    card(s, x, y, 1.45, 0.6, C.background1, C.accent2);
    txt(s, l, { x, y, w: 1.45, h: 0.6, fontSize: 15, bold: true, align: "center", valign: "middle" });
  });
  txt(s, "최종 책임은 사람에게 있다", { x: 0.95, y: 5.3, w: 4.95, h: 0.4, fontSize: 16, bold: true, color: C.accent4 });
  txt(s, "정책: 과기정통부·중기부 '모두의 AI 공장장' (2026.09)", { x: 0.95, y: 5.8, w: 4.95, h: 0.6, fontSize: 13, color: C.accent3 });

  txt(s, "자율성 단계", { x: 6.7, y: 1.4, w: 5, h: 0.4, fontSize: 15, bold: true, color: C.accent1 });
  const lv = [["L1", "참모", true], ["L2", "추천", true], ["L3", "승인형 실행", true], ["L4", "조건부 자율", false], ["L5", "다크팩토리", false]];
  lv.forEach(([k, n, now], i) => {
    const w = 1.08, x = 6.7 + i * 1.2, h = 1.0 + i * 0.75, y = 6.0 - h;
    card(s, x, y, w, h, now ? C.accent1 : (i === 3 ? "FDE68A" : C.background2));
    txt(s, k, { x, y: y + 0.12, w, h: 0.4, fontSize: 18, bold: true, align: "center", color: C.text2 });
    txt(s, n, { x: x + 0.05, y: y + 0.52, w: w - 0.1, h: 0.45, fontSize: 12, align: "center", color: C.text2 });
  });
  txt(s, "지금 현실: L1~L3", { x: 6.7, y: 6.15, w: 3.5, h: 0.4, fontSize: 15, bold: true, color: C.accent1 });
  txt(s, "L5는 2028~2030년 목표 (정부·삼성)", { x: 9.6, y: 6.15, w: 3.1, h: 0.4, fontSize: 12, color: C.accent3, align: "right" });
  s.addNotes(
    "[0:33] AI 공장장은 공장장이 매일 하는 판단 루프, 상황 파악 → 진단 → 판단 → 검증 → 지시 → 학습을 공장 전체 범위에서 수행하는 AI입니다. 최종 책임은 사람에게 남습니다.\n" +
    "자율성은 다섯 단계로 봅니다. 지금 현실은 L1~L3, 즉 참모, 추천, 승인형 실행입니다. L5 다크팩토리는 정부가 2028~29년, 삼성이 2030년을 목표로 두고 있습니다.\n" +
    "정부가 2026년 9월에 '모두의 AI 공장장'이라는 이름으로 중소기업 지원 사업을 시작했습니다(강의 직전 최신 보도 확인)."
  );
}
{
  const s = content("AI 공장장의 하루", P3);
  txt(s, "가상의 중소기업 · 직원 60명 · 자동차 부품 사출·조립 2차 협력사", { x: 0.6, y: 1.25, w: 12.1, h: 0.4, fontSize: 14, color: C.accent3 });
  const day = [
    ["06:30", "야간 정리", "야간 근무조\n실적·불량·비가동\n정리", "실적 · 품질 · 설비"],
    ["07:00", "아침 브리핑", "전일 실적\n당일 생산·출하 집계\n출하 충족 여부\n오늘의 위험", "계획 · 실적 · 출하 · 재고"],
    ["09:40", "알람 진단", "매뉴얼·정비 이력\n→ 원인 후보\n→ 조치 가이드", "설비 + RAG"],
    ["10:15", "긴급 주문", "재계획 시나리오\n3개 → 승인\n→ 작업지시 반영", "수주 · 계획 · 자재"],
    ["15:30", "불량 급증", "4M 원인 분석\n→ 금형 온도\n편차 의심", "품질 · 실적 · LOT"],
    ["18:00", "교대 보고", "교대 보고서\n미결 사항 인계", "전체"],
  ];
  s.addShape(pres.shapes.LINE, { x: 0.9, y: 2.25, w: 11.5, h: 0, line: { color: C.accent3, width: 2 }, objectName: nm("timeline") });
  day.forEach(([t, h, d, m], i) => {
    const x = 0.6 + i * 2.05, hot = i === 1;
    s.addShape(pres.shapes.OVAL, { x: x + 0.72, y: 2.07, w: 0.36, h: 0.36, fill: { color: hot ? C.accent1 : C.accent2 }, line: { type: "none" }, objectName: nm("dot") });
    card(s, x, 2.7, 1.85, 4.05, hot ? "FEF3C7" : C.background2, hot ? C.accent1 : undefined);
    txt(s, t, { x: x + 0.18, y: 2.85, w: 1.5, h: 0.45, fontSize: 20, bold: true, color: hot ? C.accent1 : C.accent2 });
    txt(s, h, { x: x + 0.18, y: 3.35, w: 1.55, h: 0.45, fontSize: 16, bold: true });
    txt(s, d, { x: x + 0.18, y: 3.85, w: 1.55, h: 1.9, fontSize: 14 });
    txt(s, m, { x: x + 0.18, y: 5.85, w: 1.55, h: 0.75, fontSize: 11, color: C.accent3 });
  });
  s.addNotes(
    "[0:35] 가상의 중소기업에서 AI 공장장의 하루를 따라가 봅니다. 데모 MES의 샘플 데이터와 같은 회사로 맞추면 이야기가 이어집니다.\n" +
    "아래 회색 글씨가 각 장면에서 쓰는 MES 모듈입니다. 거의 모든 장면이 모듈 여러 개를 엮는다는 점을 짚어 주세요.\n" +
    "07:00 아침 브리핑을 다음 장에서 실제 화면으로 보여드립니다."
  );
}
{
  const s = content("07:00 아침 브리핑", P3);
  card(s, 0.6, 1.3, 7.7, 5.45, C.background1, C.text1);
  txt(s, "10월 20일(화) 아침 브리핑 · AI 공장장 · 07:00 기준", { x: 0.9, y: 1.45, w: 7.2, h: 0.4, fontSize: 15, bold: true });
  txt(s, "1. 전일 실적 (10/19)", { x: 0.9, y: 1.95, w: 7, h: 0.3, fontSize: 12, bold: true, color: C.accent2 });
  const bopt = { x: 0.9, w: 7.1, fontSize: 12, color: C.text1, border: { type: "solid", pt: 0.5, color: HEX_BORDER }, valign: "middle", margin: [0, 0.08, 0, 0.08], align: "right" };
  const th = (t) => ({ text: t, options: { bold: true, fill: { color: C.background2 } } });
  s.addTable([[th("구분"), th("계획"), th("실적"), th("달성률")], ["생산", "12,000", "11,280", "94.0%"], ["출하", "9,500", "9,500", "100%"]],
    { ...bopt, y: 2.3, colW: [1.6, 1.8, 1.8, 1.9], rowH: 0.3, objectName: nm("table") });
  txt(s, "2. 금일 계획 (10/20)", { x: 0.9, y: 3.35, w: 7, h: 0.3, fontSize: 12, bold: true, color: C.accent2 });
  const warn = { text: "부족 200", options: { bold: true, color: C.accent4 } };
  s.addTable([
    [th("품목"), th("생산 계획"), th("출하 예정"), th("완제품 재고"), th("출하 충족")],
    ["A-101 (사출)", "5,000", "4,800", "1,200", "여유 1,400"],
    ["B-205 (조립)", "3,000", "3,500", "300", warn],
    ["C-310 (사출)", "4,000", "2,000", "2,500", "여유 4,500"],
    [th("합계"), th("12,000"), th("10,300"), th(""), th("")],
  ], { ...bopt, y: 3.7, colW: [1.6, 1.35, 1.35, 1.4, 1.4], rowH: 0.3, objectName: nm("table") });
  txt(s, "3. 주의 사항", { x: 0.9, y: 5.35, w: 7, h: 0.3, fontSize: 12, bold: true, color: C.accent2 });
  txt(s, [
    { text: "B-205 출하 200개 부족 예상 → 오전 중 조립2라인 우선 투입 권고", options: { bullet: true, breakLine: true, bold: true, color: C.accent4 } },
    { text: "자재 A 입고 지연 가능성 (납기 회신 미수신) → 구매팀 확인", options: { bullet: true, breakLine: true } },
    { text: "3호기 사출기 진동 상승 추세 → 점심시간 점검 권고", options: { bullet: true } },
  ], { x: 0.9, y: 5.7, w: 7.2, h: 0.95, fontSize: 12, paraSpaceAfter: 2 });

  const msg = [
    ["숫자는 MES에서", "집계는 SQL이 한다. LLM은 계산하지 않는다", C.accent5],
    ["가치는 모듈 사이에", "계획 + 출하 + 재고를 엮어야 '200개 부족'이 보인다", C.accent2],
    ["AI는 해석과 권고만", "결정은 회의에서 사람이 한다", C.accent1],
  ];
  msg.forEach(([t, d, col], i) => {
    const y = 1.3 + i * 1.85;
    card(s, 8.6, y, 4.1, 1.65, C.background2);
    badge(s, 8.85, y + 0.25, String(i + 1), col, C.background1, 0.42);
    txt(s, t, { x: 9.45, y: y + 0.22, w: 3.1, h: 0.5, fontSize: 18, bold: true, valign: "middle" });
    txt(s, d, { x: 8.9, y: y + 0.85, w: 3.6, h: 0.7, fontSize: 14, color: C.accent3 });
  });
  s.addNotes(
    "[0:37] 데모 코드가 실제로 만들어 내는 브리핑 화면입니다(가상 데이터). 가능하면 30~60초 녹화본을 여기서 보여주세요.\n" +
    "핵심은 B-205입니다. 출하 예정 3,500개인데 재고 300 + 오늘 생산 계획 3,000 = 3,300이라 200개가 부족합니다. 이 숫자는 LLM이 아니라 SQL과 코드가 계산합니다.\n" +
    "생산계획, 출하, 재고는 MES에서 서로 다른 화면입니다. 세 모듈을 엮어야 이 판단이 나옵니다.\n" +
    "읽기 전용 조회 + LLM 요약만으로 되기 때문에, 중소기업이 가장 먼저, 가장 낮은 위험으로 시작할 수 있는 기능입니다(L1)."
  );
}
{
  const s = content("시나리오 ① 긴급 주문 끼워 넣기", P3);
  const steps = [
    ["주문 접수", "“C사 긴급\n300개,\n목요일 출하”", C.background2],
    ["병렬 조회", "자재 재고\n정비 일정\n실제 사이클타임", C.background2],
    ["솔버 계산", "시나리오 3개\n· 정비 연기\n· 잔업\n· 다른 주문 연기", C.background2],
    ["비교·권고", "납기·비용·위험\n비교\n권고안 + 근거", C.background2],
    ["승인·반영", "생산관리자 승인\n→ 작업지시\n   변경\n→ 납기 회신", "FEF3C7"],
  ];
  const w = 2.15, gap = 0.34;
  steps.forEach(([t, d, f], i) => {
    const x = 0.6 + i * (w + gap);
    card(s, x, 1.6, w, 3.3, f, i === 4 ? C.accent1 : undefined);
    badge(s, x + 0.22, 1.82, String(i + 1));
    txt(s, t, { x: x + 0.22, y: 2.45, w: w - 0.4, h: 0.5, fontSize: 18, bold: true });
    txt(s, d, { x: x + 0.22, y: 3.0, w: w - 0.3, h: 1.85, fontSize: 15, color: C.text1 });
    if (i < steps.length - 1) arrowR(s, x + w + 0.04, 3.25, gap - 0.08);
  });
  const who = [["솔버", "일정 계산", C.accent2], ["LLM", "해석과 조율", C.accent1], ["사람", "결정", C.accent4]];
  who.forEach(([a, b, col], i) => {
    const x = 0.6 + i * 4.15;
    card(s, x, 5.3, 3.8, 1.3, C.background1, col);
    txt(s, a, { x: x + 0.3, y: 5.3, w: 1.3, h: 1.3, fontSize: 24, bold: true, color: col, valign: "middle" });
    txt(s, b, { x: x + 1.6, y: 5.3, w: 2.1, h: 1.3, fontSize: 18, bold: true, valign: "middle" });
  });
  s.addNotes(
    "[0:39] 데모 첫 번째 멈춤 지점의 답입니다.\n" +
    "영업에서 긴급 주문이 오면, AI 공장장이 주문을 해석하고 자재, 정비 일정, 실제 사이클타임을 동시에 조회합니다. 솔버가 시나리오 세 개를 계산하고, LLM이 납기·비용·위험을 비교해 권고안을 만듭니다. 생산관리자가 승인하면 작업지시가 바뀌고 영업에 납기가 회신됩니다.\n" +
    "역할 분담을 강조하세요: 일정 계산은 솔버, 해석과 조율은 LLM, 결정은 사람."
  );
}
{
  const s = content("시나리오 ② 불량 급증 원인 분석", P3);
  card(s, 0.6, 1.4, 4.2, 5.2, C.text1);
  txt(s, "품질 모듈 경보", { x: 0.95, y: 1.7, w: 3.6, h: 0.4, fontSize: 15, bold: true, color: C.accent1 });
  txt(s, "2×", { x: 0.95, y: 2.2, w: 3.6, h: 1.6, fontSize: 88, bold: true, color: C.background1 });
  txt(s, "오후 불량률이 평소의 두 배", { x: 0.95, y: 3.95, w: 3.6, h: 0.5, fontSize: 17, color: C.background1 });
  txt(s, "모듈 하나만 봐서는 안 보이는 원인이, 모듈을 엮으면 보인다", { x: 0.95, y: 4.8, w: 3.5, h: 1.5, fontSize: 16, bold: true, color: C.accent1 });
  const st = [
    ["품질 에이전트에 위임", "해당 시간대 LOT · 작업자 · 설비 조건 · 자재 LOT 조회 (품질 + 실적 + 설비 + 자재)"],
    ["4M 원인 후보 순위", "사람 · 기계 · 재료 · 방법 관점. 근거 데이터와 과거 유사 사례 첨부"],
    ["품질 엔지니어 검증", "예: “금형 온도 편차와 상관관계 높음” → 현장 확인"],
    ["조치와 학습", "조치 지시 → 결과를 사례로 축적 → 다음 진단 품질 향상"],
  ];
  st.forEach(([t, d], i) => {
    const y = 1.4 + i * 1.32;
    badge(s, 5.2, y + 0.1, String(i + 1), C.accent2, C.background1);
    txt(s, t, { x: 5.85, y: y + 0.05, w: 6.8, h: 0.5, fontSize: 19, bold: true, valign: "middle" });
    txt(s, d, { x: 5.85, y: y + 0.58, w: 6.8, h: 0.65, fontSize: 15, color: C.accent3 });
  });
  s.addNotes(
    "[0:41] 데모 두 번째 멈춤 지점의 답입니다.\n" +
    "품질 모듈에서 오후 불량률이 두 배로 뛰면, AI 공장장이 품질 에이전트에 일을 맡깁니다. 그 시간대의 LOT, 작업자, 설비 조건, 자재 LOT를 모두 조회해 4M 관점의 원인 후보를 근거와 함께 순위로 제시합니다.\n" +
    "결정은 품질 엔지니어가 합니다. 그리고 결과가 사례로 쌓여 다음 진단이 좋아집니다.\n" +
    "핵심 문장: 모듈 하나만 봐서는 안 보이는 원인이, 모듈을 엮으면 보인다."
  );
}

// ═════════════════════════════════════════════════════════════════════════
// PART 4 · 아키텍처
// ═════════════════════════════════════════════════════════════════════════
const P4 = "PART 4 아키텍처";
divider("PART 4", "아키텍처와 AI-ready MES", P4, "[0:43] 이제 엔지니어의 질문: 이걸 어떻게 만드나. 5분.");
{
  const s = content("MES 위에 AI 공장장을 얹는 구조", P4);
  s.addImage({ path: path.join(IMG, "architecture.png"), x: 0.6, y: 1.25, w: 6.95, h: 5.56, altText: "AI 공장장 일반 아키텍처: 사용자 채널, AI 공장장 서비스, 도구 계층, 모델 서빙, AI 전용 저장소, 기존 MES, 현장의 7계층", objectName: nm("image") });
  const pts = [
    ["읽기는 조회 템플릿으로만", "읽기 전용 계정, 숫자의 출처", C.accent5],
    ["쓰기는 사람 승인 후 API로만", "승인 대기열과 감사 로그", C.accent4],
    ["기존 MES는 교체하지 않는다", "조회 API · 쓰기 API · 이벤트만 갖춘다", C.accent2],
    ["데이터가 공장 밖으로 나가지 않는다", "Ollama/vLLM + 오픈 모델, GPU 1대로 시작", C.accent6],
  ];
  pts.forEach(([t, d, col], i) => {
    const y = 1.3 + i * 1.38;
    card(s, 7.85, y, 4.85, 1.2, C.background2);
    badge(s, 8.05, y + 0.37, String(i + 1), col, C.background1, 0.46);
    txt(s, t, { x: 8.7, y: y + 0.15, w: 3.9, h: 0.45, fontSize: 16, bold: true, valign: "middle" });
    txt(s, d, { x: 8.7, y: y + 0.62, w: 3.9, h: 0.45, fontSize: 13, color: C.accent3 });
  });
  s.addNotes(
    "[0:43] 중소기업 MES에 AI 공장장을 얹을 때의 일반적인 구성입니다. 모든 구성요소가 사내망 안에 있습니다.\n" +
    "위에서부터: 사용자 채널, AI 공장장 서비스(Python, FastAPI, LangGraph), 도구 계층(MCP 서버: MES 조회, 문서 RAG, 솔버, 실행 요청), 모델 서빙(Ollama/vLLM), AI 전용 저장소, 기존 MES, 현장.\n" +
    "초록 선은 읽기, 빨간 선은 쓰기입니다. 읽기는 조회 템플릿으로만, 쓰기는 사람 승인을 거친 뒤 API로만. 점선은 MES 이벤트가 AI 공장장을 깨우는 경로입니다."
  );
}
{
  const s = content("아침 브리핑은 시계가 아니라 데이터가 깨운다", P4);
  s.addImage({ path: path.join(IMG, "briefing-sequence.png"), x: 1.1, y: 1.3, w: 11.1, h: 4.91, altText: "아침 브리핑 처리 흐름: 스케줄러, AI 공장장, MES 조회 도구, MES DB, LLM, 공장장·팀장 사이의 9단계 시퀀스", objectName: nm("image") });
  card(s, 0.6, 6.3, 12.1, 0.55, "FEF3C7");
  txt(s, "07:00은 마감 시한일 뿐, 실제 실행 신호는 MES의 야간 실적 마감이다", { x: 0.9, y: 6.3, w: 11.6, h: 0.55, fontSize: 16, bold: true, valign: "middle" });
  s.addNotes(
    "[0:45] 아침 브리핑이 만들어지는 순서입니다. MES를 읽기 전용으로 조회하고, 출하 충족은 코드가 계산하고, LLM은 권고 문장만 쓰고, 검증 단계에서 근거 없는 숫자를 걸러냅니다.\n" +
    "누가 실행하나? 기본은 스케줄러지만, 시각만으로는 부족합니다. 야간 실적이 늦게 입력되면 틀린 브리핑이 회의에 올라갑니다. 그래서 MES 실적 마감 신호를 기다리고, 07:00까지 안 오면 '미마감 경고'를 붙여 생성합니다.\n" +
    "여러분이 받아 본 AI 비서의 아침 브리핑과 구조는 같습니다. 공장에서는 시계 대신 MES 마감이 깨운다는 점만 다릅니다."
  );
}
{
  const s = content("AI-ready MES 체크리스트", P4);
  const items = [
    ["조회 API 표준화", "get_line_status처럼 의미 있는 이름 → MCP로 노출"],
    ["이벤트 발행", "실적 · 불량 · 알람 · 마감 → MQTT, Kafka"],
    ["쓰기 API에 승인과 감사", "누가 · 무엇을 · 왜 남기기"],
    ["멱등성", "재시도해도 작업지시가 두 번 생기지 않게"],
    ["기준정보 품질 지표", "표준 vs 실제 사이클타임 차이를 관리"],
    ["자유 서술을 코드로", "불량 · 비가동 사유를 코드화"],
    ["문서 디지털화와 개정판", "작업표준서 · 매뉴얼 = RAG의 원료"],
    ["역할 기반 권한", "AI가 사용자 권한 이상을 보지 않게"],
  ];
  items.forEach(([t, d], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.15, y = 1.35 + row * 1.35;
    card(s, x, y, 5.95, 1.18, C.background2);
    badge(s, x + 0.25, y + 0.36, String(i + 1));
    txt(s, t, { x: x + 0.95, y: y + 0.14, w: 4.85, h: 0.45, fontSize: 18, bold: true, valign: "middle" });
    txt(s, d, { x: x + 0.95, y: y + 0.62, w: 4.85, h: 0.42, fontSize: 14, color: C.accent3 });
  });
  s.addNotes(
    "[0:46] 오늘의 실무 결과물입니다. 이 여덟 가지를 갖추면 어떤 AI를 붙이든 쉬워집니다.\n" +
    "1번 조회 API는 아침 브리핑을 바로 가능하게 하고, 2번 이벤트는 '데이터가 깨우는' 브리핑과 알람 진단을, 3·4번은 AI 제안을 안전하게 실행하게 합니다. 5·6번은 AI 판단 품질의 상한을 올리고, 7번은 RAG의 원료, 8번은 보안입니다.\n" +
    "오늘 돌아가서 여러분 MES에서 몇 개가 갖춰져 있는지 세어 보세요."
  );
}

// ═════════════════════════════════════════════════════════════════════════
// 마무리
// ═════════════════════════════════════════════════════════════════════════
pres.addSection({ title: "마무리" });
{
  const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "마무리" });
  s.addText("기억할 세 문장", { placeholder: "title" });
  s.addText("질문을 환영합니다", { placeholder: "body" });
  const lines = [
    "AI는 MES를 대체하지 않고, MES 위의 두뇌가 된다",
    "숫자는 MES와 솔버에서, 해석과 연결은 LLM이, 결정은 사람이",
    "AI-ready MES는 오늘 설계할 수 있다: API · 이벤트 · 승인 · 기준정보 품질",
  ];
  lines.forEach((l, i) => {
    const y = 4.5 + i * 0.85;
    badge(s, 0.8, y + 0.04, String(i + 1));
    txt(s, l, { x: 1.5, y, w: 11, h: 0.55, fontSize: 20, bold: true, color: C.background1, valign: "middle" });
  });
  s.addNotes(
    "[0:48] 세 문장으로 마무리합니다.\n" +
    "예상 질문:\n" +
    "· 보안은? 온프레미스 LLM이라 데이터가 공장 밖으로 나가지 않습니다. AI 계정은 읽기 전용, 쓰기는 승인 후에만.\n" +
    "· GPU 비용은? 24~32GB GPU 1장 서버로 시작할 수 있습니다. 브리핑 같은 요약은 작은 모델로도 충분합니다.\n" +
    "· 기존 MES를 바꿔야 하나? 아닙니다. 조회 API와 MCP로 얹습니다.\n" +
    "· 환각은? 숫자는 MES 도구에서만, 출처 표시, 근거 없는 수치는 검증 단계에서 차단, 실행은 승인 후.\n" +
    "· 어디서부터? 아침 브리핑, 자연어 질의 같은 읽기 전용 L1부터."
  );
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  const applyThemePath = process.env.APPLY_THEME;
  if (applyThemePath) {
    const { applyTheme } = require(applyThemePath);
    await applyTheme(OUT, THEME);
  } else {
    console.warn("APPLY_THEME가 지정되지 않아 테마 색상을 적용하지 않았습니다 (기본 Office 팔레트로 보임).");
  }
  console.log("written", OUT);
})();
