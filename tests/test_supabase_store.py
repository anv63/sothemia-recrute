import json
from types import SimpleNamespace

import pytest

import ats_store
from config import database, supabase_store


class FakeQuery:
    def __init__(self, data=None):
        self.data = data
        self.filters = []

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        return SimpleNamespace(data=self.data)


def test_failed_supabase_health_is_reported(monkeypatch):
    monkeypatch.setattr(supabase_store, "table", lambda *_args: (_ for _ in ()).throw(RuntimeError("not reachable")))
    status = supabase_store.health()
    assert status["ok"] is False
    assert "not reachable" in status["error"]


def test_backend_uses_supabase_when_secrets_are_configured(monkeypatch):
    monkeypatch.setenv("SOTHEMA_SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SOTHEMA_SUPABASE_SERVICE_ROLE_KEY", "server-secret")
    assert supabase_store.backend_name() == "supabase"


def test_partial_supabase_configuration_fails_closed(monkeypatch):
    monkeypatch.setenv("SOTHEMA_SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.delenv("SOTHEMA_SUPABASE_SERVICE_ROLE_KEY", raising=False)
    assert supabase_store.backend_name() == "supabase"
    with pytest.raises(supabase_store.SupabaseConfigurationError):
        supabase_store.require_config()


def test_backend_defaults_to_local_sqlite(monkeypatch):
    monkeypatch.delenv("SOTHEMA_SUPABASE_URL", raising=False)
    monkeypatch.delenv("SOTHEMA_SUPABASE_SERVICE_ROLE_KEY", raising=False)
    assert supabase_store.backend_name() == "sqlite"


def test_supabase_ingest_uploads_original_and_sends_analysis(monkeypatch):
    uploads = []
    calls = []
    monkeypatch.setattr(ats_store, "backend_name", lambda: "supabase")
    monkeypatch.setattr(ats_store, "find_by_fingerprint", lambda _sha: None)
    monkeypatch.setattr(supabase_store, "upload_original", lambda *args: uploads.append(args))
    monkeypatch.setattr(supabase_store, "rpc", lambda name, params: calls.append((name, params)) or SimpleNamespace(data=41))

    candidate_id = ats_store.save_candidate("cv.pdf", b"%PDF-example", "CV text", {"name": "A Person"},
                                            score=72, confidence=0.8, actor="rh@example.com")

    assert candidate_id == 41
    assert uploads[0][0].endswith(".pdf")
    assert uploads[0][1] == b"%PDF-example"
    name, params = calls[0]
    assert name == "ats_ingest_candidate"
    payload = params["p_candidate"]
    assert payload["full_name"] == "A Person"
    assert payload["score"] == 72
    assert payload["storage_key"] == uploads[0][0]
    assert payload["fingerprint"] not in payload["storage_key"]


def test_supabase_ingest_cleans_up_object_if_rpc_fails(monkeypatch):
    removed = []
    monkeypatch.setattr(ats_store, "backend_name", lambda: "supabase")
    monkeypatch.setattr(ats_store, "find_by_fingerprint", lambda _sha: None)
    monkeypatch.setattr(supabase_store, "upload_original", lambda *_args: None)
    monkeypatch.setattr(supabase_store, "remove_original", removed.append)

    def fail_rpc(*_args):
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(supabase_store, "rpc", fail_rpc)
    with pytest.raises(RuntimeError, match="database unavailable"):
        ats_store.save_candidate("cv.pdf", b"%PDF-example", "CV text", {})
    assert len(removed) == 1


def test_get_original_file_downloads_private_storage_object(monkeypatch):
    calls = []
    monkeypatch.setattr(ats_store, "backend_name", lambda: "supabase")
    monkeypatch.setattr(supabase_store, "download_original", lambda key: calls.append(key) or b"cv-bytes")
    assert ats_store.get_original_file({"storage_key": "aa/hash.pdf"}) == b"cv-bytes"
    assert calls == ["aa/hash.pdf"]


def test_delete_reports_storage_cleanup_failure_after_db_delete(monkeypatch):
    monkeypatch.setattr(ats_store, "backend_name", lambda: "supabase")
    monkeypatch.setattr(ats_store, "get_candidate", lambda _cid: {"id": 7, "storage_key": "aa/hash.pdf"})
    monkeypatch.setattr(supabase_store, "rpc", lambda *_args: SimpleNamespace(data=None))
    monkeypatch.setattr(supabase_store, "remove_original", lambda _key: (_ for _ in ()).throw(RuntimeError("storage")))
    with pytest.raises(RuntimeError, match="records were deleted"):
        ats_store.delete_candidates([7], "rh@example.com")


def test_first_admin_rpc_parses_boolean_result(monkeypatch):
    monkeypatch.setattr(supabase_store, "backend_name", lambda: "supabase")
    monkeypatch.setattr(supabase_store, "rpc", lambda *_args: SimpleNamespace(data="false"))
    assert database.create_first_admin("rh@example.com", "long-password") is False
    monkeypatch.setattr(supabase_store, "rpc", lambda *_args: SimpleNamespace(data=True))
    assert database.create_first_admin("rh@example.com", "long-password") is True
