# Changelog

## v3.2.1 — Remove redundant Dashboard tech-stack button

- Removed "Re-analyze Tech Stack" from the Dashboard — it only ever jumped to the Skills tab and clicked that tab's "Infer Tech Stack using AI" button, so it was a duplicate entry point rather than a separate feature. Use the Skills tab button directly.

## v3.2.0 — Themes, in-app notifications & refined look

- **Dark/light mode**: toggle at the top right (sun/moon), preference remembered; full light theme with all surfaces/text re-tokenized
- **In-app notifications**: every browser alert/confirm popup replaced — slide-in toasts (success/error/info) for notices and a styled confirmation dialog (with red destructive actions) for delete/reset flows
- **Refined look**: loud gradients replaced with solid primary/tertiary buttons and calmer hovers for an industry-standard feel
- **Mobile API key setup** moved out of the cramped app bar into Quick Start step 1 on the Dashboard — a clear "Set Up API Key Now" button that turns into a green "API Key Configured" state once done (desktop sidebar button unchanged)

## v3.1.0 — Mobile header & polish

- **Top app bar reworked**: fixed 56px height with brand on the left and a right-aligned compact API pill + round delete icon — no more oversized, unevenly spread buttons pushing each other
- API setup button on phones is now a small rounded pill ("API Key") — the pulsing accent color carries the "do this first" signal; the bulky STEP 1 badge and arrow only show on desktop
- Bottom tab bar: active tab gets a soft highlight pill; taller touch targets
- Action buttons (Import, Save, Print, etc.) split the row evenly full-width on phones instead of ragged clusters
- Modals now slide up as iOS-style bottom sheets with safe-area padding

## v3.0.1 — Fix "Error analyzing: … JSON" on AI responses

- Fixed AI features failing with a JSON parse error: newer Gemini "thinking" models can split their answer across multiple response parts (and include thought parts) — the app now joins all non-thought parts instead of reading only the first
- Hardened response handling: strips stray markdown fences, clamps to the outermost JSON object, automatically retries once on a malformed reply, and shows a clear message (including when the response was cut off for length)

## v3.0.0 — Professional redesign & mobile-native experience

- **New color system**: replaced the multi-color purple/pink/teal mix with a professional three-tier palette — primary (indigo) for all interactive elements, secondary (light indigo) for gradients/highlights, tertiary (sky) for informational accents
- **Mobile rework**: iOS-style fixed bottom tab bar with icons and short labels, compact top header with brand + API key + delete, 16px inputs (no more iOS auto-zoom), safe-area support; fixed the API key button text collapsing into a vertical letter-stack
- **Loading overlays**: full-screen progress screens with staged status text during resume parsing and tech-stack inference — no more wondering if it's stuck
- **Phone field**: separate country-code box (defaults to +91) + number field; numbers stored space-free and normalized on both manual entry and resume import
- **URL fields**: no more cryptic "Enter a URL" browser errors — bare links like linkedin.com/in/you are accepted and auto-prefixed with https://
- **Import review**: contact note renamed to "Fields retrieved"; fixed Safari not pre-selecting new entries (checkbox state now set via DOM property)
- **Clearer outcomes**: tech-stack inference popup now reports exactly what was found (languages/frameworks/databases/other counts)
- **Guidance**: API key guide now links straight to aistudio.google.com/apikey with layout-agnostic wording; "Next: Tailor Resume" is now a colored primary action

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
