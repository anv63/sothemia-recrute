# Sothema HR Intelligence

Private collaboration repository for Sothema's HR manager Applicant Tracking System.

## What this project is

Sothema HR Intelligence is a Streamlit application for authorized RH managers and recruiters. It provides a local CVthèque where teams can:

- import real PDF and DOCX CVs;
- extract text from ordinary and designed CVs, including columns and tables;
- analyze CV structure with the local `ResumeAnalyzer`;
- review advisory scores, confidence, evidence, and extraction warnings;
- search and filter imported dossiers;
- assign RH review statuses and validate analyses;
- keep original files, analysis results, and audit events in SQLite;
- optionally run pseudonymized external AI analysis.

This is an RH tool, not an applicant-facing resume builder. It does not automatically reject, invite, rank, or hire candidates. Every score is advisory and requires human review.

The authoritative product is the Streamlit application in this repository. The `reference/react-design/` directory is a visual/product reference only; it is not a second production frontend or data source.

## Architecture

```text
app.py
  └── Streamlit login gate and navigation
      └── sothema_views.py
          ├── utils/document_extractor.py   layout-aware PDF/DOCX extraction
          ├── sothema_quality.py            fairness, confidence, evidence
          ├── utils/resume_analyzer.py      local advisory scoring
          └── ats_store.py                  transactional SQLite persistence
              └── resume_data.db (local only, never committed)
```

Important modules:

- `app.py` — Streamlit entrypoint and active RH navigation.
- `sothema_views.py` — dashboard, CVthèque, import, dossier, settings, audit, and review workflows.
- `utils/document_extractor.py` — column/table-aware extraction, DOCX XML parsing, provenance, OCR status.
- `sothema_quality.py` — protected-attribute exclusion, confidence, document signals, pseudonymization, evidence.
- `utils/resume_analyzer.py` — existing local ATS-style advisory analyzer.
- `ats_store.py` — ATS schema, migrations, duplicate detection, audit log, exports, backups.
- `ats_api.py` — optional local Flask API using the same extraction and persistence pipeline.
- `PROJECT_DESCRIPTION.txt` — full project handoff and operational documentation.

## Local setup

Requirements:

- Python 3.12 recommended;
- Poppler (`pdftoppm`/`pdftocairo`) for PDF rendering;
- Tesseract plus English/French language data for scanned-page OCR;
- Microsoft/Google/Anthropic API keys only if optional external AI features are enabled.

Create an environment and install dependencies:

```bash
python3 -m venv .venv-final
.venv-final/bin/pip install -r requirements.txt
cp utils/.env.example utils/.env
```

Never commit `utils/.env`. Put secrets in the local environment or a deployment secret manager.

For Debian/Ubuntu OCR support:

```bash
sudo apt-get update
sudo apt-get install -y poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-fra
```

## Run the application

```bash
.venv-final/bin/python -m streamlit run app.py \
  --server.port 8501 \
  --server.address 127.0.0.1
```

Open <http://127.0.0.1:8501>.

On a fresh local database, the login page lets an authorized RH manager create the first administrator account. Passwords are stored as salted PBKDF2-SHA256 hashes. Do not put credentials in source files or GitHub.

## Run with a scratch database

Automated tests must never use production data:

```bash
SOTHEMA_DB_PATH=/tmp/sothema-test.db \
.venv-final/bin/python -m streamlit run app.py \
  --server.port 8501 \
  --server.address 127.0.0.1
```

The production `resume_data.db`, legacy databases, backups, CV corpus, exports, and uploaded files are intentionally excluded from Git.

## Optional local API

Start the shared extraction/persistence API in another terminal:

```bash
.venv-final/bin/python ats_api.py
```

Health check:

```bash
curl http://127.0.0.1:5000/api/health
```

Upload endpoint:

```text
POST /api/candidates/upload
```

The API is intended for local integration testing. Before hosting it, add service authentication, HTTPS, rate limiting, malware scanning, and queue-based processing.

## Test and compile

```bash
.venv-final/bin/python -m compileall -q \
  app.py sothema_views.py sothema_quality.py ats_api.py utils

SOTHEMA_DB_PATH=/tmp/sothema-ci.db \
.venv-final/bin/python -m pytest -q
```

The tests cover designed two-column PDFs, DOCX tables and headers/footers, source provenance, semantic CV detection, and invalid documents.

## Data protection and fairness

The application intentionally excludes these attributes from scoring, ranking, and search:

- age;
- gender;
- nationality;
- family status;
- photo-related information.

Scores are recommendations for reading assistance only. Recruiters must inspect the original CV and evidence. Original CVs and exports contain personal data and must be protected.

See:

- `PROJECT_DESCRIPTION.txt` — full architecture and operations guide;
- `SECURITY.md` — security and data-handling rules;
- `CONTRIBUTING.md` — team workflow.

## Collaboration workflow

1. Create a branch from `main`.
2. Use a focused change and add/update tests.
3. Run compile and tests with `SOTHEMA_DB_PATH`.
4. Never add CVs, databases, exports, `.env` files, credentials, or screenshots containing personal data.
5. Open a pull request with behavior changes, test results, and security/privacy impact.

The React reference in `reference/react-design/` may be updated for visual handoff, but the Streamlit/Python application and SQLite ATS store remain the implementation source of truth.
