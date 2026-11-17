// 경영진 보고 덱 v2: 사내 AI 에이전트 플랫폼 도입 제안
// v1(build_deck.js) 대비: 표지 부서 8개, 한 장 요약을 현행 → 제안(AS-IS/TO-BE) 형식으로 바꾸고 당위성 장표를 합침,
// 대표 시나리오 3가지 요약표(품질·영업·회계), 내 에이전트·관리 절차 장표 추가
// 사용법: node build_deck_v2.js [출력 파일]   (pptxgenjs 필요, 테마 적용 도구 경로는 APPLY_THEME 환경 변수)
// 근거 문서: ../ai-agent-platform-proposal.md (숫자와 출처는 이 문서와 같아야 한다)
const path = require("path");
const pptxgen = require("pptxgenjs");

const OUT = process.argv[2] || path.join(__dirname, "..", "ai-agent-platform-proposal-v2.pptx");
const IMG = path.join(__dirname, "..", "images");

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
function content(title, section, o = {}) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(o.fontSize ? [{ text: title, options: { fontSize: o.fontSize } }] : title, { placeholder: "title", ...o });
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
  const tags = ["회계", "영업", "생산", "보전", "품질", "구매", "개발", "일상 업무"];
  tags.forEach((t, i) => {
    const x = 0.8 + i * 1.47;
    card(s, x, 5.2, 1.35, 0.62, C.text1);
    txt(s, t, { x, y: 5.2, w: 1.35, h: 0.62, fontSize: 15, bold: true, color: C.background1, align: "center", valign: "middle" });
  });
  s.addNotes(
    "오늘 드릴 말씀은 하나입니다. 직원들은 이미 AI를 쓰고 있습니다. 문제는 쓰느냐가 아니라, 회사가 통제하고 쌓아 가는 방식으로 쓰느냐입니다.\n" +
    "그래서 직원 누구나 화면에서 자기 업무용 AI 에이전트를 만들고 실행하고 공유하는 사내 플랫폼을 제안합니다. 회계, 영업, 생산, 보전, 품질, 구매, 개발, 일상 업무까지 하나의 기반 위에서 씁니다.\n" +
    "결론부터 말씀드리면, 오늘 요청드리는 것은 전체 투자가 아니라 6개월, 1억 원 이하(약 0.95억 원) 규모의 1단계 파일럿 승인입니다."
  );
}
{
  const s = content("한 장 요약: 문제점 분석 및 제안", S1);
  const T = HEX.accent2, R = HEX.accent4;
  txt(s, [
    { text: "직원이 " }, { text: "자기 업무용 AI 에이전트", options: { bold: true, color: T } }, { text: "를 직접 만들고, " },
    { text: "회사 데이터", options: { bold: true, color: T } }, { text: "에 연결해, " },
    { text: "통제된 방식", options: { bold: true, color: T } }, { text: "으로 쓰게 한다" },
  ], { x: 0.6, y: 1.18, w: 12.1, h: 0.42, fontSize: 19, valign: "middle" });
  txt(s, "지금 하지 않아도 AI는 쓰인다. 다만 통제되지 않은 방식으로, 비효율적으로 쓰일 뿐이다 → 1단계 파일럿(6개월, 1억 원 이하) 승인 요청",
    { x: 0.6, y: 1.6, w: 12.1, h: 0.3, fontSize: 12, bold: true, color: C.accent4 });

  const L = { x: 0.6, w: 5.85 }, Rt = { x: 6.85, w: 5.85 };
  [[L, "현행 문제점 (AS-IS)", C.accent4], [Rt, "제안 (TO-BE)", C.text2]].forEach(([c, t, col]) => {
    s.addShape(pres.shapes.RECTANGLE, { x: c.x, y: 2.0, w: c.w, h: 0.46, fill: { color: col }, line: { type: "none" }, objectName: nm("hdr") });
    txt(s, t, { x: c.x, y: 2.0, w: c.w, h: 0.46, fontSize: 18, bold: true, color: C.background1, align: "center", valign: "middle" });
    s.addShape(pres.shapes.RECTANGLE, { x: c.x, y: 2.46, w: c.w, h: 3.5, fill: { color: "F8FAFC" }, line: { color: BORDER, width: 0.75 }, objectName: nm("panel") });
  });
  s.addText("", { shape: pres.shapes.CHEVRON, x: 6.5, y: 3.5, w: 0.3, h: 0.9, fill: { color: "CBD5E1" }, line: { type: "none" }, objectName: nm("chevron") });

  const asis = [
    [["범용 AI와 ", ""], ["그때그때 대화", R], [", 연결은 사람이", ""], "조회·복사·붙여넣기·옮기기를 매번 반복, 결과는 사람마다 다름"],
    [["회계·제조·품질·생산 ", ""], ["데이터를 쓸 수 없음", R], ["", ""], "범용 MCP 도구는 많아도 우리 데이터용 도구는 없음"],
    [["", ""], ["통제와 비용 관리", R], ["가 안 됨", ""], "섀도 AI 유출 위험, 사람 수만큼 구독료, 부서별 중복 결제"],
    [["노하우가 ", ""], ["개인에게 머묾", R], ["", ""], "잘 쓰는 방식이 퍼지지 않고, 작은 반복 업무는 IT 대기열에"],
  ];
  const tobe = [
    [["직원이 ", ""], ["자기 에이전트를 직접 만들고 실행", T], ["", ""], "목표만 정하면 에이전트가 단계를 잇고, 예약·사건에 맞춰 실행"],
    [["사내 시스템을 ", ""], ["표준 도구(MCP)로 연결", T], ["", ""], "ERP·MES 조회 도구가 회사 자산, 모든 에이전트가 재사용"],
    [["", ""], ["하나의 기반에서 통제", T], ["", ""], "대외비는 사내 모델, 시스템 변경은 사람 승인, 모든 실행 기록"],
    [["잘 만든 에이전트는 ", ""], ["갤러리로 공유", T], ["", ""], "현업이 만들고, 검토를 거쳐 전사가 함께 씀"],
  ];
  const rowsTxt = (rows) => rows.map(([a, b, c, sub], i) => [
    { text: "• " + a[0] },
    ...(b[0] ? [{ text: b[0], options: { bold: true, color: b[1] } }] : []),
    { text: c[0], options: { breakLine: true } },
    { text: "   – " + sub, options: { fontSize: 12, color: HEX.accent3, breakLine: i < rows.length - 1 } },
  ]).flat();
  txt(s, rowsTxt(asis), { x: L.x + 0.2, y: 2.6, w: L.w - 0.3, h: 2.4, fontSize: 14, paraSpaceAfter: 5 });
  txt(s, rowsTxt(tobe), { x: Rt.x + 0.2, y: 2.6, w: Rt.w - 0.3, h: 2.4, fontSize: 14, paraSpaceAfter: 5 });

  // AS-IS 도식: 사람이 단계를 잇는다
  txt(s, "사람이 매번 단계를 잇는다 (AI는 6단계 중 1단계)", { x: L.x, y: 5.05, w: L.w, h: 0.3, fontSize: 12.5, bold: true, color: C.accent4, align: "center" });
  s.addShape(pres.shapes.LINE, { x: 1.1, y: 5.52, w: 4.8, h: 0, line: { color: R, width: 2, dashType: "dash" }, objectName: nm("line") });
  ["조회", "복사", "AI 대화", "재조회", "이어 묻기", "옮기기"].forEach((t, i) => {
    const cx = 1.1 + i * 0.96, ai = i === 2;
    s.addShape(pres.shapes.OVAL, { x: cx - 0.1, y: 5.42, w: 0.2, h: 0.2, fill: { color: ai ? HEX.accent6 : R }, line: { type: "none" }, objectName: nm("node") });
    txt(s, t, { x: cx - 0.5, y: 5.64, w: 1.0, h: 0.26, fontSize: 10.5, bold: ai, color: ai ? C.accent6 : C.text1, align: "center" });
  });
  // TO-BE 도식: 에이전트가 잇고, 사람은 정하고 승인
  txt(s, "에이전트가 단계를 잇고, 사람은 정하고 승인한다", { x: Rt.x, y: 5.05, w: Rt.w, h: 0.3, fontSize: 12.5, bold: true, color: C.text2, align: "center" });
  s.addShape(pres.shapes.LINE, { x: 7.15, y: 5.43, w: 5.25, h: 0, line: { color: HEX.dk2, width: 1.5, beginArrowType: "triangle", endArrowType: "triangle" }, objectName: nm("span") });
  [[7.15, 1.5, "목표·규칙 (사람)", "C4B5FD", HEX.dk1], [8.75, 2.45, "에이전트: 조회 → 연결 → 초안", "CCFBF1", HEX.accent2], [11.3, 1.1, "승인 (사람)", "475569", "FFFFFF"]]
    .forEach(([x, w, t, f, c]) => {
      s.addShape(pres.shapes.RECTANGLE, { x, y: 5.55, w, h: 0.34, fill: { color: f }, line: { type: "none" }, objectName: nm("seg") });
      txt(s, t, { x, y: 5.55, w, h: 0.34, fontSize: 10.5, bold: true, color: c, align: "center", valign: "middle" });
    });

  // 효과 · 요청
  [[L, "효과", C.accent5, "같은 인원으로 더 많은 일을, 더 좋은 품질로 · 처리 시간 단축 · 시간 절감만 따져도 2년차 누적 손익분기"],
   [Rt, "요청", C.accent1, "1단계 파일럿 6개월 약 0.95억 원(1억 이하) · 3개 부서 + 전사 Q&A · 지표로 확대 결정"]].forEach(([c, t, col, d]) => {
    card(s, c.x, 6.08, c.w, 0.56, C.background2);
    s.addShape(pres.shapes.OVAL, { x: c.x + 0.18, y: 6.27, w: 0.18, h: 0.18, fill: { color: col }, line: { type: "none" }, objectName: nm("dot") });
    txt(s, t, { x: c.x + 0.45, y: 6.08, w: 0.6, h: 0.56, fontSize: 14, bold: true, valign: "middle" });
    txt(s, d, { x: c.x + 1.05, y: 6.08, w: c.w - 1.15, h: 0.56, fontSize: 11.5, valign: "middle" });
  });
  s.addNotes(
    "한 장으로 현행과 제안을 비교해 말씀드리겠습니다.\n" +
    "현행: 직원들은 범용 AI를 쓰고 있지만 그때그때 대화하고, 조회하고 복사하고 옮기는 연결은 사람이 합니다. 무엇보다 회계·제조·품질·생산 데이터를 쓸 수 없습니다. 범용 MCP 도구는 많지만 우리 데이터를 여는 도구는 없습니다. 섀도 AI와 사람 수만큼 느는 구독료로 통제와 비용 관리가 안 되고, 잘 쓰는 노하우는 개인에게 머뭅니다.\n" +
    "제안: 직원이 자기 업무용 에이전트를 직접 만들어 씁니다. 사내 시스템은 표준 도구로 연결해 회사 자산으로 만들고, 대외비는 사내 모델, 시스템 변경은 사람 승인으로 하나의 기반에서 통제합니다. 잘 만든 에이전트는 갤러리로 퍼집니다.\n" +
    "아래 그림처럼, 지금은 사람이 여섯 단계를 잇고 AI는 그중 하나만 합니다. 제안 이후에는 사람은 목표를 정하고 승인만 하고, 그 사이는 에이전트가 잇습니다.\n" +
    "효과는 시간 절감에 그치지 않습니다. 같은 인원으로 더 많은 일을, 더 좋은 품질로 처리합니다. 보수적으로 시간 절감만 따져도 2년차에 누적 손익분기입니다. 오늘 요청드리는 것은 6개월, 1억 원 이하의 1단계 파일럿입니다.\n" +
    "지금 하지 않아도 AI는 쓰입니다. 다만 통제되지 않은 방식으로, 비효율적으로, 아무것도 남기지 않고 쓰일 뿐입니다."
  );
}

// ═════════════════════════════════════════════════════════════════════════
// 1-2. 대표 시나리오
// ═════════════════════════════════════════════════════════════════════════
const S1B = "대표 시나리오";
pres.addSection({ title: S1B });
{
  const s = content("대표 시나리오 3가지: 품질 · 영업 · 회계", S1B);
  const head = (t, f) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: f }, align: "center", valign: "middle", fontSize: 13.5 } });
  const lab = (t) => ({ text: t, options: { bold: true, fill: { color: "F1F5F9" } } });
  const em = (t) => ({ text: t, options: { bold: true, color: HEX.accent2 } });
  const rows = [
    [{ text: "", options: { fill: { color: "FFFFFF" } } }, head("품질 · 고객 클레임 대응", HEX.accent4), head("영업 · 긴급 주문 납기 회신", HEX.accent6), head("회계 · 월말 거래처 대사", HEX.accent2)],
    [lab("시작"), "고객사 클레임 메일 도착 (사건)", "고객의 긴급 주문 문의 메일 도착 (사건)", "매월 말일 09:00 (예약)"],
    [lab("연결 데이터"), "MES LOT·공정·검사, ERP 출하·재고, 과거 클레임 사례", "ERP 수주·재고, MES 생산 계획·설비 가동, 자재 재고", "ERP 매출채권·전표·입금, 거래처 회신 메일, 회계 규정·대사 매뉴얼"],
    [lab("에이전트가 하는 일"), "LOT 추적·영향 범위 파악, 유사 사례 검색, 8D 초안, 출하 보류·1차 회신 제안", "납기 가능 여부 계산, 대안(분할 납품·작업 순서 조정) 비교, 계획 변경 제안·회신 초안", "50곳 잔액 비교, 차이 3곳 원인 후보, 대사 보고서·확인 메일 초안"],
    [lab("사람이 하는 일"), "품질 담당: 근거 확인, 출하 보류·회신 승인", "생산관리: 계획 변경 승인\n영업 담당: 고객 회신 승인", "회계 담당: 차이 판단\n팀장: 확인 메일 발송 승인"],
    [lab("지금 → 이후 (예시)"), em("1차 회신 다음 날 → 당일 오전"), em("납기 회신 반나절~하루 → 30분 안"), em("반나절 대사 → 차이 검토 30분")],
    [lab("보여 주는 기능"), "사건 실행 · 지식 검색 · 사내 모델 · 승인", "여러 시스템 계산 · 대안 비교 · 두 단계 승인", "예약 실행 · 업무 규칙 · 화면 시안"],
  ];
  s.addTable(rows, { x: 0.6, y: 1.3, w: 12.1, colW: [1.9, 3.4, 3.4, 3.4], rowH: [0.48, 0.45, 0.68, 0.8, 0.68, 0.45, 0.48], fontSize: 12, color: HEX.dk1,
    border: { type: "solid", pt: 0.75, color: BORDER }, valign: "middle", margin: [0.03, 0.1, 0.03, 0.1], objectName: nm("table") });
  card(s, 0.6, 5.9, 12.1, 0.62, C.text1);
  txt(s, [
    { text: "세 시나리오 모두 같은 구조: ", options: { bold: true, color: C.accent1 } },
    { text: "사건·예약으로 시작 → 에이전트가 사내 데이터로 찾고·계산·초안 → 사람이 판단·승인", options: { color: C.background1 } },
  ], { x: 0.9, y: 5.9, w: 11.6, h: 0.62, fontSize: 14.5, valign: "middle" });
  source(s, "시각과 수치는 설명용 예시이며 파일럿에서 실측한다. 회계 시나리오는 화면 시안(proposal/ux/agent-studio-mockup.html)의 '월말 거래처 대사'");
  s.addNotes(
    "대표 시나리오 세 가지를 한 장으로 먼저 보여 드리겠습니다. 품질, 영업, 회계입니다.\n" +
    "품질: 고객 클레임 메일이 오면 에이전트가 LOT를 추적하고 영향 범위를 파악해 8D 초안과 출하 보류, 1차 회신을 제안합니다. 회신이 다음 날에서 당일 오전으로 당겨집니다.\n" +
    "영업: 고객이 긴급 주문이 가능하냐고 물으면, 지금은 영업 담당이 생산관리와 자재 담당에게 물어 반나절에서 하루가 걸립니다. 에이전트는 ERP 수주·재고와 MES 생산 계획·설비 가동, 자재 재고를 함께 보고 납기 가능 여부를 계산하고, 분할 납품이나 작업 순서 조정 같은 대안을 비교합니다. 계획 변경은 생산관리가, 고객 회신은 영업 담당이 승인합니다. 30분 안에 회신할 수 있습니다.\n" +
    "회계: 화면 시안으로 보여 드린 월말 거래처 대사입니다. 매월 말일 자동으로 50곳 잔액을 비교해 차이 3곳과 원인 후보를 찾고, 확인 메일은 팀장 승인 뒤에 나갑니다.\n" +
    "세 시나리오 모두 구조가 같습니다. 사건이나 예약으로 시작하고, 에이전트가 사내 데이터로 찾고 계산하고 초안을 만들고, 사람이 판단하고 승인합니다. 그중 품질 시나리오를 자세히 보겠습니다."
  );
}
{
  const s = content("시나리오 ① 품질: 오전 9시, 고객 클레임 메일이 도착했다", S1B);
  const steps = [
    ["09:10", "메일 감지", "고객사 메일 “커넥터 단자 변형 3건, LOT 2611-A” → 품질팀의 클레임 대응 에이전트가 시작", "사건 트리거"],
    ["09:12", "LOT 추적", "MES: 11/3 2라인 프레스 3호기, 금형 교체 직후 생산분. 같은 조건 LOT 4개 중 2개(1,200개)가 미출하(ERP)", "MES·ERP 도구"],
    ["09:15", "사례 검색", "2024년 비슷한 클레임 2건과 그때의 대책을 찾는다. 고객·품질 데이터는 대외비라 사내 모델로 처리", "지식 · 사내 모델"],
    ["09:20", "정리·제안", "원인 후보, 영향 범위, 8D 초안(D1~D4) + 제안 ① 2개 LOT 출하 보류 ② 고객 1차 회신 초안", "초안 · 제안"],
    ["09:40", "사람이 승인", "담당자가 근거를 확인하고 회신 문구를 고쳐 승인 → MES 출하 보류 등록, 회신 발송", "승인함 · 기록"],
  ];
  steps.forEach(([tm, t, d, tag], i) => {
    const y = 1.3 + i * 0.97;
    const hot = i === 4;
    card(s, 0.6, y, 8.6, 0.85, hot ? "FEF3C7" : C.background2, hot ? C.accent1 : undefined);
    txt(s, tm, { x: 0.8, y, w: 0.9, h: 0.85, fontSize: 17, bold: true, color: C.accent2, valign: "middle" });
    txt(s, t, { x: 1.75, y, w: 1.45, h: 0.85, fontSize: 15, bold: true, valign: "middle" });
    txt(s, d, { x: 3.2, y, w: 4.3, h: 0.85, fontSize: 12, valign: "middle" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.6, y: y + 0.24, w: 1.45, h: 0.38, rectRadius: 0.19, fill: { color: hot ? C.accent1 : C.accent2 }, line: { type: "none" }, objectName: nm("pill") });
    txt(s, tag, { x: 7.6, y: y + 0.24, w: 1.45, h: 0.38, fontSize: 11, bold: true, color: hot ? C.text2 : C.background1, align: "center", valign: "middle" });
  });
  card(s, 9.45, 1.3, 3.25, 4.73, C.text1);
  txt(s, [
    { text: "30분 동안 AI가 한 일", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "시스템 3곳 조회, 사례 검색, 영향 범위 계산, 보고서·회신 초안", options: { color: C.background1, breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "사람이 한 일", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "근거 확인, 문구 수정, 승인 2건", options: { color: C.background1, breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "그 뒤", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "대책은 사례 지식으로 쌓이고, 다른 공장 품질팀이 갤러리에서 이 에이전트를 가져다 쓴다", options: { color: C.background1 } },
  ], { x: 9.7, y: 1.5, w: 2.85, h: 4.4, fontSize: 13.5 });
  source(s, "설명용 예시 시나리오. 시각과 수치는 가상이며 파일럿에서 실측한다. MES 조회와 '제안 → 승인 → 실행' 흐름은 데모로 구조를 확인했다");
  s.addNotes(
    "이 플랫폼이 실제로 어떻게 쓰이는지, 가장 그럴싸한 장면 하나로 보여 드리겠습니다. 고객 품질 클레임입니다.\n" +
    "오전 9시 10분, 고객사에서 커넥터 단자 변형 불량 메일이 옵니다. 품질팀이 만들어 둔 클레임 대응 에이전트가 메일을 감지해 바로 시작합니다.\n" +
    "2분 뒤, MES에서 LOT를 추적합니다. 프레스 3호기 금형 교체 직후 생산분이고, 같은 조건으로 만든 LOT 중 두 개가 아직 창고에 있다는 것을 ERP에서 확인합니다.\n" +
    "이어서 2년 전 비슷한 클레임 두 건과 그때의 대책을 찾습니다. 고객과 품질 데이터는 대외비라 사내 모델에서만 처리합니다.\n" +
    "9시 20분, 담당자에게 원인 후보, 영향 범위, 8D 보고서 초안, 그리고 제안 두 건이 옵니다. 재고 출하 보류와 고객 1차 회신입니다.\n" +
    "9시 40분, 담당자가 근거를 확인하고 문구를 고쳐 승인합니다. 그때 비로소 MES에 보류가 걸리고 회신이 나갑니다.\n" +
    "AI가 결정한 것은 없습니다. 찾고, 맞추고, 초안을 쓰는 일을 했을 뿐입니다. 시각과 수치는 설명용 예시이고 파일럿에서 실제로 재겠습니다."
  );
}
{
  const s = content("지금과 무엇이 달라지나: 사람은 찾는 일 대신 판단을 한다", S1B);
  const H = (t) => hdr(t);
  const rows = [
    [H("구분"), H("지금"), H("플랫폼 이후 (예시)")],
    ["고객 1차 회신", "다음 날 (LOT 추적과 영향 범위 파악에 하루)", { text: "당일 오전", options: { bold: true, color: HEX.accent2 } }],
    ["미출하 재고 보류", "영향 범위가 확정된 뒤", { text: "첫 30분 안에 제안 → 사람이 승인", options: { bold: true, color: HEX.accent2 } }],
    ["담당자의 일", "부서마다 묻고, 시스템을 오가며 복사·붙여넣기", { text: "근거 확인과 판단, 회신 문구 다듬기", options: { bold: true, color: HEX.accent2 } }],
    ["과거 사례 활용", "기억하는 사람이 있으면", { text: "매번 자동으로 찾아 근거로 붙임", options: { bold: true, color: HEX.accent2 } }],
    ["남는 것", "담당자 메일함", { text: "실행·승인 기록, 대책이 담긴 사례 지식", options: { bold: true, color: HEX.accent2 } }],
  ];
  s.addTable(rows, { x: 0.6, y: 1.35, w: 7.7, colW: [1.8, 2.95, 2.95], rowH: [0.48, 0.78, 0.7, 0.78, 0.7, 0.7], fontSize: 13, color: HEX.dk1,
    border: { type: "solid", pt: 0.75, color: BORDER }, valign: "middle", margin: [0, 0.1, 0, 0.1], objectName: nm("table") });
  card(s, 8.6, 1.35, 4.1, 4.14, C.background2);
  txt(s, "왜 이 시나리오인가", { x: 8.85, y: 1.5, w: 3.7, h: 0.45, fontSize: 17, bold: true });
  const pts = [
    ["자주 일어나는 공통의 고통", "품질·생산·물류·영업이 함께 움직인다"],
    ["여러 시스템을 넘나든다", "MES·ERP·메일·사례 문서"],
    ["플랫폼 기능이 한 장면에", "트리거·도구·지식·사내 모델·승인·공유"],
    ["바로 잴 수 있다", "첫 회신 시간, 보류 판단 시간"],
  ];
  pts.forEach(([t, d], i) => {
    const y = 2.05 + i * 0.84;
    s.addShape(pres.shapes.OVAL, { x: 8.88, y: y + 0.1, w: 0.2, h: 0.2, fill: { color: C.accent2 }, line: { type: "none" }, objectName: nm("dot") });
    txt(s, t, { x: 9.2, y, w: 3.4, h: 0.4, fontSize: 14, bold: true, valign: "middle" });
    txt(s, d, { x: 9.2, y: y + 0.38, w: 3.4, h: 0.35, fontSize: 12, color: C.accent3 });
  });
  card(s, 0.6, 5.75, 12.1, 0.8, C.text1);
  txt(s, [
    { text: "AI는 찾고, 맞추고, 초안을 쓴다. 판단과 승인은 사람이 한다. ", options: { bold: true, color: C.accent1 } },
    { text: "같은 사람이 더 빨리, 더 근거 있게 대응한다", options: { color: C.background1 } },
  ], { x: 0.9, y: 5.75, w: 11.6, h: 0.8, fontSize: 16, valign: "middle" });
  s.addNotes(
    "지금과 비교하면 이렇습니다. 고객 1차 회신이 다음 날에서 당일 오전으로 당겨집니다. 아직 창고에 있는 재고는 영향 범위가 확정되기 전, 첫 30분 안에 보류가 제안됩니다.\n" +
    "가장 큰 변화는 담당자의 일입니다. 부서마다 물어보고 시스템을 오가며 복사하던 시간이, 근거를 확인하고 판단하는 시간으로 바뀝니다. 그리고 대응 기록과 대책이 회사의 지식으로 남습니다.\n" +
    "이 장면을 고른 이유는, 자주 일어나는 공통의 고통이고, 여러 시스템을 넘나들고, 플랫폼의 모든 기능이 한 장면에 나오며, 파일럿에서 바로 효과를 잴 수 있기 때문입니다.\n" +
    "그리고 이런 에이전트를, 직원 한 명이 여러 개 만들어 씁니다."
  );
}

{
  const s = content("직원 한 명, 에이전트 여러 개: 품질팀 김 대리의 '내 에이전트'", S1B);
  const G = (t) => ({ text: t, options: { color: HEX.accent3 } });
  const rows = [
    ["에이전트", "실행 방식", "어떻게 생겼나", "공유 범위", "지난 30일"].map(hdr),
    [{ text: "고객 클레임 대응", options: { bold: true } }, "사건: 클레임 메일", "직접 만듦", { text: "전사 (검토됨)", options: { bold: true, color: HEX.accent2 } }, "7회 · 성공"],
    [{ text: "아침 불량 현황", options: { bold: true } }, "예약: 매일 07:30", "직접 만듦", "팀", "21회 · 성공"],
    [{ text: "검사 기준 Q&A", options: { bold: true } }, "대화", "직접 만듦", "팀", "64회"],
    [{ text: "8D 보고서 초안", options: { bold: true } }, "대화", "갤러리에서 가져옴", "개인", "5회"],
    [{ text: "주간 품질 보고 초안", options: { bold: true } }, "예약: 금 16:00", "템플릿으로 만듦", { text: "개인 (시험 중)", options: { color: HEX.accent1, bold: true } }, "4회"],
    [G("협력사 성적서 점검"), G("사건: 성적서 메일"), G("직접 만듦"), G("보관 (미사용)"), G("0회")],
  ];
  s.addTable(rows, { x: 0.6, y: 1.35, w: 8.0, colW: [1.95, 1.75, 1.55, 1.6, 1.15], rowH: [0.46, 0.56, 0.56, 0.56, 0.56, 0.56, 0.56], fontSize: 12.5, color: HEX.dk1,
    border: { type: "solid", pt: 0.75, color: BORDER }, valign: "middle", margin: [0, 0.08, 0, 0.08], objectName: nm("table") });
  txt(s, "＋ 새 에이전트 만들기 (개수 제한 없음)", { x: 0.6, y: 5.25, w: 8.0, h: 0.32, fontSize: 12.5, bold: true, color: C.accent2 });
  card(s, 8.9, 1.35, 3.8, 4.22, C.text1);
  txt(s, [
    { text: "원하는 만큼 만든다", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "개인용 에이전트는 자유롭게. 권한은 언제나 내 권한까지", options: { color: C.background1, breakLine: true } },
    { text: " ", options: { fontSize: 8, breakLine: true } },
    { text: "나누는 것은 검토를 거친다", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "팀 공유는 팀장, 전사 공개는 AI 추진 조직이 검토", options: { color: C.background1, breakLine: true } },
    { text: " ", options: { fontSize: 8, breakLine: true } },
    { text: "기록을 보고 고친다", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "실행 횟수·성공률·동료 평가로 개선, 버전 관리", options: { color: C.background1, breakLine: true } },
    { text: " ", options: { fontSize: 8, breakLine: true } },
    { text: "안 쓰면 정리된다", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "90일 미사용 시 보관, 담당이 바뀌면 인계", options: { color: C.background1 } },
  ], { x: 9.15, y: 1.55, w: 3.35, h: 3.9, fontSize: 14 });
  card(s, 0.6, 5.8, 12.1, 0.75, "FEF3C7");
  txt(s, [
    { text: "하나의 큰 AI가 아니라, 직원마다 업무에 맞춘 작은 에이전트 여러 개. ", options: { bold: true } },
    { text: "잘 되는 것은 퍼지고, 안 쓰는 것은 정리된다" },
  ], { x: 0.9, y: 5.8, w: 11.6, h: 0.75, fontSize: 15, valign: "middle" });
  source(s, "설명용 가상 예시. 화면 시안의 '내 에이전트' 메뉴에 해당");
  s.addNotes(
    "앞의 클레임 대응 에이전트를 만든 품질팀 김 대리의 '내 에이전트' 화면입니다. 직원 한 명이 에이전트를 여러 개 씁니다.\n" +
    "클레임 메일이 오면 도는 클레임 대응, 매일 아침 7시 30분 불량 현황, 대화로 쓰는 검사 기준 Q&A, 갤러리에서 가져온 8D 초안, 아직 시험 중인 주간 보고 초안. 석 달 동안 안 쓴 성적서 점검은 자동으로 보관됐습니다.\n" +
    "원칙은 네 가지입니다. 개인용은 원하는 만큼 자유롭게 만든다. 단 권한은 언제나 내 권한까지. 남과 나누는 것은 검토를 거친다. 실행 기록을 보고 고친다. 안 쓰면 정리된다.\n" +
    "하나의 거대한 AI가 아니라, 직원마다 업무에 맞춘 작은 에이전트들이 생기고, 잘 되는 것은 퍼지고 안 쓰는 것은 정리되는 구조입니다."
  );
}
{
  const s = content("에이전트 관리 절차: 만들고 · 고치고 · 나누고 · 정리한다", S1B);
  const stages = ["찾기·만들기", "시험·저장", "운영", "점검·개선", "공유", "정리"];
  txt(s, "누가 / 단계 →", { x: 0.6, y: 1.32, w: 1.6, h: 0.52, fontSize: 12, bold: true, color: C.accent3, valign: "middle" });
  stages.forEach((t, i) => {
    s.addText(`${i + 1}  ${t}`, { shape: pres.shapes.CHEVRON, x: 2.2 + i * 1.75, y: 1.32, w: 1.82, h: 0.52, fill: { color: i === 5 ? "475569" : HEX.accent2 },
      line: { type: "none" }, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, objectName: nm("stage") });
  });
  const lane = (t, f) => ({ text: t, options: { bold: true, fill: { color: f }, fontSize: 13 } });
  const rows = [
    [lane("직원\n(만든 사람)", "CCFBF1"), "갤러리에서 검색해 가져오거나 템플릿으로 새로 만든다 (개수 제한 없음)", "시험 실행으로 결과와 근거를 확인하고 저장", "대화·예약·사건으로 실행하고 결과를 쓴다", "실행 기록·성공률·동료 평가를 보고 목표·규칙·지식을 고친다 (버전 관리)", "잘 되는 에이전트를 팀·전사에 공유 요청", "안 쓰는 에이전트는 보관, 담당이 바뀌면 인계"],
    [lane("팀장\n(승인자)", "FEF3C7"), "팀에 필요한 에이전트를 요청·추천", "쓰기 도구(메일 발송·시스템 변경)를 쓰면 승인자로 지정", "승인함에서 제안을 승인·반려", "월 1회 팀 에이전트 현황 점검", "팀 공유 승인", "인사이동 시 소유권 인계 확인"],
    [lane("AI 추진 조직\n(플랫폼)", "EEF2FF"), "부서 템플릿·도구·지식 제공, 부서 챔피언 교육", "데이터 등급·권한 자동 검사", "실행 기록·비용 한도 관리", "실패·비용 이상 알림, 도구 개선", "전사 공개 전 검토 (권한·프롬프트·데이터 등급)", "90일 미사용 휴면 알림, 중복 에이전트 통합"],
  ];
  s.addTable(rows, { x: 0.6, y: 1.98, w: 12.1, colW: [1.6, 1.75, 1.75, 1.75, 1.75, 1.75, 1.75], rowH: [1.17, 1.17, 1.17], fontSize: 11, color: HEX.dk1,
    border: { type: "solid", pt: 0.75, color: BORDER }, valign: "middle", margin: [0.04, 0.08, 0.04, 0.08], objectName: nm("table") });
  card(s, 0.6, 5.68, 12.1, 0.82, C.text1);
  txt(s, [
    { text: "직원은 자유롭게 만들고, 회사는 기록·검토·정리로 관리한다. ", options: { bold: true, color: C.accent1 } },
    { text: "에이전트가 수백 개로 늘어도 통제가 무너지지 않는다", options: { color: C.background1 } },
  ], { x: 0.9, y: 5.68, w: 11.6, h: 0.82, fontSize: 15, valign: "middle" });
  s.addNotes(
    "에이전트가 많아지면 관리는 어떻게 하느냐는 질문이 당연히 나옵니다. 그래서 관리 절차를 처음부터 정해 둡니다. 여섯 단계, 세 역할입니다.\n" +
    "직원은 갤러리에서 찾아 가져오거나 새로 만들고, 시험 실행으로 확인한 뒤 씁니다. 실행 기록과 동료 평가를 보고 고치고, 잘 되면 공유를 요청하고, 안 쓰면 보관하고, 담당이 바뀌면 인계합니다.\n" +
    "팀장은 시스템을 바꾸거나 밖으로 메일을 보내는 에이전트의 승인자가 되고, 승인함에서 제안을 승인하며, 월 1회 팀 에이전트를 점검하고 팀 공유를 승인합니다.\n" +
    "AI 추진 조직은 템플릿과 도구를 제공하고, 데이터 등급과 권한을 자동 검사하며, 비용과 실패를 감시하고, 전사 공개 전에 검토하고, 90일 동안 안 쓴 에이전트를 정리합니다.\n" +
    "직원은 자유롭게 만들고 회사는 기록·검토·정리로 관리합니다. 그래서 에이전트가 수백 개로 늘어도 통제가 무너지지 않습니다.\n" +
    "이제 이 일이 왜 지금 필요한지, 데이터로 말씀드리겠습니다."
  );
}

// ═════════════════════════════════════════════════════════════════════════
// 2. 문제
// ═════════════════════════════════════════════════════════════════════════
const S2 = "문제";
pres.addSection({ title: S2 });
{
  const s = content("직원들은 이미 AI를 쓰고 있다. 다만 통제되지 않은 방식으로, 비효율적으로", S2, { fontSize: 24 });
  // ① 현황 수치
  const stats = [
    ["45%", "업무에 AI를 정기적으로 쓰는 직원", "Verizon DBIR 2026", C.accent2],
    ["49%", "회사가 승인하지 않은 AI를 쓰는 직원", "BlackFog 2026", C.accent1],
    ["33%", "승인 안 된 도구에 회사 자료를 넣어 본 직원", "BlackFog 2026", C.accent4],
    ["43%", "침해 사고 조직 중 섀도 AI 관련 사고", "IBM 2026", C.accent4],
  ];
  stats.forEach(([n, d, src, col], i) => {
    const x = 0.6 + i * 3.05;
    card(s, x, 1.18, 2.9, 0.82, C.background2);
    txt(s, n, { x: x + 0.12, y: 1.18, w: 1.15, h: 0.82, fontSize: 28, bold: true, color: col, valign: "middle" });
    txt(s, [{ text: d, options: { breakLine: true } }, { text: src, options: { fontSize: 9.5, color: HEX.accent3 } }],
      { x: x + 1.25, y: 1.18, w: 1.6, h: 0.82, fontSize: 10.5, valign: "middle" });
  });
  // ② 지금의 방식: 6단계
  txt(s, "지금의 방식: AI는 6단계 중 1단계, 나머지는 사람이 잇는다", { x: 0.6, y: 2.1, w: 12.1, h: 0.32, fontSize: 14, bold: true });
  const steps = [
    ["조회", "시스템마다 따로 접속"], ["복사", "민감 정보 유출 위험"], ["AI 대화", "우리 데이터를 모름"],
    ["재조회", "근거 찾아 다시 조회"], ["이어 묻기", "맥락을 매번 다시 설명"], ["옮기기", "손으로 옮기다 오류"],
  ];
  steps.forEach(([t, pain], i) => {
    const x = 0.6 + i * 2.02, ai = i === 2;
    s.addText(`${i + 1} ${t}${ai ? " (AI)" : ""}`, { shape: pres.shapes.CHEVRON, x, y: 2.47, w: 2.1, h: 0.5, fill: { color: ai ? HEX.accent6 : "64748B" },
      line: { type: "none" }, fontSize: 13, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, objectName: nm("step") });
    txt(s, "⚠ " + pain, { x: x + 0.1, y: 3.0, w: 1.85, h: 0.36, fontSize: 11, bold: true, color: ai ? C.accent6 : C.accent4, align: "center", valign: "middle" });
  });
  // ③ 세 가지 한계
  const lim = [
    ["느리다", "비효율", "6단계 중 5단계를 사람이 손으로 잇는다 · 사람마다 결과가 다르고 재현되지 않는다 · AI 도입 69.5% vs 업무 정착 12.5%", HEX.accent3, false],
    ["반쪽이다", "데이터 · 가장 큰 한계", "회계·제조·품질·생산 데이터를 못 본다 · “이번 달 왜 불량이 늘었나” 같은 우리 회사의 질문에 답하지 못한다 · 숫자의 근거를 확인할 수 없다", HEX.accent4, true],
    ["위험하다", "통제 · 비용", "무엇이 밖으로 나갔는지 기록이 없다 · 쓰는 만큼이 아니라 사람 수만큼 구독료 · 부서마다 따로 결제해 중복", HEX.accent1, false],
  ];
  lim.forEach(([w, tag, d, col, hot], i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 3.52, 3.9, 2.12, hot ? C.background1 : C.background2, hot ? C.accent4 : undefined);
    txt(s, w, { x: x + 0.22, y: 3.6, w: 2.0, h: 0.6, fontSize: 26, bold: true, color: col, valign: "middle" });
    txt(s, tag, { x: x + 2.0, y: 3.68, w: 1.75, h: 0.45, fontSize: 11.5, bold: true, color: col, align: "right", valign: "middle" });
    txt(s, d.split(" · ").map((t, k, a) => ({ text: t, options: { bullet: true, breakLine: k < a.length - 1 } })),
      { x: x + 0.22, y: 4.22, w: 3.5, h: 1.38, fontSize: 12.5, paraSpaceAfter: 4 });
  });
  card(s, 0.6, 5.8, 12.1, 0.72, C.text1);
  txt(s, [
    { text: "금지로는 못 막는다(임원 65%도 사용). ", options: { color: C.background1 } },
    { text: "필요한 것은 우리 데이터에 연결되고 통제되는 업무용 에이전트다", options: { bold: true, color: C.accent1 } },
  ], { x: 0.9, y: 5.8, w: 11.6, h: 0.72, fontSize: 15, valign: "middle" });
  source(s, "출처: Verizon 2026 DBIR·IBM 2026(2차 보도), BlackFog 2026, TrustedTech·Censuswide, 조코딩AX파트너스(2,078명). 조사마다 정의가 달라 방향성 지표로 본다");
  s.addNotes(
    "직원들은 이미 AI를 쓰고 있습니다. 문제는 통제되지 않은 방식으로, 비효율적으로 쓴다는 것입니다.\n" +
    "위의 숫자부터 보시면, 업무에 AI를 정기적으로 쓰는 직원이 45%로 1년 만에 3배가 됐고, 절반 가까이가 회사가 승인하지 않은 도구를 씁니다. 3명 중 1명은 회사 자료를 거기에 넣어 봤고, 침해 사고를 겪은 조직의 43%가 섀도 AI 관련 사고였습니다.\n" +
    "가운데는 지금 일하는 방식입니다. 시스템에서 조회하고, 복사하고, AI에 묻고, 근거를 확인하러 다시 조회하고, 맥락을 다시 설명하며 이어 묻고, 결과를 손으로 옮깁니다. 여섯 단계 중 AI가 하는 것은 하나뿐이고, 그마저 우리 데이터를 모른 채 답합니다.\n" +
    "그래서 세 가지 한계가 생깁니다. 느립니다. 사람이 다섯 단계를 잇습니다. 반쪽입니다. 이것이 가장 큰 한계로, 회계·제조·품질·생산 데이터를 볼 수 없어 정작 우리 회사의 질문에는 답하지 못합니다. 그리고 위험합니다. 무엇이 밖으로 나갔는지 기록이 없고, 비용은 사람 수만큼 늘어납니다.\n" +
    "임원의 65%도 승인되지 않은 AI를 씁니다. 금지로는 막을 수 없습니다. 필요한 것은 우리 데이터에 연결되고 통제되는 업무용 에이전트입니다."
  );
}
{
  const s = content("AI 에이전트는 어떻게 회사 데이터를 쓰나: 글로벌 표준 MCP", S2, { fontSize: 26 });
  // 왼쪽 도식
  txt(s, "AI는 회사 DB를 직접 열지 않는다. 회사가 정해 둔 '도구'로만 접근한다", { x: 0.6, y: 1.2, w: 6.6, h: 0.35, fontSize: 13.5, bold: true, color: C.accent2 });
  card(s, 0.6, 1.75, 1.75, 2.1, "EEF2FF", HEX.accent6);
  txt(s, [{ text: "AI 에이전트", options: { bold: true, fontSize: 15, breakLine: true } }, { text: "Claude · ChatGPT\nGemini · 사내 모델\n무엇이든", options: { fontSize: 11, color: HEX.accent3 } }],
    { x: 0.7, y: 1.75, w: 1.55, h: 2.1, align: "center", valign: "middle", color: C.accent6 });
  arrowR(s, 2.4, 2.8, 0.4, C.accent3);
  card(s, 2.85, 1.6, 2.55, 2.4, "F0FDFA", HEX.accent2);
  txt(s, "MCP 도구 (표준 연결구)", { x: 2.85, y: 1.65, w: 2.55, h: 0.35, fontSize: 12, bold: true, color: C.accent2, align: "center" });
  ["거래처 잔액 조회", "LOT 추적", "불량 이력 조회", "작업지시 변경 제안 ✋"].forEach((t, i) => {
    const y = 2.05 + i * 0.47;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 3.0, y, w: 2.25, h: 0.38, rectRadius: 0.08, fill: { color: "FFFFFF" }, line: { color: HEX.accent2, width: 0.75 }, objectName: nm("tool") });
    txt(s, t, { x: 3.0, y, w: 2.25, h: 0.38, fontSize: 11.5, bold: true, align: "center", valign: "middle" });
  });
  arrowR(s, 5.45, 2.8, 0.4, C.accent3);
  ["ERP", "MES", "그룹웨어"].forEach((t, i) => {
    const y = 1.75 + i * 0.72;
    card(s, 5.9, y, 1.3, 0.6, C.text1);
    txt(s, t, { x: 5.9, y, w: 1.3, h: 0.6, fontSize: 14, bold: true, color: C.background1, align: "center", valign: "middle" });
  });
  const flow = [["1", "AI가 필요한 도구를 부른다"], ["2", "도구가 권한을 확인하고 시스템에서 조회"], ["3", "결과(숫자)만 AI에 돌려준다"], ["4", "모든 호출을 기록, 변경은 사람 승인 ✋"]];
  flow.forEach(([n, t], i) => {
    const y = 4.2 + i * 0.36;
    badge(s, 0.65, y + 0.02, n, C.accent2, C.background1, 0.3);
    txt(s, t, { x: 1.05, y, w: 6.1, h: 0.34, fontSize: 13, valign: "middle" });
  });
  // 오른쪽: 무엇인가 / 왜 필요한가 / 글로벌 표준
  const qa = [
    ["MCP란?", "AI와 회사 시스템을 잇는 표준 연결 규격. AI가 '할 수 있는 일'을 도구로 정해 둔다. 어떤 기기든 꽂으면 되는 USB-C 단자와 같다", C.accent2],
    ["왜 필요한가?", "AI가 회사 데이터에 안전하게 닿는 유일한 길. 권한 안에서만, 기록을 남기며 접근한다. 한 번 만든 도구는 모든 에이전트가 재사용한다", C.accent1],
    ["글로벌 표준", "2024년 11월 공개 → 2025년 12월 리눅스 재단(Agentic AI Foundation)으로 이관. Claude·ChatGPT·Gemini·Copilot 등 주요 AI가 모두 지원", C.accent6],
  ];
  qa.forEach(([t, d, col], i) => {
    const y = 1.2 + i * 1.5;
    card(s, 7.55, y, 5.15, 1.36, C.background2);
    s.addShape(pres.shapes.RECTANGLE, { x: 7.55, y, w: 0.09, h: 1.36, fill: { color: col }, line: { type: "none" }, objectName: nm("bar") });
    txt(s, t, { x: 7.8, y: y + 0.1, w: 4.8, h: 0.36, fontSize: 16, bold: true, color: col });
    txt(s, d, { x: 7.8, y: y + 0.48, w: 4.8, h: 0.82, fontSize: 12.5 });
  });
  card(s, 0.6, 5.82, 12.1, 0.7, C.text1);
  txt(s, [
    { text: "글로벌 표준이라 특정 AI 회사에 묶이지 않는다. ", options: { bold: true, color: C.accent1 } },
    { text: "지금 만든 도구는 AI를 바꿔도 그대로 쓰는 회사 자산이 된다", options: { color: C.background1 } },
  ], { x: 0.9, y: 5.82, w: 11.6, h: 0.7, fontSize: 15, valign: "middle" });
  source(s, "출처: Linux Foundation·Agentic AI Foundation 발표(2025.12), 업계 보도. ✋ = 사람 승인이 필요한 도구");
  s.addNotes(
    "여기서 용어 하나만 설명드리겠습니다. MCP입니다.\n" +
    "AI 에이전트는 회사 데이터베이스를 직접 열지 않습니다. 회사가 정해 둔 '도구'를 통해서만 접근합니다. 예를 들어 '거래처 잔액 조회', 'LOT 추적', '작업지시 변경 제안' 같은 도구입니다.\n" +
    "AI가 도구를 부르면, 도구가 그 직원의 권한을 확인하고 ERP나 MES에서 조회해 결과 숫자만 돌려줍니다. 모든 호출은 기록되고, 시스템을 바꾸는 도구는 사람이 승인해야 실행됩니다.\n" +
    "이 도구를 만드는 표준 규격이 MCP입니다. 어떤 기기든 꽂으면 되는 USB-C 단자라고 생각하시면 됩니다.\n" +
    "중요한 것은 이것이 글로벌 표준이라는 점입니다. 2024년 말 공개된 뒤 작년 12월 리눅스 재단으로 넘어갔고, Claude, ChatGPT, Gemini, Copilot 등 주요 AI가 모두 지원합니다. 그래서 지금 만든 도구는 나중에 어떤 AI로 바꿔도 그대로 씁니다. 특정 회사에 묶이지 않는 회사 자산입니다."
  );
}
{
  const s = content("MCP 도구는 넘쳐나지만, 우리 회사 데이터를 여는 도구는 없다", S2);
  // 왼쪽: 공개된 범용 MCP 도구
  card(s, 0.6, 1.3, 5.6, 3.3, C.background2);
  txt(s, "공개된 범용 MCP 도구: 이미 많다", { x: 0.85, y: 1.42, w: 5.2, h: 0.4, fontSize: 16, bold: true, color: C.accent5 });
  const generic = [
    ["협업", "메일 · 메신저 · 캘린더"], ["문서", "클라우드 드라이브 · 위키"], ["개발", "코드 저장소 · 이슈 관리"],
    ["일반", "웹 검색 · 파일 · 범용 DB 질의"],
  ];
  generic.forEach(([k, v], i) => {
    const y = 1.95 + i * 0.6;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.85, y, w: 5.1, h: 0.48, rectRadius: 0.08, fill: { color: C.background1 }, line: { color: BORDER, width: 0.75 }, objectName: nm("chip") });
    txt(s, "✓", { x: 0.95, y, w: 0.35, h: 0.48, fontSize: 15, bold: true, color: C.accent5, valign: "middle" });
    txt(s, k, { x: 1.3, y, w: 0.9, h: 0.48, fontSize: 13, bold: true, valign: "middle" });
    txt(s, v, { x: 2.2, y, w: 3.7, h: 0.48, fontSize: 13, color: C.accent3, valign: "middle" });
  });
  txt(s, "누구나 쓰는 공통 업무용. 경쟁사도 똑같이 쓴다", { x: 0.85, y: 4.3, w: 5.2, h: 0.28, fontSize: 11.5, italic: true, color: C.accent3 });
  // 가운데 화살표
  txt(s, "vs", { x: 6.2, y: 2.6, w: 0.6, h: 0.5, fontSize: 18, bold: true, color: C.accent3, align: "center", valign: "middle" });
  // 오른쪽: 우리 업무에 필요한 도구
  card(s, 6.8, 1.3, 5.9, 3.3, C.background1, C.accent4);
  txt(s, "우리 업무에 필요한 도구: 어디에도 없다", { x: 7.05, y: 1.42, w: 5.5, h: 0.4, fontSize: 16, bold: true, color: C.accent4 });
  const ours = [
    ["회계", "거래처별 채권·전표 조회 (우리 계정 체계)"], ["생산", "LOT 추적·실적·작업지시 (우리 LOT 규칙)"],
    ["품질", "검사 결과·클레임·불량 이력 (우리 판정 기준)"], ["제조", "설비 알람·가동, 계획 변경 제안 (승인 필요)"],
  ];
  ours.forEach(([k, v], i) => {
    const y = 1.95 + i * 0.6;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.05, y, w: 5.4, h: 0.48, rectRadius: 0.08, fill: { color: "FEE2E2" }, line: { type: "none" }, objectName: nm("chip") });
    txt(s, "✕", { x: 7.15, y, w: 0.35, h: 0.48, fontSize: 15, bold: true, color: C.accent4, valign: "middle" });
    txt(s, k, { x: 7.5, y, w: 0.75, h: 0.48, fontSize: 13, bold: true, valign: "middle" });
    txt(s, v, { x: 8.25, y, w: 4.15, h: 0.48, fontSize: 12.5, valign: "middle" });
  });
  txt(s, "직접 만들어야 한다. 그래서 이것이 차별화 요소다", { x: 7.05, y: 4.3, w: 5.5, h: 0.28, fontSize: 11.5, bold: true, color: C.accent4 });
  // 왜 없나
  const why = [
    ["시스템이 회사마다 다르다", "같은 ERP·MES라도 커스터마이징, 코드 체계, 테이블이 다르다"],
    ["업무 규칙이 들어가야 한다", "어떤 LOT를 같은 조건으로 볼지, 대사 차이를 무엇으로 볼지는 우리 기준"],
    ["권한과 승인이 필요하다", "누가 무엇을 볼 수 있는지, 쓰기는 제안 → 승인. 범용 도구는 모른다"],
  ];
  why.forEach(([t, d], i) => {
    const x = 0.6 + i * 4.1;
    badge(s, x, 4.82, String(i + 1), C.accent3, C.background1, 0.36);
    txt(s, t, { x: x + 0.45, y: 4.78, w: 3.5, h: 0.42, fontSize: 14, bold: true, valign: "middle" });
    txt(s, d, { x: x + 0.45, y: 5.2, w: 3.5, h: 0.6, fontSize: 11.5, color: C.accent3 });
  });
  card(s, 0.6, 5.9, 12.1, 0.68, C.text1);
  txt(s, [
    { text: "우리 데이터를 여는 도구가 회사의 AI 자산이다. ", options: { bold: true, color: C.accent1 } },
    { text: "한 번 만들면 모든 에이전트가 재사용하고, 모델을 바꿔도 남는다", options: { color: C.background1 } },
  ], { x: 0.9, y: 5.9, w: 11.6, h: 0.68, fontSize: 14, valign: "middle" });
  source(s, "실현 가능성: MES 조회·제안 도구 10개를 MCP 서버(Python·Java)로 만들어 검증했다 (demo/mes-mcp)");
  s.addNotes(
    "무엇보다 강조드리고 싶은 점입니다. AI와 시스템을 잇는 표준인 MCP 도구는 이미 넘쳐납니다. 메일, 메신저, 클라우드 드라이브, 코드 저장소, 웹 검색. 누구나 가져다 쓸 수 있고, 경쟁사도 똑같이 씁니다.\n" +
    "그런데 우리 업무에 정작 필요한 도구, 거래처별 채권 조회, LOT 추적, 검사·클레임 이력, 설비 알람과 계획 변경 제안 같은 도구는 어디에도 없습니다.\n" +
    "없는 이유가 있습니다. 같은 ERP, 같은 MES라도 회사마다 커스터마이징과 코드 체계가 다르고, 어떤 LOT를 같은 조건으로 볼지 같은 우리만의 업무 규칙이 들어가야 하며, 누가 무엇을 볼 수 있는지와 승인 절차가 필요합니다. 범용 도구는 이것을 모릅니다.\n" +
    "그래서 이 도구는 우리가 직접 만들어야 하고, 바로 그것이 회사의 AI 자산이자 차별화 요소입니다. 한 번 만들면 모든 에이전트가 재사용하고, AI 모델을 바꿔도 그대로 남습니다. 저희는 이미 MES 조회와 승인 흐름을 담은 도구 10개를 MCP 서버로 만들어 검증했습니다."
  );
}
{
  const s = content("왜 지금인가: 업무 소프트웨어가 에이전트로 바뀌고 있다", S2);
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
    ["연결 표준 확정", "MCP가 글로벌 표준으로 자리 잡았다(앞 장). 지금 만든 도구는 어떤 AI로 바꿔도 그대로 쓴다", C.accent2],
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
    "앞 장에서 말씀드린 대로 연결 표준도 정해졌습니다. 지금 도구를 만들면 나중에 어떤 AI로 바꿔도 그대로 씁니다.\n" +
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
  const s = content("화면 시안: 에이전트 만들기", S3);
  const iw = 7.5, ih = iw * 1494 / 2112;
  s.addImage({ path: path.join(IMG, "agent-studio-builder.png"), x: 0.6, y: 1.25, w: iw, h: ih,
    altText: "에이전트 스튜디오 만들기 화면 시안: 상단의 8단계 만들기 절차 아래에서 목표, 도구, 지식, 규칙, 실행 방식을 차례로 정하고 오른쪽에 시험 실행 결과가 보인다", objectName: nm("image") });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.25, w: iw, h: ih, fill: { type: "none" }, line: { color: BORDER, width: 1 }, objectName: nm("frame") });
  const pts = [
    ["만드는 절차가 한눈에", "정의 → 시험 실행 → 운영·공유 8단계, 승인 지점 표시"],
    ["목표는 말로 적는다", "AI가 실행 단계로 정리해 보여 준다"],
    ["도구마다 권한이 보인다", "조회 · 생성 · 승인 필요를 한눈에"],
    ["시험 실행 결과를 바로 확인", "근거(ERP 조회값, 매뉴얼 절)까지 표시"],
    ["외부 발송은 승인함으로", "메일 초안과 근거가 승인자에게 간다"],
  ];
  pts.forEach(([t, d], i) => {
    const y = 1.3 + i * 1.04;
    badge(s, 8.45, y + 0.04, String(i + 1), C.accent2, C.background1, 0.42);
    txt(s, t, { x: 9.05, y, w: 3.65, h: 0.45, fontSize: 15, bold: true, valign: "middle" });
    txt(s, d, { x: 9.05, y: y + 0.46, w: 3.65, h: 0.45, fontSize: 12.5, color: C.accent3 });
  });
  source(s, "클릭해 볼 수 있는 시안: proposal/ux/agent-studio-mockup.html (만들기 · 승인함과 실행 기록 · 갤러리). 시안용 가상 데이터");
  s.addNotes(
    "실제 화면을 상상하실 수 있도록 시안을 만들었습니다. 앞에서 말씀드린 회계팀 대사 에이전트를 만드는 화면입니다.\n" +
    "화면 맨 위에는 만드는 절차가 한눈에 보입니다. 목표, 도구, 지식, 규칙, 실행 방식을 정하고, 시험 실행으로 확인한 뒤, 저장해서 운영하고 검토를 거쳐 공유하는 8단계입니다. 어디서 사람이 승인하는지도 표시됩니다.\n" +
    "목표를 말로 적으면 AI가 실행 단계로 정리해 보여 줍니다. 도구마다 조회인지, 승인이 필요한지 표시됩니다. 대외비 데이터를 쓰기 때문에 사내 모델이 자동으로 선택됐습니다.\n" +
    "오른쪽은 시험 실행 결과입니다. 50곳 중 3곳 차이, 원인 후보, 그리고 숫자가 ERP 조회값이라는 근거까지 보입니다. 거래처에 보낼 메일은 바로 나가지 않고 팀장 승인함으로 갑니다.\n" +
    "시안 파일에는 승인함과 실행 기록, 그리고 다른 부서가 만든 에이전트를 가져다 쓰는 갤러리 화면도 있습니다."
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
// 4. 기대 효과 (재무 계산은 부록)
// ═════════════════════════════════════════════════════════════════════════
const S4B = "기대 효과";
pres.addSection({ title: S4B });
{
  const s = content("기대 효과: 같은 인원으로 더 많은 일을, 더 좋은 품질로", S4B);
  const cols = [
    ["더 많은 일", "같은 인원이 더 많은 건을 처리한다", C.accent2, [
      "대사: 주요 50곳 표본 → 전체 거래처 전수 대사",
      "영업: 1인이 하루에 회신하는 납기 문의 건수 증가",
      "업무량이 늘어도 증원 없이 대응, 숙련자 퇴직 공백 완화"]],
    ["더 좋은 품질", "매번 같은 절차, 근거 있는 결과", C.accent6, [
      "숫자는 시스템 조회값, 근거 문서 표시 → 옮겨 적기 오류 감소",
      "과거 사례·체크리스트 자동 적용 → 영향 범위·검토 누락 감소",
      "잘 된 방식이 갤러리로 퍼져 사람·부서 간 품질 편차 감소"]],
    ["더 빠른 대응", "기다리는 시간이 사라진다", C.accent1, [
      "클레임 1차 회신: 다음 날 → 당일 오전",
      "납기 회신: 반나절~하루 → 30분 안",
      "아낀 시간(주 2~4시간 보고)은 판단·개선 업무로"]],
  ];
  cols.forEach(([t, sub, col, items], i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 1.3, 3.9, 3.3, C.background2);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.3, w: 3.9, h: 0.09, fill: { color: col }, line: { type: "none" }, objectName: nm("bar") });
    txt(s, t, { x: x + 0.25, y: 1.5, w: 3.4, h: 0.5, fontSize: 24, bold: true, color: col });
    txt(s, sub, { x: x + 0.25, y: 2.02, w: 3.45, h: 0.35, fontSize: 13.5, bold: true });
    txt(s, items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < items.length - 1 } })),
      { x: x + 0.25, y: 2.45, w: 3.5, h: 2.05, fontSize: 13, paraSpaceAfter: 6 });
  });
  txt(s, "파일럿에서 재는 지표", { x: 0.6, y: 4.78, w: 3.0, h: 0.35, fontSize: 14, bold: true, color: C.accent3 });
  ["1인당 처리 건수", "처리 리드타임", "오류·재작업률", "점검 범위 (전수 비율)", "절감 시간"].forEach((k, i) => {
    const x = 0.6 + i * 2.44;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.15, w: 2.3, h: 0.45, rectRadius: 0.1, fill: { color: "FFFFFF" }, line: { color: BORDER, width: 1 }, objectName: nm("kpi") });
    txt(s, k, { x, y: 5.15, w: 2.3, h: 0.45, fontSize: 13, bold: true, align: "center", valign: "middle" });
  });
  card(s, 0.6, 5.82, 12.1, 0.7, C.text1);
  txt(s, [
    { text: "핵심은 인력 감축이 아니라 처리 능력 확대다. ", options: { bold: true, color: C.accent1 } },
    { text: "재무 계산(부록)은 보수적으로 시간 절감만 넣어도 2년차에 누적 손익분기", options: { color: C.background1 } },
  ], { x: 0.9, y: 5.82, w: 11.6, h: 0.7, fontSize: 15, valign: "middle" });
  s.addNotes(
    "효과를 시간 절감으로만 보시면 안 됩니다. 핵심은 같은 인원으로 더 많은 일을, 더 좋은 품질로 처리하는 것입니다.\n" +
    "더 많은 일: 지금 회계팀은 시간이 없어 주요 거래처 50곳만 표본으로 대사합니다. 에이전트가 있으면 전체 거래처를 전수 대사할 수 있습니다. 영업 담당 한 명이 하루에 회신할 수 있는 납기 문의도 늘어납니다. 업무량이 늘어도 사람을 늘리지 않고 대응할 수 있고, 숙련자가 떠난 공백도 줄어듭니다.\n" +
    "더 좋은 품질: 숫자는 시스템에서 바로 가져오고 근거를 표시하니 옮겨 적다 생기는 오류가 줄어듭니다. 과거 사례와 체크리스트가 매번 자동으로 적용돼 누락이 줄고, 잘 하는 사람의 방식이 퍼져 사람마다 다른 품질이 고르게 됩니다.\n" +
    "더 빠른 대응: 클레임 회신은 당일 오전으로, 납기 회신은 30분 안으로 당겨집니다.\n" +
    "파일럿에서는 이 다섯 가지 지표를 직접 재겠습니다. 그리고 부록의 재무 계산은 보수적으로 시간 절감만 넣었는데도 2년차에 누적 손익분기입니다."
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
    ["1단계 파일럿", "0~6개월 · 약 0.95억 원", ["품질·영업·회계 3개 부서", "+ 전사 규정 Q&A", "사용자 60명, 조회 전용", "핵심 도구 10개, 템플릿 10개"], "FEF3C7", C.accent1],
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
  const kpis = ["주간 활성 사용률 60% 이상", "1인 주 1.5시간 이상 절감 (표본 측정)", "만족도 4.0 / 5 이상", "보안 사고 0건", "대표 업무 처리 시간 50% 단축"];
  kpis.forEach((k, i) => {
    const x = 0.9 + i * 2.36;
    txt(s, "✓ " + k, { x, y: 5.4, w: 2.26, h: 0.85, fontSize: 13, color: C.background1, valign: "middle" });
  });
  source(s, "파일럿 비용 0.95억 원 = 외부 구축 지원 0.4 + GPU 워크스테이션 0.3 + 클라우드 모델 0.1 + 교육 0.05 + 예비비 0.1. 인력은 기존 IT 2명 + 부서 챔피언 3명(겸임)");
  s.addNotes(
    "추진은 3단계입니다. 핵심은 성과 지표를 넘어야 다음 단계로 간다는 것입니다.\n" +
    "1단계 6개월 파일럿: 품질, 영업, 회계 3개 부서와 전사 규정 Q&A로 시작합니다. 사용자 60명, 조회 전용으로 위험을 낮춥니다. 신규 지출은 1억 원 이하, 약 0.95억 원입니다. 플랫폼은 오픈소스로 세우고 외부 구축 지원 0.4억, 추론용 GPU 워크스테이션 1대 0.3억, 클라우드 모델 0.1억, 교육 0.05억, 예비비 0.1억입니다. 인력은 기존 IT 인력 2명과 부서 챔피언이 맡습니다.\n" +
    "6개월 뒤 다섯 가지 지표로 판단합니다. 주간 활성 사용률 60%, 1인 주 1.5시간 절감, 만족도 4.0, 보안 사고 0건, 대표 업무 처리 시간 50% 단축. 이걸 넘으면 2단계로 전 부서에 셀프 빌더를 열고 승인형 쓰기 도구를 도입합니다.\n" +
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
const S7 = "부록";
pres.addSection({ title: S7 });
// ═════════════════════════════════════════════════════════════════════════
// 4. 투자와 효과
// ═════════════════════════════════════════════════════════════════════════
const S4 = S7;
{
  const s = content("부록 · 투자와 효과: 시간 절감만 따져도 2년차 누적 손익분기", S4);
  s.addChart(pres.charts.BAR, [
    { name: "비용", labels: ["1년차", "2년차", "3년차", "4년차"], values: [4.6, 6.4, 5.9, 5.9] },
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
    ["보수 (주 1.5시간)", "+1.7", "+5.6"],
    [{ text: "기준 (주 2.5시간)", options: { bold: true } }, { text: "+8.9", options: { bold: true } }, { text: "+16.1", options: { bold: true, color: HEX.accent5 } }],
    ["낙관 (주 4시간)", "+19.6", { text: "+31.8", options: { color: HEX.accent5 } }],
  ];
  s.addTable(rows, { x: 8.1, y: 1.3, w: 4.6, colW: [2.2, 1.2, 1.2], rowH: 0.5, fontSize: 13, color: HEX.dk1, align: "center",
    border: { type: "solid", pt: 0.75, color: BORDER }, valign: "middle", margin: [0, 0.08, 0, 0.08], objectName: nm("table") });
  card(s, 8.1, 3.55, 4.6, 2.15, C.text1);
  txt(s, [
    { text: "연간 운영비 회수 조건", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "활성 사용자 300명이 주 1.1시간만 실제로 아끼면 된다", options: { bold: true, color: C.background1, breakLine: true } },
    { text: "외부 조사 보고치는 주 2.2~3.8시간. 자동화 업무 30개를 넣으면 주 0.2시간", options: { color: "CBD5E1" } },
  ], { x: 8.35, y: 3.6, w: 4.15, h: 2.05, fontSize: 14, valign: "middle", paraSpaceAfter: 4 });
  source(s, "가정: 활성 120→300→360명, 시간당 4만 원, 절감 시간의 50%만 가치로, 자동화 업무 1개 연 0.16억. 처리량·품질 효과 제외. 비용은 개략 추정 (계산 엑셀)");
  s.addNotes(
    "부록: 투자와 효과입니다. 숫자를 부풀리지 않으려고 보수적으로 계산했습니다. 처리량과 품질 효과는 넣지 않고 시간 절감만, 그것도 아낀 시간의 절반만 가치로 셌습니다.\n" +
    "비용은 1년차 4.6억 원입니다. 파일럿 신규 지출 0.95억 원, 내부 인력 2명 인건비 2.8억 원, 하반기 확대 지출 0.85억 원입니다. 2년차 6.4억, 3년차 이후 연 5.9억 원입니다.\n" +
    "기준 시나리오에서 1년차만 투자 구간이고 2년차에 누적 손익분기, 3년 누적 8.9억 원의 순효과입니다. 보수 시나리오에서도 3년 누적 플러스입니다.\n" +
    "연간 운영비를 회수하려면 활성 사용자 300명이 일주일에 1.1시간만 실제로 아끼면 됩니다. 외부 조사의 보고치는 주 2.2~3.8시간입니다.\n" +
    "보안 리스크 감소도 빠져 있습니다. 섀도 AI 관련 침해 사고 한 건의 평균 피해가 70억 원대입니다.\n" +
    "가정은 모두 근거 문서에 있고, 우리 회사 숫자로 바꾸면 바로 다시 계산됩니다."
  );
}
{
  const s = content("부록 · 구축 방식: 오픈소스 기반 자체 구축 + 모델 혼합 운영", S4);
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

const QA = [
  [
    ["비용 근거는 무엇인가?", "파일럿 0.95억 = 외부 구축 지원·GPU 워크스테이션·모델 사용료·교육·예비비. 1년차 4.6억은 내부 인력 2명 인건비 포함. 계산식은 부록과 계산 엑셀에 공개, 견적으로 확정"],
    ["이미 범용 AI(ChatGPT·Copilot)를 쓰는데?", "범용 AI는 대화 도구라 단계 연결은 사람 몫이고, 회계·제조·품질·생산 데이터에 닿지 못한다. 플랫폼은 범용 AI를 버리는 게 아니라 그 위에 우리 데이터와 업무 절차를 잇는 층이다"],
    ["파일럿이 실패하면?", "6개월 뒤 다섯 가지 지표(활성 사용률 60%, 주 1.5시간 절감 등)에 못 미치면 확대하지 않는다. 손실은 파일럿 비용(1억 원 이하)으로 제한된다"],
    ["데이터 유출은 안전한가?", "대외비는 사내 모델에서만 처리하고, 에이전트는 실행한 사람의 권한만큼만 본다. 모든 실행은 기록된다. 오히려 지금의 섀도 AI가 더 위험하다"],
    ["AI가 틀리면 누가 책임지나?", "숫자는 시스템 조회값만 쓰고 AI는 해석만 한다. 답마다 근거를 표시하고, 시스템 변경과 외부 발송은 사람이 승인한다. 결정과 책임은 승인한 사람에게 있다"],
    ["인력 감축이 목적인가?", "아니다. 반복 업무를 덜어 판단과 개선에 시간을 쓰게 하는 것이 목적이다. 채용·평가 같은 인사 판단에는 AI를 쓰지 않는다"],
  ],
  [
    ["직원들이 실제로 쓸까?", "부서별 템플릿으로 바로 쓰게 하고, 부서 챔피언이 동료를 돕는다. 지금도 절반이 외부 AI를 쓰고 있어 수요는 충분하다. 공식 경로가 더 편하면 옮겨 온다"],
    ["ERP·MES를 바꿔야 하나?", "아니다. 조회 도구와 승인된 쓰기만 연결한다. API가 없으면 읽기 전용 DB 뷰로 시작하고, 쓰기는 담당자 할 일로 보낸다"],
    ["사내 GPU 서버가 꼭 필요한가?", "대외비(원가·설계·품질·인사)를 외부로 보내지 않으려면 필요하다. 파일럿은 GPU 워크스테이션 1대(0.3억)로 시작하고, 사용량을 보고 증설한다"],
    ["경쟁사·업계는 어떤가?", "국내 기업 79%가 내년 AI 예산을 늘리지만 업무 정착은 12.5% 수준이다. 먼저 정착시키는 회사가 앞선다"],
    ["운영 인력은 어디서?", "파일럿은 기존 IT 인력 2명 + 외부 구축 지원, 확산 단계에서 3명 전담과 부서 챔피언. 오픈소스 기반이라 특정 업체 인력에 묶이지 않는다"],
    ["법적 문제(AI 기본법)는?", "2026.1 시행. 대외로 나가는 생성물에 AI 작성 표시, AI 사용 고지 규칙을 플랫폼에 내장한다. 고영향 AI에 해당하는 용도는 쓰지 않는다"],
  ],
];
QA.forEach((items, page) => {
  const s = content(`예상 질문과 답변 (${page + 1}/2)`, S7);
  items.forEach(([q, a], i) => {
    const x = 0.6 + (i % 2) * 6.15, y = 1.3 + Math.floor(i / 2) * 1.8;
    card(s, x, y, 5.95, 1.65, C.background2);
    txt(s, "Q. " + q, { x: x + 0.25, y: y + 0.12, w: 5.5, h: 0.4, fontSize: 15, bold: true, color: C.accent2 });
    txt(s, a, { x: x + 0.25, y: y + 0.55, w: 5.5, h: 1.05, fontSize: 13 });
  });
  s.addNotes("부록: 예상 질문과 답변. 근거 문서 14장에 같은 내용이 있다. 질문이 나오면 해당 카드를 띄워 답한다.");
});

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
