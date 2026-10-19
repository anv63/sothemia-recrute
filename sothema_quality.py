"""Extraction quality, evidence and fairness guards around the existing ResumeAnalyzer.

The analyzer's scoring logic is untouched. This module only decides what text it
scores (protected attributes removed first), how confident the extraction is,
and where each extracted element can be found in the source CV.
"""
import re
import unicodedata

PROTECTED_LABELS = {
    "age": "âge",
    "gender": "genre",
    "nationality": "nationalité",
    "family_status": "situation familiale",
    "photo": "photo",
}

# (category, pattern, short_only). short_only patterns only match a short, standalone segment
# so that e.g. "8 ans en assurance qualité" (experience) is never treated as an age.
_PROTECTED_PATTERNS = [
    ("age", r"\b(?:âge|age)\s*[:\-–]?\s*\d{1,2}\b", False),
    ("age", r"\b(?:né|née|nee)\s+le\b", False),
    ("age", r"\bdate\s+(?:de\s+)?naissance\b", False),
    ("age", r"\b(?:date\s+of\s+birth|birth\s*date|d\.o\.b\.?|dob)\b", False),
    ("age", r"\bborn\s+(?:on|in)\b", False),
    ("age", r"^(?:1[6-9]|[2-7]\d)\s*(?:ans|years?\s*old)$", True),
    ("gender", r"\b(?:sexe|genre|gender|sex)\s*[:\-–]", False),
    ("gender", r"^(?:homme|femme|masculin|f[ée]minin|male|female)$", True),
    ("nationality", r"\b(?:nationalit[ée]s?|nationality|citizenship|citoyennet[ée])\b", False),
    # Standalone demonyms only; language names such as "Français" or "Espagnol" are skills, not nationality.
    ("nationality", r"^(?:marocaine?|alg[ée]rienne?|tunisienne?|s[ée]n[ée]galaise?|ivoirienne?|"
                    r"moroccan|algerian|tunisian)$", True),
    ("family_status", r"\b(?:situation\s+(?:familiale|matrimoniale)|[ée]tat\s+civil|marital\s+status|family\s+status)\b", False),
    ("family_status", r"\b(?:mari[ée]e?|c[ée]libataire|divorc[ée]e?|veuf|veuve|pacs[ée]e?|married|divorced|widowed)\b", False),
    ("family_status", r"^(?:\d+\s+(?:enfants?|children|kids)|sans\s+enfants?|no\s+children)$", True),
    ("photo", r"^photo(?:graphie)?\b.{0,25}$", True),
]
_COMPILED = [(cat, re.compile(pat, re.IGNORECASE), short) for cat, pat, short in _PROTECTED_PATTERNS]
_SEGMENT_SPLIT = re.compile(r"\s*(?:[|•·;]|,\s|\s{3,}|\t)\s*")

# Search terms that would filter or rank people on protected attributes.
_PROTECTED_QUERY_TERMS = {
    "age": ["âge", "age", "jeune", "jeunes", "young", "âgé", "âgée", "agé"],
    "gender": ["homme", "hommes", "femme", "femmes", "masculin", "féminin", "feminin", "male", "female",
               "man", "men", "woman", "women", "garçon", "fille", "sexe", "genre", "gender"],
    "nationality": ["nationalité", "nationalite", "nationality", "marocain", "marocaine", "marocains",
                    "étranger", "etranger", "étrangère", "foreigner"],
    "family_status": ["marié", "mariée", "célibataire", "celibataire", "divorcé", "divorcée",
                      "enfant", "enfants", "married", "single", "divorced", "children", "veuf", "veuve"],
    "photo": ["photo", "photos"],
}
_QUERY_INDEX = {term: cat for cat, terms in _PROTECTED_QUERY_TERMS.items() for term in terms}

_NOT_A_NAME = {
    "curriculum", "vitae", "cv", "resume", "résumé", "profile", "profil", "summary", "manager", "engineer",
    "ingénieur", "ingenieur", "developer", "développeur", "developpeur", "specialist", "spécialiste",
    "consultant", "director", "directeur", "directrice", "analyst", "analyste", "assistant", "assistante",
    "accountant", "comptable", "teacher", "enseignant", "chef", "sales", "commercial", "technicien",
    "technician", "officer", "coordinator", "coordinateur", "administrator", "administrateur", "pharmacien",
    "pharmacienne", "designer", "advocate", "avocat", "hr", "rh", "it", "senior", "junior", "executive",
    "representative", "intern", "stagiaire", "responsable", "chargé", "chargée", "business", "development",
    "marketing", "finance", "banking", "healthcare", "nurse", "infirmier", "infirmière", "agent",
    "supervisor", "superviseur", "lead", "head", "president", "vice", "associate", "operator", "opérateur",
    "driver", "clerk", "contact", "information", "informations", "personal", "personnelles", "experience",
    "expérience", "education", "formation", "skills", "compétences", "objective", "objectif", "professional",
    "professionnel", "management", "services", "service", "customer", "account", "project", "projet",
    "teaching", "fitness", "trainer", "instructor", "public", "relations", "aviation", "automobile",
}

FIELD_LABELS = {
    "name": "Nom",
    "email": "E-mail",
    "phone": "Téléphone",
    "skills": "Compétences",
    "experience": "Expérience",
    "education": "Formation",
    "text": "Texte lisible",
}

LOW_CONFIDENCE = 0.6


def _fold(text):
    return unicodedata.normalize("NFD", text.lower()).encode("ascii", "ignore").decode()


def redact_protected(text):
    """Remove protected-attribute mentions; returns (text, {category: count}).

    Only the matching segment of a line is removed, so contact details sharing
    a line with a birth date are kept.
    """
    counts = {}
    out_lines = []
    for line in (text or "").splitlines():
        if not line.strip():
            out_lines.append(line)
            continue
        segments = [seg for seg in _SEGMENT_SPLIT.split(line.strip()) if seg]
        kept, hit = [], False
        for segment in segments:
            category = None
            for cat, rx, short in _COMPILED:
                if short and len(segment) > 40:
                    continue
                if rx.search(segment.strip()):
                    category = cat
                    break
            if category:
                counts[category] = counts.get(category, 0) + 1
                hit = True
            else:
                kept.append(segment)
        if not hit:
            out_lines.append(line)
        elif kept:
            out_lines.append(" · ".join(kept))
    return "\n".join(out_lines), counts


def sanitize_query(query):
    """Split a search query into usable terms and ignored protected terms."""
    terms, ignored = [], []
    for raw in re.findall(r"[\wÀ-ÿ@.+'’-]+", query or ""):
        word = raw.strip(".'’-").lower()
        if not word:
            continue
        if word in _QUERY_INDEX or _fold(word) in _QUERY_INDEX:
            ignored.append(raw)
        elif len(word) >= 2:
            terms.append(raw)
    return terms, ignored


def plausible_name(value):
    value = (value or "").strip()
    if not value or len(value) > 60 or "@" in value or any(ch.isdigit() for ch in value):
        return False
    words = re.findall(r"[A-Za-zÀ-ÿ'’\-]+", value)
    if not 2 <= len(words) <= 5 or len(words) != len(value.split()):
        return False
    return not ({w.lower() for w in words} & _NOT_A_NAME)


def detect_name(raw_text, analyzer_name):
    """Use the analyzer's guess when plausible, else the first plausible line among the first five."""
    if plausible_name(analyzer_name):
        return analyzer_name.strip(), 1, 0.85
    lines = [line.strip() for line in (raw_text or "").splitlines() if line.strip()]
    for index, line in enumerate(lines[:5], start=1):
        if plausible_name(line):
            return line, index, 0.7
    return "", None, 0.0


def clean_skills(skills):
    out, seen = [], set()
    for skill in skills or []:
        skill = re.sub(r"\s+", " ", str(skill).replace("Â", " ")).strip(" .:;,-–•· ")
        if not skill or len(skill) > 40 or len(skill.split()) > 4 or not re.search(r"[A-Za-zÀ-ÿ]", skill):
            continue
        key = skill.lower()
        if key not in seen:
            seen.add(key)
            out.append(skill)
    return out[:40]


def field_confidence(raw_text, name_confidence, analysis, skills, extraction=None):
    phone_digits = re.sub(r"\D", "", analysis.get("phone") or "")
    text_length = len((raw_text or "").strip())
    return {
        "name": name_confidence,
        "email": 1.0 if re.fullmatch(r"[\w.+-]+@[\w-]+(\.[\w-]+)+", analysis.get("email") or "") else 0.0,
        "phone": 1.0 if len(phone_digits) >= 8 else 0.0,
        "skills": round(min(1.0, len(skills) / 5), 2),
        "experience": 1.0 if analysis.get("experience") else 0.0,
        "education": 1.0 if analysis.get("education") else 0.0,
        "text": extraction.readability_confidence if extraction is not None else (
            1.0 if text_length >= 1200 else 0.6 if text_length >= 400 else 0.2
        ),
    }


def semantic_confidence(analysis, extraction=None):
    """Estimate whether the document contains enough CV structure to review safely."""
    if extraction is not None and extraction.semantic_signals:
        signals = extraction.semantic_signals
        score = (int(signals.get("contact", False)) +
                 min(2, int(signals.get("sections", 0))) / 2 +
                 int(signals.get("dates", False)) +
                 int(signals.get("role_language", False)) +
                 int(signals.get("structured_content", False))) / 5
        return round(min(1.0, score), 2)
    return round(min(1.0, sum(bool(analysis.get(key)) for key in ("summary", "experience", "education", "skills")) / 4), 2)


def _extraction_metadata(extraction):
    if extraction is None:
        return {}
    return extraction.as_dict()


def _confidence_reasons(fields, readability, semantic, extraction=None):
    reasons = []
    if fields.get("email", 0) == 0:
        reasons.append("e-mail non détecté")
    if fields.get("phone", 0) == 0:
        reasons.append("téléphone non détecté")
    if fields.get("name", 0) < 0.8:
        reasons.append("nom à vérifier")
    if fields.get("skills", 0) < 0.6:
        reasons.append("peu de compétences structurées")
    if fields.get("experience", 0) == 0:
        reasons.append("expérience non détectée")
    if fields.get("education", 0) == 0:
        reasons.append("formation non détectée")
    if readability < 0.6:
        reasons.append("texte partiellement lisible")
    if extraction is not None:
        if extraction.ocr_pages:
            reasons.append(f"OCR requis sur page(s) {', '.join(map(str, extraction.ocr_pages))}")
        if extraction.tables:
            reasons.append(f"{extraction.tables} tableau(x) extrait(s)")
        if extraction.empty_pages:
            reasons.append(f"page(s) sans texte : {', '.join(map(str, extraction.empty_pages))}")
    if semantic < 0.6:
        reasons.append("signaux CV incomplets")
    return reasons


def prepare_analysis(raw_text, analyzer, role_info=None, criteria_label="", extraction=None):
    """Run the existing analyzer on protected-attribute-free, layout-normalized text."""
    analysis_text = extraction.normalized_text if extraction is not None else raw_text
    scoring_text, redactions = redact_protected(analysis_text)
    analysis = analyzer.analyze_resume({"raw_text": scoring_text}, role_info or {"required_skills": []})
    document_type = analysis.get("document_type")
    semantic = semantic_confidence(analysis, extraction)
    # An ambiguous but readable document is retained for recruiter review rather than discarded.
    if analysis.get("error"):
        return analysis
    if document_type != "resume" and extraction is not None and semantic >= 0.45 and extraction.readability_confidence >= 0.35:
        analysis["document_type"] = "resume"
        analysis["document_type_review"] = document_type
        analysis.setdefault("suggestions", []).insert(0, "Vérifier manuellement le type de document : la mise en page est atypique.")
    elif document_type != "resume":
        return analysis
    name, name_line, name_confidence = detect_name(raw_text or analysis_text, analysis.get("name"))
    skills = clean_skills(analysis.get("skills"))
    fields = field_confidence(analysis_text, name_confidence, analysis, skills, extraction)
    field_average = sum(fields.values()) / len(fields)
    readability = extraction.readability_confidence if extraction is not None else fields["text"]
    confidence = round((field_average * 0.5) + (readability * 0.3) + (semantic * 0.2), 2)
    analysis["sothema"] = {
        "version": 2,
        "engine": "ResumeAnalyzer (local)",
        "name": name,
        "name_line": name_line,
        "skills": skills,
        "field_confidence": fields,
        "field_average": round(field_average, 2),
        "readability_confidence": round(readability, 2),
        "semantic_confidence": semantic,
        "confidence_reasons": _confidence_reasons(fields, readability, semantic, extraction),
        "confidence": confidence,
        "protected_redactions": redactions,
        "extraction": _extraction_metadata(extraction),
        "criteria": {
            "label": criteria_label or "",
            "required_skills": list((role_info or {}).get("required_skills") or []),
        },
    }
    return analysis


def locate(raw_text, needle, extraction=None):
    """Find exact extracted source with original page and line provenance."""
    needle = (needle or "").strip()
    if not needle:
        return None, "", None
    folded = _fold(needle)[:80]
    if extraction is not None:
        for item in extraction.evidence_lines:
            source = item.get("text", "")
            if folded and folded in _fold(source):
                quote = source.strip()
                quote = quote if len(quote) <= 180 else quote[:177] + "…"
                return item.get("line"), quote, item.get("page")
    for number, line in enumerate((raw_text or "").splitlines(), start=1):
        if folded and folded in _fold(line):
            quote = line.strip()
            return number, quote if len(quote) <= 180 else quote[:177] + "…", None
    return None, "", None


def build_evidence(raw_text, analysis):
    """Rows of (element, extracted value, exact quote, location) for recruiter verification."""
    meta = analysis.get("sothema") or {}
    rows = []

    extraction = None
    # The extraction result is persisted with the analysis; the helper also accepts it explicitly.
    extraction_data = meta.get("extraction") or {}
    source_map = extraction_data.get("source_lines") or []

    def add(element, value, needle=None):
        line, quote, page = locate(raw_text, needle or value)
        if line is None and source_map:
            folded = _fold(needle or value)[:80]
            match = next((item for item in source_map if folded and folded in _fold(item.get("text", ""))), None)
            if match:
                line, quote, page = match.get("line"), match.get("text", ""), match.get("page")
        location = f"p. {page}, l. {line}" if page and line else f"l. {line}" if line else "—"
        rows.append({
            "Élément": element,
            "Valeur extraite": value,
            "Citation exacte du CV": quote or "— introuvable tel quel dans le texte",
            "Localisation": location,
        })

    if meta.get("name"):
        add("Nom", meta["name"])
    for key, label in (("email", "E-mail"), ("phone", "Téléphone"), ("linkedin", "LinkedIn"), ("github", "GitHub")):
        if analysis.get(key):
            add(label, analysis[key])
    for skill in (meta.get("skills") or [])[:15]:
        add("Compétence", skill)
    for label, key in (("Expérience", "experience"), ("Formation", "education")):
        for entry in (analysis.get(key) or [])[:3]:
            snippet = re.sub(r"\s+", " ", str(entry)).strip()
            add(label, snippet[:90] + ("…" if len(snippet) > 90 else ""), snippet[:50])
    return rows


def keyword_evidence(raw_text, keyword_match, analysis=None):
    rows = []
    source_map = ((analysis or {}).get("sothema", {}).get("extraction", {}).get("source_lines") or [])
    for skill in keyword_match.get("found_skills") or []:
        line, quote, page = locate(raw_text, skill)
        if line is None and source_map:
            folded = _fold(skill)[:80]
            match = next((item for item in source_map if folded and folded in _fold(item.get("text", ""))), None)
            if match:
                line, quote, page = match.get("line"), match.get("text", ""), match.get("page")
        location = f"p. {page}, l. {line}" if page and line else f"l. {line}" if line else "—"
        rows.append({"Critère": skill, "État": "Satisfait", "Citation exacte du CV": quote or "—",
                     "Localisation": location})
    for skill in keyword_match.get("missing_skills") or []:
        rows.append({"Critère": skill, "État": "Manquant", "Citation exacte du CV": "—", "Localisation": "—"})
    return rows


def pseudonymize(text, analysis):
    """Text sent to an external AI provider: identity and protected attributes removed."""
    text, _ = redact_protected(text)
    meta = analysis.get("sothema") or {}
    for value, token in ((meta.get("name"), "[NOM]"), (analysis.get("email"), "[E-MAIL]"),
                         (analysis.get("phone"), "[TÉLÉPHONE]"), (analysis.get("linkedin"), "[LINKEDIN]"),
                         (analysis.get("github"), "[GITHUB]")):
        if value:
            text = re.sub(re.escape(value), token, text, flags=re.IGNORECASE)
    return text
