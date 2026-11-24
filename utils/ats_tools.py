"""
Sothema ATS Tools for AI Recruiter Agent.
Provides query, search, comparison, and profile retrieval tools across resume_data.db.
Works with both SQLite (local) and Supabase (cloud) via ats_store abstraction.
"""
import json
import sqlite3
import unicodedata
from typing import Any, Dict, List, Optional
from ats_store import DB_PATH, conn as get_db_connection


def _strip_accents(text: Any) -> str:
    if not text:
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", str(text).lower())
        if unicodedata.category(c) != "Mn"
    )


def get_ats_overview() -> Dict[str, Any]:
    """
    Get high-level summary statistics of the ATS pipeline:
    Total candidates, breakdown by review status, average ATS score, and top job roles.
    """
    conn = get_db_connection()
    try:
        total_candidates = conn.execute("SELECT COUNT(*) FROM ats_candidates").fetchone()[0]

        # Status breakdown
        status_rows = conn.execute(
            "SELECT COALESCE(review, 'a_examiner') as st, COUNT(*) FROM ats_candidates GROUP BY st"
        ).fetchall()
        status_counts = {row[0]: row[1] for row in status_rows}

        # Average score
        avg_score_row = conn.execute(
            "SELECT ROUND(AVG(score), 1), MIN(score), MAX(score) FROM ats_candidates WHERE score IS NOT NULL"
        ).fetchone()
        avg_score = avg_score_row[0] or 0
        min_score = avg_score_row[1] or 0
        max_score = avg_score_row[2] or 0

        # Top target roles
        role_rows = conn.execute(
            """SELECT target_role, COUNT(*) as cnt 
               FROM ats_candidates 
               WHERE target_role IS NOT NULL AND target_role != '' 
               GROUP BY target_role 
               ORDER BY cnt DESC LIMIT 8"""
        ).fetchall()
        top_roles = [{"role": r[0], "count": r[1]} for r in role_rows]

        return {
            "total_candidates": total_candidates,
            "status_breakdown": status_counts,
            "score_stats": {
                "average": avg_score,
                "min": min_score,
                "max": max_score,
            },
            "top_target_roles": top_roles,
        }
    finally:
        conn.close()


def search_candidates(
    keyword: Optional[str] = None,
    target_role: Optional[str] = None,
    min_score: Optional[int] = None,
    review_status: Optional[str] = None,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """
    Search and filter candidates in the CVthèque.
    
    Args:
        keyword: Text to search in name, skills, summary, or raw resume text.
        target_role: Substring match for target job title (e.g. 'électromécanique', 'agronome').
        min_score: Minimum ATS score (0 to 100).
        review_status: Candidate status ('a_examiner', 'retenu', 'rejete', 'vivier', 'en_cours').
        limit: Max candidates to return (default 10, max 25).
    """
    conn = get_db_connection()
    try:
        conn.create_function("accent_match", 2, lambda needle, haystack: _strip_accents(needle) in _strip_accents(haystack))
    except Exception:
        pass

    limit = min(max(1, limit), 25)
    query_parts = ["SELECT id, full_name, target_role, score, review, email, phone, local_analysis_json FROM ats_candidates WHERE 1=1"]
    params: List[Any] = []

    if target_role and target_role.strip():
        query_parts.append("AND accent_match(?, target_role)")
        params.append(target_role.strip())

    if min_score is not None:
        query_parts.append("AND score >= ?")
        params.append(int(min_score))

    if review_status and review_status.strip():
        query_parts.append("AND LOWER(COALESCE(review, 'a_examiner')) = ?")
        params.append(review_status.strip().lower())

    if keyword and keyword.strip():
        kw = keyword.strip()
        query_parts.append(
            "AND (accent_match(?, full_name) OR accent_match(?, target_role) OR accent_match(?, raw_text) OR accent_match(?, summary))"
        )
        params.extend([kw, kw, kw, kw])

    query_parts.append("ORDER BY score DESC, id DESC LIMIT ?")
    params.append(limit)

    full_sql = " ".join(query_parts)

    try:
        rows = conn.execute(full_sql, params).fetchall()
        results = []
        for r in rows:
            skills = []
            if r[7]:
                try:
                    analysis = json.loads(r[7])
                    meta = analysis.get("sothema", {})
                    skills = meta.get("skills") or analysis.get("skills") or []
                except Exception:
                    pass

            results.append({
                "id": r[0],
                "name": r[1] or f"Candidat #{r[0]}",
                "target_role": r[2] or "Non spécifié",
                "score": r[3] or 0,
                "status": r[4] or "a_examiner",
                "email": r[5] or "Non renseigné",
                "phone": r[6] or "Non renseigné",
                "top_skills": skills[:6] if isinstance(skills, list) else [],
            })
        return results
    finally:
        conn.close()


def get_candidate_profile(candidate_id: int) -> Optional[Dict[str, Any]]:
    """
    Get the complete structured profile for a specific candidate by ID.
    Includes contact info, skills, education, experience, ATS score, notes, and status.
    """
    conn = get_db_connection()
    try:
        row = conn.execute(
            """SELECT id, full_name, email, phone, summary, score, confidence, 
                      review, notes, target_role, created_at, local_analysis_json 
               FROM ats_candidates WHERE id = ?""",
            (int(candidate_id),),
        ).fetchone()

        if not row:
            return None

        analysis_dict = {}
        if row[11]:
            try:
                analysis_dict = json.loads(row[11])
            except Exception:
                pass

        meta = analysis_dict.get("sothema", {})
        skills = meta.get("skills") or analysis_dict.get("skills") or []
        education = analysis_dict.get("education") or []
        experience = analysis_dict.get("experience") or []

        return {
            "id": row[0],
            "name": row[1] or f"Candidat #{row[0]}",
            "email": row[2] or "Non renseigné",
            "phone": row[3] or "Non renseigné",
            "summary": row[4] or "",
            "score": row[5] or 0,
            "confidence": round(float(row[6] or 0.7), 2),
            "status": row[7] or "a_examiner",
            "notes": row[8] or "",
            "target_role": row[9] or "Non spécifié",
            "created_at": row[10],
            "skills": skills,
            "education": education,
            "experience": experience,
        }
    finally:
        conn.close()


def get_candidate_cv_text(candidate_id: int, max_chars: int = 4000) -> Optional[Dict[str, Any]]:
    """
    Retrieve the extracted full text of a candidate's CV for in-depth analysis or interview preparation.
    """
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT id, full_name, target_role, raw_text FROM ats_candidates WHERE id = ?",
            (int(candidate_id),),
        ).fetchone()

        if not row:
            return None

        raw = (row[3] or "").strip()
        truncated = len(raw) > max_chars
        if truncated:
            raw = raw[:max_chars] + "\n... [Texte tronqué pour limiter le contexte]"

        return {
            "id": row[0],
            "name": row[1] or f"Candidat #{row[0]}",
            "target_role": row[2] or "Non spécifié",
            "text": raw,
            "is_truncated": truncated,
        }
    finally:
        conn.close()


def compare_candidates(candidate_ids: List[int]) -> List[Dict[str, Any]]:
    """
    Compare multiple candidates side-by-side by ID.
    Returns comparison cards with scores, roles, skills, and summary.
    """
    candidates = []
    for cid in candidate_ids[:4]:  # compare at most 4 candidates at once
        profile = get_candidate_profile(cid)
        if profile:
            candidates.append({
                "id": profile["id"],
                "name": profile["name"],
                "target_role": profile["target_role"],
                "score": profile["score"],
                "status": profile["status"],
                "skills": profile["skills"][:8],
                "summary": profile["summary"][:200] if profile["summary"] else "Aucun résumé",
            })
    return candidates
