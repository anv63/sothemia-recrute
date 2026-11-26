from types import SimpleNamespace

import ats_store
from config import supabase_store
from utils import ats_tools
from utils.hr_agent import SothemaHRAgent


def test_assistant_tools_use_backend_neutral_store_and_exclude_pii(monkeypatch):
    rows = [{
        "id": 7,
        "full_name": "Amina Example",
        "target_role": "Ingénieure qualité",
        "score": 81,
        "review": "en_revue",
        "confidence": 0.9,
        "summary": "Amina Example, expérience en laboratoire, amina@example.test, +212 600 123 456",
        "raw_text": "Amina Example\nEmail: amina@example.test\nTéléphone: +212 600 123 456\nCompétences: HPLC",
        "local_analysis_json": '{"skills":["HPLC"],"education":["Amina Example - amina@example.test"],"experience":["+212 600 123 456"]}',
        "created_at": "2025-01-01T00:00:00Z",
    }]
    monkeypatch.setattr(ats_store, "assistant_candidate_rows", lambda: rows)
    monkeypatch.setattr(ats_store, "get_assistant_candidate", lambda candidate_id: rows[0] if candidate_id == 7 else None)

    assert ats_tools.get_ats_overview()["total_candidates"] == 1
    search = ats_tools.search_candidates(keyword="hplc")
    assert search[0]["id"] == 7
    assert "email" not in search[0]
    assert "phone" not in search[0]

    profile = ats_tools.get_candidate_profile(7)
    profile_text = str(profile)
    assert "amina@example.test" not in profile_text
    assert "+212 600 123 456" not in profile_text
    assert "Amina Example" not in profile_text

    cv_excerpt = ats_tools.get_candidate_cv_text(7)
    assert "amina@example.test" not in cv_excerpt["text"]
    assert "+212 600 123 456" not in cv_excerpt["text"]
    assert "Amina Example" not in cv_excerpt["text"]


def test_supabase_assistant_rows_are_paged_and_select_only_needed_fields(monkeypatch):
    class Query:
        def __init__(self):
            self.offset = 0
            self.limit = 0
            self.selected = None
        def select(self, columns):
            self.selected = columns
            return self
        def order(self, *_args, **_kwargs):
            return self
        def range(self, start, end):
            self.offset, self.limit = start, end - start + 1
            return self
        def execute(self):
            if self.offset == 0:
                return SimpleNamespace(data=[{"id": i} for i in range(500)])
            return SimpleNamespace(data=[{"id": 501}])

    queries = []
    def table(_name):
        query = Query()
        queries.append(query)
        return query
    monkeypatch.setattr(ats_store, "backend_name", lambda: "supabase")
    monkeypatch.setattr(supabase_store, "table", table)

    result = ats_store.assistant_candidate_rows()
    assert len(result) == 501
    assert [query.offset for query in queries] == [0, 500]
    assert all("original_file" not in query.selected for query in queries)
    assert all("email" not in query.selected and "phone" not in query.selected for query in queries)


def test_groq_agent_does_not_reuse_openai_credentials(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "openai-secret")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    agent = SothemaHRAgent()
    assert not agent.is_configured
    assert agent.api_key == ""


def test_groq_agent_uses_groq_specific_configuration(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk-test")
    monkeypatch.setenv("GROQ_MODEL", "test-model")
    monkeypatch.setenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    agent = SothemaHRAgent()
    assert agent.api_key == "gsk-test"
    assert agent.model == "test-model"
    assert agent.base_url == "https://api.groq.com/openai/v1"
