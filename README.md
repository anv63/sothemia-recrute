# Sothema HR Intelligence

Private collaboration repository for Sothema's HR manager Applicant Tracking System.

## What this project is

Sothema HR Intelligence is a Streamlit application for authorized RH managers and recruiters. It provides a local CVthèque where teams can:

- import real PDF, DOCX, and common raster-image CVs (PNG, JPG/JPEG, TIFF, BMP, GIF, WebP);
- extract text from designed CVs and scanned images using layout-aware parsing and server-side OCR;
- analyze CV structure with the local `ResumeAnalyzer`;
- review advisory scores, confidence, evidence, and extraction warnings;
- extract source-verified candidate profile details with optional AI, for human review;
- search and filter imported dossiers;
- assign RH review statuses and validate analyses;
- keep original files, analysis results, and audit events in SQLite locally or Supabase Postgres/Storage when hosted;
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
          └── ats_store.py                  SQLite locally / Supabase Postgres + Storage when hosted
              ├── resume_data.db (local only, never committed)
              └── private `candidate-cvs` Storage bucket (hosted originals)
```

Important modules:

- `app.py` — Streamlit entrypoint and active RH navigation.
- `sothema_views.py` — dashboard, CVthèque, import, dossier, settings, audit, and review workflows.
- `utils/document_extractor.py` — PDF/DOCX/image extraction, column/table awareness, provenance, and OCR.
- `sothema_quality.py` — protected-attribute exclusion, confidence, document signals, pseudonymization, evidence.
- `utils/resume_analyzer.py` — existing local ATS-style advisory analyzer.
- `ats_store.py` — backend-neutral candidate storage, duplicate detection, audit log, exports and backups (SQLite locally; Supabase hosted).
- `config/supabase_store.py` — server-side Supabase client and private Storage operations.
- `ats_api.py` — optional Flask API for authenticated local/hosted integrations; every route requires the separate `SOTHEMA_INGEST_API_TOKEN` bearer token.
- `PROJECT_DESCRIPTION.txt` — full project handoff and operational documentation.

## Local setup

Requirements:

- Python 3.12 recommended;
- Poppler (`pdftoppm`/`pdftocairo`) for PDF rendering;
- Tesseract plus English/French language data for scanned-page OCR;
- Microsoft/Google/Anthropic API keys only if optional external AI features are enabled. Provider SDKs are listed in `requirements.txt`; no keys are required for the local analyzer or app startup.

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

## Host the proof of concept on Streamlit Community Cloud

The hosted app uses Supabase for persistent ATS data because Community Cloud's local filesystem is not a durable database. The Streamlit server uses a **server-only service-role key**; it is never sent to the browser. SQLite remains the default for local development and tests when Supabase secrets are absent.

### 1. Create and secure Supabase

1. Create a private Supabase project in an appropriate region and save the database password securely.
2. In Supabase **SQL Editor**, run the complete [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) migration. It creates the ATS schema, restricts direct table/RPC access to the server service role, and creates the private `candidate-cvs` Storage bucket.
3. Confirm Storage shows `candidate-cvs` as **private**. Do not add public read policies or expose the service-role/secret key.
4. Copy the project URL and the service-role key from Supabase API settings. Treat the latter like a database password.

### 2. Deploy the repository

1. Sign in to [Streamlit Community Cloud](https://share.streamlit.io/) and choose **Create app**.
2. Select repository `anv63/sothemia-recrute`, branch `main`, and main file path `app.py`.
3. In the app's **Settings → Secrets**, add (substitute the real values; do not commit them):

```toml
[supabase]
url = "https://<project-ref>.supabase.co"
service_role_key = "<server-only-service-role-key>"
storage_bucket = "candidate-cvs"
```

4. Save and deploy. Root `packages.txt` requests Poppler and Tesseract system tools for PDF fallback, scanned PDF OCR, and raster-image CV OCR. Supported image formats are PNG, JPG/JPEG, TIFF, BMP, GIF and WebP. If Community Cloud cannot install a package, image-only CVs will be marked as requiring manual review.
5. Open the app and confirm **Paramètres → Données** reports the Supabase Postgres + Storage backend as healthy. Then create the initial RH administrator through the setup screen. No candidate or admin demo accounts are seeded.
6. Test with synthetic CV files first: upload, exact duplicate, restart/persistence, original-file download, review/audit, and deletion. Confirm the original object disappears from the private bucket after deletion.

### Update an existing hosted project for AI profile re-extraction and image CVs

After the first deployment, apply the additive SQL migrations in order in the Supabase SQL Editor:

1. [`supabase/migrations/002_profile_reextraction.sql`](supabase/migrations/002_profile_reextraction.sql) enables audited per-dossier profile re-extraction.
2. [`supabase/migrations/003_image_cv_types.sql`](supabase/migrations/003_image_cv_types.sql) allows supported raster image types in ATS records and the still-private originals bucket.

Then deploy the updated application and API code. Confirm the hosting environment has Pillow, Tesseract, and the required language packs (`eng` and `fra`). The profile action and image uploads depend on both the code update and these migrations; no migration runs automatically from GitHub.

### Proof-of-concept limitations

- This is a PoC configuration, not a production security review. Do not upload real applicant CVs until access control, privacy notices, data-processing terms, retention/deletion, incident response, backup/restore, and RH authorization have been approved.
- Supabase free-tier projects may pause and have limited backup/storage guarantees. Review the selected plan, export and restore process, and project region before relying on it. Streamlit Community Cloud also has deployment/resource limits.
- The application stores ATS records, admin password hashes, audit events, and file originals in Supabase. Passwords remain salted PBKDF2-SHA256 hashes. Candidate+audit writes and initial admin+audit creation use atomic SQL RPCs. Admin login/logout are logged; failed login attempts appear in ATS audit. Object storage and Postgres cannot share a transaction, so failed ingestion attempts perform compensating object cleanup.
- The API stores no token in the workflow: its bearer token is configured separately in Render and an n8n credential. Keep the Supabase service-role key only on the API/Streamlit servers, never in n8n.

## Run with a scratch database

Automated tests must never use production data:

```bash
SOTHEMA_DB_PATH=/tmp/sothema-test.db \
.venv-final/bin/python -m streamlit run app.py \
  --server.port 8501 \
  --server.address 127.0.0.1
```

The production `resume_data.db`, legacy databases, backups, CV corpus, exports, and uploaded files are intentionally excluded from Git.

## Optional authenticated API

The Flask API is used by server-to-server integrations such as n8n. All API endpoints require a bearer token, including health and candidate-read endpoints. Set a long random value as `SOTHEMA_INGEST_API_TOKEN` in the API host's private environment settings; configure the same value in an n8n Header Auth credential. Do not store it in the workflow export or source control. This token is separate from Supabase credentials.

Local development (choose your own temporary token; never paste a production token into a command recorded in shell history):

```bash
export SOTHEMA_INGEST_API_TOKEN="<local-test-token>"
.venv-final/bin/python ats_api.py
```

Authenticated health check:

```bash
curl -H "Authorization: Bearer $SOTHEMA_INGEST_API_TOKEN" http://127.0.0.1:5000/api/health
```

For a hosted WSGI server, install requirements and start Gunicorn with:

```bash
gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 180 ats_api:app
```

Set `SOTHEMA_INGEST_API_TOKEN`, `SOTHEMA_SUPABASE_URL`, `SOTHEMA_SUPABASE_SERVICE_ROLE_KEY`, and `SOTHEMA_SUPABASE_STORAGE_BUCKET` as separate private environment variables on the API host. Do not expose the service-role key to n8n. The API should be deployed only behind HTTPS, with host access controls, monitoring, and an approved retention policy for workflow execution data.

When n8n sends an upload, use `POST https://<api-host>/api/candidates/upload`, multipart field `file`, and an n8n credential that sends `Authorization: Bearer <token>`. `127.0.0.1` is only valid when the API and n8n can reach each other on the same host/network; it is not the Streamlit Cloud URL.

## Test and compile

```bash
.venv-final/bin/python -m compileall -q \
  app.py sothema_views.py sothema_quality.py ats_api.py ats_store.py config utils tests

SOTHEMA_DB_PATH=/tmp/sothema-ci.db \
.venv-final/bin/python -m pytest -q
```

Tests cover designed CV extraction, Supabase adapter behavior, and API authentication/response contracts.

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

The React reference in `reference/react-design/` may be updated for visual handoff, but the Streamlit/Python application and configured ATS store remain the implementation source of truth.
