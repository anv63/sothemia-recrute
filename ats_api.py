"""Small local API sharing the Streamlit ATS extraction and SQLite store."""
from __future__ import annotations

import hmac
import json
import os
from pathlib import Path

from flask import Flask, jsonify, request

from ats_store import DuplicateCandidateError, backend_name, get_candidate, init_ats_db, list_candidates, save_ai_result, save_candidate
from utils import document_extractor
from utils.resume_analyzer import ResumeAnalyzer
import sothema_quality as quality

app = Flask(__name__)
analyzer = ResumeAnalyzer()
init_ats_db()
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
SUPPORTED_UPLOAD_EXTENSIONS = {".pdf", ".docx", *(f".{extension}" for extension in document_extractor.SUPPORTED_IMAGE_FORMATS)}


@app.before_request
def require_api_token():
    configured_token = os.environ.get("SOTHEMA_INGEST_API_TOKEN", "")
    if not configured_token:
        return jsonify({"error": "API authentication is not configured"}), 503
    authorization = request.headers.get("Authorization", "")
    scheme, _, supplied_token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not supplied_token or not hmac.compare_digest(
        supplied_token, configured_token
    ):
        return jsonify({"error": "Bearer token required"}), 401


def json_value(value, fallback=None):
    try:
        return json.loads(value) if value else (fallback if fallback is not None else {})
    except (TypeError, json.JSONDecodeError):
        return fallback if fallback is not None else {}


def candidate_json(row):
    local = json_value(row["local_analysis_json"])
    meta = local.get("sothema") or {}
    name = row["full_name"] or row["source_filename"] or "Nom non détecté"
    parts = name.split(maxsplit=1)
    extraction = meta.get("extraction") or {}
    return {
        "id": str(row["id"]), "firstName": parts[0], "lastName": parts[1] if len(parts) > 1 else "",
        "email": row["email"] or "", "phone": row["phone"] or "", "summary": row["summary"] or "",
        "cvText": row["raw_text"] or "", "score": row["score"] if row["score"] is not None else local.get("ats_score"),
        "skills": meta.get("skills", local.get("skills", [])) or [],
        "processing": row["processing"] or "ready", "review": row["review"] or "a_examiner",
        "createdAt": row["created_at"], "updatedAt": row["updated_at"],
        "file": {"name": row["source_filename"], "type": row["file_type"],
                 "sizeKb": round((row["file_size"] or 0) / 1024), "hash": row["fingerprint"],
                 "pages": extraction.get("page_count", 1), "stored": True},
        "confidence": row["confidence"] if row["confidence"] is not None else meta.get("confidence"),
        "fieldConfidence": meta.get("field_confidence", {}),
        "readabilityConfidence": meta.get("readability_confidence"),
        "semanticConfidence": meta.get("semantic_confidence"),
        "confidenceReasons": meta.get("confidence_reasons", []),
        "extraction": extraction,
        "city": "", "targetRole": row["target_role"] or "", "department": "",
        "experienceYears": None, "languages": [], "education": [], "experience": [],
        "certifications": [], "mobility": "", "notes": row["notes"] or "",
    }


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "sothema-ats", "storage": backend_name(),
                    "capabilities": document_extractor.runtime_capabilities()})


@app.get("/api/candidates")
def candidates():
    rows = list_candidates(request.args.get("q", ""))
    return jsonify({"candidates": [candidate_json(r) for r in rows], "count": len(rows)})


@app.get("/api/candidates/<int:cid>")
def candidate(cid):
    row = get_candidate(cid)
    if not row:
        return jsonify({"error": "Candidate not found"}), 404
    return jsonify(candidate_json(row))


@app.post("/api/candidates/upload")
def upload():
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "A PDF, DOCX or supported image file is required"}), 400
    filename = Path(uploaded.filename).name
    suffix = Path(filename).suffix.lower()
    content = uploaded.read()
    if suffix not in SUPPORTED_UPLOAD_EXTENSIONS:
        return jsonify({"error": "Only PDF, DOCX, PNG, JPG/JPEG, TIFF, BMP, GIF and WebP files are accepted"}), 400
    if len(content) > MAX_UPLOAD_BYTES:
        return jsonify({"error": "File exceeds the 10 MB limit"}), 413
    if suffix in {".pdf", ".docx"}:
        valid_signature = (suffix == ".pdf" and content.startswith(b"%PDF")) or (suffix == ".docx" and content.startswith(b"PK"))
        if not content or not valid_signature:
            return jsonify({"error": "File signature is invalid or the file is empty"}), 400
    else:
        try:
            document_extractor.validate_image(filename, content)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
    try:
        extraction = document_extractor.extract_document(filename, content)
        raw = extraction.normalized_text
        if not raw.strip():
            return jsonify({"error": "Could not extract readable text", "extraction": extraction.as_dict()}), 422
        analysis = quality.prepare_analysis(raw, analyzer, extraction=extraction)
        if analysis.get("error") or analysis.get("document_type") != "resume":
            return jsonify({"error": "Document does not appear to be a CV", "document_type": analysis.get("document_type"),
                            "extraction": extraction.as_dict()}), 422
        meta = analysis["sothema"]
        cid = save_candidate(filename, content, raw, analysis, full_name=meta["name"],
                             score=int(analysis.get("ats_score") or 0), confidence=meta["confidence"])
    except DuplicateCandidateError as duplicate:
        return jsonify({"error": "Exact duplicate", "candidateId": duplicate.candidate_id}), 409
    except Exception as exc:
        return jsonify({"error": f"Processing failed: {exc}"}), 422
    row = get_candidate(cid)
    return jsonify(candidate_json(row)), 201


@app.post("/api/candidates/<int:cid>/ai-analysis")
def ai_analysis(cid):
    body = request.get_json(silent=True) or {}
    provider = body.get("provider", "local")
    result = body.get("result") or {}
    if not get_candidate(cid):
        return jsonify({"error": "Candidate not found"}), 404
    save_ai_result(cid, provider, result)
    return jsonify({"ok": True, "provider": provider})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
