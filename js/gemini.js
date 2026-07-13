/* ResuTailor - Gemini API Integration Service */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

/**
 * Checks if the API key is valid by making a simple request
 * @param {string} apiKey 
 * @returns {Promise<boolean>}
 */
export async function validateApiKey(apiKey) {
    if (!apiKey) return false;
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Hello" }]
                }]
            })
        });
        return response.ok;
    } catch (e) {
        console.error("API Key validation error:", e);
        return false;
    }
}

/**
 * Sends a prompt to the Gemini API expecting a JSON response
 * @param {string} apiKey 
 * @param {string} prompt 
 * @returns {Promise<any>}
 */
async function callGeminiJSON(apiKey, prompt) {
    if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please configure it in Settings.");
    }
    
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `HTTP error! status: ${response.status}`;
            throw new Error(errMsg);
        }

        const data = await response.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!jsonText) {
            throw new Error("Received empty response from Gemini API.");
        }
        
        return JSON.parse(jsonText.trim());
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
