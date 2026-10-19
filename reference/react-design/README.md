# React visual reference (not production)

This directory preserves the React/Tailwind Sothema HR Intelligence prototype as a design and interaction reference for the Streamlit application.

- The authoritative application is the Streamlit/Python application at the repository root.
- Candidate data must come from the Python backend/SQLite; this reference does not seed or fabricate candidate records.
- Do not run this as an alternate production ATS or persist candidate data in browser storage.
- The design handoff is in `docs/HANDOFF.md`.
- Dependencies and a build check are kept here so the UI reference can be previewed and verified.

```bash
npm ci
npm run dev
```

The reference is not connected to production data and should never contain real CVs or candidate information.
