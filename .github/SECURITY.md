# Security policy

Sothema HR Intelligence processes CVs, contact details, recruiter notes, analyses, and audit records. Treat all candidate data as confidential personal data.

## Never publish

Never commit or upload:

- `utils/.env`, API keys, passwords, tokens, certificates, or private keys;
- `resume_data.db`, other SQLite files, backups, exports, or local test databases;
- uploaded CVs, the `Data/` corpus, logs, or screenshots containing personal data;
- virtual environments, `node_modules`, or generated build output.

## Reporting

For this private repository, report vulnerabilities privately to the repository maintainers rather than opening a public issue. Do not include real CVs or credentials in a report; use synthetic fixtures.

If a credential is exposed, revoke or rotate it immediately, inspect history/access logs, and notify maintainers. Deleting the file later does not make the credential safe.

## Application safeguards

The application includes administrator login with salted PBKDF2-SHA256 password hashes, PDF/DOCX validation, SHA-256 duplicate detection, transactional ingestion, append-only audit events, protected-attribute exclusion, pseudonymization before optional external AI analysis, and explicit human-review states.

A hosted deployment must additionally provide HTTPS, service authentication, secure secret storage, malware scanning, encrypted backups, access control, retention policies, and monitoring.

Scores are advisory and must not be used as an automatic employment decision. Recruiters must review source CVs, evidence, extraction warnings, and job context.
