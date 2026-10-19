# Contributing to Sothema HR Intelligence

Thank you for helping improve the Sothema RH Applicant Tracking System.

## Scope

The authoritative application is the Streamlit/Python project. The React project is included under `reference/react-design/` only as a visual/product reference. Candidate data and persistence belong to the Python/SQLite pipeline.

## Before you start

```bash
python3 -m venv .venv-final
.venv-final/bin/pip install -r requirements.txt
cp utils/.env.example utils/.env
```

Keep `utils/.env` local. Never commit API keys, passwords, CVs, databases, exports, or screenshots containing personal data.

## Branches and pull requests

Create a focused branch:

```bash
git switch -c feature/short-description
```

A pull request should include:

- the user-facing or technical behavior changed;
- affected files and data flow;
- tests and commands run;
- any migration or deployment impact;
- security, privacy, and fairness considerations;
- screenshots only when they contain no personal data.

## Local validation

Use a scratch database for every test run:

```bash
.venv-final/bin/python -m compileall -q \
  app.py sothema_views.py sothema_quality.py ats_api.py utils

SOTHEMA_DB_PATH=/tmp/sothema-ci.db \
.venv-final/bin/python -m pytest -q
```

For manual testing:

```bash
SOTHEMA_DB_PATH=/tmp/sothema-local.db \
.venv-final/bin/python -m streamlit run app.py \
  --server.port 8501 --server.address 127.0.0.1
```

Do not run destructive tests against `resume_data.db`.

## Development rules

- Preserve the synchronous, transactional import contract: validate → extract → analyze → persist → read back.
- Reuse `utils/document_extractor.py` for PDF/DOCX extraction; do not create a second parser in a UI module.
- Keep `ats_store.py` as the ATS persistence source of truth.
- Keep protected attributes out of scoring, ranking, and search.
- Keep scores advisory and require human review.
- Add provenance and actionable warnings when changing extraction.
- Keep original files and personal data out of Git.
- Do not seed or fabricate candidate records.
- Prefer native Streamlit APIs and follow the project Streamlit skill guidance.

## Commit messages

Use a concise imperative subject, for example:

```text
Improve DOCX table extraction
```

Keep unrelated formatting or generated files out of the commit.

## Code review checklist

Reviewers should verify:

- tests use a scratch database;
- no credentials or personal data are staged;
- extraction failures cannot create partial candidate rows;
- duplicate detection still works;
- evidence remains tied to source text/page/line;
- age, gender, nationality, family status, and photo cannot influence results;
- documentation is updated for user-visible behavior;
- hosted/API changes include authentication and privacy implications.
