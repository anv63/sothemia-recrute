import streamlit as st

from sothema_views import _matches, _profile_facets


def test_profile_facets_classify_human_fields():
    facets = _profile_facets(
        {
            "education": ["Master en chimie"],
            "experience": ["Quality Assurance Manager — GMP, CAPA, 8 ans"],
            "skills": ["GMP", "CAPA"],
        },
        target_role="Quality Assurance Manager",
    )
    assert facets["sector"] == "Qualité / assurance qualité"
    assert facets["function"] == "Assurance qualité"
    assert facets["experience_level"] == "Senior / expert"
    assert facets["education_level"] == "Master / ingénieur"
    assert facets["diploma"] == "Master en chimie"


def test_profile_facets_keep_unknown_values_reviewable():
    facets = _profile_facets({"education": [], "experience": [], "skills": []}, "Married woman")
    assert facets == {
        "sector": "À vérifier",
        "function": "À vérifier",
        "experience_level": "À vérifier",
        "education_level": "À vérifier",
        "diploma": "À vérifier",
    }


def test_matches_human_filters_and_not_protected_attributes(monkeypatch):
    row = {
        "review": "a_examiner", "sector": "Qualité / assurance qualité", "function": "Assurance qualité",
        "experience_level": "Senior / expert", "education_level": "Master / ingénieur", "diploma": "Master en chimie",
        "reviewed_by": "", "skills": ["GMP"], "low_conf": False, "score": 90,
    }
    defaults = {
        "cv_review": [], "cv_sector": ["Qualité / assurance qualité"], "cv_function": "Assurance qualité",
        "cv_experience": "Senior / expert", "cv_education": "Master / ingénieur", "cv_diploma": "Master en chimie",
        "cv_conf": "Toutes", "cv_valid": "Toutes", "cv_skill": "Toutes", "cv_min_score": 0,
    }
    for key, value in defaults.items():
        monkeypatch.setitem(st.session_state, key, value)
    assert _matches(row)
    monkeypatch.setitem(st.session_state, "cv_q", "femme marocaine")
    assert _profile_facets({"education": [], "experience": [], "skills": []}, "femme marocaine")["sector"] == "À vérifier"
