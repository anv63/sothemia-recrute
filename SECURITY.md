# Security policy

## Scope

Sothema HR Intelligence processes CVs, contact details, recruiter notes, analysis results, and audit records. Treat all candidate data as confidential personal data.

## Never commit

Do not commit or upload:

- `utils/.env` or any API key;
- passwords, access tokens, private keys, or certificates;
- `resume_data.db`, `resume_analysis.db`, `feedback/feedback.db`, or any SQLite backup;
- uploaded CVs, the `Data/` corpus, exports, logs, screenshots with candidate data, or local test databases;
- virtual environments, compiled files, or local secrets.

The repository ignore rules are defense in depth, not a substitute for checking staged files.

## Reporting a vulnerability

For a private repository, report security issues privately to the repository maintainers rather than opening a public issue. Include:

- affected component and version/commit;
- reproduction steps;
- impact and data exposure risk;
- suggested mitigation, if known.

Do not include real CVs or credentials in a report. Use synthetic fixtures.

## Credential exposure

If a credential is accidentally exposed:

1. revoke or rotate it immediately;
2. remove it from the active configuration;
3. inspect Git history and access logs;
4. notify repository maintainers;
5. treat the credential as compromised even if the file is later deleted.

## Application safeguards

The application currently provides:

- administrator login with salted PBKDF2-SHA256 password hashes;
- PDF/DOCX validation and upload-size limits;
- SHA-256 exact duplicate detection;
- transactional ATS ingestion (SQLite locally or Postgres RPC + compensating Storage cleanup when hosted);
- token-authenticated ATS API routes (configured server-side with `SOTHEMA_INGEST_API_TOKEN`);
- append-only audit events;
- protected-attribute exclusion from scoring, ranking, and search;
- pseudonymization before optional external AI analysis;
- human review and validation states.

These safeguards do not replace production controls. A hosted deployment must add HTTPS, service authentication, secure secret storage, access control, malware scanning, encrypted backups, retention rules, and monitoring.

## Responsible use

Scores are advisory and must not be used as an automatic employment decision. Recruiters must review the source CV, evidence, extraction warnings, and relevant job context.
