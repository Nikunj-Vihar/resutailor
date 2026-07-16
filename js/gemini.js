/* ResuTailor - Gemini API Integration Service */

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const MODEL_CACHE_KEY = "resutailor_gemini_model";

/**
 * Picks the best usable model from a key's available model list: prefers the
 * floating "-latest" flash alias (so future Google model rotations don't break
 * the app), then any stable flash model, then any model that supports
 * generateContent at all. Every API key can have a different set of models
 * available depending on account tier/region, so this is resolved per-key
 * rather than hardcoded.
 * @param {any[]} models
 * @returns {any|null}
 */
function pickBestModel(models) {
    const usable = models.filter(m => (m.supportedGenerationMethods || []).includes("generateContent"));
    const byName = (name) => usable.find(m => m.name === `models/${name}`);
    const isPreviewish = (m) => /preview|exp|tts|image|robotics|computer-use|deep-research|lyria|banana/i.test(m.name);

    return (
        byName("gemini-flash-latest") ||
        usable.find(m => /flash/i.test(m.name) && !isPreviewish(m)) ||
        usable.find(m => !isPreviewish(m)) ||
        usable[0] ||
        null
    );
}

/**
 * Resolves which model to use for a given API key by asking Gemini's
 * ListModels endpoint, caching the result so we don't re-list on every call.
 * @param {string} apiKey
 * @param {{forceRefresh?: boolean}} [options]
 * @returns {Promise<string>} bare model name, e.g. "gemini-flash-latest"
 */
async function resolveModel(apiKey, { forceRefresh = false } = {}) {
    if (!forceRefresh) {
        const cached = localStorage.getItem(MODEL_CACHE_KEY);
        if (cached) return cached;
    }

    const response = await fetch(`${GEMINI_BASE_URL}/models`, {
        headers: { "x-goog-api-key": apiKey }
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Could not list Gemini models (HTTP ${response.status}).`);
    }

    const data = await response.json();
    const best = pickBestModel(data.models || []);
    if (!best) {
        throw new Error("This API key has no models available that support content generation.");
    }

    const modelName = best.name.replace(/^models\//, "");
    localStorage.setItem(MODEL_CACHE_KEY, modelName);
    return modelName;
}

/**
 * Checks if the API key is valid by listing the models it can access.
 * Also resolves and caches which model to use for this key.
 * @param {string} apiKey
 * @returns {Promise<boolean>}
 */
export async function validateApiKey(apiKey) {
    if (!apiKey) return false;
    try {
        const modelName = await resolveModel(apiKey, { forceRefresh: true });
        return !!modelName;
    } catch (e) {
        console.error("API Key validation error:", e);
        return false;
    }
}

/**
 * Sends a prompt to the Gemini API expecting a JSON response. Automatically
 * resolves the best available model for this key, and if the cached model
 * has since been retired (404), re-resolves and retries once.
 * @param {string} apiKey
 * @param {string} prompt
 * @returns {Promise<any>}
 */
async function callGeminiJSON(apiKey, prompt) {
    if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please configure it in Settings.");
    }

    const requestBody = JSON.stringify({
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            responseMimeType: "application/json"
        }
    });

    const attempt = async (modelName) => fetch(`${GEMINI_BASE_URL}/models/${modelName}:generateContent`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },
        body: requestBody
    });

    try {
        let modelName = await resolveModel(apiKey);
        let lastError = null;

        // Model output is stochastic — a malformed/incomplete JSON reply usually
        // succeeds on a second attempt, so retry the generation once
        for (let tries = 0; tries < 2; tries++) {
            let response = await attempt(modelName);

            if (response.status === 404) {
                // Cached model was retired/renamed since we last resolved it — re-resolve and retry
                modelName = await resolveModel(apiKey, { forceRefresh: true });
                response = await attempt(modelName);
            }

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const candidate = data.candidates?.[0];

            // Newer "thinking" models can split the answer across several parts and
            // may include thought parts — join every non-thought text part
            let jsonText = (candidate?.content?.parts || [])
                .filter(p => typeof p.text === 'string' && !p.thought)
                .map(p => p.text)
                .join('')
                .trim();

            // Strip markdown code fences if the model added them despite JSON mode
            jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

            // Clamp to the outermost JSON object in case of stray surrounding text
            const firstBrace = jsonText.indexOf('{');
            const lastBrace = jsonText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                jsonText = jsonText.slice(firstBrace, lastBrace + 1);
            }

            if (!jsonText) {
                lastError = new Error("Received an empty response from the Gemini API. Please try again.");
                continue;
            }

            try {
                return JSON.parse(jsonText);
            } catch (parseErr) {
                console.error("Gemini returned unparseable JSON (attempt " + (tries + 1) + "):",
                    candidate?.finishReason, jsonText.slice(0, 400));
                lastError = candidate?.finishReason === 'MAX_TOKENS'
                    ? new Error("The AI response was cut off because it ran too long. Try again, or trim very long entries in your persona.")
                    : new Error("The AI returned an incomplete response. Please try again — this is usually temporary.");
            }
        }

        throw lastError;
    } catch (e) {
        console.error("Gemini API execution failed:", e);
        throw e;
    }
}

/**
 * Infers a structured tech stack from the user's master profile
 * @param {string} apiKey 
 * @param {any} profileData 
 * @returns {Promise<any>}
 */
export async function inferTechStack(apiKey, profileData) {
    const prompt = `
    Analyze the following user profile (experience details, project details, and education description) and identify all programming languages, libraries, frameworks, database systems, developer tools, cloud infrastructure, and technologies they have worked with or mention. 
    Group them into:
    1. 'languages': Programming languages (e.g. JavaScript, Python, C++, Go)
    2. 'frameworks': Libraries & Frameworks (e.g. React, Next.js, Node.js, Spring Boot, Flask)
    3. 'databases': Database engines and data tools (e.g. PostgreSQL, MongoDB, Redis, Kafka)
    4. 'custom': DevOps, Cloud, tools, and methodologies (e.g. Docker, AWS, Git, CI/CD, System Design)

    Output strictly a JSON object with these exact keys: 'languages', 'frameworks', 'databases', 'custom'. Value of each key must be an array of strings. Keep it concise, sorting out duplicate tags, and capitalizing properly.

    User Master Profile Data:
    ${JSON.stringify(profileData)}
    `;

    return callGeminiJSON(apiKey, prompt);
}

/**
 * Parses raw resume text (extracted from an uploaded PDF) into the structured profile schema
 * @param {string} apiKey
 * @param {string} resumeText
 * @returns {Promise<any>}
 */
export async function parseResumeText(apiKey, resumeText) {
    const prompt = `
    You are a resume parser. Below is raw text extracted from a resume PDF (formatting and line breaks may be messy or out of order).
    Extract the person's details into a structured JSON profile.

    Rules:
    1. Extract ONLY information actually present in the text. Never invent or embellish details.
    2. If a field is not found, use an empty string "" (or an empty array [] for lists).
    3. For experience and project bullet points, preserve the original achievement statements as closely as possible, one string per bullet.
    4. Periods/durations should be kept in their original format (e.g. "May 2023 - July 2023").
    5. Classify skills into languages / frameworks / databases / custom (DevOps, cloud, tools, methodologies) groups.

    Output strictly a JSON object matching this exact schema:
    {
      "contact": {
        "fullname": "Full name",
        "email": "Email address",
        "phone": "Phone number",
        "location": "City, Country",
        "linkedin": "LinkedIn URL if present",
        "github": "GitHub or portfolio URL if present"
      },
      "education": [
        { "degree": "Degree and major", "institution": "School name", "location": "City, Country", "period": "Dates attended", "gpa": "GPA/percentage if stated" }
      ],
      "experience": [
        { "role": "Job title", "company": "Company name", "location": "City, Country", "period": "Duration", "bullets": ["achievement 1", "achievement 2"] }
      ],
      "projects": [
        { "name": "Project name", "tech": "Comma-separated technologies", "period": "Duration if stated", "bullets": ["highlight 1", "highlight 2"] }
      ],
      "skills": {
        "languages": ["programming languages"],
        "frameworks": ["frameworks & libraries"],
        "databases": ["databases & data tools"],
        "custom": ["other tools, cloud, methodologies"]
      }
    }

    Raw resume text:
    ---
    ${resumeText}
    ---
    `;

    return callGeminiJSON(apiKey, prompt);
}

/**
 * Tailors the user's master profile to match a job description
 * @param {string} apiKey 
 * @param {any} profileData 
 * @param {string} jobTitle 
 * @param {string} companyName 
 * @param {string} jobDescription 
 * @param {string} tone 
 * @param {string} targetPageLength 
 * @returns {Promise<any>}
 */
export async function tailorResume(apiKey, profileData, jobTitle, companyName, jobDescription, tone, targetPageLength) {
    const prompt = `
    You are an expert resume writer specializing in ATS (Applicant Tracking System) optimization. Your goal is to tailor the user's master resume profile to match a target job description.

    Target Job: ${jobTitle} at ${companyName}
    Target Job Description:
    ---
    ${jobDescription}
    ---

    AI Tone Preference: ${tone} (use this tone to phrase the bullets and summary).
    - 'balanced': Professional, standard resume style, using clear action verbs.
    - 'technical': Highlight details, compiler flags, API designs, algorithmic complexity, architectures, and engineering metrics.
    - 'action': Emphasize impact, leadership, metric outcomes, scaling metrics, and active project ownership.

    Target Page Length: ${targetPageLength}.
    - '1': Be extremely concise. Keep description lines short. Restrict work experiences and projects to 3 bullet points maximum. Focus on the highest-impact details.
    - '2' or 'any': Keep 4-5 high-quality bullets per role if relevant, providing detail.

    Rules for tailoring:
    1. Identify key technologies, frameworks, and skills highlighted in the Job Description, and cross-reference them with the user's profile. Emphasize matching skills in the 'skills' section and rewritten bullets.
    2. Rewrite work experience and project bullet points using the STAR method (Situation, Task, Action, Result). Format each bullet as an active achievement. Quantify accomplishments realistically (e.g. "reduced latency by 15%", "improved dev productivity by 20%", "scaled throughput to 50k requests/min") if the user worked on scaling or optimizations.
    3. Make sure to integrate keywords and phrasing from the Job Description naturally.
    4. CRITICAL: DO NOT invent fake job titles, companies, degree names, or new work experiences. Tailor ONLY the details already provided in the Master Profile, but rephrase, re-order, and optimize them for alignment.
    5. In the resume 'summary', write a highly engaging 3-sentence summary highlighting their matching experience, tech skills, and interest/suitability for the target role.

    Output as a JSON object matching this schema exactly:
    {
      "summary": "Tailored professional summary text (3 sentences)",
      "skills": {
        "languages": ["array of tailored languages"],
        "frameworks": ["array of tailored frameworks"],
        "databases": ["array of tailored databases"],
        "custom": ["array of other tailored tools/skills"]
      },
      "experience": [
        {
          "role": "Job role title (same as input, do not invent)",
          "company": "Company Name",
          "location": "City, Country",
          "period": "Duration (e.g., June 2023 - Present)",
          "bullets": [
            "Tailored STAR bullet point 1",
            "Tailored STAR bullet point 2"
          ]
        }
      ],
      "projects": [
        {
          "name": "Project Name",
          "period": "Duration or Date",
          "tech": "Comma-separated tech list of skills used in project",
          "bullets": [
            "Tailored project achievement bullet point 1",
            "Tailored project achievement bullet point 2"
          ]
        }
      ],
      "education": [
        {
          "degree": "Degree and Major",
          "institution": "School/University Name",
          "location": "City, Country",
          "period": "Dates attended",
          "gpa": "GPA / Percentage (if specified in master profile)"
        }
      ]
    }

    Here is the User Master Profile:
    ${JSON.stringify(profileData)}
    `;

    return callGeminiJSON(apiKey, prompt);
}
