"""ATS persistence facade: Supabase in Streamlit Cloud, SQLite for local dev/tests."""
import hashlib
import json
import os
import sqlite3
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from config import supabase_store

DB_PATH = Path(os.environ.get("SOTHEMA_DB_PATH") or Path(__file__).resolve().parent / "resume_data.db")
REVIEW_LABELS = {
    "a_examiner": "À examiner", "en_revue": "En revue", "retenu": "Présélectionné",
    "en_attente": "En attente", "archive": "Archivé",
}
_CANDIDATE_MIGRATIONS = {
    "file_size": "INTEGER", "score": "INTEGER", "confidence": "REAL", "processing": "TEXT DEFAULT 'ready'",
    "review": "TEXT DEFAULT 'a_examiner'", "notes": "TEXT DEFAULT ''", "reviewed_by": "TEXT",
    "reviewed_at": "TEXT", "created_by": "TEXT", "target_role": "TEXT DEFAULT ''",
}
_LIST_COLUMNS = "id,source_filename,file_type,file_size,full_name,email,phone,summary,raw_text,fingerprint,score,confidence,processing,review,notes,reviewed_by,reviewed_at,target_role,created_at,updated_at,local_analysis_json,ai_analysis_json,storage_key"


class DuplicateCandidateError(Exception):
    def __init__(self, candidate_id):
        self.candidate_id = candidate_id
        super().__init__(f"This exact file is already stored as candidate #{candidate_id}.")


def backend_name():
    return supabase_store.backend_name()


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
    if backend_name() == "supabase":
        # The hosted schema is provisioned by supabase/migrations/001_initial.sql.
        return
    with conn() as connection:
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS ats_candidates (
                id INTEGER PRIMARY KEY AUTOINCREMENT, fingerprint TEXT UNIQUE, source_filename TEXT,
                original_file BLOB, file_type TEXT, full_name TEXT, email TEXT, phone TEXT, summary TEXT,
                raw_text TEXT, structured_json TEXT, local_analysis_json TEXT, ai_analysis_json TEXT,
                created_at TEXT, updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS ats_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, candidate_id INTEGER,
                details TEXT, created_at TEXT
            );
        """)
        existing = {row["name"] for row in connection.execute("PRAGMA table_info(ats_candidates)")}
        for column, ddl in _CANDIDATE_MIGRATIONS.items():
            if column not in existing:
                connection.execute(f"ALTER TABLE ats_candidates ADD COLUMN {column} {ddl}")
        audit_columns = {row["name"] for row in connection.execute("PRAGMA table_info(ats_audit_log)")}
        if "actor" not in audit_columns:
            connection.execute("ALTER TABLE ats_audit_log ADD COLUMN actor TEXT")
        if "storage_key" not in existing:
            connection.execute("ALTER TABLE ats_candidates ADD COLUMN storage_key TEXT")
        connection.executescript("""
            CREATE INDEX IF NOT EXISTS ix_ats_candidates_email ON ats_candidates(email);
            CREATE INDEX IF NOT EXISTS ix_ats_candidates_review ON ats_candidates(review);
            CREATE INDEX IF NOT EXISTS ix_ats_audit_candidate ON ats_audit_log(candidate_id);
        """)


def _as_dict(row):
    return dict(row) if row is not None else None


def _candidate(row):
    if row is None:
        return None
    data = dict(row)
    for field in ("structured_json", "local_analysis_json", "ai_analysis_json"):
        if isinstance(data.get(field), (dict, list)):
            data[field] = json.dumps(data[field], ensure_ascii=False, default=str)
    data.setdefault("original_file", None)
    data.setdefault("storage_key", None)
    data.setdefault("fingerprint", None)
    return data


def _audit(connection, action, candidate_id=None, details=None, actor=""):
    if details is not None and not isinstance(details, str):
        details = json.dumps(details, ensure_ascii=False, default=str)
    connection.execute(
        "INSERT INTO ats_audit_log(action, candidate_id, details, created_at, actor) VALUES (?, ?, ?, ?, ?)",
        (action, candidate_id, details, _now(), actor or ""),
    )


def log_event(action, candidate_id=None, details=None, actor=""):
    if backend_name() == "supabase":
        serialized = details if isinstance(details, str) or details is None else json.dumps(details, ensure_ascii=False, default=str)
        supabase_store.rpc("ats_log_event", {"p_action": action, "p_candidate_id": candidate_id,
                                              "p_details": serialized, "p_actor": actor or ""})
        return
    connection = conn()
    try:
        with connection:
            _audit(connection, action, candidate_id, details, actor)
    finally:
        connection.close()


def candidate_count():
    if backend_name() == "supabase":
        return int(supabase_store.table("ats_candidates").select("id", count="exact").execute().count or 0)
    connection = conn()
    try:
        return connection.execute("SELECT COUNT(*) FROM ats_candidates").fetchone()[0]
    finally:
        connection.close()


def audit_count():
    if backend_name() == "supabase":
        return int(supabase_store.table("ats_audit_log").select("id", count="exact").execute().count or 0)
    connection = conn()
    try:
        return connection.execute("SELECT COUNT(*) FROM ats_audit_log").fetchone()[0]
    finally:
        connection.close()


def find_by_fingerprint(sha256):
    if backend_name() == "supabase":
        rows = supabase_store.rows(supabase_store.table("ats_candidates").select("id").eq("fingerprint", sha256).limit(1).execute())
        return rows[0]["id"] if rows else None
    connection = conn()
    try:
        row = connection.execute("SELECT id FROM ats_candidates WHERE fingerprint = ?", (sha256,)).fetchone()
        return row["id"] if row else None
    finally:
        connection.close()


def find_by_email(email, exclude_id=None):
    email = (email or "").strip().lower()
    if not email:
        return []
    if backend_name() == "supabase":
        query = supabase_store.table("ats_candidates").select("id").ilike("email", email)
        if exclude_id is not None:
            query = query.neq("id", exclude_id)
        return [row["id"] for row in supabase_store.rows(query.order("id").execute())]
    connection = conn()
    try:
        rows = connection.execute("SELECT id FROM ats_candidates WHERE lower(email)=? AND id != ? ORDER BY id",
                                  (email, exclude_id or -1)).fetchall()
        return [row["id"] for row in rows]
    finally:
        connection.close()


def _candidate_payload(filename, file_bytes, raw_text, analysis, full_name, score, confidence, target_role, actor):
    safe_name = Path(filename).name
    sha = fingerprint(file_bytes)
    now = _now()
    candidate_name = str((analysis.get("name") if full_name is None else full_name) or "").strip()
    payload = json.loads(json.dumps(analysis or {}, ensure_ascii=False, default=str))
    return {
        "fingerprint": sha, "source_filename": safe_name, "file_type": Path(safe_name).suffix.lower().lstrip("."),
        "file_size": len(file_bytes), "full_name": candidate_name,
        "email": str((analysis or {}).get("email") or "").strip().lower(),
        "phone": (analysis or {}).get("phone", ""), "summary": (analysis or {}).get("summary", ""),
        "raw_text": raw_text, "structured_json": payload, "local_analysis_json": payload,
        "score": int(score if score is not None else (analysis or {}).get("ats_score") or 0),
        "confidence": confidence, "target_role": target_role or "", "created_by": actor or "",
        "created_at": now, "updated_at": now,
    }


def save_candidate(filename, file_bytes, raw_text, analysis, *, full_name=None, score=None,
                   confidence=None, target_role="", actor=""):
    """Persist CV and analysis; Supabase stores the binary in private object storage."""
    payload = _candidate_payload(filename, file_bytes, raw_text, analysis, full_name, score, confidence, target_role, actor)
    if backend_name() == "supabase":
        sha = payload["fingerprint"]
        existing = find_by_fingerprint(sha)
        if existing:
            raise DuplicateCandidateError(existing)
        object_id = uuid.uuid4().hex
        object_key = f"{object_id[:2]}/{object_id}.{payload['file_type']}"
        mime = "application/pdf" if payload["file_type"] == "pdf" else \
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        uploaded = False
        payload["storage_key"] = object_key
        try:
            supabase_store.upload_original(object_key, file_bytes, mime)
            uploaded = True
            response = supabase_store.rpc("ats_ingest_candidate", {"p_candidate": payload})
            candidate_id = getattr(response, "data", None)
            if isinstance(candidate_id, list):
                candidate_id = candidate_id[0] if candidate_id else None
            if isinstance(candidate_id, dict):
                candidate_id = next(iter(candidate_id.values()), None)
            if candidate_id is None:
                raise RuntimeError("Supabase ingest RPC returned no candidate ID")
            return int(candidate_id)
        except Exception as exc:
            if uploaded:
                try:
                    supabase_store.remove_original(object_key)
                except Exception:
                    pass
            if "23505" in str(exc) or "duplicate key" in str(exc).lower():
                existing = find_by_fingerprint(sha)
                if existing:
                    raise DuplicateCandidateError(existing) from exc
            raise

    connection = conn()
    try:
        with connection:
            existing = connection.execute("SELECT id FROM ats_candidates WHERE fingerprint = ?", (payload["fingerprint"],)).fetchone()
            if existing:
                raise DuplicateCandidateError(existing["id"])
            cursor = connection.execute("""
                INSERT INTO ats_candidates (
                    fingerprint, source_filename, original_file, file_type, file_size, full_name,
                    email, phone, summary, raw_text, structured_json, local_analysis_json,
                    score, confidence, processing, review, target_role, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', 'a_examiner', ?, ?, ?, ?)
            """, (payload["fingerprint"], payload["source_filename"], sqlite3.Binary(file_bytes), payload["file_type"],
                  payload["file_size"], payload["full_name"], payload["email"], payload["phone"], payload["summary"],
                  raw_text, json.dumps(payload["structured_json"], ensure_ascii=False),
                  json.dumps(payload["local_analysis_json"], ensure_ascii=False), payload["score"], confidence,
                  payload["target_role"], actor or "", payload["created_at"], payload["updated_at"]))
            candidate_id = cursor.lastrowid
            _audit(connection, "candidate_ingested", candidate_id,
                   {"filename": payload["source_filename"], "sha256": payload["fingerprint"],
                    "score": payload["score"], "confidence": confidence}, actor)
        return candidate_id
    finally:
        connection.close()


def list_candidates(query=""):
    if backend_name() == "supabase":
        builder = supabase_store.table("ats_candidates").select(_LIST_COLUMNS)
        if query:
            q = query.replace("%", "").replace(",", "")
            builder = builder.or_(f"full_name.ilike.%{q}%,email.ilike.%{q}%,raw_text.ilike.%{q}%,source_filename.ilike.%{q}%")
        return [_candidate(r) for r in supabase_store.rows(builder.order("created_at", desc=True).execute())]
    connection = conn()
    try:
        pattern = "%" + (query or "") + "%"
        return connection.execute(f"SELECT {_LIST_COLUMNS} FROM ats_candidates WHERE full_name LIKE ? OR email LIKE ? OR raw_text LIKE ? OR source_filename LIKE ? ORDER BY created_at DESC,id DESC",
                                  (pattern, pattern, pattern, pattern)).fetchall()
    finally:
        connection.close()


def search_candidates(terms):
    if backend_name() == "supabase":
        rows = list_candidates("")
        for term in terms:
            needle = str(term).casefold()
            rows = [row for row in rows if needle in " ".join(str(row.get(k) or "") for k in
                    ("full_name", "email", "raw_text", "source_filename", "target_role")).casefold()]
        return rows
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
        return connection.execute(sql + " ORDER BY created_at DESC,id DESC", params).fetchall()
    finally:
        connection.close()


def get_candidate(candidate_id):
    if backend_name() == "supabase":
        rows = supabase_store.rows(supabase_store.table("ats_candidates").select("*").eq("id", candidate_id).limit(1).execute())
        return _candidate(rows[0]) if rows else None
    connection = conn()
    try:
        return connection.execute("SELECT * FROM ats_candidates WHERE id=?", (candidate_id,)).fetchone()
    finally:
        connection.close()


def get_original_file(row):
    if row is None:
        return None
    if row.get("original_file") is not None:
        value = row["original_file"]
        return bytes(value) if not isinstance(value, bytes) else value
    if backend_name() == "supabase" and row.get("storage_key"):
        return supabase_store.download_original(row["storage_key"])
    return None


def set_review(candidate_ids, review, actor=""):
    if review not in REVIEW_LABELS:
        raise ValueError(f"Unknown review status: {review}")
    now = _now()
    if backend_name() == "supabase":
        supabase_store.rpc("ats_set_review", {"p_ids": list(candidate_ids), "p_review": review, "p_actor": actor or ""})
        return
    connection = conn()
    try:
        with connection:
            for candidate_id in candidate_ids:
                row = connection.execute("SELECT review FROM ats_candidates WHERE id=?", (candidate_id,)).fetchone()
                if not row or row["review"] == review:
                    continue
                connection.execute("UPDATE ats_candidates SET review=?,updated_at=? WHERE id=?", (review, now, candidate_id))
                _audit(connection, "review_status_changed", candidate_id, {"from": row["review"], "to": review}, actor)
    finally:
        connection.close()


def validate_analysis(candidate_id, actor):
    now = _now()
    if backend_name() == "supabase":
        supabase_store.rpc("ats_validate_analysis", {"p_id": candidate_id, "p_actor": actor or ""})
        return
    connection = conn()
    try:
        with connection:
            connection.execute("UPDATE ats_candidates SET reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=?",
                               (actor, now, now, candidate_id))
            _audit(connection, "analysis_validated", candidate_id, None, actor)
    finally:
        connection.close()


def save_notes(candidate_id, notes, actor=""):
    notes = (notes or "")[:4000]
    now = _now()
    if backend_name() == "supabase":
        supabase_store.rpc("ats_save_notes", {"p_id": candidate_id, "p_notes": notes, "p_actor": actor or ""})
        return
    connection = conn()
    try:
        with connection:
            connection.execute("UPDATE ats_candidates SET notes=?,updated_at=? WHERE id=?", (notes, now, candidate_id))
            _audit(connection, "notes_saved", candidate_id, {"length": len(notes)}, actor)
    finally:
        connection.close()


def update_local_analysis(candidate_id, analysis, *, score, confidence, target_role="", actor=""):
    now = _now()
    payload = json.loads(json.dumps(analysis, ensure_ascii=False, default=str))
    if backend_name() == "supabase":
        supabase_store.rpc("ats_update_analysis", {"p_id": candidate_id, "p_analysis": payload, "p_score": score,
            "p_confidence": confidence, "p_role": target_role or "", "p_actor": actor or ""})
        return
    serialized = json.dumps(payload, ensure_ascii=False)
    connection = conn()
    try:
        with connection:
            previous = connection.execute("SELECT score FROM ats_candidates WHERE id=?", (candidate_id,)).fetchone()
            connection.execute("UPDATE ats_candidates SET local_analysis_json=?,structured_json=?,score=?,confidence=?,target_role=?,reviewed_by=NULL,reviewed_at=NULL,updated_at=? WHERE id=?",
                (serialized, serialized, score, confidence, target_role or "", now, candidate_id))
            _audit(connection, "analysis_rerun", candidate_id, {"criteria": target_role or "générale",
                "previous_score": previous["score"] if previous else None, "score": score}, actor)
    finally:
        connection.close()


def save_ai_result(candidate_id, provider, result, actor=""):
    now = _now()
    payload = {"provider": provider, "created_at": now, **result}
    if backend_name() == "supabase":
        supabase_store.rpc("ats_save_ai_result", {"p_id": candidate_id, "p_result": payload, "p_actor": actor or ""})
        return
    connection = conn()
    try:
        with connection:
            connection.execute("UPDATE ats_candidates SET ai_analysis_json=?,updated_at=? WHERE id=?",
                (json.dumps(payload, ensure_ascii=False, default=str), now, candidate_id))
            _audit(connection, "ai_analysis_saved", candidate_id, str(provider), actor)
    finally:
        connection.close()


def delete_candidates(candidate_ids, actor=""):
    if backend_name() == "supabase":
        rows = [r for cid in candidate_ids if (r := get_candidate(cid))]
        supabase_store.rpc("ats_delete_candidates", {"p_ids": list(candidate_ids), "p_actor": actor or ""})
        failed = []
        for row in rows:
            object_key = row.get("storage_key")
            if not object_key:
                continue
            try:
                supabase_store.remove_original(object_key)
            except Exception:
                failed.append((row["id"], object_key))
        if failed:
            for candidate_id, object_key in failed:
                try:
                    log_event("storage_cleanup_failed", candidate_id,
                              {"storage_key": object_key, "reason": "Storage object removal failed after record deletion"},
                              actor)
                except Exception:
                    pass
            raise RuntimeError(
                f"Candidate records were deleted, but {len(failed)} original file(s) could not be removed from Storage. "
                "Retry cleanup from the Supabase dashboard."
            )
        return
    connection = conn()
    try:
        with connection:
            for candidate_id in candidate_ids:
                row = connection.execute("SELECT source_filename,fingerprint FROM ats_candidates WHERE id=?", (candidate_id,)).fetchone()
                if not row:
                    continue
                connection.execute("DELETE FROM ats_candidates WHERE id=?", (candidate_id,))
                _audit(connection, "candidate_deleted", candidate_id,
                       {"filename": row["source_filename"], "sha256": row["fingerprint"]}, actor)
    finally:
        connection.close()


def list_audit(limit=1000, candidate_id=None):
    if backend_name() == "supabase":
        builder = supabase_store.table("ats_audit_log").select("*")
        if candidate_id is not None:
            builder = builder.eq("candidate_id", candidate_id)
        return supabase_store.rows(builder.order("id", desc=True).limit(limit).execute())
    connection = conn()
    try:
        if candidate_id is None:
            return connection.execute("SELECT * FROM ats_audit_log ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return connection.execute("SELECT * FROM ats_audit_log WHERE candidate_id=? ORDER BY id DESC LIMIT ?",
                                  (candidate_id, limit)).fetchall()
    finally:
        connection.close()


def audit_counts_since(days):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")
    if backend_name() == "supabase":
        events = supabase_store.rows(supabase_store.table("ats_audit_log").select("action,created_at").gte("created_at", since).execute())
        counts = {}
        for event in events:
            counts[event["action"]] = counts.get(event["action"], 0) + 1
        return counts
    connection = conn()
    try:
        rows = connection.execute("SELECT action,COUNT(*) AS n FROM ats_audit_log WHERE created_at>=? GROUP BY action", (since,)).fetchall()
        return {row["action"]: row["n"] for row in rows}
    finally:
        connection.close()


def storage_stats():
    if backend_name() == "supabase":
        rows = supabase_store.rows(supabase_store.table("ats_candidates").select("file_size").execute())
        total = sum(int(row.get("file_size") or 0) for row in rows)
        return {"db_path": "Supabase Postgres", "db_bytes": 0, "originals": len(rows),
                "original_bytes": total, "backend": "supabase", "bucket": supabase_store.storage_bucket()}
    connection = conn()
    try:
        files = connection.execute("SELECT COUNT(*) AS n,COALESCE(SUM(LENGTH(original_file)),0) AS bytes FROM ats_candidates").fetchone()
        return {"db_path": str(DB_PATH), "db_bytes": DB_PATH.stat().st_size if DB_PATH.exists() else 0,
                "originals": files["n"], "original_bytes": files["bytes"], "backend": "sqlite"}
    finally:
        connection.close()


def backend_health():
    return supabase_store.health() if backend_name() == "supabase" else {
        "backend": "SQLite local", "ok": True, "path": str(DB_PATH)
    }


def backup_bytes():
    """Downloadable SQLite snapshot for local development only."""
    if backend_name() == "supabase":
        raise RuntimeError("SQLite backup is unavailable in Supabase mode; export logical data instead.")
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
