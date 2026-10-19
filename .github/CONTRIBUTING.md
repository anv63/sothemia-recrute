# Contributing to Sothema HR Intelligence

The active application is the Streamlit/Python project at the repository root. The React/Tailwind files under `reference/react-design/` are a visual reference only.

## Workflow

1. Create a focused branch from `main`.
2. Make the smallest change that solves the issue.
3. Add or update tests.
4. Run compilation and tests with a scratch database:

```bash
.venv-final/bin/python -m compileall -q app.py sothema_views.py sothema_quality.py ats_api.py utils
SOTHEMA_DB_PATH=/tmp/sothema-ci.db .venv-final/bin/python -m pytest -q
```

5. Open a pull request describing behavior, tests, privacy/fairness impact, and deployment impact.

## Data and security rules

Never commit or attach:

- CVs or the `Data/` corpus;
- SQLite databases, backups, exports, logs, or screenshots containing personal data;
- `.env` files, API keys, passwords, tokens, or private keys;
- virtual environments, `node_modules`, or generated build output.

Do not run destructive tests against production `resume_data.db`; use `SOTHEMA_DB_PATH`.

## Implementation rules

- Preserve the synchronous import contract: validate → extract → analyze → persist → read back.
- Reuse `utils/document_extractor.py` and `ats_store.py` rather than creating duplicate pipelines.
- Keep age, gender, nationality, family status, and photo out of scoring, ranking, and search.
- Keep all scores advisory and require human RH review.
- Add source evidence and actionable warnings when changing extraction.
- Do not seed or fabricate candidate records.
