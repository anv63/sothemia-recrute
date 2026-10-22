import io
from types import SimpleNamespace

import pytest

import ats_api


@pytest.fixture
def client():
    return ats_api.app.test_client()


def test_api_fails_closed_when_token_is_not_configured(client, monkeypatch):
    monkeypatch.delenv("SOTHEMA_INGEST_API_TOKEN", raising=False)
    response = client.get("/api/health")
    assert response.status_code == 503
    assert response.json["error"] == "API authentication is not configured"


@pytest.mark.parametrize("authorization", [None, "Basic abc", "Bearer wrong"])
def test_all_api_routes_reject_missing_or_invalid_token(client, monkeypatch, authorization):
    monkeypatch.setenv("SOTHEMA_INGEST_API_TOKEN", "test-secret-token")
    headers = {"Authorization": authorization} if authorization else {}
    requests = [
        ("get", "/api/health"),
        ("get", "/api/candidates"),
        ("get", "/api/candidates/123"),
        ("post", "/api/candidates/upload"),
        ("post", "/api/candidates/123/ai-analysis"),
    ]
    for method, path in requests:
        response = getattr(client, method)(path, headers=headers)
        assert response.status_code == 401, (method, path, response.status_code)
        assert response.json["error"] == "Bearer token required"


def test_bearer_token_allows_health(client, monkeypatch):
    monkeypatch.setenv("SOTHEMA_INGEST_API_TOKEN", "test-secret-token")
    response = client.get("/api/health", headers={"Authorization": "Bearer test-secret-token"})
    assert response.status_code == 200
    assert response.json["ok"] is True


def test_bearer_token_allows_candidate_read(client, monkeypatch):
    monkeypatch.setenv("SOTHEMA_INGEST_API_TOKEN", "test-secret-token")
    monkeypatch.setattr(ats_api, "list_candidates", lambda _query: [])
    response = client.get("/api/candidates", headers={"Authorization": "Bearer test-secret-token"})
    assert response.status_code == 200
    assert response.json == {"candidates": [], "count": 0}


def test_bearer_token_allows_candidate_detail_lookup(client, monkeypatch):
    monkeypatch.setenv("SOTHEMA_INGEST_API_TOKEN", "test-secret-token")
    monkeypatch.setattr(ats_api, "get_candidate", lambda _candidate_id: None)
    response = client.get("/api/candidates/123", headers={"Authorization": "Bearer test-secret-token"})
    assert response.status_code == 404
    assert response.json["error"] == "Candidate not found"


def test_bearer_token_allows_ai_analysis_route(client, monkeypatch):
    monkeypatch.setenv("SOTHEMA_INGEST_API_TOKEN", "test-secret-token")
    monkeypatch.setattr(ats_api, "get_candidate", lambda _candidate_id: {"id": 123})
    saved = []
    monkeypatch.setattr(ats_api, "save_ai_result", lambda *args: saved.append(args))
    response = client.post(
        "/api/candidates/123/ai-analysis",
        headers={"Authorization": "Bearer test-secret-token"},
        json={"provider": "test", "result": {"summary": "synthetic"}},
    )
    assert response.status_code == 200
    assert saved[0] == (123, "test", {"summary": "synthetic"})


def test_authenticated_invalid_upload_keeps_validation_contract(client, monkeypatch):
    monkeypatch.setenv("SOTHEMA_INGEST_API_TOKEN", "test-secret-token")
    response = client.post(
        "/api/candidates/upload",
        headers={"Authorization": "Bearer test-secret-token"},
        data={"file": (io.BytesIO(b"not a document"), "cv.pdf")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert response.json["error"] == "File signature is invalid or the file is empty"


def test_authenticated_image_signature_is_validated(client, monkeypatch):
    monkeypatch.setenv("SOTHEMA_INGEST_API_TOKEN", "test-secret-token")
    response = client.post(
        "/api/candidates/upload",
        headers={"Authorization": "Bearer test-secret-token"},
        data={"file": (io.BytesIO(b"not an image"), "cv.png")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert "image" in response.json["error"].lower()


    monkeypatch.setenv("SOTHEMA_INGEST_API_TOKEN", "test-secret-token")
    extraction = SimpleNamespace(normalized_text="CV text", as_dict=lambda: {"page_count": 1})
    monkeypatch.setattr(ats_api.document_extractor, "extract_document", lambda *_args: extraction)
    monkeypatch.setattr(ats_api.quality, "prepare_analysis", lambda *_args, **_kwargs: {
        "ats_score": 70, "document_type": "resume", "sothema": {"name": "Synthetic Person", "confidence": 0.8}
    })

    def duplicate(*_args, **_kwargs):
        raise ats_api.DuplicateCandidateError(17)

    monkeypatch.setattr(ats_api, "save_candidate", duplicate)
    response = client.post(
        "/api/candidates/upload",
        headers={"Authorization": "Bearer test-secret-token"},
        data={"file": (io.BytesIO(b"%PDF-1.4 synthetic"), "cv.pdf")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 409
    assert response.json == {"error": "Exact duplicate", "candidateId": 17}
