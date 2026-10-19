"""Server-side Supabase access for the hosted PoC.

Only Streamlit Python code uses the service-role key. Never send it to a browser.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any
from urllib.parse import urlparse

import streamlit as st


class SupabaseConfigurationError(RuntimeError):
    pass


def _setting(name: str, default: str = "") -> str:
    env_key = f"SOTHEMA_SUPABASE_{name.upper()}"
    if os.environ.get(env_key):
        return os.environ[env_key]
    try:
        section = st.secrets.get("supabase", {})
        value = section.get(name, default)
        return str(value) if value is not None else default
    except Exception:
        return default


def is_configured() -> bool:
    return bool(_setting("url") and _setting("service_role_key"))


def backend_name() -> str:
    # A partial cloud configuration must fail closed rather than silently using
    # ephemeral SQLite on the hosted app.
    return "supabase" if _setting("url") or _setting("service_role_key") else "sqlite"


def require_config():
    url = _setting("url")
    key = _setting("service_role_key")
    bucket = _setting("storage_bucket", "candidate-cvs").strip()
    if not url or not key:
        raise SupabaseConfigurationError(
            "Supabase mode requires [supabase].url and [supabase].service_role_key in Streamlit secrets."
        )
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc or not parsed.netloc.endswith(".supabase.co"):
        raise SupabaseConfigurationError("Supabase URL must look like https://<project-ref>.supabase.co.")
    if not bucket:
        raise SupabaseConfigurationError("Supabase storage_bucket must not be empty.")
    return url.rstrip("/"), key, bucket


@lru_cache(maxsize=2)
def _client(url: str, key: str):
    try:
        from supabase import create_client
    except ImportError as exc:
        raise SupabaseConfigurationError(
            "Supabase backend selected but supabase package is not installed. Install requirements.txt."
        ) from exc
    return create_client(url, key)


def client():
    url, key, _ = require_config()
    return _client(url, key)


def storage_bucket():
    _, _, bucket = require_config()
    return bucket


def table(name: str):
    return client().table(name)


def rpc(name: str, params: dict[str, Any]):
    return client().rpc(name, params).execute()


def rows(response) -> list[dict[str, Any]]:
    return list(getattr(response, "data", None) or [])


def upload_original(object_key: str, data: bytes, content_type: str):
    bucket = client().storage.from_(storage_bucket())
    return bucket.upload(object_key, data, {"content-type": content_type, "upsert": False})


def download_original(object_key: str) -> bytes:
    return bytes(client().storage.from_(storage_bucket()).download(object_key))


def remove_original(object_key: str):
    return client().storage.from_(storage_bucket()).remove([object_key])


def health() -> dict[str, Any]:
    try:
        table("ats_candidates").select("id").limit(1).execute()
        bucket = storage_bucket()
        client().storage.from_(bucket).list(path="", options={"limit": 1})
        parsed = urlparse(_setting("url"))
        project_ref = parsed.netloc.split(".", 1)[0] if parsed.netloc else "unknown"
        return {"backend": "Supabase Postgres + Storage", "ok": True, "bucket": bucket,
                "project_ref": project_ref}
    except Exception as exc:
        return {"backend": "Supabase Postgres", "ok": False, "project_ref":
                (urlparse(_setting("url")).netloc.split(".", 1)[0] if _setting("url") else "unknown"),
                "error": str(exc)[:240]}
