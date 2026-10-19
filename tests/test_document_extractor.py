from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Table
from docx import Document

from utils.document_extractor import extract_document
from utils.resume_analyzer import ResumeAnalyzer
from sothema_quality import prepare_analysis


def make_pdf(path: Path):
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(str(path), pagesize=A4)
    table = Table([[Paragraph("ALICE DUPONT<br/>alice@example.com<br/>EXPERIENCE<br/>Engineer 2021-2024", styles["BodyText"]),
                    Paragraph("EDUCATION<br/>Master Computer Science 2021<br/>SKILLS<br/>Python | SQL", styles["BodyText"])]],
                  colWidths=[250, 250])
    doc.build([table, PageBreak(), Paragraph("ALICE DUPONT", styles["Title"]),
               Paragraph("EXPERIENCE EDUCATION SKILLS", styles["BodyText"])])


def make_docx(path: Path):
    doc = Document()
    doc.add_paragraph("ALICE DUPONT")
    doc.add_paragraph("Professional profile and experience")
    table = doc.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "Skills"
    table.cell(0, 1).text = "Python | SQL"
    table.cell(1, 0).text = "Education"
    table.cell(1, 1).text = "Master Computer Science"
    doc.sections[0].header.paragraphs[0].text = "CV HEADER"
    doc.sections[0].footer.paragraphs[0].text = "CV FOOTER"
    doc.save(path)


def test_pdf_columns_and_provenance(tmp_path):
    path = tmp_path / "columns.pdf"
    make_pdf(path)
    result = extract_document(path.name, path.read_bytes())
    assert result.page_count == 2
    assert "ALICE DUPONT" in result.text
    assert "alice@example.com" in result.text
    assert any(method == "pdf_text_columns" for method in result.methods)
    assert result.as_dict()["source_lines"]
    assert all("page" in line and "line" in line for line in result.as_dict()["source_lines"])


def test_docx_tables_headers_and_semantic_analysis(tmp_path):
    path = tmp_path / "table.docx"
    make_docx(path)
    result = extract_document(path.name, path.read_bytes())
    assert "Python | SQL" in result.text
    assert "CV HEADER" in result.text
    assert result.tables >= 1
    analysis = prepare_analysis(result.text, ResumeAnalyzer(), extraction=result)
    assert analysis["document_type"] == "resume"
    assert analysis["sothema"]["extraction"]["tables"] >= 1
    assert 0 <= analysis["sothema"]["confidence"] <= 1


def test_invalid_document_is_not_silently_accepted():
    result = extract_document("not-a-cv.docx", b"PK\x03\x04")
    assert result.warnings
