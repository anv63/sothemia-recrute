import json
from types import SimpleNamespace

import pytest

import sothema_quality as quality
from utils.ai_resume_analyzer import AIResumeAnalyzer


def test_normalize_ai_profile_keeps_source_fields_and_drops_protected():
    profile = quality.normalize_ai_profile(
        {
            "name": "Jane Doe",
            "email": "jane@example.test",
            "location": "Casablanca",
            "age": "31",
            "nationality": "Moroccan",
        },
        "Jane Doe\njane@example.test\nCasablanca",
    )
    assert profile["name"] == "Jane Doe"
    assert profile["email"] == "jane@example.test"
    assert profile["location"] == "Casablanca"
    assert "age" not in profile
    assert "nationality" not in profile
    assert profile["needs_human_review"] is True


def test_normalize_ai_profile_rejects_invented_values():
    with pytest.raises(ValueError, match="no verifiable"):
        quality.normalize_ai_profile({"name": "Invented Person"}, "Visible CV text")


def test_normalize_ai_profile_accepts_source_quote_with_phone_formatting():
    profile = quality.normalize_ai_profile(
        {
            "name": "Jane Doe",
            "phone": "+2120612345678",
            "source_quotes": {
                "name": "Jane Doe",
                "phone": "+212 (0) 6 12 34 56 78",
            },
        },
        "Jane Doe\nTéléphone : +212 (0) 6 12 34 56 78",
    )
    assert profile["name"] == "Jane Doe"
    assert profile["phone"] == "+2120612345678"
    assert profile["field_evidence"]["phone"] == "+212 (0) 6 12 34 56 78"


def test_normalize_ai_profile_keeps_supported_partial_fields():
    profile = quality.normalize_ai_profile(
        {
            "name": "Jane Doe",
            "email": "jane@example.test",
            "headline": "Quality Manager",
            "experience": ["Quality Manager — Sothema"],
            "source_quotes": {
                "name": "Jane Doe",
                "email": "jane@example.test",
                "headline": "Quality Manager",
                "experience": ["2021–present | Quality Manager — Sothema"],
            },
        },
        "Jane Doe\njane@example.test\nQuality Manager\n2021–present | Quality Manager — Sothema",
    )
    assert profile["name"] == "Jane Doe"
    assert profile["experience"] == ["Quality Manager — Sothema"]
    assert "location" not in profile


def test_normalize_ai_profile_rejects_protected_source_quote():
    profile = quality.normalize_ai_profile(
        {
            "name": "Jane Doe",
            "source_quotes": {"name": "Jane Doe"},
            "nationality": "Marocaine",
        },
        "Jane Doe\nNationalité : Marocaine",
    )
    assert "nationality" not in profile
    assert profile["name"] == "Jane Doe"


def test_name_validation_rejects_body_sentence_when_header_has_name():
    profile = quality.normalize_ai_profile(
        {
            "name": "Developed a full-stack application",
            "email": "jake@example.test",
            "source_quotes": {
                "name": "Developed a full-stack application",
                "email": "jake@example.test",
            },
        },
        "Jake Ryan\njake@example.test\nDeveloped a full-stack application using Flask",
        name_source_text="Jake Ryan\njake@example.test",
    )
    assert "name" not in profile
    assert profile["email"] == "jake@example.test"


    analysis = {"name": "Local Name", "ats_score": 72, "sothema": {"confidence": 0.8}}
    updated = quality.apply_ai_profile(
        analysis,
        {"name": "Jane Smith", "email": "name@example.test"},
        "Jane Smith name@example.test",
    )
    assert updated["name"] == "Jane Smith"
    assert updated["email"] == "name@example.test"
    assert updated["ats_score"] == 72
    assert updated["sothema"]["confidence"] == 0.8


def test_detect_name_uses_visual_header_not_first_extracted_column():
    from pathlib import Path

    from utils.document_extractor import extract_document
    from utils.resume_analyzer import ResumeAnalyzer

    pdf_path = Path(__file__).resolve().parents[2] / "syzfjbzwjncs_1.pdf"
    if not pdf_path.exists():
        pytest.skip("reported sample PDF is not available")
    extraction = extract_document(pdf_path.name, pdf_path.read_bytes())
    analysis = quality.prepare_analysis(
        extraction.display_text, ResumeAnalyzer(), {}, "", extraction=extraction
    )
    assert analysis["name"] == "Jake Ryan"
    assert analysis["sothema"]["name"] == "Jake Ryan"
    assert extraction.display_text.splitlines()[0] == "Jake Ryan"
    assert "Developed a full-stack web application" not in analysis["name"]


def test_ai_profile_extractor_parses_fenced_json():
    assert AIResumeAnalyzer._parse_profile_json('```json\n{"name":"Jane Doe"}\n```') == {"name": "Jane Doe"}


def test_ai_profile_extractor_retries_non_json_response():
    analyzer = AIResumeAnalyzer()
    responses = [
        SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="I found Jane Doe in the header."), finish_reason="stop")]),
        SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='{"name":"Jane Doe","source_quotes":{"name":"Jane Doe"}}'), finish_reason="stop")]),
    ]
    calls = []

    def create(**kwargs):
        calls.append(kwargs)
        return responses.pop(0)

    analyzer.openai_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=create))
    )
    result = analyzer.extract_candidate_profile("Jane Doe", header_context="Jane Doe")
    assert result["profile"]["name"] == "Jane Doe"
    assert len(calls) == 2
    assert "valid JSON" in calls[1]["messages"][-1]["content"]


def test_ai_profile_extractor_surfaces_invalid_json_after_retry():
    analyzer = AIResumeAnalyzer()
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="no structured output"), finish_reason="stop")]
    )
    analyzer.openai_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **_kwargs: response))
    )
    result = analyzer.extract_candidate_profile("Jane Doe")
    assert "error" in result
    assert "JSON object" in result["error"]


def test_ai_profile_extractor_returns_profile_json(monkeypatch):
    analyzer = AIResumeAnalyzer()
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content='{"name":"Jane Doe","email":"jane@example.test"}'), finish_reason="stop")]
    )
    analyzer.openai_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **_kwargs: response))
    )
    result = analyzer.extract_candidate_profile("Jane Doe jane@example.test")
    assert result["profile"]["name"] == "Jane Doe"
