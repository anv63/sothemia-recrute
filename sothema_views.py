"""Sothema HR Intelligence pages (Streamlit), rebuilt from the React reference design.

Every candidate shown here is read back from the configured ATS store; nothing is
fabricated on the client. Scores come from the existing ResumeAnalyzer and stay advisory.
"""
import io
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import streamlit as st

import ats_store as store
import sothema_quality as quality
from utils import document_extractor
from config.database import add_admin, admin_count, create_first_admin, list_admins, log_admin_action, update_admin_password, verify_admin
from sothema_ui import (
    AUDIT_LABELS, confidence_badge, empty_state, esc, field_dot, human_size, page_header, review_badge,
    score_badge, sidebar_status, user_chip,
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
SUPPORTED_UPLOAD_EXTENSIONS = ["pdf", "docx", *document_extractor.SUPPORTED_IMAGE_FORMATS]
LOCAL_TZ = datetime.now().astimezone().tzinfo
SECTION_WEIGHTS = [
    ("contact", "Coordonnées", 10), ("summary", "Résumé professionnel", 10),
    ("skills", "Compétences requises", 30), ("experience", "Expérience", 20),
    ("education", "Formation", 10), ("format", "Mise en forme", 20),
]
_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre",
           "novembre", "décembre"]
_DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
_MD_SPECIAL = re.compile(r"([\\`*_{}\[\]<>#|$~:])")


_HUMAN_SECTORS = {
    "qualite": "Qualité / assurance qualité",
    "production": "Production / opérations",
    "laboratoire": "Laboratoire / R&D",
    "reglementaire": "Affaires réglementaires",
    "supply": "Supply chain / achats",
    "commercial": "Commercial / vente",
    "marketing": "Marketing / communication",
    "finance": "Finance / comptabilité",
    "rh": "Ressources humaines",
    "it": "Informatique / data",
    "juridique": "Juridique",
}
_HUMAN_SECTOR_TERMS = {
    "qualite": ("qualité", "quality", "assurance qualité", "quality assurance", "gmp", "capa", "qms"),
    "production": ("production", "manufacturing", "opérations", "operations", "process engineer"),
    "laboratoire": ("laboratoire", "laboratory", "lab", "r&d", "research", "recherche", "chimie"),
    "reglementaire": ("réglementaire", "reglementaire", "regulatory", "compliance", "pharmacovigilance"),
    "supply": ("supply chain", "logistique", "logistics", "procurement", "achats", "stock", "approvisionnement"),
    "commercial": ("commercial", "sales", "vente", "business development", "account manager"),
    "marketing": ("marketing", "communication", "brand", "digital marketing"),
    "finance": ("finance", "financier", "comptabilité", "comptabilite", "accounting", "audit"),
    "rh": ("ressources humaines", "ressource humaine", "human resources", "recrutement", "talent", "hr", "rh"),
    "it": ("informatique", "software", "développeur", "developer", "data", "it ", "python", "sql", "cyber"),
    "juridique": ("juridique", "legal", "lawyer", "avocat", "contract"),
}
_HUMAN_FUNCTION_TERMS = {
    "Assurance qualité": ("responsable qualité", "quality assurance", "assurance qualité", "quality manager", "qa manager", "qa engineer", "qa specialist", "qa officer"),
    "Production": ("responsable production", "production manager", "production supervisor", "production engineer", "chef de production", "opérateur de production"),
    "Affaires réglementaires": ("affaires réglementaires", "regulatory affairs", "regulatory specialist", "regulatory manager", "pharmacovigilance"),
    "Laboratoire / R&D": ("technicien de laboratoire", "laboratory technician", "lab technician", "chercheur", "researcher", "r&d scientist", "laboratory analyst"),
    "Supply chain / logistique": ("supply chain manager", "logistics manager", "responsable logistique", "approvisionneur", "acheteur", "procurement specialist"),
    "Commercial / vente": ("commercial", "sales representative", "sales manager", "account manager", "business developer", "business development"),
    "Marketing / communication": ("marketing manager", "responsable marketing", "marketing specialist", "communication manager", "brand manager"),
    "Finance / comptabilité": ("comptable", "accountant", "financial analyst", "finance manager", "auditeur", "auditor", "contrôleur de gestion"),
    "Ressources humaines": ("responsable rh", "hr manager", "human resources", "recruteur", "recruiter", "talent acquisition"),
    "Informatique / data": ("software engineer", "développeur", "developer", "data analyst", "data scientist", "system administrator", "it manager"),
}
_EXPERIENCE_LEVELS = {
    "Débutant / junior": ("junior", "débutant", "debutant", "entry level", "intern", "stagiaire", "stage", "0-2 ans"),
    "Intermédiaire": ("mid-level", "intermediate", "confirmé", "confirme", "3-5 ans"),
    "Senior / expert": ("senior", "expert", "lead", "principal", "manager", "director", "responsable", "6+ ans"),
}
_EDUCATION_LEVELS = {
    "Bac / formation professionnelle": ("bac", "baccalauréat", "baccalaureat", "technicien", "formation professionnelle", "vocational"),
    "Bac+2 / technicien supérieur": ("bac+2", "bts", "dut", "deug", "associate", "technicien supérieur", "technicien superieur"),
    "Licence / bachelor": ("licence", "bachelor", "b.sc", "bsc", "b.a", "bac+3"),
    "Master / ingénieur": ("master", "mba", "m.sc", "msc", "ingénieur", "ingenieur", "engineering", "bac+5"),
    "Doctorat": ("doctorat", "doctorate", "phd", "ph.d", "thèse", "these"),
}


def _fold_text(value):
    return quality._fold(str(value or ""))


def _first_matching_label(text, mapping, labels=None):
    folded = _fold_text(text)
    for key, terms in mapping.items():
        if any(_fold_text(term) in folded for term in terms):
            return (labels or {}).get(key, key)
    return "À vérifier"


def _profile_facets(analysis, raw_text="", target_role=""):
    """Return conservative recruiter facets; unknown values stay explicitly reviewable."""
    meta = quality_meta(analysis, raw_text)
    education = " ".join(str(value) for value in (analysis.get("education") or []))
    experience = " ".join(str(value) for value in (analysis.get("experience") or []))
    skills = " ".join(str(value) for value in (meta.get("skills") or analysis.get("skills") or []))
    corpus = " ".join((raw_text, education, experience, skills))
    sector = _first_matching_label(corpus, _HUMAN_SECTOR_TERMS, _HUMAN_SECTORS)
    level = _first_matching_label(corpus, _EXPERIENCE_LEVELS)
    education_level = _first_matching_label(education or corpus, _EDUCATION_LEVELS)
    diploma = next((entry.strip() for entry in (analysis.get("education") or []) if str(entry).strip()), "À vérifier")
    function_text = " ".join((experience, raw_text, skills))
    function = _first_matching_label(function_text, _HUMAN_FUNCTION_TERMS)
    return {"sector": sector, "function": function, "experience_level": level,
            "education_level": education_level, "diploma": diploma[:120]}


def actor():
    return st.session_state.get("current_admin_email") or ""


def goto(name, **query):
    """Switch to a Sothema page; the registry lives in session state (built by app.main)."""
    st.switch_page(st.session_state["_so_pages"][name], query_params={k: str(v) for k, v in query.items()} or None)


def md(text):
    """Escape CV-derived text before it goes through Markdown."""
    return _MD_SPECIAL.sub(r"\\\1", str(text or ""))


def to_local(iso):
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso).astimezone(LOCAL_TZ).replace(tzinfo=None)
    except ValueError:
        return None


def fmt_dt(iso):
    value = to_local(iso)
    return value.strftime("%d/%m/%Y %H:%M") if value else "—"


def fmt_relative(iso):
    value = to_local(iso)
    if not value:
        return "—"
    seconds = (datetime.now() - value).total_seconds()
    if seconds < 60:
        return "à l'instant"
    if seconds < 3600:
        return f"il y a {int(seconds // 60)} min"
    if seconds < 86400:
        return f"il y a {int(seconds // 3600)} h"
    if seconds < 86400 * 30:
        days = int(seconds // 86400)
        return f"il y a {days} jour{'s' if days > 1 else ''}"
    return value.strftime("%d/%m/%Y")


def today_fr():
    now = datetime.now()
    return f"{_DAYS[now.weekday()].capitalize()} {now.day} {_MONTHS[now.month - 1]} {now.year}"


def plural(n, one, many=None):
    return f"{n} {one if n <= 1 else (many or one + 's')}"


def parse_json(value):
    try:
        return json.loads(value) if value else {}
    except (TypeError, json.JSONDecodeError):
        return {}


def quality_meta(analysis, raw_text="", full_name=""):
    """Sothema metadata for an analysis; rebuilt for records ingested before it existed."""
    meta = analysis.get("sothema")
    if meta:
        return meta
    skills = quality.clean_skills(analysis.get("skills"))
    name_conf = 0.85 if quality.plausible_name(full_name) else 0.0
    fields = quality.field_confidence(raw_text, name_conf, analysis, skills)
    return {"name": full_name if name_conf else "", "skills": skills, "field_confidence": fields,
            "confidence": round(sum(fields.values()) / len(fields), 2), "protected_redactions": {},
            "criteria": {"label": "", "required_skills": []}, "engine": "ResumeAnalyzer (local)"}


def details_text(details):
    data = parse_json(details) if details and details.strip().startswith("{") else None
    if not isinstance(data, dict):
        return details or ""
    labels = {"filename": "fichier", "sha256": "empreinte", "score": "score", "confidence": "confiance",
              "reason": "motif", "from": "de", "to": "vers", "length": "longueur", "criteria": "critères",
              "previous_score": "score précédent", "existing_id": "dossier existant", "count": "lignes",
              "email": "e-mail", "first_run": "initialisation"}
    parts = []
    for key, value in data.items():
        if key == "sha256" and value:
            value = str(value)[:12] + "…"
        if key in ("from", "to"):
            value = store.REVIEW_LABELS.get(value, value)
        if key == "confidence" and isinstance(value, (int, float)):
            value = f"{round(value * 100)} %"
        parts.append(f"{labels.get(key, key)} : {value}")
    return " · ".join(parts)


@st.cache_data(ttl=60, max_entries=64, show_spinner=False)
def _fetch(terms, version):
    """Candidate rows as plain dicts; `version` (audit size) invalidates after any mutation."""
    rows = store.search_candidates(list(terms))
    emails = {}
    out = []
    for row in rows:
        analysis = parse_json(row["local_analysis_json"])
        profile = analysis.get("ai_profile") or {}
        canonical_name = profile.get("name") or row["full_name"] or analysis.get("name") or ""
        canonical_email = row["email"] or profile.get("email") or analysis.get("email") or ""
        canonical_phone = row["phone"] or profile.get("phone") or analysis.get("phone") or ""
        meta = quality_meta(analysis, "", canonical_name)
        confidence = row["confidence"] if row["confidence"] is not None else meta.get("confidence")
        email = canonical_email.lower()
        if email:
            emails[email] = emails.get(email, 0) + 1
        facets = _profile_facets(analysis, row["raw_text"] or "", row["target_role"] or "")
        out.append({
            "id": row["id"], "name": canonical_name, "email": canonical_email,
            "phone": canonical_phone, "file": row["source_filename"] or "", "file_type": row["file_type"] or "",
            "size": row["file_size"] or 0, "score": row["score"] if row["score"] is not None else analysis.get("ats_score"),
            "confidence": confidence, "review": row["review"] or "a_examiner",
            "reviewed_by": row["reviewed_by"] or "", "reviewed_at": row["reviewed_at"] or "",
            "target_role": row["target_role"] or "", "created_at": row["created_at"] or "",
            "skills": meta.get("skills") or [],
            "ai_profile": profile,
            "location": profile.get("location", ""),
            **facets,
        })
    for item in out:
        item["low_conf"] = item["confidence"] is not None and item["confidence"] < quality.LOW_CONFIDENCE
        item["probable_dup"] = bool(item["email"]) and emails.get(item["email"].lower(), 0) > 1
    return out


def fetch_candidates(terms=()):
    return _fetch(tuple(terms), store.audit_count())


def export_frame(rows):
    return pd.DataFrame([{
        "ID": r["id"], "Nom": r["name"], "E-mail": r["email"], "Téléphone": r["phone"], "Fichier": r["file"],
        "Score format": r["score"], "Confiance extraction (%)": round(r["confidence"] * 100) if r["confidence"] is not None else None,
        "Secteur": r["sector"], "Fonction": r["function"], "Expérience": r["experience_level"],
        "Niveau d'études": r["education_level"], "Diplôme / formation": r["diploma"],
        "Statut RH": store.REVIEW_LABELS.get(r["review"], r["review"]),
        "Analyse validée par": r["reviewed_by"], "Critères": r["target_role"],
        "Compétences": ", ".join(r["skills"]), "Reçu le": fmt_dt(r["created_at"]),
    } for r in rows])


def csv_bytes(frame):
    return frame.to_csv(index=False, sep=";").encode("utf-8-sig")


def _log_export(action, count):
    store.log_event(action, details={"count": count}, actor=actor())


def header_with_actions(title, subtitle=None, crumbs=None, eyebrow=None):
    left, right = st.columns([3, 2], vertical_alignment="bottom")
    with left:
        page_header(title, subtitle, eyebrow=eyebrow, crumbs=crumbs)
    return right.container(horizontal=True, horizontal_alignment="right", vertical_alignment="center")


def role_options(job_roles):
    options = ["Aucun — analyse générale"]
    for category, roles in job_roles.items():
        options += [f"{category} › {role}" for role in roles]
    return options


def role_from_option(job_roles, option):
    if not option or option.startswith("Aucun"):
        return None, ""
    category, role = option.split(" › ", 1)
    return job_roles[category][role], option


def ai_providers(app):
    ai = app.ai_analyzer
    return [
        ("OpenAI", bool(getattr(ai, "openai_client", None)), getattr(ai, "openai_model", "")),
        ("Anthropic Claude", bool(getattr(ai, "anthropic_client", None)), getattr(ai, "anthropic_model", "")),
        ("Google Gemini", bool(getattr(ai, "google_api_key", None)), ""),
    ]


# --------------------------------------------------------------------------- shell

def page_login(app):
    st.space("large")
    _, middle, _ = st.columns([1, 1.1, 1])
    with middle, st.container(border=True, key="card-login"):
        with st.container(horizontal_alignment="center"):
            st.image("assets/sothema-logo.png", width=180)
        st.html('<div class="so-login-brand"><div class="so-eyebrow">Sothema · HR Intelligence</div>'
                '<h1 class="so-title">Espace recrutement</h1>'
                '<div class="so-subtitle">Accès réservé aux équipes RH autorisées.</div></div>')
        try:
            count = admin_count()
        except Exception as exc:
            st.error(f"Impossible de vérifier les comptes RH dans le stockage configuré : {exc}",
                     title="Base de données indisponible")
            st.caption("La création du premier compte est désactivée tant que le backend n'est pas joignable.")
            return
        if store.backend_name() == "supabase":
            from config.supabase_store import require_config
            from urllib.parse import urlparse
            project_ref = urlparse(require_config()[0]).netloc.split(".", 1)[0]
            st.caption(f"Backend connecté : Supabase · projet `{project_ref}` · {count} compte(s) RH")
        if count == 0:
            _first_run_setup()
        else:
            _login_form()
        st.caption("Les scores produits par l'application sont indicatifs : toute décision reste humaine.")


def _first_run_setup():
    st.info("Aucun compte n'existe encore. Créez le premier compte administrateur RH pour initialiser l'espace.",
            title="Initialisation", icon=":material/admin_panel_settings:")
    with st.form("so_setup_form"):
        email = st.text_input("E-mail professionnel", key="so_setup_email")
        password = st.text_input("Mot de passe (10 caractères minimum)", type="password", key="so_setup_pw")
        confirm = st.text_input("Confirmer le mot de passe", type="password", key="so_setup_pw2")
        submitted = st.form_submit_button("Créer le compte et se connecter", type="primary", width="stretch")
    if submitted:
        email = email.strip().lower()
        if not re.fullmatch(r"[\w.+-]+@[\w-]+(\.[\w-]+)+", email):
            st.error("Adresse e-mail invalide.")
        elif len(password) < 10:
            st.error("Le mot de passe doit contenir au moins 10 caractères.")
        elif password != confirm:
            st.error("Les deux mots de passe ne correspondent pas.")
        elif create_first_admin(email, password):
            _sign_in(email)
        else:
            st.error("Création du compte impossible.")


def _login_form():
    locked_until = st.session_state.get("so_login_locked_until")
    now = datetime.now()
    with st.form("so_login_form"):
        email = st.text_input("E-mail professionnel", key="so_login_email")
        password = st.text_input("Mot de passe", type="password", key="so_login_password")
        submitted = st.form_submit_button("Se connecter", type="primary", width="stretch")
    if not submitted:
        return
    if locked_until and now < locked_until:
        st.error(f"Trop de tentatives. Réessayez dans {int((locked_until - now).total_seconds()) + 1} s.")
        return
    email = email.strip().lower()
    if email and password and verify_admin(email, password):
        st.session_state.so_login_failures = 0
        _sign_in(email)
    else:
        failures = st.session_state.get("so_login_failures", 0) + 1
        st.session_state.so_login_failures = failures
        store.log_event("login_failed", details={"email": email}, actor=email)
        if failures >= 5:
            st.session_state.so_login_locked_until = now + timedelta(seconds=30)
            st.session_state.so_login_failures = 0
        st.error("Identifiants invalides.")


def _sign_in(email):
    st.session_state.is_admin = True
    st.session_state.current_admin_email = email
    log_admin_action(email, "login")
    store.log_event("login", actor=email)
    st.rerun()


def sign_out():
    email = actor()
    if email:
        log_admin_action(email, "logout")
        store.log_event("logout", actor=email)
    for key in ("is_admin", "current_admin_email", "import_results"):
        st.session_state.pop(key, None)
    st.rerun()


def flash():
    message = st.session_state.pop("so_flash", None)
    if message:
        st.toast(message, icon=":material/check:")


def topbar():
    left, right = st.columns([3, 1.3], vertical_alignment="center")
    with left, st.form("so_topsearch", border=False, clear_on_submit=True):
        with st.container(horizontal=True, vertical_alignment="center"):
            query = st.text_input("Recherche dans la CVthèque", label_visibility="collapsed", key="so_topsearch_q",
                                  placeholder="Rechercher un profil… ex. assurance qualité BPF Casablanca")
            submitted = st.form_submit_button("Rechercher", icon=":material/search:")
    with right, st.container(horizontal=True, horizontal_alignment="right"):
        user_chip(actor())
    if submitted and query.strip():
        st.session_state["cv_q"] = query.strip()
        goto("cvtheque")


def sidebar_footer():
    with st.sidebar:
        st.space("small")
        failures = store.audit_counts_since(7).get("ingestion_failed", 0)
        sidebar_status(store.candidate_count(), failures)
        if st.button("Se déconnecter", icon=":material/logout:", key="so_logout", width="stretch"):
            sign_out()


# --------------------------------------------------------------------------- dashboard

def page_dashboard(app):
    actions = header_with_actions("Tableau de bord", f"{today_fr()} · Vue d'ensemble de la CVthèque")
    with actions:
        if st.button("Rechercher un profil", icon=":material/search:", key="dash_search"):
            goto("cvtheque")
        if st.button("Importer des CV", icon=":material/upload_file:", type="primary", key="dash_import"):
            goto("import")

    rows = fetch_candidates()
    if not rows:
        with st.container(border=True, key="card-dash-empty"):
            empty_state("group", "La CVthèque est vide",
                        "Importez des CV au format PDF ou DOCX : ils sont extraits, analysés et enregistrés "
                        "localement, puis prêts pour votre revue. Aucun dossier de démonstration n'est créé.")
            with st.container(horizontal_alignment="center"):
                if st.button("Importer les premiers CV", icon=":material/upload_file:", type="primary", key="dash_first"):
                    goto("import")
            st.space("small")
        _recent_activity(limit=6)
        return

    now = datetime.now()
    created = [to_local(r["created_at"]) for r in rows]
    week = sum(1 for c in created if c and now - c < timedelta(days=7))
    today = sum(1 for c in created if c and c.date() == now.date())
    to_review = [r for r in rows if r["review"] == "a_examiner"]
    low = [r for r in rows if r["low_conf"]]
    scored = [r["score"] for r in rows if isinstance(r["score"], (int, float))]
    validated = sum(1 for r in rows if r["reviewed_by"])
    counts7 = store.audit_counts_since(7)

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("CV dans la CVthèque", len(rows), f"+{week} sur 7 jours", delta_color="off", delta_arrow="off", border=True)
    m2.metric("Ajoutés aujourd'hui", today, f"{counts7.get('ingestion_failed', 0)} import(s) refusé(s) sur 7 j",
              delta_color="off", delta_arrow="off", border=True)
    m3.metric("À examiner", len(to_review), f"{len(low)} à vérifier (faible confiance)", delta_color="off",
              delta_arrow="off", border=True)
    m4.metric("Score moyen indicatif", f"{sum(scored) / len(scored):.0f}" if scored else "—",
              f"{validated}/{len(rows)} analyses validées par RH", delta_color="off", delta_arrow="off", border=True,
              help="Moyenne des scores du moteur local. Indicateur de traitement, jamais un critère de décision.")

    left, right = st.columns([7, 5])
    with left, st.container(border=True, key="card-dash-review"):
        st.subheader("Répartition par statut RH")
        st.caption("Statut fixé par les recruteurs dans chaque dossier")
        frame = pd.DataFrame({
            "Statut": list(store.REVIEW_LABELS.values()),
            "Dossiers": [sum(1 for r in rows if r["review"] == key) for key in store.REVIEW_LABELS],
        })
        st.bar_chart(frame, x="Statut", y="Dossiers", horizontal=True, height=220, sort=False,
                     x_label="", y_label="")
    with right, st.container(border=True, key="card-dash-quality"):
        st.subheader("Contrôle qualité des imports")
        st.caption("Reçu → Extraction → Analyse → Enregistrement → Prêt pour revue")
        dups = sum(1 for r in rows if r["probable_dup"])
        st.markdown(
            f":green-badge[:material/check: Prêts pour revue] **{len(rows)}**  \n"
            f":red-badge[:material/warning: Faible confiance] **{len(low)}**  \n"
            f":orange-badge[:material/content_copy: Doublons probables (même e-mail)] **{dups}**  \n"
            f":red-badge[:material/block: Imports refusés · 7 j] **{counts7.get('ingestion_failed', 0)}**  \n"
            f":orange-badge[:material/file_copy: Doublons exacts refusés · 7 j] **{counts7.get('duplicate_rejected', 0)}**"
        )
        for r in low[:3]:
            label = f"#{r['id']} · {r['name'] or r['file']} — confiance {round(r['confidence'] * 100)} %"
            if st.button(label, key=f"dash_low_{r['id']}", type="tertiary", icon=":material/warning:"):
                goto("dossier", id=r["id"])

    left, right = st.columns([7, 5])
    with left, st.container(border=True, key="card-dash-recent"):
        head, link = st.columns([3, 1], vertical_alignment="center")
        head.subheader("Derniers CV reçus")
        if link.button("Tout voir", icon=":material/arrow_forward:", type="tertiary", key="dash_all"):
            goto("cvtheque")
        recent = rows[:6]
        event = st.dataframe(
            pd.DataFrame([{
                "Candidat": r["name"] or "Nom non détecté", "Secteur": r["sector"],
                "Fonction": r["function"], "Expérience": r["experience_level"],
                "Études": r["education_level"], "Score format": r["score"],
                "Confiance extraction (%)": round(r["confidence"] * 100) if r["confidence"] is not None else None,
                "Statut RH": store.REVIEW_LABELS.get(r["review"]), "Reçu le": to_local(r["created_at"]),
            } for r in recent]),
            hide_index=True, on_select="rerun", selection_mode="single-row", key="dash_recent_table",
            column_config=_table_columns(), alt="Derniers CV reçus",
        )
        if event.selection.rows:
            picked = recent[event.selection.rows[0]]
            if st.button(f"Ouvrir le dossier #{picked['id']}", icon=":material/open_in_new:", key="dash_open"):
                goto("dossier", id=picked["id"])
    with right:
        _recent_activity(limit=7)

    with st.container(border=True, key="card-dash-trend"):
        st.subheader("Imports sur 30 jours")
        start = now.date() - timedelta(days=29)
        days = pd.date_range(start, now.date(), freq="D")
        per_day = pd.Series(0, index=days)
        for c in created:
            if c and c.date() >= start:
                per_day[pd.Timestamp(c.date())] += 1
        st.bar_chart(per_day.rename("CV importés"), height=200, x_label="", y_label="CV importés")


def _recent_activity(limit=7):
    with st.container(border=True, key="card-dash-activity"):
        head, link = st.columns([3, 1], vertical_alignment="center")
        head.subheader("Activité récente")
        if link.button("Journal d'audit", type="tertiary", key="dash_audit"):
            st.session_state["settings_section"] = "Journal d'audit"
            goto("settings")
        entries = store.list_audit(limit=limit)
        if not entries:
            st.caption("Aucune activité enregistrée.")
        for entry in entries:
            target = f" · dossier #{entry['candidate_id']}" if entry["candidate_id"] else ""
            st.markdown(f"**{AUDIT_LABELS.get(entry['action'], md(entry['action']))}**{target}")
            detail = details_text(entry["details"])
            st.caption(f"{md(entry['actor'] or 'système')} · {fmt_relative(entry['created_at'])}"
                       + (f" · {md(detail[:90])}" if detail else ""))


def _table_columns():
    return {
        "ID": st.column_config.NumberColumn("ID", format="#%d", width="small"),
        "Candidat": st.column_config.TextColumn("Candidat", width="medium"),
        "Secteur": st.column_config.TextColumn("Secteur", width="medium"),
        "Fonction": st.column_config.TextColumn("Fonction", width="large"),
        "Expérience": st.column_config.TextColumn("Expérience", width="medium"),
        "Études": st.column_config.TextColumn("Études", width="medium"),
        "Score format": st.column_config.ProgressColumn("Score format", min_value=0, max_value=100, format="%d",
                                                       help="Indicateur de lisibilité et de présentation du CV, pas une note du candidat."),
        "Confiance extraction (%)": st.column_config.ProgressColumn("Confiance extraction (%)", min_value=0, max_value=100, format="%d %%",
                                                                   help="Estimation de la qualité d'extraction du document."),
        "Compétences": st.column_config.ListColumn("Compétences", width="large"),
        "Reçu le": st.column_config.DatetimeColumn("Reçu le", format="DD/MM/YYYY HH:mm"),
    }


# --------------------------------------------------------------------------- CVthèque

_FILTER_DEFAULTS = {
    "cv_q": "", "cv_review": [], "cv_valid": "Toutes", "cv_sector": [],
    "cv_function": "Toutes", "cv_experience": "Tous", "cv_education": "Tous",
    "cv_diploma": "Tous", "cv_conf": "Toutes", "cv_min_score": 0,
    "cv_skill": "Toutes",
}


def _reset_filters():
    for key, value in _FILTER_DEFAULTS.items():
        st.session_state[key] = value


def page_cvtheque(app):
    for key, value in _FILTER_DEFAULTS.items():
        st.session_state.setdefault(key, value)
    everything = fetch_candidates()
    actions = header_with_actions("CVthèque", f"{plural(len(everything), 'dossier')} · {store.backend_name()}")
    with actions:
        st.download_button("Exporter CSV", csv_bytes(export_frame(everything)), "cvtheque_sothema.csv", "text/csv",
                           icon=":material/download:", disabled=not everything, key="cv_export_all",
                           on_click=_log_export, args=("export_csv", len(everything)))
        if st.button("Importer des CV", icon=":material/upload_file:", type="primary", key="cv_import"):
            goto("import")

    if not everything:
        with st.container(border=True, key="card-cv-empty"):
            empty_state("group", "Aucun CV dans la CVthèque",
                        "Les CV importés apparaissent ici uniquement après extraction, analyse et enregistrement "
                        "réussis dans le stockage configuré.")
            with st.container(horizontal_alignment="center"):
                if st.button("Importer des CV", icon=":material/upload_file:", type="primary", key="cv_empty_import"):
                    goto("import")
            st.space("small")
        return

    with st.container(border=True, key="card-cv-table"):
        with st.container(horizontal=True, vertical_alignment="bottom"):
            st.text_input("Rechercher", key="cv_q", placeholder="Nom, e-mail, compétence, texte du CV…",
                          icon=":material/search:", width=340)
            st.multiselect("Statut RH", list(store.REVIEW_LABELS), key="cv_review",
                           format_func=store.REVIEW_LABELS.get, placeholder="Tous", width=210)
            sectors = sorted({r["sector"] for r in everything}, key=str.lower)
            functions = sorted({r["function"] for r in everything if r["function"] != "À vérifier"}, key=str.lower)
            experience_levels = ["Débutant / junior", "Intermédiaire", "Senior / expert", "À vérifier"]
            education_levels = ["Bac / formation professionnelle", "Bac+2 / technicien supérieur",
                                "Licence / bachelor", "Master / ingénieur", "Doctorat", "À vérifier"]
            diplomas = sorted({r["diploma"] for r in everything if r["diploma"] != "À vérifier"}, key=str.lower)
            st.multiselect("Secteur", sectors, key="cv_sector", placeholder="Tous", width=220)
            st.selectbox("Fonction", ["Toutes"] + functions, key="cv_function", width=220)
            st.selectbox("Expérience", ["Tous"] + experience_levels, key="cv_experience", width=190)
        with st.container(horizontal=True, vertical_alignment="bottom"):
            st.selectbox("Niveau d'études", ["Tous"] + education_levels, key="cv_education", width=230)
            st.selectbox("Diplôme / formation", ["Tous"] + diplomas, key="cv_diploma", width=260)

        terms, ignored = quality.sanitize_query(st.session_state.cv_q)
        if ignored:
            st.warning(f"Termes ignorés : {', '.join(md(t) for t in ignored)}. L'âge, le genre, la nationalité, la "
                       "situation familiale et la photo ne sont jamais utilisés pour rechercher ou classer.",
                       title="Critères protégés ignorés", icon=":material/shield:")
        rows = fetch_candidates(terms) if terms else everything
        rows = [r for r in rows if _matches(r)]

        with st.expander("Contrôles qualité (facultatif)", expanded=False):
            st.caption("La confiance mesure la qualité d’extraction et le score mesure le format du CV. Ce ne sont pas des mesures de valeur professionnelle.")
            st.selectbox("Qualité d'extraction", ["Toutes", "À vérifier (< 60 %)", "Lisible (≥ 60 %)"],
                         key="cv_conf", width=240)
            st.slider("Score de format minimum", 0, 100, step=5, key="cv_min_score", width=300)
            st.selectbox("Validation de l'analyse", ["Toutes", "À valider", "Validées"],
                         key="cv_valid", width=220)
            skills = sorted({s for r in everything for s in r["skills"]}, key=str.lower)
            st.selectbox("Compétence précise", ["Toutes"] + skills, key="cv_skill", width=300)
            rows = [r for r in rows if _matches(r)]

        active = sum(st.session_state[k] != v for k, v in _FILTER_DEFAULTS.items())
        with st.container(horizontal=True, vertical_alignment="center"):
            st.caption(f"{plural(len(rows), 'résultat')} · uniquement des CV importés")
            if active:
                st.button("Réinitialiser", type="tertiary", on_click=_reset_filters, key="cv_reset")

        if not rows:
            empty_state("search_off", "Aucun résultat",
                        "Aucun dossier ne correspond à la recherche ou aux filtres actifs.")
            with st.container(horizontal_alignment="center"):
                st.button("Effacer la recherche et les filtres", on_click=_reset_filters, key="cv_clear")
            st.space("small")
            return

        selected_ids = set()
        with st.container(border=True, key="card-cv-profiles"):
            for profile_row in rows:
                with st.container(border=True, key=f"cv_profile_{profile_row['id']}"):
                    top = st.container(horizontal=True, vertical_alignment="center")
                    with top:
                        st.markdown(f"### {md(profile_row['name'] or 'Nom non détecté')} · #{profile_row['id']}")
                        st.badge(store.REVIEW_LABELS.get(profile_row["review"], profile_row["review"]))
                        st.badge(profile_row["sector"])
                        st.badge(profile_row["experience_level"])
                    st.caption(" · ".join(filter(None, [profile_row["function"], profile_row["education_level"],
                                                           profile_row["diploma"], fmt_dt(profile_row["created_at"])])))
                    profile = profile_row.get("ai_profile") or {}
                    contacts = [profile_row["email"] or profile.get("email"), profile_row["phone"] or profile.get("phone"),
                                profile_row["location"] or profile.get("location")]
                    st.caption(" · ".join(md(value) for value in contacts if value) or "Coordonnées : à vérifier dans le CV")
                    if profile.get("profile_summary"):
                        st.write(md(profile["profile_summary"]))
                    profile_details = []
                    if profile.get("languages"):
                        profile_details.append("Langues : " + ", ".join(profile["languages"]))
                    if profile.get("education"):
                        profile_details.append("Formation : " + "; ".join(profile["education"]))
                    if profile_details:
                        st.caption(" · ".join(md(value) for value in profile_details))
                    links = [("LinkedIn", profile.get("linkedin")), ("GitHub", profile.get("github")),
                             ("Portfolio", profile.get("portfolio"))]
                    safe_links = [(label, value) for label, value in links
                                  if isinstance(value, str) and value.startswith("https://")]
                    if safe_links:
                        with st.container(horizontal=True):
                            for label, url in safe_links:
                                st.link_button(label, url, help=f"Ouvrir le {label} extrait du CV")
                    with st.container(horizontal=True, vertical_alignment="center"):
                        st.caption("Compétences : " + (", ".join(profile_row["skills"][:8]) or "non détectées"))
                        st.caption("Extraction à vérifier" if profile_row["low_conf"] or not profile else "Profil extrait · vérification RH requise")
                        if st.button("Ouvrir le dossier", icon=":material/open_in_new:", key=f"cv_profile_open_{profile_row['id']}"):
                            goto("dossier", id=profile_row["id"])
                        if st.checkbox("Sélectionner", key=f"cv_profile_select_{profile_row['id']}"):
                            selected_ids.add(profile_row["id"])

        selected = [r for r in rows if r["id"] in selected_ids]
    if selected:
        _bulk_bar(selected)


def _matches(r):
    s = st.session_state
    if s.cv_review and r["review"] not in s.cv_review:
        return False
    if s.cv_sector and r["sector"] not in s.cv_sector:
        return False
    if s.cv_function != "Toutes" and r["function"] != s.cv_function:
        return False
    if s.cv_experience != "Tous" and r["experience_level"] != s.cv_experience:
        return False
    if s.cv_education != "Tous" and r["education_level"] != s.cv_education:
        return False
    if s.cv_diploma != "Tous" and r["diploma"] != s.cv_diploma:
        return False
    if s.cv_conf == "À vérifier (< 60 %)" and not r["low_conf"]:
        return False
    if s.cv_conf.startswith("Lisible") and r["low_conf"]:
        return False
    if s.cv_valid == "À valider" and r["reviewed_by"]:
        return False
    if s.cv_valid == "Validées" and not r["reviewed_by"]:
        return False
    if s.cv_skill != "Toutes" and s.cv_skill not in r["skills"]:
        return False
    if s.cv_min_score and (r["score"] or 0) < s.cv_min_score:
        return False
    return True


def _bulk_bar(selected):
    ids = [r["id"] for r in selected]
    with st.container(border=True, key="card-cv-bulk"):
        with st.container(horizontal=True, vertical_alignment="bottom"):
            st.markdown(f"**{plural(len(ids), 'dossier sélectionné', 'dossiers sélectionnés')}**")
            if len(ids) == 1 and st.button("Ouvrir le dossier", icon=":material/open_in_new:", type="primary",
                                           key="cv_open"):
                goto("dossier", id=ids[0])
            status = st.selectbox("Changer le statut RH", list(store.REVIEW_LABELS), format_func=store.REVIEW_LABELS.get,
                                  key="cv_bulk_status", width=220)
            if st.button("Appliquer", key="cv_bulk_apply"):
                store.set_review(ids, status, actor())
                st.toast(f"{plural(len(ids), 'dossier')} → « {store.REVIEW_LABELS[status]} »", icon=":material/check:")
                st.rerun()
            st.download_button("Exporter la sélection", csv_bytes(export_frame(selected)), "selection_sothema.csv",
                               "text/csv", icon=":material/download:", key="cv_bulk_export",
                               on_click=_log_export, args=("export_csv", len(selected)))
            if st.button("Supprimer", icon=":material/delete:", key="cv_bulk_delete"):
                confirm_delete(ids)


@st.dialog("Supprimer des dossiers")
def confirm_delete(ids):
    data_location = "Supabase Postgres et son Storage privé" if store.backend_name() == "supabase" else "base locale"
    st.write(f"{plural(len(ids), 'dossier')} ({', '.join(f'#{i}' for i in ids)}) : fiche, CV original et analyses "
             f"seront supprimés de {data_location}. L'opération est tracée dans le journal d'audit et ne peut pas "
             "être annulée.")
    typed = st.text_input("Tapez SUPPRIMER pour confirmer", key="so_delete_confirm") if len(ids) > 1 else "SUPPRIMER"
    with st.container(horizontal=True, horizontal_alignment="right"):
        if st.button("Annuler", key="so_delete_cancel"):
            st.rerun()
        if st.button("Supprimer définitivement", type="primary", disabled=typed != "SUPPRIMER", key="so_delete_go"):
            try:
                store.delete_candidates(ids, actor())
            except Exception as exc:
                message = f"Suppression effectuée avec un problème de stockage : {exc}"
                if "records were deleted" in str(exc):
                    message += " Réessayez le nettoyage des CV orphelins dans Supabase Storage."
                st.error(message)
                return
            st.session_state["so_flash"] = f"{plural(len(ids), 'dossier')} supprimé(s)."
            goto("cvtheque")


# --------------------------------------------------------------------------- import

def page_import(app):
    st.session_state.setdefault("import_results", [])
    st.session_state.setdefault("uploader_round", 0)
    backend_label = "Supabase + Storage" if store.backend_name() == "supabase" else "SQLite"
    page_header("Importer des CV", f"Traitement synchrone. Un dossier n'est créé qu'après extraction, "
                f"analyse et écriture dans {backend_label} réussies.", crumbs=["CVthèque", "Import"])
    main, side = st.columns([8, 4])
    with main:
        with st.container(border=True, key="card-import-upload"):
            files = st.file_uploader("Déposer des CV", type=SUPPORTED_UPLOAD_EXTENSIONS, accept_multiple_files=True,
                                     key=f"so_uploader_{st.session_state.uploader_round}",
                                     help="PDF, DOCX, PNG, JPG/JPEG, TIFF, BMP, GIF ou WebP · 10 Mo maximum par fichier. Les images sont lues par OCR.")
            option = st.selectbox("Critères de poste (facultatif)", role_options(app.job_roles), key="import_role",
                                  help="Sans critères, la composante « compétences requises » du score n'est pas évaluée.")
            run = st.button(f"Analyser et enregistrer {plural(len(files or []), 'fichier')}", type="primary",
                            icon=":material/play_arrow:", disabled=not files, key="import_run")
        if run and files:
            role_info, label = role_from_option(app.job_roles, option)
            outcomes = []
            for uploaded in files:
                with st.status(f"{uploaded.name} — reçu", expanded=True) as status:
                    outcome = ingest_file(app, uploaded.name, uploaded.getvalue(), role_info, label, status.write)
                    status.update(label=f"{uploaded.name} — {_OUTCOME_LABEL[outcome['outcome']]}",
                                  state="complete" if outcome["outcome"] == "saved" else "error", expanded=False)
                outcomes.append(outcome)
            st.session_state.import_results = outcomes + st.session_state.import_results
            st.session_state.uploader_round += 1
        _import_results()
    with side:
        with st.container(border=True, key="card-import-controls"):
            st.subheader("Contrôles appliqués")
            st.html('<dl class="so-kv">'
                    '<dt>Formats</dt><dd>PDF, DOCX et images PNG/JPG/TIFF/BMP/GIF/WebP (signature vérifiée)</dd>'
                    '<dt>Taille</dt><dd>10 Mo maximum, fichiers vides refusés</dd>'
                    '<dt>Doublon exact</dt><dd>Empreinte SHA-256 identique → refusé, lien vers l\'existant</dd>'
                    '<dt>Doublon probable</dt><dd>Même e-mail qu\'un dossier existant → avertissement</dd>'
                    '<dt>Faible confiance</dt><dd>Moins de 60 % des champs clés lus → vérification RH</dd>'
                    '<dt>Données sensibles</dt><dd>Âge, genre, nationalité, situation familiale et photo exclus '
                    'du texte évalué</dd></dl>')
        with st.container(border=True, key="card-import-engine"):
            st.subheader("Moteur d'analyse")
            st.markdown(":gray-badge[:material/memory: ResumeAnalyzer · local] — aucun envoi externe à l'import.")
            for name, ok, model in ai_providers(app):
                st.markdown(f"{':green-badge[Clé configurée]' if ok else ':orange-badge[Clé manquante]'} {name}"
                            + (f" · `{model}`" if ok and model else ""))
            st.caption("L'analyse IA est facultative et se lance depuis chaque dossier, sur un texte pseudonymisé.")


_OUTCOME_LABEL = {"saved": "Prêt pour revue", "duplicate": "Doublon exact", "rejected": "Refusé", "error": "Erreur"}


def ingest_file(app, filename, data, role_info, criteria_label, say):
    """Validate → extract → analyze → persist → read back. Nothing is stored unless every step succeeds."""
    name = Path(filename).name
    suffix = Path(name).suffix.lower().lstrip(".")
    sha = store.fingerprint(data) if data else ""

    def stop(kind, reason):
        try:
            store.log_event("ingestion_failed", details={"filename": name, "sha256": sha, "reason": reason}, actor=actor())
        except Exception:
            pass
        say(f":red[{md(reason)}]")
        return {"outcome": kind, "filename": name, "message": reason}

    say("Reçu — contrôle du format, de la taille et de l'empreinte")
    if suffix not in SUPPORTED_UPLOAD_EXTENSIONS:
        return stop("rejected", "Format non pris en charge : PDF, DOCX, PNG, JPG/JPEG, TIFF, BMP, GIF ou WebP uniquement.")
    if not data:
        return stop("rejected", "Le fichier est vide.")
    if len(data) > MAX_UPLOAD_BYTES:
        return stop("rejected", "Le fichier dépasse la limite de 10 Mo.")
    if suffix in {"pdf", "docx"} and ((suffix == "pdf" and not data.startswith(b"%PDF")) or (suffix == "docx" and not data.startswith(b"PK"))):
        return stop("rejected", f"Le contenu ne correspond pas à un fichier {suffix.upper()}.")
    if suffix in document_extractor.SUPPORTED_IMAGE_FORMATS:
        try:
            document_extractor.validate_image(name, data)
        except ValueError as exc:
            return stop("rejected", str(exc))
    existing = store.find_by_fingerprint(sha)
    if existing:
        store.log_event("duplicate_rejected", existing, {"filename": name, "existing_id": existing}, actor())
        say(f":orange[Ce fichier exact est déjà enregistré (dossier #{existing}). Aucun dossier créé.]")
        return {"outcome": "duplicate", "filename": name, "candidate_id": existing,
                "message": f"Fichier identique au dossier #{existing} (empreinte SHA-256)."}

    say("Extraction de la mise en page (colonnes, tableaux, en-têtes)…")
    try:
        extraction = document_extractor.extract_document(name, data, progress=say)
        raw = extraction.display_text or extraction.normalized_text or ""
    except Exception as exc:  # extraction libraries raise many different types
        return stop("error", f"Extraction impossible : {exc}")
    if not raw.strip():
        reason = "Aucun texte exploitable (PDF scanné, image ou document protégé)."
        if not document_extractor.runtime_capabilities().get("tesseract"):
            reason += " Le moteur OCR Tesseract n'est pas installé sur ce serveur."
        return stop("error", reason)
    if extraction.warnings:
        say(":orange[Attention : " + ", ".join(extraction.warnings) + "]")

    profile_result = {"profile": {}}
    profile_warning = None

    say("Analyse par le moteur local (attributs protégés exclus du texte évalué)…")
    analysis = quality.prepare_analysis(raw, app.analyzer, role_info, criteria_label, extraction=extraction)
    if analysis.get("error"):
        return stop("error", analysis["error"])
    if analysis.get("document_type") != "resume":
        return stop("rejected", f"Le document ne ressemble pas à un CV (type détecté : {analysis.get('document_type')}).")

    if getattr(app.ai_analyzer, "openai_client", None):
        say("Extraction IA du profil (champs présents uniquement, vérification contre le texte source)…")
        profile_result = app.ai_analyzer.extract_candidate_profile(
            raw, header_context=quality.profile_header_context(extraction)
        )
        if profile_result.get("profile"):
            try:
                analysis = quality.apply_ai_profile(
                    analysis, profile_result["profile"], raw,
                    name_source_text=quality.profile_header_context(extraction),
                )
                say(":green[Profil IA vérifié contre le texte extrait.]")
            except ValueError as exc:
                profile_warning = f"Profil IA ignoré : {exc}"
        else:
            profile_warning = profile_result.get("error", "Extraction IA du profil indisponible.")
        if profile_warning:
            say(f":orange[{md(profile_warning)} — vérification RH nécessaire.]")
    meta = analysis["sothema"]
    backend_label = "Supabase Storage et Postgres" if store.backend_name() == "supabase" else "SQLite"
    say(f"Enregistrement {backend_label} : fichier original, texte, analyse et entrée d'audit…")
    try:
        candidate_id = store.save_candidate(name, data, raw, analysis, full_name=meta["name"],
                                            score=int(analysis.get("ats_score") or 0), confidence=meta["confidence"],
                                            target_role=criteria_label, actor=actor())
    except store.DuplicateCandidateError as duplicate:
        return {"outcome": "duplicate", "filename": name, "candidate_id": duplicate.candidate_id,
                "message": f"Fichier identique au dossier #{duplicate.candidate_id}."}
    except Exception as exc:
        return stop("error", f"Écriture {backend_label} impossible, vérifiez la connexion et la configuration : {exc}")

    persisted = store.get_candidate(candidate_id)
    if not persisted:
        return stop("error", "Le dossier n'a pas pu être relu après écriture.")
    probable = store.find_by_email(persisted["email"], exclude_id=candidate_id)
    say(f":green[Dossier #{candidate_id} enregistré et relu depuis {backend_label}.]")
    result = {
        "outcome": "saved", "filename": name, "candidate_id": candidate_id, "probable": probable,
        "message": "Prêt pour revue", "extraction": extraction.as_dict(),
        "profile_warning": profile_warning,
    }
    return result


def _import_results():
    results = st.session_state.import_results
    with st.container(border=True, key="card-import-queue"):
        head, clear = st.columns([3, 1], vertical_alignment="center")
        head.subheader("File de traitement")
        if results and clear.button("Effacer la liste", type="tertiary", icon=":material/delete_sweep:", key="import_clear"):
            st.session_state.import_results = []
            st.rerun()
        if not results:
            empty_state("description", "Aucun import dans cette session",
                        "Chaque fichier passe par Reçu → Extraction → Analyse → Enregistrement → Prêt pour revue.")
            st.space("small")
            return
        for index, item in enumerate(results):
            with st.container(horizontal=True, vertical_alignment="center", key=f"import_row_{index}"):
                st.markdown(f":material/description: **{md(item['filename'])}**")
                if item["outcome"] == "saved":
                    row = store.get_candidate(item["candidate_id"])
                    if not row:
                        st.markdown(":gray-badge[Dossier supprimé depuis]")
                        continue
                    analysis = parse_json(row["local_analysis_json"])
                    st.markdown(":green-badge[:material/check: Prêt pour revue] " + score_badge(row["score"]) + " "
                                + confidence_badge(row["confidence"])
                                + (" :orange-badge[:material/warning: Doublon probable]" if item.get("probable") else ""))
                    extraction = item.get("extraction") or {}
                    methods = ", ".join(extraction.get("methods") or []) or "standard"
                    warning_text = "; ".join(extraction.get("warnings") or [])
                    st.caption(f"#{row['id']} · {md(row['full_name'] or 'Nom non détecté')} · "
                               f"{plural(len(quality_meta(analysis)['skills']), 'compétence')} repérée(s) · "
                               f"{extraction.get('page_count', 1)} page(s) · {md(methods)}"
                               + (f" · {md(warning_text)}" if warning_text else ""))
                    if item.get("profile_warning"):
                        st.warning(md(item["profile_warning"]) + " — vérification manuelle du profil requise.",
                                   icon=":material/person_search:")
                    if st.button("Ouvrir pour revue", icon=":material/open_in_new:", key=f"import_open_{index}"):
                        goto("dossier", id=row["id"])
                elif item["outcome"] == "duplicate":
                    st.markdown(":orange-badge[:material/content_copy: Doublon exact]")
                    st.caption(md(item["message"]))
                    if st.button("Voir l'existant", key=f"import_dup_{index}"):
                        goto("dossier", id=item["candidate_id"])
                else:
                    badge = ":red-badge[:material/block: Refusé]" if item["outcome"] == "rejected" else \
                        ":red-badge[:material/error: Erreur]"
                    st.markdown(badge)
                    st.caption(md(item["message"]) + " · aucun dossier créé")


# --------------------------------------------------------------------------- dossier

def page_dossier(app):
    raw_id = st.query_params.get("id", "")
    row = store.get_candidate(int(raw_id)) if raw_id.isdigit() else None
    if not row:
        page_header("Dossier introuvable", crumbs=["CVthèque", "Dossier"])
        with st.container(border=True, key="card-dossier-missing"):
            empty_state("person_off", "Ce dossier n'existe pas ou a été supprimé", tone="bad")
            with st.container(horizontal_alignment="center"):
                if st.button("Retour à la CVthèque", key="dossier_back_missing"):
                    goto("cvtheque")
            st.space("small")
        return

    cid = row["id"]
    analysis = parse_json(row["local_analysis_json"])
    raw_text = row["raw_text"] or ""
    profile = analysis.get("ai_profile") or {}
    canonical_name = profile.get("name") or row["full_name"] or analysis.get("name") or ""
    meta = quality_meta(analysis, raw_text, canonical_name)
    confidence = row["confidence"] if row["confidence"] is not None else meta.get("confidence")
    score = row["score"] if row["score"] is not None else analysis.get("ats_score")
    title = canonical_name or "Nom non détecté"

    actions = header_with_actions(title, f"{row['source_filename']} · {human_size(row['file_size'])} · "
                                  f"importé le {fmt_dt(row['created_at'])}", crumbs=["CVthèque", f"Dossier #{cid}"])
    with actions:
        mime = document_extractor.FILE_MIME_TYPES.get(row["file_type"], "application/octet-stream")
        original = store.get_original_file(dict(row))
        st.download_button("CV original", original or b"", row["source_filename"], mime,
                           icon=":material/download:", key="dossier_download", disabled=not original,
                           on_click=lambda: store.log_event("original_downloaded", cid, None, actor()))
        if st.button("Retour", icon=":material/arrow_back:", key="dossier_back"):
            goto("cvtheque")

    st.markdown(" ".join([
        score_badge(score), confidence_badge(confidence), review_badge(row["review"], store.REVIEW_LABELS),
        f":green-badge[:material/verified: Analyse validée par {md(row['reviewed_by'])}]" if row["reviewed_by"]
        else ":orange-badge[:material/pending: Analyse à valider]",
        ":violet-badge[:material/auto_awesome: Recommandation · à valider par RH]",
    ]))

    redactions = meta.get("protected_redactions") or {}
    note = ("Le score résume la complétude et la structure du CV selon le moteur local. Il ne déclenche aucun rejet "
            "ni aucune invitation : la décision appartient au recruteur.")
    if redactions:
        cats = ", ".join(quality.PROTECTED_LABELS.get(k, k) for k in redactions)
        note += f" {plural(sum(redactions.values()), 'mention')} ({cats}) exclue(s) du texte évalué."
    st.info(note, title="Score indicatif — décision humaine requise", icon=":material/balance:")
    extraction = meta.get("extraction") or {}
    if extraction:
        methods = ", ".join(extraction.get("methods") or []) or "standard"
        st.caption(f"Extraction : {extraction.get('page_count', 1)} page(s) · {md(methods)}"
                   + (f" · avertissements : {md(', '.join(extraction.get('warnings') or []))}" if extraction.get("warnings") else ""))
    if confidence is not None and confidence < quality.LOW_CONFIDENCE:
        reasons = " · ".join(meta.get("confidence_reasons") or [])
        st.error("Vérifiez les champs et le texte source avant d'utiliser ce profil."
                 + (f" Causes : {md(reasons)}" if reasons else ""),
                 title=f"Extraction à faible confiance ({round(confidence * 100)} %)", icon=":material/report:")
    probable = store.find_by_email(row["email"], exclude_id=cid)
    if probable:
        st.warning(f"Même adresse e-mail que {', '.join(f'#{p}' for p in probable)}. Vérifiez s'il s'agit de la même "
                   "personne avant toute décision.", title="Doublon probable", icon=":material/content_copy:")

    left, right = st.columns([5, 7])
    with left:
        _dossier_identity(row, analysis, meta)
        _dossier_sections(analysis, meta)
        with st.container(border=True, key="card-dossier-source"):
            st.subheader("Texte source")
            st.caption("Texte extrait du document original ; les numéros de ligne correspondent aux citations.")
            st.code(raw_text or "Aucun texte.", language=None, line_numbers=True, wrap_lines=True, height=420)
    with right:
        _dossier_score(analysis, score, meta)
        _dossier_review(row)
        _dossier_evidence(raw_text, analysis)
        _dossier_criteria(app, row, raw_text, meta)
        _dossier_ai(app, row, raw_text, analysis)
        _dossier_audit(cid)
        with st.container(border=True, key="card-dossier-danger"):
            with st.container(horizontal=True, vertical_alignment="center"):
                st.caption("Supprime la fiche, le CV original et les analyses (tracé dans l'audit).")
                if st.button("Supprimer le dossier", icon=":material/delete:", key="dossier_delete"):
                    confirm_delete([cid])


def _dossier_identity(row, analysis, meta):
    fields = meta.get("field_confidence") or {}
    profile = analysis.get("ai_profile") or {}
    canonical_name = profile.get("name") or row["full_name"] or analysis.get("name") or ""
    with st.container(border=True, key="card-dossier-identity"):
        st.subheader("Informations extraites")

        def item(label, value, conf_key=None):
            dot = field_dot(fields.get(conf_key, 1.0 if value else 0.0)) if conf_key else ""
            shown = esc(value) if value else '<span class="missing">Non détecté</span>'
            return f"<dt>{dot}{esc(label)}</dt><dd>{shown}</dd>"

        st.html('<dl class="so-kv">' + "".join([
            item("Nom", canonical_name, "name"),
            item("E-mail", row["email"] or profile.get("email") or analysis.get("email"), "email"),
            item("Téléphone", row["phone"] or profile.get("phone") or analysis.get("phone"), "phone"),
            item("Localisation", profile.get("location")),
            item("Fonction / titre", profile.get("headline") or row["target_role"]),
            item("LinkedIn", analysis.get("linkedin") or profile.get("linkedin")),
            item("GitHub", analysis.get("github") or profile.get("github")),
            item("Critères de poste", row["target_role"] or "Analyse générale"),
        ]) + "</dl>")
        st.caption("Confiance par champ : " + " · ".join(
            f"{quality.FIELD_LABELS[k]} {round(v * 100)} %" for k, v in fields.items()))
        reasons = meta.get("confidence_reasons") or []
        if reasons:
            st.caption("À vérifier : " + " · ".join(md(reason) for reason in reasons))


def _dossier_sections(analysis, meta):
    with st.container(border=True, key="card-dossier-skills"):
        st.subheader("Compétences repérées")
        skills = meta.get("skills") or []
        st.markdown(" ".join(f":gray-badge[{md(s)}]" for s in skills) if skills else "_Aucune compétence détectée._")
    for key, label in (("experience", "Expérience"), ("education", "Formation"), ("projects", "Projets")):
        entries = analysis.get(key) or []
        if key == "projects" and not entries:
            continue
        with st.container(border=True, key=f"card-dossier-{key}"):
            st.subheader(label)
            if not entries:
                st.caption("Aucune section détectée.")
            for entry in entries[:6]:
                text = re.sub(r"\s+", " ", str(entry)).strip()
                st.markdown("- " + md(text[:400] + ("…" if len(text) > 400 else "")))
    if analysis.get("summary"):
        with st.container(border=True, key="card-dossier-summary"):
            st.subheader("Résumé extrait")
            st.markdown(md(analysis["summary"][:1200]))


def _dossier_score(analysis, score, meta):
    with st.container(border=True, key="card-dossier-score"):
        top, criteria = st.columns([1, 2], vertical_alignment="center")
        top.metric("Score indicatif", f"{score}/100" if score is not None else "—")
        label = (meta.get("criteria") or {}).get("label")
        criteria.caption(f"Moteur : {meta.get('engine', 'ResumeAnalyzer (local)')} · critères : "
                         f"{md(label) if label else 'aucun (analyse générale)'}")
        if not label:
            criteria.caption("Sans critères de poste, la composante « compétences requises » (30 %) vaut 0. "
                             "Comparez à un poste ci-dessous pour l'évaluer.")
        sections = analysis.get("section_scores") or {}
        for key, name, weight in SECTION_WEIGHTS:
            value = max(0, min(100, int(sections.get(key) or 0)))
            st.progress(value / 100, text=f"{name} · {value}/100 · poids {weight} %")


def _dossier_review(row):
    cid = row["id"]
    with st.container(border=True, key="card-dossier-review"):
        st.subheader("Revue RH")
        with st.container(horizontal=True, vertical_alignment="bottom"):
            keys = list(store.REVIEW_LABELS)
            status = st.selectbox("Statut RH", keys, index=keys.index(row["review"]) if row["review"] in keys else 0,
                                  format_func=store.REVIEW_LABELS.get, key=f"dossier_status_{cid}", width=240)
            if st.button("Enregistrer le statut", key="dossier_status_save", disabled=status == row["review"]):
                store.set_review([cid], status, actor())
                st.toast(f"Statut → « {store.REVIEW_LABELS[status]} »", icon=":material/check:")
                st.rerun()
            if row["reviewed_by"]:
                st.caption(f"Analyse validée par {md(row['reviewed_by'])} le {fmt_dt(row['reviewed_at'])}")
            elif st.button("Valider l'analyse", icon=":material/verified:", type="primary", key="dossier_validate",
                           help="Confirme que vous avez relu le score, les éléments probants et le texte source."):
                store.validate_analysis(cid, actor())
                st.toast("Analyse marquée comme validée", icon=":material/verified:")
                st.rerun()
        with st.form(f"dossier_notes_{cid}", border=False):
            notes = st.text_area("Notes RH", value=row["notes"] or "", max_chars=4000, height=110,
                                 placeholder="Observations factuelles liées au poste…")
            if st.form_submit_button("Enregistrer la note"):
                store.save_notes(cid, notes, actor())
                st.toast("Note enregistrée", icon=":material/check:")
                st.rerun()
        suggestions = [s for s in analysis_suggestions(row) if s]
        if suggestions:
            st.markdown("**Points à examiner (moteur local)**")
            st.markdown("\n".join(f"- {md(s)}" for s in suggestions[:12]))


def analysis_suggestions(row):
    return parse_json(row["local_analysis_json"]).get("suggestions") or []


def _dossier_evidence(raw_text, analysis):
    with st.container(border=True, key="card-dossier-evidence"):
        st.subheader("Éléments probants")
        st.caption("Chaque élément extrait est relié à sa citation exacte dans le CV (numéro de ligne du texte source).")
        rows = quality.build_evidence(raw_text, analysis)
        if rows:
            st.dataframe(pd.DataFrame(rows), hide_index=True, alt="Éléments probants extraits du CV",
                         height=min(420, 38 + 35 * len(rows)))
        else:
            st.caption("Aucun élément extrait à citer.")


def _dossier_criteria(app, row, raw_text, meta):
    cid = row["id"]
    with st.container(border=True, key="card-dossier-criteria"):
        st.subheader("Comparer à des critères de poste")
        option = st.selectbox("Critères", role_options(app.job_roles)[1:], key=f"dossier_role_{cid}", index=None,
                              placeholder="Choisir un poste de référence…")
        if not option:
            st.caption("Les critères proviennent de config/job_roles.py (compétences requises par poste).")
            return
        role_info, label = role_from_option(app.job_roles, option)
        scoring_text, _ = quality.redact_protected(raw_text)
        match = app.analyzer.calculate_keyword_match(scoring_text, role_info.get("required_skills") or [])
        st.markdown(f"**{round(match['score'])} %** des compétences requises retrouvées dans le CV")
        st.dataframe(pd.DataFrame(quality.keyword_evidence(raw_text, match, parse_json(store.get_candidate(cid)["local_analysis_json"]))), hide_index=True,
                     alt=f"Correspondance avec {label}")
        if st.button("Recalculer le score avec ces critères", key="dossier_rerun",
                     help="Relance le moteur local avec ces compétences requises ; la validation RH est réinitialisée."):
            analysis = quality.prepare_analysis(raw_text, app.analyzer, role_info, label)
            if analysis.get("error") or "sothema" not in analysis:
                st.error(analysis.get("error") or "Analyse impossible.")
            else:
                store.update_local_analysis(cid, analysis, score=int(analysis.get("ats_score") or 0),
                                            confidence=analysis["sothema"]["confidence"], target_role=label,
                                            actor=actor())
                st.toast("Score recalculé avec les critères du poste", icon=":material/refresh:")
                st.rerun()


def _dossier_ai(app, row, raw_text, analysis):
    cid = row["id"]
    stored = parse_json(row["ai_analysis_json"])
    configured = bool(getattr(app.ai_analyzer, "openai_client", None))
    with st.container(border=True, key="card-dossier-ai"):
        st.subheader("Profil IA et analyse facultative")
        if not configured:
            st.warning("Ajoutez OPENAI_API_KEY dans utils/.env pour activer l'extraction du profil. L'analyse locale reste la "
                       "référence.", title="Clé API OpenAI manquante", icon=":material/key:")
        else:
            st.caption("L'extraction du profil lit le CV original pour corriger le nom et les informations présentes. "
                       "Les valeurs sont vérifiées contre le texte et restent à valider par RH.")
            if st.button("Réextraire le profil avec l'IA", icon=":material/person_search:", type="primary",
                         key="dossier_profile_reextract", help="Corrige le nom et les champs du profil sans modifier le score ni la confiance."):
                original = store.get_original_file(dict(row))
                if not original:
                    st.error("Le CV original est indisponible : le profil n'a pas été modifié.", title="Réextraction impossible")
                else:
                    with st.spinner("Lecture du CV et extraction du profil…"):
                        try:
                            extraction = document_extractor.extract_document(row["source_filename"], original)
                            profile_text = extraction.display_text or extraction.normalized_text or raw_text
                            result = app.ai_analyzer.extract_candidate_profile(
                                profile_text, header_context=quality.profile_header_context(extraction)
                            )
                            if result.get("profile"):
                                updated = quality.apply_ai_profile(
                                    analysis, result["profile"], profile_text,
                                    name_source_text=quality.profile_header_context(extraction),
                                )
                                verified = updated.get("ai_profile") or {}
                                canonical_name = verified.get("name") or row["full_name"] or updated.get("name") or ""
                                canonical_email = verified.get("email") or row["email"] or updated.get("email") or ""
                                canonical_phone = verified.get("phone") or row["phone"] or updated.get("phone") or ""
                                store.update_profile(cid, updated, full_name=canonical_name, email=canonical_email,
                                                     phone=canonical_phone, summary=updated.get("summary", ""), actor=actor())
                                st.toast("Profil réextrait et enregistré — score et confiance inchangés", icon=":material/check:")
                                st.rerun()
                            else:
                                st.error(result.get("error", "Aucun profil vérifiable n'a été retourné."),
                                         title="Profil IA indisponible")
                        except (ValueError, OSError, RuntimeError) as exc:
                            st.error(f"Profil IA non enregistré : {exc}", title="Réextraction impossible")
            if st.button("Lancer l'analyse IA", icon=":material/auto_awesome:", key="dossier_ai_run"):
                with st.spinner("Analyse IA en cours…"):
                    label = row["target_role"] or None
                    result = app.ai_analyzer.analyze_resume_with_openai(quality.pseudonymize(raw_text, analysis),
                                                                        job_role=label)
                if result.get("error"):
                    st.error(result["error"], title="Analyse IA impossible")
                else:
                    store.save_ai_result(cid, f"OpenAI · {app.ai_analyzer.openai_model}", result, actor())
                    st.rerun()
        if stored.get("analysis"):
            st.markdown(f":violet-badge[:material/auto_awesome: {md(stored.get('provider', 'IA'))} · à valider par RH] "
                        f"{score_badge(stored.get('resume_score'))}")
            with st.expander("Rapport IA", expanded=False):
                st.markdown(stored["analysis"])


def _dossier_audit(cid):
    with st.container(border=True, key="card-dossier-audit"):
        st.subheader("Historique du dossier")
        entries = store.list_audit(limit=50, candidate_id=cid)
        if not entries:
            st.caption("Aucun événement.")
            return
        st.dataframe(pd.DataFrame([{
            "Date": to_local(e["created_at"]), "Utilisateur": e["actor"] or "système",
            "Action": AUDIT_LABELS.get(e["action"], e["action"]), "Détails": details_text(e["details"]),
        } for e in entries]), hide_index=True, alt="Historique d'audit du dossier",
            column_config={"Date": st.column_config.DatetimeColumn(format="DD/MM/YYYY HH:mm")})


# --------------------------------------------------------------------------- settings

def page_settings(app):
    page_header("Paramètres", "Journal d'audit, données locales, comptes et cadre éthique.")
    st.session_state.setdefault("settings_section", "Journal d'audit")
    section = st.segmented_control("Section", ["Journal d'audit", "Données locales", "Comptes", "IA & éthique"],
                                   key="settings_section", label_visibility="collapsed", required=True)
    if section == "Journal d'audit":
        _settings_audit()
    elif section == "Données locales":
        _settings_data()
    elif section == "Comptes":
        _settings_accounts()
    else:
        _settings_ethics(app)


def _settings_audit():
    entries = store.list_audit(limit=5000)
    with st.container(border=True, key="card-settings-audit"):
        with st.container(horizontal=True, vertical_alignment="bottom"):
            query = st.text_input("Filtrer", key="audit_q", placeholder="Utilisateur, fichier, détail…", width=300)
            kinds = st.multiselect("Actions", sorted({e["action"] for e in entries}), key="audit_kinds",
                                   format_func=lambda a: AUDIT_LABELS.get(a, a), placeholder="Toutes", width=320)
        frame = pd.DataFrame([{
            "Date": to_local(e["created_at"]), "Utilisateur": e["actor"] or "système",
            "Action": AUDIT_LABELS.get(e["action"], e["action"]),
            "Dossier": f"#{e['candidate_id']}" if e["candidate_id"] else "—", "Détails": details_text(e["details"]),
            "_action": e["action"],
        } for e in entries])
        if not frame.empty:
            if kinds:
                frame = frame[frame["_action"].isin(kinds)]
            if query:
                blob = frame[["Utilisateur", "Action", "Dossier", "Détails"]].astype(str).agg(" ".join, axis=1)
                frame = frame[blob.str.contains(query, case=False, regex=False)]
        frame = frame.drop(columns=["_action"], errors="ignore")
        with st.container(horizontal=True, vertical_alignment="center"):
            st.caption(f"{plural(len(frame), 'entrée')} · journal en ajout seul (append-only)")
            st.download_button("Exporter", csv_bytes(frame), "journal_audit_sothema.csv", "text/csv",
                               icon=":material/download:", disabled=frame.empty, key="audit_export",
                               on_click=_log_export, args=("audit_exported", len(frame)))
        if frame.empty:
            empty_state("history", "Aucune entrée", "Les connexions, imports, revues et exports apparaissent ici.")
            st.space("small")
        else:
            st.dataframe(frame, hide_index=True, alt="Journal d'audit", height=520,
                         column_config={"Date": st.column_config.DatetimeColumn(format="DD/MM/YYYY HH:mm:ss")})


def _settings_data():
    stats = store.storage_stats()
    health = store.backend_health()
    rows = fetch_candidates()
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Dossiers", len(rows), border=True)
    c2.metric("Entrées d'audit", store.audit_count(), border=True)
    c3.metric("Base de données", "Supabase" if stats.get("backend") == "supabase" else human_size(stats["db_bytes"]), border=True)
    c4.metric("CV originaux stockés", human_size(stats["original_bytes"]), border=True)
    with st.container(border=True, key="card-settings-data"):
        if not health.get("ok"):
            st.error(f"Backend inaccessible : {health.get('error', 'erreur inconnue')}", title="État du stockage")
        else:
            backend_label = health.get("backend", "SQLite local")
            if health.get("project_ref"):
                backend_label += f" · projet {health['project_ref']}"
            st.success(f"Backend opérationnel : {backend_label}", icon=":material/cloud_done:")
        if stats.get("backend") == "supabase":
            st.html(f'<div class="so-mono">Supabase Postgres · private Storage bucket: {esc(stats.get("bucket", "candidate-cvs"))}</div>')
            st.caption("Dossiers, comptes RH et audit sont stockés dans Supabase Postgres ; les CV originaux sont dans le bucket privé. "
                       "Aucune donnée de démonstration n'est créée.")
        else:
            st.html(f'<div class="so-mono">sqlite:///{esc(stats["db_path"])}</div>')
            st.caption("Base unique locale : CV originaux, texte extrait, analyses et audit. Aucune donnée de démonstration n'est créée.")
        with st.container(horizontal=True):
            st.download_button("Exporter les dossiers (CSV)", csv_bytes(export_frame(rows)), "cvtheque_sothema.csv",
                               "text/csv", icon=":material/download:", disabled=not rows, key="data_csv",
                               on_click=_log_export, args=("export_csv", len(rows)))
            st.download_button("Exporter les dossiers (Excel)", _excel_bytes(rows) if rows else b"",
                               "cvtheque_sothema.xlsx",
                               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                               icon=":material/table_view:", disabled=not rows, key="data_xlsx",
                               on_click=_log_export, args=("export_excel", len(rows)))
            if stats.get("backend") != "supabase":
                if st.button("Préparer une sauvegarde SQLite", icon=":material/backup:", key="data_backup_prepare"):
                    st.session_state["so_backup"] = store.backup_bytes()
        if stats.get("backend") != "supabase" and st.session_state.get("so_backup"):
            st.download_button("Télécharger la sauvegarde", st.session_state["so_backup"],
                               f"sothema_backup_{datetime.now():%Y%m%d_%H%M}.db", "application/octet-stream",
                               icon=":material/download:", type="primary", key="data_backup_dl",
                               on_click=_backup_downloaded)
        elif stats.get("backend") == "supabase":
            st.info("Les sauvegardes hébergées sont gérées depuis Supabase. Vérifiez le plan de sauvegarde du projet et exportez régulièrement les données de test.",
                    title="Sauvegarde Supabase", icon=":material/cloud_done:")
        with st.container(border=True, key="card-settings-engine"):
            st.subheader("État des moteurs d'extraction")
            capabilities = document_extractor.runtime_capabilities()
            st.html('<dl class="so-kv">' + "".join(
                f"<dt>{esc(label)}</dt><dd>{':green-badge[Disponible]' if capabilities[key] else ':orange-badge[Non installé — revue manuelle]'}</dd>"
                for key, label in (("pdftotext", "pdftotext / texte PDF"), ("poppler", "Poppler / rendu de pages"), ("tesseract", "Tesseract / OCR")
            )) + "</dl>")
            st.caption("Les CV PDF/DOCX textuels et conçus avec des colonnes/tableaux ne dépendent pas de l'OCR. "
                       "Les pages image nécessitent Tesseract ; sans lui, elles sont signalées et aucun champ n'est inventé.")
        st.caption("Les exports et sauvegardes contiennent des données personnelles : stockez-les sur un emplacement "
                   "sécurisé.")


def _backup_downloaded():
    st.session_state.pop("so_backup", None)
    store.log_event("backup_downloaded", actor=actor())


def _excel_bytes(rows):
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        export_frame(rows).to_excel(writer, index=False, sheet_name="CVthèque")
    return buffer.getvalue()


def _settings_accounts():
    left, right = st.columns([6, 5])
    with left, st.container(border=True, key="card-settings-accounts"):
        st.subheader("Comptes autorisés")
        accounts = list_admins()
        st.dataframe(pd.DataFrame([{"E-mail": a["email"] if isinstance(a, dict) else a[0],
                                    "Créé le": a["created_at"] if isinstance(a, dict) else a[1]}
                                   for a in accounts]), hide_index=True,
                     alt="Comptes autorisés")
        st.caption("Les mots de passe sont stockés sous forme de hachage PBKDF2-SHA256 salé ; ils ne sont jamais "
                   "affichés.")
    with right:
        with st.container(border=True, key="card-settings-add"):
            st.subheader("Ajouter un compte RH")
            with st.form("so_add_account", border=False, clear_on_submit=True):
                email = st.text_input("E-mail professionnel")
                password = st.text_input("Mot de passe (10 caractères minimum)", type="password")
                confirm = st.text_input("Confirmer", type="password")
                submitted = st.form_submit_button("Créer le compte", type="primary")
            if submitted:
                email = email.strip().lower()
                if not re.fullmatch(r"[\w.+-]+@[\w-]+(\.[\w-]+)+", email):
                    st.error("Adresse e-mail invalide.")
                elif len(password) < 10 or password != confirm:
                    st.error("Mot de passe trop court ou confirmation différente.")
                elif add_admin(email, password):
                    store.log_event("admin_created", details={"email": email}, actor=actor())
                    st.success(f"Compte {email} créé.")
                else:
                    st.error("Ce compte existe déjà.")
        with st.container(border=True, key="card-settings-password"):
            st.subheader("Changer mon mot de passe")
            with st.form("so_change_pw", border=False, clear_on_submit=True):
                current = st.text_input("Mot de passe actuel", type="password")
                new = st.text_input("Nouveau mot de passe", type="password")
                confirm = st.text_input("Confirmer le nouveau mot de passe", type="password")
                submitted = st.form_submit_button("Mettre à jour")
            if submitted:
                if len(new) < 10 or new != confirm:
                    st.error("Nouveau mot de passe trop court ou confirmation différente.")
                elif update_admin_password(actor(), current, new):
                    store.log_event("password_changed", actor=actor())
                    st.success("Mot de passe mis à jour.")
                else:
                    st.error("Mot de passe actuel incorrect.")


def _settings_ethics(app):
    principles = [
        (":material/person_check:", "RH dans la boucle", "Les scores et analyses sont des recommandations. Aucun rejet "
         "ni aucune invitation automatique ; chaque analyse est validée explicitement par un recruteur."),
        (":material/fact_check:", "Transparence", "Chaque élément extrait est relié à sa citation exacte et à sa ligne "
         "dans le CV ; la pondération du score est publique."),
        (":material/balance:", "Équité", "Âge, genre, nationalité, situation familiale et photo sont retirés du texte "
         "évalué et ignorés dans la recherche."),
        (":material/lock:", "Protection des données", "SQLite local en développement, Supabase Postgres et Storage privés en hébergement. Les fournisseurs IA sont optionnels, reçoivent "
         "un texte pseudonymisé et leurs clés ne sont jamais affichées."),
    ]
    cols = st.columns(4)
    for col, (icon, title, body) in zip(cols, principles):
        with col, st.container(border=True, key=f"card-ethics-{title}", height="stretch"):
            st.markdown(f"#### {icon} {title}")
            st.caption(body)
    left, right = st.columns(2)
    with left, st.container(border=True, key="card-ethics-weights"):
        st.subheader("Pondération du score local")
        st.dataframe(pd.DataFrame([{"Composante": name, "Poids": f"{weight} %"} for _, name, weight in SECTION_WEIGHTS]),
                     hide_index=True, alt="Pondération du score")
        st.caption("Source : utils/resume_analyzer.py (ResumeAnalyzer.analyze_resume). Le score mesure la structure "
                   "et la complétude du CV, pas la valeur d'une personne.")
    with right, st.container(border=True, key="card-ethics-providers"):
        st.subheader("Fournisseurs IA")
        st.dataframe(pd.DataFrame([{"Fournisseur": name, "Statut": "Clé configurée" if ok else "Clé manquante",
                                    "Modèle": model or "—"} for name, ok, model in ai_providers(app)]),
                     hide_index=True, alt="Fournisseurs IA")
        st.caption("Les clés sont lues depuis utils/.env et ne sont jamais stockées en base ni affichées.")
