"""Backend-neutral, privacy-minimized ATS tools for the RH assistant.

All candidate reads go through ``ats_store`` so the assistant sees the same
SQLite or Supabase records as the rest of the application.
"""
import json
import re
import unicodedata
from typing import Any, Dict, List, Optional

import ats_store


_EMAIL_RE = re.compile(r"\b[\w.+%'-]+@[\w.-]+\.[A-Za-z]{2,}\b")
_PHONE_RE = re.compile(r"(?<!\w)(?:\+?\d[\d .()\-/]{6,}\d)(?!\w)")


def _as_dict(row: Any) -> Dict[str, Any]:
    if row is None:
        return {}
    return dict(row)


def _json_object(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except (TypeError, ValueError):
            pass
    return {}


def _strip_accents(text: Any) -> str:
    normalized = unicodedata.normalize("NFD", str(text or "").casefold())
    return "".join(c for c in normalized if unicodedata.category(c) != "Mn")


def _anonymize(text: Any, full_name: Any = "") -> str:
    """Remove direct identifiers before CV-derived content leaves this server."""
    value = str(text or "")
    name = str(full_name or "").strip()
    if name:
        value = re.sub(re.escape(name), "[CANDIDAT]", value, flags=re.IGNORECASE)
    value = _EMAIL_RE.sub("[EMAIL]", value)
    value = _PHONE_RE.sub("[TÉLÉPHONE]", value)
    return value


def _scrub(value: Any, full_name: Any = "") -> Any:
    if isinstance(value, str):
        return _anonymize(value, full_name)
    if isinstance(value, list):
        return [_scrub(item, full_name) for item in value]
    if isinstance(value, dict):
        return {key: _scrub(item, full_name) for key, item in value.items()}
    return value


def _analysis_fields(row: Dict[str, Any]):
    analysis = _json_object(row.get("local_analysis_json"))
    meta = analysis.get("sothema") if isinstance(analysis.get("sothema"), dict) else {}
    skills = meta.get("skills") or analysis.get("skills") or []
    education = analysis.get("education") or []
    experience = analysis.get("experience") or []
    return analysis, meta, skills, education, experience


def get_ats_overview() -> Dict[str, Any]:
    """Summarize candidates from the configured ATS persistence backend."""
    rows = [_as_dict(row) for row in ats_store.assistant_candidate_rows()]
    status_counts: Dict[str, int] = {}
    role_counts: Dict[str, int] = {}
    scores = []
    for row in rows:
        status = row.get("review") or "a_examiner"
        status_counts[status] = status_counts.get(status, 0) + 1
        role = str(row.get("target_role") or "").strip()
        if role:
            role_counts[role] = role_counts.get(role, 0) + 1
        if row.get("score") is not None:
            try:
                scores.append(float(row["score"]))
            except (TypeError, ValueError):
                pass
    return {
        "total_candidates": len(rows),
        "status_breakdown": status_counts,
        "score_stats": {
            "average": round(sum(scores) / len(scores), 1) if scores else 0,
            "min": min(scores) if scores else 0,
            "max": max(scores) if scores else 0,
        },
        "top_target_roles": [
            {"role": role, "count": count}
            for role, count in sorted(role_counts.items(), key=lambda item: (-item[1], item[0]))[:8]
        ],
    }


def search_candidates(
    keyword: Optional[str] = None,
    target_role: Optional[str] = None,
    min_score: Optional[int] = None,
    review_status: Optional[str] = None,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """Search/filter ATS candidates; expose IDs and skills, never contact details."""
    rows = [_as_dict(row) for row in ats_store.assistant_candidate_rows()]
    needle = _strip_accents(keyword).strip()
    role_needle = _strip_accents(target_role).strip()
    status_needle = str(review_status or "").strip().casefold()
    try:
        score_floor = int(min_score) if min_score is not None else None
    except (TypeError, ValueError):
        score_floor = None
    try:
        limit = min(max(1, int(limit)), 25)
    except (TypeError, ValueError):
        limit = 10

    matched = []
    for row in rows:
        if role_needle and role_needle not in _strip_accents(row.get("target_role")):
            continue
        if score_floor is not None:
            try:
                if int(row.get("score") or 0) < score_floor:
                    continue
            except (TypeError, ValueError):
                continue
        if status_needle and str(row.get("review") or "a_examiner").casefold() != status_needle:
            continue
        analysis, meta, skills, _education, _experience = _analysis_fields(row)
        search_text = " ".join(str(value or "") for value in (
            row.get("full_name"), row.get("target_role"), row.get("raw_text"),
            row.get("summary"), json.dumps(skills, ensure_ascii=False),
        ))
        if needle and needle not in _strip_accents(search_text):
            continue
        matched.append({
            "id": row.get("id"),
            "candidate": f"Candidat #{row.get('id')}",
            "target_role": row.get("target_role") or "Non spécifié",
            "score": row.get("score") or 0,
            "status": row.get("review") or "a_examiner",
            "top_skills": skills[:6] if isinstance(skills, list) else [],
        })
    matched.sort(key=lambda row: (row["score"], row["id"] or 0), reverse=True)
    return matched[:limit]


def get_candidate_profile(candidate_id: int) -> Optional[Dict[str, Any]]:
    """Return a candidate profile without name, contact fields, or RH notes."""
    row = _as_dict(ats_store.get_assistant_candidate(int(candidate_id)))
    if not row:
        return None
    _analysis, _meta, skills, education, experience = _analysis_fields(row)
    return {
        "id": row.get("id"),
        "candidate": f"Candidat #{row.get('id')}",
        "summary": _anonymize(row.get("summary"), row.get("full_name")),
        "score": row.get("score") or 0,
        "confidence": round(float(row.get("confidence") or 0), 2),
        "status": row.get("review") or "a_examiner",
        "target_role": row.get("target_role") or "Non spécifié",
        "created_at": row.get("created_at"),
        "skills": _scrub(skills if isinstance(skills, list) else [], row.get("full_name")),
        "education": _scrub(education if isinstance(education, list) else [], row.get("full_name")),
        "experience": _scrub(experience if isinstance(experience, list) else [], row.get("full_name")),
    }


def get_candidate_cv_text(candidate_id: int, max_chars: int = 4000) -> Optional[Dict[str, Any]]:
    """Return a truncated CV excerpt with direct identifiers redacted."""
    row = _as_dict(ats_store.get_assistant_candidate(int(candidate_id)))
    if not row:
        return None
    raw = _anonymize(row.get("raw_text"), row.get("full_name")).strip()
    try:
        max_chars = min(max(1, int(max_chars)), 8000)
    except (TypeError, ValueError):
        max_chars = 4000
    truncated = len(raw) > max_chars
    if truncated:
        raw = raw[:max_chars] + "\n... [Texte tronqué pour limiter le contexte]"
    return {
        "id": row.get("id"),
        "candidate": f"Candidat #{row.get('id')}",
        "target_role": row.get("target_role") or "Non spécifié",
        "text": raw,
        "is_truncated": truncated,
    }


def compare_candidates(candidate_ids: List[int]) -> List[Dict[str, Any]]:
    """Compare up to four candidates using anonymized profile data."""
    candidates = []
    for candidate_id in (candidate_ids or [])[:4]:
        profile = get_candidate_profile(int(candidate_id))
        if profile:
            candidates.append({
                "id": profile["id"],
                "candidate": profile["candidate"],
                "target_role": profile["target_role"],
                "score": profile["score"],
                "status": profile["status"],
                "skills": profile["skills"][:8],
                "summary": profile["summary"][:200] if profile["summary"] else "Aucun résumé",
            })
    return candidates
