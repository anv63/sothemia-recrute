import hashlib
import json
import os
import sqlite3
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

# SOTHEMA_DB_PATH lets tests run against a scratch copy; production uses resume_data.db.
DB_PATH = Path(os.environ.get("SOTHEMA_DB_PATH") or Path(__file__).resolve().parent / "resume_data.db")

REVIEW_LABELS = {
    "a_examiner": "À examiner",
    "en_revue": "En revue",
    "retenu": "Présélectionné",
    "en_attente": "En attente",
    "archive": "Archivé",
}

# Columns added after the first version of ats_candidates; applied in place on startup.
_CANDIDATE_MIGRATIONS = {
    "file_size": "INTEGER",
    "score": "INTEGER",
    "confidence": "REAL",
    "processing": "TEXT DEFAULT 'ready'",
    "review": "TEXT DEFAULT 'a_examiner'",
    "notes": "TEXT DEFAULT ''",
    "reviewed_by": "TEXT",
    "reviewed_at": "TEXT",
    "created_by": "TEXT",
    "target_role": "TEXT DEFAULT ''",
}

_LIST_COLUMNS = """
    id, source_filename, file_type, file_size, full_name, email, phone, summary,
    raw_text, fingerprint, score, confidence, processing, review, notes, reviewed_by, reviewed_at, target_role,
    created_at, updated_at, local_analysis_json
"""


class DuplicateCandidateError(Exception):
    """Raised when the exact same original CV has already been ingested."""

    def __init__(self, candidate_id):
        self.candidate_id = candidate_id
        super().__init__(f"This exact file is already stored as candidate #{candidate_id}.")


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def conn():
    connection = sqlite3.connect(DB_PATH, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def fingerprint(file_bytes):
    return hashlib.sha256(file_bytes).hexdigest()


def init_ats_db():
    with conn() as connection:
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS ats_candidates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fingerprint TEXT UNIQUE,
                source_filename TEXT,
                original_file BLOB,
                file_type TEXT,
                full_name TEXT,
                email TEXT,
                phone TEXT,
                summary TEXT,
                raw_text TEXT,
                structured_json TEXT,
                local_analysis_json TEXT,
                ai_analysis_json TEXT,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS ats_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT,
                candidate_id INTEGER,
                details TEXT,
                created_at TEXT
            );
        """)
        existing = {row["name"] for row in connection.execute("PRAGMA table_info(ats_candidates)")}
        for column, ddl in _CANDIDATE_MIGRATIONS.items():
            if column not in existing:
                connection.execute(f"ALTER TABLE ats_candidates ADD COLUMN {column} {ddl}")
        audit_columns = {row["name"] for row in connection.execute("PRAGMA table_info(ats_audit_log)")}
        if "actor" not in audit_columns:
            connection.execute("ALTER TABLE ats_audit_log ADD COLUMN actor TEXT")
        connection.executescript("""
            CREATE INDEX IF NOT EXISTS ix_ats_candidates_email ON ats_candidates(email);
            CREATE INDEX IF NOT EXISTS ix_ats_candidates_review ON ats_candidates(review);
            CREATE INDEX IF NOT EXISTS ix_ats_audit_candidate ON ats_audit_log(candidate_id);
        """)


def _audit(connection, action, candidate_id=None, details=None, actor=""):
    if details is not None and not isinstance(details, str):
        details = json.dumps(details, ensure_ascii=False, default=str)
    connection.execute(
        "INSERT INTO ats_audit_log(action, candidate_id, details, created_at, actor) VALUES (?, ?, ?, ?, ?)",
        (action, candidate_id, details, _now(), actor or ""),
    )


def log_event(action, candidate_id=None, details=None, actor=""):
    """Append an audit entry outside any candidate transaction (logins, rejected uploads, exports)."""
    connection = conn()
    try:
        with connection:
            _audit(connection, action, candidate_id, details, actor)
    finally:
        connection.close()


def candidate_count():
    connection = conn()
    try:
        return connection.execute("SELECT COUNT(*) FROM ats_candidates").fetchone()[0]
    finally:
        connection.close()


def audit_count():
    connection = conn()
    try:
        return connection.execute("SELECT COUNT(*) FROM ats_audit_log").fetchone()[0]
    finally:
        connection.close()


def find_by_fingerprint(sha256):
    connection = conn()
    try:
        row = connection.execute("SELECT id FROM ats_candidates WHERE fingerprint = ?", (sha256,)).fetchone()
        return row["id"] if row else None
    finally:
        connection.close()


def find_by_email(email, exclude_id=None):
    """Ids of other dossiers sharing this e-mail (probable duplicates)."""
    email = (email or "").strip().lower()
    if not email:
        return []
    connection = conn()
    try:
        rows = connection.execute(
            "SELECT id FROM ats_candidates WHERE lower(email) = ? AND id != ? ORDER BY id",
            (email, exclude_id or -1),
        ).fetchall()
        return [row["id"] for row in rows]
    finally:
        connection.close()


def save_candidate(filename, file_bytes, raw_text, analysis, *, full_name=None, score=None,
                   confidence=None, target_role="", actor=""):
    """Persist original CV, extracted data, and ingestion audit in one transaction."""
    analysis = analysis or {}
    safe_name = Path(filename).name
    sha256 = fingerprint(file_bytes)
    now = _now()
    file_type = Path(safe_name).suffix.lower().lstrip(".")
    candidate_name = str((analysis.get("name") if full_name is None else full_name) or "").strip()
    email = str(analysis.get("email") or "").strip().lower()
    if score is None and isinstance(analysis.get("ats_score"), (int, float)):
        score = int(analysis["ats_score"])
    payload = json.dumps(analysis, ensure_ascii=False, default=str)

    connection = conn()
    try:
        with connection:
            existing = connection.execute(
                "SELECT id FROM ats_candidates WHERE fingerprint = ?", (sha256,)
            ).fetchone()
            if existing:
                raise DuplicateCandidateError(existing["id"])

            cursor = connection.execute("""
                INSERT INTO ats_candidates (
                    fingerprint, source_filename, original_file, file_type, file_size, full_name,
                    email, phone, summary, raw_text, structured_json, local_analysis_json,
                    score, confidence, processing, review, target_role, created_by,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', 'a_examiner', ?, ?, ?, ?)
            """, (
                sha256, safe_name, sqlite3.Binary(file_bytes), file_type, len(file_bytes),
                candidate_name, email, analysis.get("phone", ""), analysis.get("summary", ""),
                raw_text, payload, payload, score, confidence, target_role or "", actor or "", now, now,
            ))
            candidate_id = cursor.lastrowid
            _audit(connection, "candidate_ingested", candidate_id,
                   {"filename": safe_name, "sha256": sha256, "score": score, "confidence": confidence},
                   actor)
        return candidate_id
    finally:
        connection.close()


def list_candidates(query=""):
    """Candidates matching a free-text query on name, e-mail or CV text, newest first."""
    connection = conn()
    try:
        pattern = "%" + (query or "") + "%"
        return connection.execute(f"""
            SELECT {_LIST_COLUMNS}
            FROM ats_candidates
            WHERE full_name LIKE ? OR email LIKE ? OR raw_text LIKE ? OR source_filename LIKE ?
            ORDER BY created_at DESC, id DESC
        """, (pattern, pattern, pattern, pattern)).fetchall()
    finally:
        connection.close()


def search_candidates(terms):
    """Candidates whose indexed fields contain every term (AND), newest first."""
    connection = conn()
    try:
        where, params = [], []
        for term in terms:
            pattern = f"%{term}%"
            where.append("(full_name LIKE ? OR email LIKE ? OR raw_text LIKE ? OR source_filename LIKE ? OR target_role LIKE ?)")
            params += [pattern] * 5
        sql = f"SELECT {_LIST_COLUMNS} FROM ats_candidates"
        if where:
            sql += " WHERE " + " AND ".join(where)
        return connection.execute(sql + " ORDER BY created_at DESC, id DESC", params).fetchall()
    finally:
        connection.close()


def get_candidate(candidate_id):
    connection = conn()
    try:
        return connection.execute(
            "SELECT * FROM ats_candidates WHERE id = ?", (candidate_id,)
        ).fetchone()
    finally:
        connection.close()


def set_review(candidate_ids, review, actor=""):
    if review not in REVIEW_LABELS:
        raise ValueError(f"Unknown review status: {review}")
    now = _now()
    connection = conn()
    try:
        with connection:
            for candidate_id in candidate_ids:
                row = connection.execute("SELECT review FROM ats_candidates WHERE id = ?", (candidate_id,)).fetchone()
                if not row or row["review"] == review:
                    continue
                connection.execute("UPDATE ats_candidates SET review = ?, updated_at = ? WHERE id = ?",
                                   (review, now, candidate_id))
                _audit(connection, "review_status_changed", candidate_id,
                       {"from": row["review"], "to": review}, actor)
    finally:
        connection.close()


def validate_analysis(candidate_id, actor):
    """Record that a recruiter has read the advisory analysis and its evidence."""
    now = _now()
    connection = conn()
    try:
        with connection:
            connection.execute(
                "UPDATE ats_candidates SET reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
                (actor, now, now, candidate_id),
            )
            _audit(connection, "analysis_validated", candidate_id, None, actor)
    finally:
        connection.close()


def save_notes(candidate_id, notes, actor=""):
    notes = (notes or "")[:4000]
    now = _now()
    connection = conn()
    try:
        with connection:
            connection.execute("UPDATE ats_candidates SET notes = ?, updated_at = ? WHERE id = ?",
                               (notes, now, candidate_id))
            # Only the length is journaled: note contents stay out of the audit trail.
            _audit(connection, "notes_saved", candidate_id, {"length": len(notes)}, actor)
    finally:
        connection.close()


def update_local_analysis(candidate_id, analysis, *, score, confidence, target_role="", actor=""):
    """Replace the local analysis (e.g. re-run against job criteria); clears any prior validation."""
    now = _now()
    payload = json.dumps(analysis, ensure_ascii=False, default=str)
    connection = conn()
    try:
        with connection:
            previous = connection.execute("SELECT score FROM ats_candidates WHERE id = ?", (candidate_id,)).fetchone()
            connection.execute("""
                UPDATE ats_candidates
                SET local_analysis_json = ?, structured_json = ?, score = ?, confidence = ?,
                    target_role = ?, reviewed_by = NULL, reviewed_at = NULL, updated_at = ?
                WHERE id = ?
            """, (payload, payload, score, confidence, target_role or "", now, candidate_id))
            _audit(connection, "analysis_rerun", candidate_id,
                   {"criteria": target_role or "générale", "previous_score": previous["score"] if previous else None,
                    "score": score}, actor)
    finally:
        connection.close()


def save_ai_result(candidate_id, provider, result, actor=""):
    now = _now()
    connection = conn()
    try:
        with connection:
            connection.execute(
                "UPDATE ats_candidates SET ai_analysis_json = ?, updated_at = ? WHERE id = ?",
                (json.dumps({"provider": provider, "created_at": now, **result}, ensure_ascii=False, default=str),
                 now, candidate_id)
            )
            _audit(connection, "ai_analysis_saved", candidate_id, str(provider), actor)
    finally:
        connection.close()


def delete_candidates(candidate_ids, actor=""):
    connection = conn()
    try:
        with connection:
            for candidate_id in candidate_ids:
                row = connection.execute("SELECT source_filename, fingerprint FROM ats_candidates WHERE id = ?",
                                         (candidate_id,)).fetchone()
                if not row:
                    continue
                connection.execute("DELETE FROM ats_candidates WHERE id = ?", (candidate_id,))
                _audit(connection, "candidate_deleted", candidate_id,
                       {"filename": row["source_filename"], "sha256": row["fingerprint"]}, actor)
    finally:
        connection.close()


def list_audit(limit=1000, candidate_id=None):
    connection = conn()
    try:
        if candidate_id is None:
            return connection.execute(
                "SELECT * FROM ats_audit_log ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        return connection.execute(
            "SELECT * FROM ats_audit_log WHERE candidate_id = ? ORDER BY id DESC LIMIT ?", (candidate_id, limit)
        ).fetchall()
    finally:
        connection.close()


def audit_counts_since(days):
    """Audit actions grouped over the last N days (e.g. rejected uploads)."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")
    connection = conn()
    try:
        rows = connection.execute(
            "SELECT action, COUNT(*) AS n FROM ats_audit_log WHERE created_at >= ? GROUP BY action", (since,)
        ).fetchall()
        return {row["action"]: row["n"] for row in rows}
    finally:
        connection.close()


def storage_stats():
    connection = conn()
    try:
        files = connection.execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(original_file)), 0) AS bytes FROM ats_candidates"
        ).fetchone()
        return {
            "db_path": str(DB_PATH),
            "db_bytes": DB_PATH.stat().st_size if DB_PATH.exists() else 0,
            "originals": files["n"],
            "original_bytes": files["bytes"],
        }
    finally:
        connection.close()


def backup_bytes():
    """Consistent snapshot of the whole SQLite database using the online backup API."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        source, target = conn(), sqlite3.connect(path)
        try:
            source.backup(target)
        finally:
            target.close()
            source.close()
        return Path(path).read_bytes()
    finally:
        os.unlink(path)
