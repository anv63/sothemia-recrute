"""Sothema HR Intelligence look & feel for Streamlit (mirrors the React reference design).

Native elements carry most of the design through .streamlit/config.toml; the CSS below only
adds what the theme cannot express: white cards on the canvas, the brand stripe, the
page header, empty states and the sidebar status card.
"""
import html

import streamlit as st

REVIEW_COLORS = {"a_examiner": "blue", "en_revue": "violet", "retenu": "green", "en_attente": "orange", "archive": "gray"}

AUDIT_LABELS = {
    "candidate_ingested": "CV importé",
    "ingestion_failed": "Import refusé",
    "duplicate_rejected": "Doublon refusé",
    "review_status_changed": "Statut RH modifié",
    "analysis_validated": "Analyse validée",
    "analysis_rerun": "Analyse recalculée",
    "profile_reextracted": "Profil réextrait avec l'IA",
    "notes_saved": "Notes RH enregistrées",
    "ai_analysis_saved": "Analyse IA enregistrée",
    "candidate_deleted": "Dossier supprimé",
    "original_downloaded": "CV original téléchargé",
    "export_csv": "Export CSV",
    "export_excel": "Export Excel",
    "audit_exported": "Journal exporté",
    "backup_downloaded": "Sauvegarde téléchargée",
    "login": "Connexion",
    "logout": "Déconnexion",
    "login_failed": "Échec de connexion",
    "admin_created": "Compte créé",
    "password_changed": "Mot de passe modifié",
}

_CSS = """
<style>
:root {
  --ink:#0B1F3A; --ink-2:#34465F; --ink-3:#5B6B82; --ink-4:#8492A6;
  --canvas:#F4F6F9; --surface:#FFFFFF; --subtle:#F8FAFC; --line:#E3E8EF; --line-strong:#C9D2DE;
  --brand-50:#EAF7FC; --brand-100:#C8EDF8; --brand-500:#00A5D6; --brand-600:#007EB5; --brand-700:#183A73;
  --ok-50:#E8F6EE; --ok-600:#12804F; --warn-50:#FFF5E1; --warn-600:#A35B00; --bad-50:#FDEEEC; --bad-600:#B42318;
  --violet-50:#F1EFFD; --violet-600:#5B4BC4; --sothema-red:#D9282F;
  --shadow-card:0 1px 2px rgb(11 31 58 / .05), 0 1px 3px rgb(11 31 58 / .04);
}
[data-testid="stAppViewContainer"] {
  background: radial-gradient(circle at 100% 0%, rgb(0 165 214 / .06), transparent 28rem), var(--canvas);
}
[data-testid="stHeader"] { background: rgb(255 255 255 / .92); border-bottom: 1px solid var(--line); }
[data-testid="stHeader"]::before {
  content: ""; position: absolute; inset: 0 0 auto 0; height: 2px;
  background: linear-gradient(90deg, var(--brand-700) 0%, var(--brand-700) 58%, var(--brand-500) 80%, var(--sothema-red) 100%);
}
.block-container { max-width: 1480px; padding-top: 3.6rem; }
[data-testid="stSidebarNav"] a[aria-current="page"] { background: var(--brand-50); }
[data-testid="stSidebarNav"] a[aria-current="page"] span { color: var(--brand-700); font-weight: 600; }
[data-testid="stSidebarNavSeparator"] { border-color: var(--line); }

/* Cards: any container whose key starts with "card" */
[class*="st-key-card"] {
  background: var(--surface); border: 1px solid var(--line) !important; border-radius: 10px;
  box-shadow: var(--shadow-card);
}
[data-testid="stMetric"] {
  background: var(--surface); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow-card);
}
[data-testid="stMetricLabel"] p { color: var(--ink-3); font-weight: 500; font-size: 13px; }
[data-testid="stCaptionContainer"] { color: var(--ink-3); }
[data-testid="stDataFrame"] { border-radius: 10px; }
[data-testid="stFileUploaderDropzone"] { border: 1.5px dashed var(--line-strong); background: var(--subtle); }
[data-testid="stFileUploaderDropzone"]:hover { border-color: var(--brand-500); background: var(--brand-50); }

.so-header { margin: 0 0 1.25rem 0; }
.so-crumbs { font-size: 13px; color: var(--ink-3); margin-bottom: 4px; }
.so-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--brand-700); margin-bottom: 4px; }
.so-title { font-size: 22px; line-height: 28px; font-weight: 600; letter-spacing: -.01em; color: var(--ink); margin: 0; }
.so-subtitle { margin-top: 4px; font-size: 14px; color: var(--ink-3); }

.so-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 24px 8px; }
.so-empty .so-icon { width: 44px; height: 44px; border-radius: 999px; display: flex; align-items: center; justify-content: center;
  background: var(--canvas); color: var(--ink-3); margin-bottom: 12px; }
.so-empty.bad .so-icon { background: var(--bad-50); color: var(--bad-600); }
.so-empty.brand .so-icon { background: var(--brand-50); color: var(--brand-600); }
.so-empty h3 { font-size: 15px; font-weight: 600; color: var(--ink); margin: 0; padding: 0; }
.so-empty p { margin: 4px 0 0; max-width: 28rem; font-size: 14px; line-height: 1.55; color: var(--ink-3); }
.so-ms { font-family: "Material Symbols Rounded"; font-size: 22px; line-height: 1; font-weight: normal; font-style: normal;
  -webkit-font-feature-settings: "liga"; font-feature-settings: "liga"; }

.so-status { display: flex; gap: 10px; align-items: flex-start; border: 1px solid var(--line); background: var(--subtle);
  border-radius: 6px; padding: 10px 12px; font-size: 12px; color: var(--ink-3); }
.so-status b { color: var(--ink); font-weight: 500; display: block; font-size: 13px; }
.so-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--ok-600); margin-top: 5px; flex: none; }
.so-user { display: flex; gap: 10px; align-items: center; }
.so-avatar { width: 32px; height: 32px; border-radius: 999px; background: #007EB5; color: #fff; display: flex;
  align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex: none; }
.so-user b { display: block; font-size: 13px; font-weight: 500; color: var(--ink); word-break: break-all; }
.so-user span { font-size: 11px; color: var(--ink-3); }

.so-kv { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 6px 12px; font-size: 13px; }
.so-kv dt { color: var(--ink-3); }
.so-kv dd { margin: 0; color: var(--ink); word-break: break-word; }
.so-kv .missing { color: var(--ink-4); font-style: italic; }
.so-fdot { display: inline-block; width: 6px; height: 6px; border-radius: 999px; margin-right: 6px; vertical-align: middle; }
.so-quote { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 12px; color: var(--ink-2);
  background: var(--subtle); border-left: 3px solid var(--brand-500); padding: 6px 10px; border-radius: 4px; }
.so-login-brand { text-align: center; margin: 4px 0 18px; }
.so-login-brand .so-title { font-size: 20px; }
.so-mono { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 12px; color: var(--ink-3); }

/* Light rendering for the complementary tools that still use the legacy header classes */
.page-header { padding: 0 0 12px; margin-bottom: 16px; border-bottom: 1px solid var(--line); }
.page-header .header-title { font-size: 22px; font-weight: 600; color: var(--ink); margin: 0; }
.page-header .header-subtitle { font-size: 14px; color: var(--ink-3); }
</style>
"""


def esc(value):
    return html.escape(str(value if value is not None else ""))


def inject_css():
    st.html(_CSS)


def page_header(title, subtitle=None, eyebrow=None, crumbs=None):
    parts = ['<div class="so-header">']
    if crumbs:
        parts.append(f'<div class="so-crumbs">{" › ".join(esc(c) for c in crumbs)}</div>')
    if eyebrow:
        parts.append(f'<div class="so-eyebrow">{esc(eyebrow)}</div>')
    parts.append(f'<h1 class="so-title">{esc(title)}</h1>')
    if subtitle:
        parts.append(f'<div class="so-subtitle">{esc(subtitle)}</div>')
    parts.append("</div>")
    st.html("".join(parts))


def empty_state(icon, title, body="", tone="neutral"):
    st.html(
        f'<div class="so-empty {esc(tone)}"><div class="so-icon"><span class="so-ms">{esc(icon)}</span></div>'
        f'<h3>{esc(title)}</h3>{f"<p>{esc(body)}</p>" if body else ""}</div>'
    )


def score_badge(score):
    if score is None:
        return ":gray-badge[Score —]"
    color = "green" if score >= 75 else "blue" if score >= 50 else "orange"
    return f":{color}-badge[Score {int(score)}/100]"


def confidence_badge(confidence):
    if confidence is None:
        return ":gray-badge[Confiance —]"
    if confidence >= 0.8:
        return f":green-badge[Confiance élevée · {round(confidence * 100)} %]"
    if confidence >= 0.6:
        return f":orange-badge[Confiance moyenne · {round(confidence * 100)} %]"
    return f":red-badge[:material/warning: Faible confiance · {round(confidence * 100)} %]"


def review_badge(review, labels):
    return f":{REVIEW_COLORS.get(review, 'gray')}-badge[{labels.get(review, review or '—')}]"


def field_dot(value):
    color = "#12804F" if value >= 0.8 else "#A35B00" if value >= 0.6 else "#B42318" if value > 0 else "#C9D2DE"
    label = "Non détecté" if value == 0 else f"Confiance d'extraction {round(value * 100)} %"
    return f'<span class="so-fdot" style="background:{color}" title="{esc(label)}"></span>'


def sidebar_status(count, failures_7d):
    detail = f"{count} dossier{'s' if count != 1 else ''} · à jour"
    if failures_7d:
        detail += f" · {failures_7d} import(s) refusé(s) sur 7 j"
    st.html(f'<div class="so-status"><span class="so-dot"></span><div><b>SQLite local</b>{esc(detail)}</div></div>')


def user_chip(email, role="Administrateur RH"):
    initials = "".join(part[:1] for part in email.split("@")[0].replace(".", " ").replace("_", " ").split()[:2]).upper() or "?"
    st.html(f'<div class="so-user"><div class="so-avatar">{esc(initials)}</div><div><b>{esc(email)}</b><span>{esc(role)}</span></div></div>')


def human_size(n):
    n = n or 0
    if n >= 1024 * 1024:
        return f"{n / 1024 / 1024:.1f} Mo"
    return f"{max(1, round(n / 1024))} Ko" if n else "0 Ko"
