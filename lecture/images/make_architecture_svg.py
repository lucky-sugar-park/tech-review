"""AI 공장장 일반 아키텍처 SVG 생성 (배치를 직접 지정).

사용법: python make_architecture_svg.py architecture.svg
"""
import sys

W, H = 1200, 960
FONT = "'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo','Nanum Gothic',sans-serif"

PAL = {
    "user":  ("#eef4ff", "#3b6fd8"),
    "ai":    ("#fff4e5", "#e08a00"),
    "tool":  ("#eefaf0", "#2e9e4f"),
    "model": ("#f5eefc", "#8a4fd8"),
    "store": ("#f4f4f4", "#707070"),
    "mes":   ("#e8f6f8", "#1f8a9e"),
    "shop":  ("#fdeeee", "#c94141"),
}

out = []
add = out.append


def text(x, y, lines, size=13, weight="normal", fill="#1a1a1a", anchor="middle"):
    if isinstance(lines, str):
        lines = [lines]
    lh = size * 1.35
    y0 = y - (len(lines) - 1) * lh / 2
    for i, ln in enumerate(lines):
        add(f'<text x="{x}" y="{y0 + i * lh:.1f}" font-size="{size}" font-weight="{weight}" '
            f'fill="{fill}" text-anchor="{anchor}" dominant-baseline="middle">{ln}</text>')


def band(x, y, w, h, kind, title):
    bg, st = PAL[kind]
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{bg}" fill-opacity="0.55" stroke="{st}" stroke-width="1.5"/>')
    add(f'<text x="{x + 14}" y="{y + 20}" font-size="14" font-weight="bold" fill="{st}">{title}</text>')


def box(x, y, w, h, kind, lines, bold_first=True):
    bg, st = PAL[kind]
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" fill="#ffffff" stroke="{st}" stroke-width="1.4"/>')
    if bold_first and isinstance(lines, list) and len(lines) > 1:
        lh = 13 * 1.35
        y0 = y + h / 2 - (len(lines) - 1) * lh / 2
        add(f'<text x="{x + w / 2}" y="{y0:.1f}" font-size="14" font-weight="bold" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">{lines[0]}</text>')
        for i, ln in enumerate(lines[1:], 1):
            add(f'<text x="{x + w / 2}" y="{y0 + i * lh:.1f}" font-size="12" fill="#444" text-anchor="middle" dominant-baseline="middle">{ln}</text>')
    else:
        text(x + w / 2, y + h / 2, lines, size=13)


def cyl(x, y, w, h, kind, lines):
    bg, st = PAL[kind]
    ry = 7
    add(f'<path d="M{x},{y + ry} a{w / 2},{ry} 0 0,0 {w},0 a{w / 2},{ry} 0 0,0 {-w},0 v{h - 2 * ry} '
        f'a{w / 2},{ry} 0 0,0 {w},0 v{-(h - 2 * ry)}" fill="#ffffff" stroke="{st}" stroke-width="1.4"/>')
    lh = 13 * 1.35
    y0 = y + h / 2 + 3 - (len(lines) - 1) * lh / 2
    add(f'<text x="{x + w / 2}" y="{y0:.1f}" font-size="14" font-weight="bold" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">{lines[0]}</text>')
    for i, ln in enumerate(lines[1:], 1):
        add(f'<text x="{x + w / 2}" y="{y0 + i * lh:.1f}" font-size="12" fill="#444" text-anchor="middle" dominant-baseline="middle">{ln}</text>')


def arrow(points, color="#333", width=2.2, dashed=False, both=False):
    d = "M" + " L".join(f"{px},{py}" for px, py in points)
    dash = ' stroke-dasharray="6 5"' if dashed else ""
    start = ' marker-start="url(#arrS)"' if both else ""
    add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}"{dash} marker-end="url(#arrE)"{start}/>')


def label(x, y, lines, color="#333", size=12, bg="#ffffff"):
    if isinstance(lines, str):
        lines = [lines]
    w = max(len(ln) for ln in lines) * size * 0.95 + 16
    h = len(lines) * size * 1.35 + 8
    add(f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" rx="5" fill="{bg}" stroke="{color}" stroke-width="1"/>')
    text(x, y, lines, size=size, fill=color, weight="bold")


add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="{FONT}">')
add('<defs>'
    '<marker id="arrE" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker>'
    '<marker id="arrS" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker>'
    '</defs>')
add(f'<rect x="0" y="0" width="{W}" height="{H}" fill="#ffffff"/>')

# 제목과 사내망 경계
text(W / 2, 26, "MES 위에 AI 공장장을 얹는 일반 아키텍처 (중소기업용 경량 구성)", size=19, weight="bold")
add(f'<rect x="20" y="48" width="{W - 40}" height="{H - 68}" rx="14" fill="none" stroke="#9a9a9a" stroke-width="1.5" stroke-dasharray="8 6"/>')
add(f'<text x="{W - 36}" y="68" font-size="13" fill="#777" text-anchor="end">사내망 (온프레미스) · 데이터가 공장 밖으로 나가지 않음</text>')

# ① 사용자 채널
band(60, 80, 1080, 96, "user", "① 사용자 채널")
box(150, 108, 250, 56, "user", ["웹·모바일", "아침 브리핑 · 채팅 질의"])
box(475, 108, 250, 56, "user", ["승인함", "생산관리자 · 품질 엔지니어"])
box(800, 108, 250, 56, "user", ["알림", "사내 메신저 · 이메일"])

# ② AI 공장장 서비스
band(60, 226, 1080, 122, "ai", "② AI 공장장 서비스 · Python · FastAPI · LangGraph")
ai_boxes = [(85, ["스케줄러 · 이벤트 수신", "07:00 브리핑 · 알람 · 불량 급증"]),
            (350, ["슈퍼바이저", "상황 분류 · 위임 · 종합"]),
            (615, ["도메인 에이전트", "생산·계획 · 품질 · 설비 · 브리핑"]),
            (880, ["검증", "근거 없는 수치 차단 · 스키마"])]
for bx, lines in ai_boxes:
    box(bx, 258, 235, 72, "ai", lines)
for bx in (320, 585, 850):
    arrow([(bx, 294), (bx + 28, 294)], color=PAL["ai"][1], width=2)

# ①↔② (양방향)
arrow([(600, 178), (600, 224)], both=True)
label(690, 201, "브리핑 · 질의 · 승인")

# ③ 도구 계층 / ④ 모델 서빙
band(60, 404, 720, 124, "tool", "③ 도구 계층 · MCP 서버 (숫자는 여기서만 나온다)")
tool_boxes = [(78, ["MES 조회", "읽기 전용 템플릿"]),
              (253, ["문서 RAG", "작업표준서 · 매뉴얼"]),
              (428, ["최적화 솔버", "OR-Tools 재계획"]),
              (603, ["실행 요청", "승인 대기열 등록"])]
for bx, lines in tool_boxes:
    box(bx, 440, 160, 68, "tool", lines)

band(810, 404, 330, 124, "model", "④ 모델 서빙 · GPU 서버 1대")
box(828, 440, 145, 68, "model", ["Ollama / vLLM", "오픈 LLM"])
box(983, 440, 140, 68, "model", ["임베딩", "재순위 모델"])

# ②→③ 도구 호출, ②↔④ 추론
arrow([(420, 350), (420, 402)], width=2.6)
label(500, 376, "도구 호출")
arrow([(975, 350), (975, 402)], both=True)
label(1045, 376, "추론")

# ⑤ AI 전용 저장소
band(810, 566, 330, 116, "store", "⑤ AI 전용 저장소")
cyl(830, 600, 130, 66, "store", ["벡터 DB", "pgvector"])
cyl(975, 600, 150, 66, "store", ["운영 DB", "판단 기록 · 감사 로그"])
arrow([(1140, 287), (1160, 287), (1160, 624), (1142, 624)], color="#707070", width=1.8)
label(1160, 560, ["기록"], color="#555")

# ⑥ 기존 MES
band(60, 716, 1080, 122, "mes", "⑥ 기존 MES · 교체하지 않음")
box(85, 750, 235, 70, "mes", ["이벤트 발행", "MQTT · Kafka"])
box(345, 750, 260, 70, "mes", ["MES 화면·로직", "기준정보 · 계획 · 실적 · 품질 · 설비 · 출하"])
cyl(630, 752, 220, 68, "mes", ["MES DB", "작업지시 · 실적 · 출하 · 재고"])
box(875, 750, 240, 70, "mes", ["MES 쓰기 API", "작업지시 변경 등"])

# ③→⑥ 읽기 / 쓰기
arrow([(158, 510), (158, 600), (700, 600), (700, 748)], color=PAL["tool"][1], width=2.4)
label(430, 600, "읽기: 조회 템플릿만 (읽기 전용 계정)", color=PAL["tool"][1])
arrow([(683, 510), (683, 560), (790, 560), (790, 700), (995, 700), (995, 748)], color="#c94141", width=2.4)
label(895, 700, "쓰기: 사람 승인 후 API로만", color="#c94141")

# ⑥→② 이벤트 (점선, 왼쪽 여백으로)
arrow([(85, 785), (40, 785), (40, 294), (83, 294)], color=PAL["mes"][1], width=1.8, dashed=True)
label(98, 560, ["이벤트", "실적·불량·알람"], color=PAL["mes"][1], size=11)

# ⑦ 현장
band(60, 868, 1080, 70, "shop", "⑦ 현장")
box(300, 884, 260, 44, "shop", ["POP 단말 · 바코드"], bold_first=False)
box(640, 884, 260, 44, "shop", ["PLC · 센서 (OPC UA · Modbus)"], bold_first=False)
arrow([(475, 882), (475, 822)], color=PAL["shop"][1], width=2.2)
label(560, 852, "실적 · 설비 데이터", color=PAL["shop"][1], size=11)

add("</svg>")
open(sys.argv[1], "w", encoding="utf-8").write("\n".join(out))
print("written", sys.argv[1])
