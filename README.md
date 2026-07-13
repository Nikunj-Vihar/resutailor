# ResuTailor — Zero-Cost AI Resume Editor

A privacy-first, zero-operational-cost AI Resume Editor that runs entirely client-side. It builds a local "Master Persona" from your resume details in the browser, then uses your own Gemini API key to tailor achievements to a specific Job Description and export an ATS-friendly PDF.

See [implementation_plan.md](implementation_plan.md) for the full architecture and feature roadmap.

## Project Structure

```
.
├── index.html          # Entry point / page structure for all views
├── css/
│   └── styles.css      # All styling, incl. print/@media styles for PDF export
├── js/
│   ├── app.js           # App controller: routing, state, DOM handlers
│   └── gemini.js         # Gemini REST API wrapper (tech-stack inference, tailoring)
└── implementation_plan.md
```

## Running Locally

No build step is required. Serve the folder with any static file server (needed because `app.js` is loaded as an ES module, which browsers block from `file://`):

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Deployment

Deploy as-is to GitHub Pages, Vercel, or Netlify — zero build configuration needed.

## Importing an Existing Resume

On the **My Persona** page, click **Import from Resume (PDF)** to upload a text-based PDF (or .txt file). The text is extracted in-browser via [pdf.js](https://mozilla.github.io/pdf.js/) and parsed into your structured profile by Gemini — nothing is uploaded to any server other than Google's Gemini API. Scanned/image-only PDFs are not supported (no OCR).

## Data & Privacy

- Your Gemini API key, profile data, and generated resumes are stored only in your browser's `localStorage`.
- No backend server is involved; API calls go directly from your browser to Google's Gemini API.
