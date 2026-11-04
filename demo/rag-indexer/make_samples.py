"""convert.py 데모용 원본 샘플(raw/)을 만든다. 생성된 파일은 저장소에 포함되어 있으므로 다시 만들 때만 실행한다.

필요: pip install python-docx python-pptx
"""

import json
from pathlib import Path

from docx import Document
from docx.shared import Pt
from pptx import Presentation
from pptx.util import Inches, Pt as PPt

RAW = Path(__file__).parent / "raw"


def make_docx():
    path = RAW / "standards" / "WI-INJ02-C310_Rev2.docx"
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = Document()
    doc.sections[0].header.paragraphs[0].text = "미래정밀 · 사내 한정 · 무단 복제 금지"   # 머리말 (본문에 섞이면 안 됨)
    doc.add_heading("C-310 커버 사출 작업표준서", level=1)
    doc.add_paragraph("적용 설비: 3호기 사출기 · 적용 품목: C-310 · 작성: 생산기술팀")
    doc.add_heading("1. 사출 조건", level=2)
    doc.add_paragraph("아래 조건으로 설정하고, 금형 교체 후 첫 10쇼트는 조건 확인용으로 폐기한다.")
    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    for c, h in zip(table.rows[0].cells, ["항목", "설정값", "허용 범위"]):
        c.text = h
    for row in [("실린더 온도", "230 ℃", "± 5 ℃"), ("금형 온도", "60 ℃", "± 3 ℃"),
                ("사출 압력", "85 MPa", "± 5 MPa"), ("냉각 시간", "18 초", "16~20 초")]:
        cells = table.add_row().cells
        for c, v in zip(cells, row):
            c.text = v
    doc.add_heading("2. 수지 건조", level=2)
    doc.add_paragraph("PC/ABS 수지는 80 ℃에서 4시간 이상 건조한다. 건조가 부족하면 은줄 불량이 생긴다.")
    doc.add_heading("3. 이상 시 조치", level=2)
    for t in ["버가 생기면 금형 온도와 형체력을 먼저 확인한다.",
              "은줄이 생기면 건조 시간과 건조기 필터를 확인한다.",
              "흑점이 생기면 실린더 히터 상태(E-217 알람 이력)를 확인한다."]:
        doc.add_paragraph(t, style="List Bullet")
    for p in doc.paragraphs:
        for r in p.runs:
            r.font.size = Pt(11)
    doc.save(path)
    meta = {"doc_id": "WI-INJ02-C310", "doc_type": "작업표준서", "revision": "Rev.2", "status": "유효",
            "process": "사출", "equipment": "3호기", "item": "C-310", "acl": "생산"}
    path.with_name(path.name + ".meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def make_pptx():
    path = RAW / "training" / "보전교육_사출기_일상점검.pptx"
    path.parent.mkdir(parents=True, exist_ok=True)
    prs = Presentation()
    s = prs.slides.add_slide(prs.slide_layouts[0])
    s.shapes.title.text = "사출기 일상 점검 교육"
    s.placeholders[1].text = "보전팀 · 신입 작업자 교육용"

    s = prs.slides.add_slide(prs.slide_layouts[1])
    s.shapes.title.text = "작업 시작 전 점검 항목"
    body = s.placeholders[1].text_frame
    body.text = "작동유 레벨이 게이지 중간 이상인지 확인"
    for t in ["냉각수 밸브 열림과 유량 확인", "안전문 인터록 동작 확인", "노즐 주변 수지 누출 여부 확인"]:
        body.add_paragraph().text = t
    s.notes_slide.notes_text_frame.text = "인터록은 안전문을 열었을 때 형개폐가 멈추는지 실제로 눌러서 확인하게 하세요."

    s = prs.slides.add_slide(prs.slide_layouts[5])
    s.shapes.title.text = "이상 징후와 조치"
    rows = [("징후", "의심 원인", "조치"), ("진동 증가", "모터 베어링 마모", "보전팀 연락, 4.5 mm/s 초과 시 점검"),
            ("작동유 온도 상승", "냉각수 부족", "냉각수 유량 확인"), ("이상 소음", "토글 윤활 부족", "윤활 상태 점검")]
    tbl = s.shapes.add_table(len(rows), 3, Inches(0.5), Inches(1.6), Inches(9), Inches(2)).table
    for r, row in enumerate(rows):
        for c, v in enumerate(row):
            tbl.cell(r, c).text = v
            tbl.cell(r, c).text_frame.paragraphs[0].runs[0].font.size = PPt(14)

    s = prs.slides.add_slide(prs.slide_layouts[6])   # 그림만 있는 슬라이드 (텍스트가 거의 없음 → 검수 대상)
    png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
           b"\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\xc9\xfe\x92\xef\x00\x00\x00\x00IEND\xaeB`\x82")
    img = RAW / "training" / "_tmp.png"
    img.write_bytes(png)
    s.shapes.add_picture(str(img), Inches(1), Inches(1), Inches(8), Inches(5))
    img.unlink()
    prs.save(path)


def make_txt():
    path = RAW / "notices" / "품질공지_2026-10.txt"
    path.parent.mkdir(parents=True, exist_ok=True)
    head = "미래정밀 품질팀 공지"
    pages = [
        f"{head}\n\n2026년 10월 품질 공지\n\n1. 흑점 불량 증가\n최근 C-310에서 흑점 불량이 늘었습니다. 원인은 3호기 실린더 히터 단선(E-217)으로 인한 수지 체류 탄화로 확인되었습니다.\n가. 3호기 E-217 알람이 뜨면 즉시 보전팀에 연락합니다.\n나. 알람 해제 후 첫 20쇼트는 전수 검사합니다.\n\n- 1 -",
        f"{head}\n\n2. 검사 기준 개정 예정\nC-310 외관 검사 기준서가 11월에 Rev.6으로 개정될 예정입니다. 흑점 판정 기준이 직경 0.3 mm에서 0.2 mm로 강화됩니다.\n\n3. 문의\n품질팀 내선 2130\n\n- 2 -",
    ]
    path.write_bytes("\f".join(pages).encode("cp949"))   # 국내 PC에서 흔한 cp949(EUC-KR) 인코딩으로 저장


if __name__ == "__main__":
    make_docx()
    make_pptx()
    make_txt()
    print("raw/ 샘플 생성 완료")
