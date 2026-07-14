# Changelog

## v2.0.0 — Multi-resume persona building

- Importing a resume now **merges into** the persona instead of replacing it — upload two or more resumes (e.g. an older one and a newer one) and each adds its new details
- New import review screen: see exactly what was extracted before anything is saved — new entries are pre-selected, likely duplicates of existing entries are flagged and unchecked
- Duplicate detection matches on role+company (experience), degree+institution (education), and name (projects), ignoring case and punctuation
- Empty contact fields are filled from the imported resume (existing values are never overwritten); skills are merged as a de-duplicated union

## v1.0.0 — First live release

- Master Persona builder (contact, education, experience, projects, skills)
- Import an existing resume from a PDF — extracted client-side, structured by Gemini
- Job-description tailoring engine (STAR-method bullets, tone/length controls)
- Live resume preview with 3 templates and print-ready PDF export
- Free forever, with an optional UPI QR code to tip the creator
- Security: Content Security Policy, SRI-pinned CDN scripts, escaped output, header-based API key transport, per-key dynamic Gemini model resolution
