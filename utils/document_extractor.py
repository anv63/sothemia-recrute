"""Layout-aware PDF/DOCX extraction for Sothema.

This module deliberately has no Streamlit dependency and never scores a CV. It returns
text plus provenance and warnings so the caller can decide how to display and persist it.
"""
from __future__ import annotations

import io
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
import zipfile
from dataclasses import asdict, dataclass, field
from pathlib import Path
from statistics import median
from typing import Callable, Iterable


Progress = Callable[[str], None] | None


@dataclass
class SourceLine:
    text: str
    page: int
    line: int
    method: str
    block: str = "body"
    column: int | None = None
    bbox: tuple[float, float, float, float] | None = None

    def as_dict(self) -> dict:
        value = asdict(self)
        if self.bbox is not None:
            value["bbox"] = list(self.bbox)
        return value


@dataclass
class ExtractionResult:
    filename: str
    file_type: str
    page_count: int = 0
    normalized_text: str = ""
    display_text: str = ""
    source_lines: list[SourceLine] = field(default_factory=list)
    methods: list[str] = field(default_factory=list)
    evidence_lines: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    tables: int = 0
    ocr_pages: list[int] = field(default_factory=list)
    empty_pages: list[int] = field(default_factory=list)
    repeated_headers_removed: list[str] = field(default_factory=list)
    readability_confidence: float = 0.0
    semantic_signals: dict[str, bool] = field(default_factory=dict)

    @property
    def text(self) -> str:
        """Compatibility alias used by callers that only need the normalized text."""
        return self.normalized_text

    def as_dict(self) -> dict:
        return {
            "version": 1,
            "filename": self.filename,
            "file_type": self.file_type,
            "page_count": self.page_count,
            "methods": list(dict.fromkeys(self.methods)),
            "warnings": self.warnings,
            "tables": self.tables,
            "ocr_pages": self.ocr_pages,
            "empty_pages": self.empty_pages,
            "repeated_headers_removed": self.repeated_headers_removed,
            "readability_confidence": self.readability_confidence,
            "semantic_signals": self.semantic_signals,
            "source_lines": list(self.evidence_lines),
        }


def _notify(progress: Progress, message: str) -> None:
    if progress:
        progress(message)


def _clean_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    value = value.replace("­", "").replace("﻿", "")
    # Common PDF ligatures that survive NFKC in some encodings.
    value = value.replace("ﬁ", "fi").replace("ﬂ", "fl").replace("–", "-").replace("—", "-")
    value = re.sub(r"[ \t]+", " ", value)
    return value.strip()


def _norm_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", _clean_text(value).lower()).strip()


def _append_line(result: ExtractionResult, text: str, page: int, method: str, *, block="body",
                 column=None, bbox=None) -> None:
    text = _clean_text(text)
    if not text:
        return
    result.source_lines.append(SourceLine(text, page, 0, method, block, column, bbox))
    result.methods.append(method)


def _group_pdf_words(words: list[dict], tolerance: float = 3.2) -> list[dict]:
    """Group pdfplumber word boxes into visual lines while preserving x coordinates."""
    rows: list[dict] = []
    for word in sorted(words, key=lambda item: (float(item.get("top", 0)), float(item.get("x0", 0)))):
        top = float(word.get("top", 0))
        row = next((candidate for candidate in reversed(rows) if abs(candidate["top"] - top) <= tolerance), None)
        if row is None:
            row = {"top": top, "bottom": float(word.get("bottom", top)), "words": []}
            rows.append(row)
        row["words"].append(word)
        row["bottom"] = max(row["bottom"], float(word.get("bottom", top)))
    output = []
    for row in sorted(rows, key=lambda item: item["top"]):
        row["words"].sort(key=lambda item: float(item.get("x0", 0)))
        # A visual line can contain two independent columns. Split at the largest
        # horizontal gap so column content is not interleaved into one sentence.
        gaps = [
            (float(b.get("x0", 0)) - float(a.get("x1", 0)), index)
            for index, (a, b) in enumerate(zip(row["words"], row["words"][1:]))
        ]
        segments = [row["words"]]
        if gaps:
            gap, split_at = max(gaps)
            if gap >= 24:
                segments = [row["words"][:split_at + 1], row["words"][split_at + 1:]]
        for segment in segments:
            if not segment:
                continue
            text = _clean_text(" ".join(str(item.get("text", "")) for item in segment))
            if not text:
                continue
            output.append({
                "text": text,
                "top": row["top"],
                "bottom": row["bottom"],
                "x0": min(float(item.get("x0", 0)) for item in segment),
                "x1": max(float(item.get("x1", 0)) for item in segment),
            })
    return output


def _has_two_columns(lines: list[dict], width: float) -> bool:
    if len(lines) < 8 or not width:
        return False
    left = [line for line in lines if (line["x0"] + line["x1"]) / 2 < width * 0.48 and line["x1"] < width * 0.68]
    right = [line for line in lines if (line["x0"] + line["x1"]) / 2 > width * 0.52 and line["x0"] > width * 0.32]
    return len(left) >= 3 and len(right) >= 3 and len(left) + len(right) >= len(lines) * 0.55


def _pdf_page_lines(page, page_number: int, result: ExtractionResult) -> list[SourceLine]:
    """Extract a page in a stable visual order, including tables where possible."""
    try:
        words = page.extract_words(keep_blank_chars=False, use_text_flow=False, x_tolerance=2, y_tolerance=3)
    except Exception:
        words = []
    visual = _group_pdf_words(words)
    width = float(getattr(page, "width", 0) or 0)
    two_columns = _has_two_columns(visual, width)
    page_lines: list[SourceLine] = []

    if visual:
        if two_columns:
            full = [line for line in visual if line["x0"] <= width * 0.12 and line["x1"] >= width * 0.88]
            left = [line for line in visual if line not in full and (line["x0"] + line["x1"]) / 2 < width * 0.5]
            right = [line for line in visual if line not in full and (line["x0"] + line["x1"]) / 2 >= width * 0.5]
            ordered = [(line, None) for line in sorted(full, key=lambda x: x["top"])]
            ordered += [(line, 1) for line in sorted(left, key=lambda x: x["top"])]
            ordered += [(line, 2) for line in sorted(right, key=lambda x: x["top"])]
            method = "pdf_text_columns"
        else:
            ordered = [(line, None) for line in visual]
            method = "pdf_text"
        for line, column in ordered:
            source = SourceLine(line["text"], page_number, 0, method, "body", column,
                                (line["x0"], line["top"], line["x1"], line["bottom"]))
            page_lines.append(source)
    else:
        try:
            fallback = _clean_text(page.extract_text(layout=True) or page.extract_text() or "")
        except Exception:
            fallback = ""
        if fallback:
            page_lines = [SourceLine(line, page_number, 0, "pdf_layout_fallback")
                          for line in fallback.splitlines() if _clean_text(line)]
            result.methods.append("pdf_layout_fallback")

    # A table can be more semantically useful than the interleaved glyph stream.
    try:
        tables = page.extract_tables() or []
    except Exception:
        tables = []
    existing = {_norm_key(line.text) for line in page_lines}
    for table_index, table in enumerate(tables, start=1):
        table_added = False
        for row in table or []:
            cells = [_clean_text(cell or "") for cell in (row or [])]
            cells = [cell for cell in cells if cell]
            if not cells:
                continue
            text = " | ".join(cells)
            if _norm_key(text) in existing:
                continue
            page_lines.append(SourceLine(text, page_number, 0, "pdf_table", f"table_{table_index}"))
            existing.add(_norm_key(text))
            table_added = True
        if table_added:
            result.tables += 1
            result.methods.append("pdf_table")

    # If extraction produced only a tiny fragment, let the fallback text extractor try once.
    if sum(len(line.text) for line in page_lines) < 20:
        try:
            fallback = _clean_text(page.extract_text(layout=True) or page.extract_text() or "")
        except Exception:
            fallback = ""
        if fallback and len(fallback) > sum(len(line.text) for line in page_lines):
            page_lines = [SourceLine(line, page_number, 0, "pdf_layout_fallback")
                          for line in fallback.splitlines() if _clean_text(line)]
            result.methods.append("pdf_layout_fallback")
    return page_lines


def _tesseract_available() -> bool:
    return bool(shutil.which("tesseract"))


def _ocr_pdf_page(page, page_number: int) -> list[SourceLine]:
    if not _tesseract_available():
        return []
    try:
        import pytesseract
        image = page.to_image(resolution=160).original
        text = pytesseract.image_to_string(image, config="--psm 3")
        return [SourceLine(line, page_number, 0, "ocr") for line in text.splitlines() if _clean_text(line)]
    except Exception:
        return []


def _remove_repeated_headers(lines: list[SourceLine], page_count: int, result: ExtractionResult) -> list[SourceLine]:
    if page_count < 2:
        return lines
    by_page: dict[int, list[SourceLine]] = {}
    for line in lines:
        by_page.setdefault(line.page, []).append(line)
    candidates: dict[str, list[int]] = {}
    for page, page_lines in by_page.items():
        edge = page_lines[:2] + page_lines[-2:]
        for line in edge:
            key = _norm_key(line.text)
            if len(key) >= 4:
                candidates.setdefault(key, []).append(page)
    repeated = {key for key, pages in candidates.items() if len(set(pages)) >= max(2, page_count // 2)}
    if not repeated:
        return lines
    removed = []
    kept = []
    for line in lines:
        if _norm_key(line.text) in repeated and line.page > 1:
            removed.append(line.text)
        else:
            kept.append(line)
    result.repeated_headers_removed = sorted(set(removed))[:10]
    if result.repeated_headers_removed:
        result.warnings.append("repeated_header_footer_removed")
    return kept


def _finalize(result: ExtractionResult) -> ExtractionResult:
    result.source_lines = _remove_repeated_headers(result.source_lines, result.page_count, result)
    if result.source_lines and not result.methods:
        result.methods = list(dict.fromkeys(line.method for line in result.source_lines))
    for index, line in enumerate(result.source_lines, start=1):
        line.line = index
    result.evidence_lines = [{
        "text": line.text,
        "page": line.page,
        "line": line.line,
        "method": line.method,
        "block": line.block,
        "column": line.column,
        "bbox": list(line.bbox) if line.bbox is not None else None,
    } for line in result.source_lines]
    lines = []
    current_page = None
    current_column = None
    for line in result.source_lines:
        if line.page != current_page:
            current_page = line.page
            current_column = None
            if line.page > 1:
                lines.append(f"[PAGE {line.page}]")
        if line.column is not None and line.column != current_column:
            lines.append(f"[COLUMN {line.column}]")
            current_column = line.column
        if line.method == "pdf_table" or line.method == "docx_table":
            if not lines or lines[-1] != "[TABLE]":
                lines.append("[TABLE]")
        elif line.method == "ocr" and (not lines or lines[-1] != "[OCR]"):
            lines.append("[OCR]")
        lines.append(line.text)
    result.display_text = "\n".join(lines).strip()
    result.normalized_text = result.display_text
    readable = len(re.sub(r"\[\w+\]", "", result.normalized_text).strip())
    coverage = readable / max(1, result.page_count * 900)
    method_bonus = 0.12 if "pdf_text_columns" in result.methods or "pdf_table" in result.methods or "docx_table" in result.methods else 0
    if result.empty_pages:
        coverage *= max(0.25, 1 - len(result.empty_pages) / max(1, result.page_count))
    result.readability_confidence = round(min(1.0, max(0.0, coverage + method_bonus)), 2)
    low = result.page_count and len(result.empty_pages) / result.page_count
    if result.ocr_pages:
        result.warnings.append("ocr_used")
    if result.empty_pages:
        result.warnings.append("empty_or_unreadable_pages")
        if not _tesseract_available():
            result.warnings.append("ocr_unavailable")
    result.warnings = list(dict.fromkeys(result.warnings))
    lowered = result.normalized_text.lower()
    result.semantic_signals = {
        "contact": bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+|(?:linkedin|github)\.com", lowered)),
        "sections": sum(bool(re.search(pattern, lowered)) for pattern in (
            r"\b(?:experience|work history|employment|expérience|parcours)\b",
            r"\b(?:education|formation|academic|dipl[oô]me)\b",
            r"\b(?:skills|compétences|competences|expertise|technologies)\b",
            r"\b(?:summary|profile|profil|objective|about me)\b",
        )),
        "dates": bool(re.search(r"\b(?:19|20)\d{2}\b", lowered)),
        "role_language": bool(re.search(r"\b(?:manager|engineer|developer|analyst|assistant|responsable|ingénieur|développeur|analyste|professionnel|poste)\b", lowered)),
        "structured_content": bool(result.tables or "[COLUMN 2]" in result.normalized_text or "•" in result.normalized_text),
    }
    return result


def extract_pdf(filename: str, content: bytes, progress: Progress = None) -> ExtractionResult:
    result = ExtractionResult(Path(filename).name, "pdf")
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            result.page_count = len(pdf.pages)
            for page_number, page in enumerate(pdf.pages, start=1):
                _notify(progress, f"Page {page_number}/{result.page_count} — lecture de la mise en page")
                page_lines = _pdf_page_lines(page, page_number, result)
                if not page_lines:
                    _notify(progress, f"Page {page_number}/{result.page_count} — OCR si disponible")
                    page_lines = _ocr_pdf_page(page, page_number)
                    if page_lines:
                        result.ocr_pages.append(page_number)
                        result.methods.append("ocr")
                if not page_lines:
                    result.empty_pages.append(page_number)
                result.source_lines.extend(page_lines)
    except Exception as exc:
        result.warnings.append(f"pdf_parser_error:{type(exc).__name__}")
        # pdftotext is a safe, external fallback for malformed but readable PDFs.
        tool = shutil.which("pdftotext")
        if tool:
            with tempfile.NamedTemporaryFile(suffix=".pdf") as handle:
                handle.write(content)
                handle.flush()
                completed = subprocess.run([tool, "-layout", handle.name, "-"], capture_output=True,
                                           text=True, timeout=30, check=False)
            text = completed.stdout.strip()
            if text:
                result.page_count = max(1, text.count("\f") + 1)
                result.source_lines = [SourceLine(line, 1, 0, "pdftotext_layout")
                                       for line in text.replace("\f", "\n").splitlines() if _clean_text(line)]
                result.methods.append("pdftotext_layout")
    if not result.page_count:
        result.page_count = 1
    return _finalize(result)


def _xml_text(element, ns: str = "http://schemas.openxmlformats.org/wordprocessingml/2006/main") -> str:
    return _clean_text("".join(node.text or "" for node in element.iter(f"{{{ns}}}t")))


def _docx_body_lines(xml_bytes: bytes, page: int, method: str) -> list[SourceLine]:
    from lxml import etree
    ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    root = etree.fromstring(xml_bytes)
    body = root.find(f"{{{ns}}}body")
    if body is None:
        body = root
    lines: list[SourceLine] = []
    for child in body:
        tag = etree.QName(child).localname
        if tag == "p":
            text = _xml_text(child, ns)
            if text:
                lines.append(SourceLine(text, page, 0, method, "body"))
        elif tag == "tbl":
            for row in child.iter(f"{{{ns}}}tr"):
                cells = [_xml_text(cell, ns) for cell in row.findall(f"{{{ns}}}tc")]
                cells = [cell for cell in cells if cell]
                if cells:
                    lines.append(SourceLine(" | ".join(cells), page, 0, "docx_table", "table"))
    return lines


def _docx_header_footer_lines(z: zipfile.ZipFile, page: int) -> list[SourceLine]:
    lines: list[SourceLine] = []
    for name in sorted(z.namelist()):
        if not (name.startswith("word/header") or name.startswith("word/footer")) or not name.endswith(".xml"):
            continue
        try:
            from lxml import etree
            root = etree.fromstring(z.read(name))
            ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            for paragraph in root.iter(f"{{{ns}}}p"):
                text = _xml_text(paragraph, ns)
                if text:
                    lines.append(SourceLine(text, page, 0, "docx_header_footer", "header_footer"))
        except Exception:
            continue
    return lines


def extract_docx(filename: str, content: bytes, progress: Progress = None) -> ExtractionResult:
    result = ExtractionResult(Path(filename).name, "docx", page_count=1)
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            document = archive.read("word/document.xml")
            _notify(progress, "Lecture des paragraphes, tableaux et zones de texte DOCX")
            result.source_lines.extend(_docx_body_lines(document, 1, "docx_xml"))
            result.source_lines.extend(_docx_header_footer_lines(archive, 1))
            if any(line.method == "docx_table" for line in result.source_lines):
                result.tables = sum(line.method == "docx_table" for line in result.source_lines)
                result.methods.append("docx_table")
            result.methods.append("docx_xml")
            # Section/page breaks are not a reliable page count, but give a useful lower bound.
            result.page_count = max(1, sum(line.text.count("[PAGE BREAK]") for line in result.source_lines) + 1)
    except Exception as exc:
        result.warnings.append(f"docx_parser_error:{type(exc).__name__}")
    if not result.source_lines:
        result.empty_pages.append(1)
    return _finalize(result)


def extract_document(filename: str, content: bytes, progress: Progress = None) -> ExtractionResult:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        return extract_pdf(filename, content, progress)
    if suffix == ".docx":
        return extract_docx(filename, content, progress)
    raise ValueError("Only PDF and DOCX documents are supported")


def runtime_capabilities() -> dict[str, str | bool]:
    return {
        "poppler": bool(shutil.which("pdftoppm") or shutil.which("pdftocairo")),
        "tesseract": _tesseract_available(),
        "pdftotext": bool(shutil.which("pdftotext")),
    }
