# Changelog

## v2.2.0 — Mobile fixes & guided flow

- **Fixed:** on phones/tablets (≤1024px) the sidebar footer was hidden entirely, making the API key setup and Delete All Data buttons unreachable — it now collapses into a compact row instead
- **Fixed:** the five Persona tabs overflowed off-screen on narrow displays — they now scroll horizontally
- Phone-size polish: single-column form layouts, wrapped header actions, tighter paddings
- New **"Next: Tailor Resume"** button on the Skills tab — saves your skills and takes you straight to the tailoring step

## v2.1.0 — In-place resume editing & data deletion

- **Edit Text** on the Preview page: click to edit the generated resume directly on the page (fix wordings, tweak bullets), then print/save as PDF. Edits auto-save as you type and survive navigation; "Reset to AI Version" restores the untouched generated resume. Generating a new resume replaces any manual edits.
- **Delete All My Data** in the sidebar: one click (with a detailed confirmation) permanently wipes everything ResuTailor stored in the browser — persona, generated resume and edits, Gemini API key, and all settings.

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
