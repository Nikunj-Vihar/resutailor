/* ResuTailor - Main Application Logic */
import { validateApiKey, inferTechStack, tailorResume, parseResumeText } from './gemini.js';

// Application State
let state = {
    apiKey: localStorage.getItem('resutailor_api_key') || '',
    profile: JSON.parse(localStorage.getItem('resutailor_profile')) || {
        contact: { fullname: '', email: '', phone: '', location: '', linkedin: '', github: '' },
        education: [],
        experience: [],
        projects: [],
        skills: { languages: '', frameworks: '', databases: '', custom: '' }
    },
    tailoredResume: JSON.parse(localStorage.getItem('resutailor_tailored')) || null
};

// Escapes a value for safe interpolation into innerHTML templates
// (element text and double-quoted attribute values)
function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// State Managers / Save Helpers
function saveProfileToLocalStorage() {
    localStorage.setItem('resutailor_profile', JSON.stringify(state.profile));
    updateDashboardStats();
}

function saveApiKey(key) {
    state.apiKey = key;
    localStorage.setItem('resutailor_api_key', key);
    updateApiStatusUI();
}

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    // Nav Routing
    initNavigation();
    
    // API Modal Handlers
    initApiSettingsHandlers();
    
    // Persona Forms & Tab Handlers
    initPersonaHandlers();
    
    // Tailor Operations
    initTailorHandlers();
    
    // Preview Screen Settings
    initPreviewHandlers();
    
    // Support banner (free tool, optional gratitude tip)
    initSupportBanner();
    renderSupportQR();

    // Clean up license data from the old subscription model
    localStorage.removeItem('resutailor_license_key');

    // Initial UI Syncs
    updateApiStatusUI();
    updateDashboardStats();
    renderAllPersonaLists();
    populateFormsFromState();
    
    if (state.tailoredResume) {
        renderResumePreview();
    }
    
    // Trigger Lucide icons replacement
    if (window.lucide) {
        window.lucide.createIcons();
    }
});

// 1. NAVIGATION & VIEW ROUTING
function initNavigation() {
    const navButtons = document.querySelectorAll('.sidebar-nav .nav-btn, #btn-api-settings');
    const viewPanels = document.querySelectorAll('.view-panel');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.getAttribute('data-target');
            if (!targetId) return; // Wait if it doesn't navigate directly (like API button which opens modal)
            
            // Toggle active button
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Toggle active view panel
            viewPanels.forEach(panel => panel.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            
            // Run special rendering hooks if entering specific panels
            if (targetId === 'dashboard-view') {
                updateDashboardStats();
            } else if (targetId === 'preview-view' && state.tailoredResume) {
                renderResumePreview();
            }
        });
    });

    // Get Started button on dashboard
    document.getElementById('btn-dashboard-start').addEventListener('click', () => {
        const nextButton = document.querySelector('.sidebar-nav .nav-btn[data-target="persona-view"]');
        if (nextButton) nextButton.click();
    });
}

// 2. API KEY HANDLERS & MODAL MANAGEMENT
function initApiSettingsHandlers() {
    const apiBtn = document.getElementById('btn-api-settings');
    const apiModal = document.getElementById('modal-api-settings');
    const closeBtn = document.getElementById('btn-close-api-modal');
    const saveBtn = document.getElementById('btn-save-api-key');
    const apiKeyInput = document.getElementById('input-api-key');

    // Open modal
    apiBtn.addEventListener('click', () => {
        apiKeyInput.value = state.apiKey;
        apiModal.classList.add('active');
    });

    // Close modal
    closeBtn.addEventListener('click', () => apiModal.classList.remove('active'));
    apiModal.addEventListener('click', (e) => {
        if (e.target === apiModal) apiModal.classList.remove('active');
    });

    // Save key
    saveBtn.addEventListener('click', async () => {
        const inputKey = apiKeyInput.value.trim();
        saveBtn.disabled = true;
        saveBtn.textContent = "Verifying...";
        
        if (!inputKey) {
            saveApiKey('');
            alert('API key cleared.');
            saveBtn.disabled = false;
            saveBtn.textContent = "Save API Key";
            apiModal.classList.remove('active');
            return;
        }

        const isValid = await validateApiKey(inputKey);
        saveBtn.disabled = false;
        saveBtn.textContent = "Save API Key";

        if (isValid) {
            saveApiKey(inputKey);
            apiModal.classList.remove('active');
            alert('Gemini API key verified and saved successfully!');
        } else {
            alert('Invalid API key. Please check your key and try again.');
        }
    });
}

function updateApiStatusUI() {
    const statusBtn = document.getElementById('btn-api-settings');
    const statusDot = statusBtn.querySelector('.status-dot');
    const statusText = statusBtn.querySelector('.status-text');
    
    if (state.apiKey) {
        statusBtn.classList.remove('keys-missing');
        statusBtn.classList.add('keys-configured');
        statusText.textContent = "Gemini Key Configured";
    } else {
        statusBtn.classList.remove('keys-configured');
        statusBtn.classList.add('keys-missing');
        statusText.textContent = "Set Up Your Free API Key";
    }
}

// 3. MASTER PERSONA STATE & FORMS
function initPersonaHandlers() {
    // 3.1 Profile tab switching
    const tabButtons = document.querySelectorAll('.tab-container .tab-btn');
    const tabPanels = document.querySelectorAll('.tab-container .tab-panel');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const targetTab = btn.getAttribute('data-tab');
            tabPanels.forEach(panel => {
                if (panel.id === targetTab) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });
        });
    });

    // 3.2 Contact Form Submit
    const contactForm = document.getElementById('form-contact');
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        state.profile.contact = {
            fullname: document.getElementById('contact-fullname').value.trim(),
            email: document.getElementById('contact-email').value.trim(),
            phone: document.getElementById('contact-phone').value.trim(),
            location: document.getElementById('contact-location').value.trim(),
            linkedin: document.getElementById('contact-linkedin').value.trim(),
            github: document.getElementById('contact-github').value.trim()
        };
        saveProfileToLocalStorage();
        alert('Contact information saved successfully!');
    });

    // 3.3 Skills Form Submit
    const skillsForm = document.getElementById('form-skills');
    skillsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        state.profile.skills = {
            languages: document.getElementById('skills-languages').value.trim(),
            frameworks: document.getElementById('skills-frameworks').value.trim(),
            databases: document.getElementById('skills-databases').value.trim(),
            custom: document.getElementById('skills-custom').value.trim()
        };
        saveProfileToLocalStorage();
        alert('Skills list updated!');
    });

    // 3.4 Infer Skills using Gemini Button
    const inferBtn = document.getElementById('btn-trigger-ai-tech');
    inferBtn.addEventListener('click', async () => {
        if (!state.apiKey) {
            alert("Please configure a Gemini API key first before using AI functions.");
            document.getElementById('btn-api-settings').click();
            return;
        }

        inferBtn.disabled = true;
        const origText = inferBtn.innerHTML;
        inferBtn.innerHTML = `<i data-lucide="loader" class="spin"></i> <span>Analyzing Persona...</span>`;
        if (window.lucide) window.lucide.createIcons();

        try {
            const result = await inferTechStack(state.apiKey, {
                experience: state.profile.experience,
                projects: state.profile.projects,
                education: state.profile.education
            });

            if (result) {
                document.getElementById('skills-languages').value = result.languages?.join(', ') || '';
                document.getElementById('skills-frameworks').value = result.frameworks?.join(', ') || '';
                document.getElementById('skills-databases').value = result.databases?.join(', ') || '';
                document.getElementById('skills-custom').value = result.custom?.join(', ') || '';
                
                // Trigger save
                state.profile.skills = {
                    languages: result.languages?.join(', ') || '',
                    frameworks: result.frameworks?.join(', ') || '',
                    databases: result.databases?.join(', ') || '',
                    custom: result.custom?.join(', ') || ''
                };
                saveProfileToLocalStorage();
                alert("AI successfully inferred your tech stack from experiences and projects!");
            }
        } catch (err) {
            alert(`Error analyzing: ${err.message}`);
        } finally {
            inferBtn.disabled = false;
            inferBtn.innerHTML = origText;
            if (window.lucide) window.lucide.createIcons();
        }
    });

    // Re-analyze on Dashboard
    const dashboardReanalyzeBtn = document.getElementById('btn-analyze-tech');
    dashboardReanalyzeBtn.addEventListener('click', () => {
        document.querySelector('.tab-btn[data-tab="skills-tab"]').click();
        document.querySelector('.sidebar-nav .nav-btn[data-target="persona-view"]').click();
        setTimeout(() => inferBtn.click(), 300);
    });

    // 3.5 Import from Resume PDF (client-side text extraction + AI parsing)
    const pdfImportBtn = document.getElementById('btn-import-resume-pdf');
    const pdfInput = document.getElementById('resume-pdf-input');

    pdfImportBtn.addEventListener('click', () => {
        if (!state.apiKey) {
            alert('Importing from a PDF uses AI parsing. Please configure your Gemini API key first.');
            document.getElementById('btn-api-settings').click();
            return;
        }
        pdfInput.click();
    });

    pdfInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = ''; // allow re-selecting the same file later
        if (!file) return;

        pdfImportBtn.disabled = true;
        const origHTML = pdfImportBtn.innerHTML;
        pdfImportBtn.innerHTML = `<i data-lucide="loader" class="spin"></i> <span>Extracting & Parsing...</span>`;
        if (window.lucide) window.lucide.createIcons();

        try {
            let rawText;
            if (file.name.toLowerCase().endsWith('.pdf')) {
                rawText = await extractPdfText(file);
            } else {
                rawText = await file.text();
            }

            if (!rawText || rawText.trim().length < 50) {
                throw new Error('Could not extract readable text. If your PDF is a scanned image, export a text-based PDF instead or fill in the forms manually.');
            }

            const parsed = await parseResumeText(state.apiKey, rawText);
            // Merge, don't replace: show the review screen so the user confirms
            // what gets added to the persona (supports importing several resumes)
            showImportReviewModal(computeImportPlan(parsed));
        } catch (err) {
            alert(`Resume import failed: ${err.message}`);
        } finally {
            pdfImportBtn.disabled = false;
            pdfImportBtn.innerHTML = origHTML;
            if (window.lucide) window.lucide.createIcons();
        }
    });

    // Import review modal close handlers
    const reviewModal = document.getElementById('modal-import-review');
    document.getElementById('btn-close-review-modal').addEventListener('click', () => reviewModal.classList.remove('active'));
    reviewModal.addEventListener('click', (e) => {
        if (e.target === reviewModal) reviewModal.classList.remove('active');
    });

    // 3.6 CRUD Actions for List Sections (Education, Experience, Projects)
    document.getElementById('btn-add-education').addEventListener('click', () => openItemEditor('education', null));
    document.getElementById('btn-add-experience').addEventListener('click', () => openItemEditor('experience', null));
    document.getElementById('btn-add-project').addEventListener('click', () => openItemEditor('projects', null));
}

// Extracts selectable text from a PDF file entirely in-browser using pdf.js
async function extractPdfText(file) {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
        throw new Error('PDF library not loaded yet. Check your internet connection and try again.');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    return fullText;
}

// --- Resume import merging (v2) ---
// Each imported resume ADDS to the persona instead of replacing it, so users
// can upload several resumes (old and new) and accumulate all their details.

// Loose key for duplicate detection: case/punctuation-insensitive
const normKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Maps one AI-parsed entry onto the internal profile shape
// (bullets stored as newline-joined strings)
function normalizeParsedEntry(section, item) {
    const joinBullets = (bullets) => Array.isArray(bullets) ? bullets.join('\n') : (bullets || '');
    if (section === 'education') {
        return {
            degree: item.degree || '',
            institution: item.institution || '',
            location: item.location || '',
            period: item.period || '',
            gpa: item.gpa || ''
        };
    }
    if (section === 'experience') {
        return {
            role: item.role || '',
            company: item.company || '',
            location: item.location || '',
            period: item.period || '',
            bullets: joinBullets(item.bullets)
        };
    }
    return {
        name: item.name || '',
        tech: item.tech || '',
        period: item.period || '',
        bullets: joinBullets(item.bullets)
    };
}

function importItemTitle(section, entry) {
    if (section === 'education') return [entry.degree, entry.institution].filter(Boolean).join(' — ');
    if (section === 'experience') return [entry.role, entry.company].filter(Boolean).join(' — ');
    return entry.name;
}

// Compares a parsed resume against the current persona and builds a merge
// plan: which entries are new, which look like duplicates of existing ones,
// which empty contact fields can be filled, and which skills are new.
function computeImportPlan(parsed) {
    const plan = { contactUpdates: {}, skillsAdded: {}, items: [] };

    ['fullname', 'email', 'phone', 'location', 'linkedin', 'github'].forEach(field => {
        const incoming = String(parsed.contact?.[field] || '').trim();
        if (incoming && !String(state.profile.contact[field] || '').trim()) {
            plan.contactUpdates[field] = incoming;
        }
    });

    ['languages', 'frameworks', 'databases', 'custom'].forEach(group => {
        const existingKeys = new Set(
            String(state.profile.skills[group] || '').split(',').map(s => normKey(s)).filter(Boolean)
        );
        const added = [];
        (Array.isArray(parsed.skills?.[group]) ? parsed.skills[group] : [])
            .map(s => String(s).trim()).filter(Boolean)
            .forEach(skill => {
                if (!existingKeys.has(normKey(skill))) {
                    existingKeys.add(normKey(skill));
                    added.push(skill);
                }
            });
        if (added.length) plan.skillsAdded[group] = added;
    });

    const findDuplicate = {
        education: (entry) => state.profile.education.find(e =>
            normKey(e.degree) === normKey(entry.degree) && normKey(e.institution) === normKey(entry.institution)),
        experience: (entry) => state.profile.experience.find(e =>
            normKey(e.role) === normKey(entry.role) && normKey(e.company) === normKey(entry.company)),
        projects: (entry) => state.profile.projects.find(e => normKey(e.name) === normKey(entry.name))
    };

    ['education', 'experience', 'projects'].forEach(section => {
        (parsed[section] || []).forEach(raw => {
            const entry = normalizeParsedEntry(section, raw);
            if (!normKey(importItemTitle(section, entry))) return; // skip empty extractions
            const dup = findDuplicate[section](entry);
            plan.items.push({
                section,
                entry,
                isDuplicate: !!dup,
                dupLabel: dup ? importItemTitle(section, dup) : ''
            });
        });
    });

    return plan;
}

// Renders the merge plan into the review modal so the user confirms exactly
// what gets added before the persona is touched.
function showImportReviewModal(plan) {
    const modal = document.getElementById('modal-import-review');
    const body = document.getElementById('import-review-body');
    const applyBtn = document.getElementById('btn-apply-import');

    const contactFields = Object.keys(plan.contactUpdates);
    const skillGroups = Object.entries(plan.skillsAdded);
    const hasAnything = plan.items.length > 0 || contactFields.length > 0 || skillGroups.length > 0;

    let html = '';
    if (!hasAnything) {
        html = `<p class="review-empty">Nothing new found — everything in this resume already exists in your Persona.</p>`;
    } else {
        html += `<p class="modal-intro">Here's what this resume adds to your Persona. New entries are pre-selected; entries that look like duplicates of what you already have are unchecked — tick them only if they're genuinely different.</p>`;

        if (contactFields.length) {
            html += `<div class="review-auto-note"><strong>Empty contact fields to fill:</strong> ${contactFields.map(f => esc(`${f}: ${plan.contactUpdates[f]}`)).join(' · ')}</div>`;
        }
        if (skillGroups.length) {
            const allSkills = skillGroups.flatMap(([, list]) => list);
            html += `<div class="review-auto-note"><strong>New skills to add (${allSkills.length}):</strong> ${esc(allSkills.join(', '))}</div>`;
        }

        const sectionLabels = { experience: 'Work Experience', projects: 'Projects', education: 'Education' };
        ['experience', 'projects', 'education'].forEach(section => {
            const indexed = plan.items.map((item, idx) => ({ item, idx })).filter(x => x.item.section === section);
            if (!indexed.length) return;
            html += `<div class="review-section-title">${sectionLabels[section]}</div>`;
            indexed.forEach(({ item, idx }) => {
                const meta = item.isDuplicate
                    ? `Looks like your existing entry: ${item.dupLabel}`
                    : (item.entry.period || '');
                html += `
                    <label class="review-item ${item.isDuplicate ? 'is-dup' : ''}">
                        <input type="checkbox" data-item-index="${idx}" ${item.isDuplicate ? '' : 'checked'}>
                        <div class="review-item-content">
                            <div class="review-item-title">
                                <span>${esc(importItemTitle(section, item.entry))}</span>
                                <span class="review-badge ${item.isDuplicate ? 'badge-dup' : 'badge-new'}">${item.isDuplicate ? 'Possible duplicate' : 'New'}</span>
                            </div>
                            ${meta ? `<div class="review-item-meta">${esc(meta)}</div>` : ''}
                        </div>
                    </label>`;
            });
        });
    }

    body.innerHTML = html;
    applyBtn.style.display = hasAnything ? '' : 'none';
    modal.classList.add('active');

    applyBtn.onclick = () => {
        let addedCount = 0;
        body.querySelectorAll('input[type="checkbox"][data-item-index]').forEach(cb => {
            if (!cb.checked) return;
            const item = plan.items[Number(cb.dataset.itemIndex)];
            state.profile[item.section].push(item.entry);
            addedCount++;
        });

        Object.entries(plan.contactUpdates).forEach(([field, value]) => {
            state.profile.contact[field] = value;
        });

        skillGroups.forEach(([group, skills]) => {
            const current = String(state.profile.skills[group] || '').trim();
            state.profile.skills[group] = current ? `${current}, ${skills.join(', ')}` : skills.join(', ');
        });

        saveProfileToLocalStorage();
        populateFormsFromState();
        renderAllPersonaLists();
        modal.classList.remove('active');

        const extras = [];
        if (contactFields.length) extras.push(`${contactFields.length} contact field${contactFields.length === 1 ? '' : 's'} filled`);
        if (skillGroups.length) extras.push('new skills merged');
        alert(`Import complete! Added ${addedCount} entr${addedCount === 1 ? 'y' : 'ies'}${extras.length ? ` (${extras.join(', ')})` : ''}. Review the Persona tabs to fine-tune.`);
    };
}

function populateFormsFromState() {
    // Contact
    document.getElementById('contact-fullname').value = state.profile.contact.fullname || '';
    document.getElementById('contact-email').value = state.profile.contact.email || '';
    document.getElementById('contact-phone').value = state.profile.contact.phone || '';
    document.getElementById('contact-location').value = state.profile.contact.location || '';
    document.getElementById('contact-linkedin').value = state.profile.contact.linkedin || '';
    document.getElementById('contact-github').value = state.profile.contact.github || '';

    // Skills
    document.getElementById('skills-languages').value = state.profile.skills.languages || '';
    document.getElementById('skills-frameworks').value = state.profile.skills.frameworks || '';
    document.getElementById('skills-databases').value = state.profile.skills.databases || '';
    document.getElementById('skills-custom').value = state.profile.skills.custom || '';
}

// Renders list managers
function renderAllPersonaLists() {
    renderPersonaList('education', 'education-list');
    renderPersonaList('experience', 'experience-list');
    renderPersonaList('projects', 'projects-list');
}

function renderPersonaList(section, elementId) {
    const listContainer = document.getElementById(elementId);
    listContainer.innerHTML = '';
    const items = state.profile[section] || [];

    if (items.length === 0) {
        listContainer.innerHTML = `<p class="placeholder-tag">No entries yet. Click "Add" below to add details.</p>`;
        return;
    }

    items.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'manager-item';
        
        let titleText = '';
        let subtitleText = '';
        let descText = '';

        if (section === 'education') {
            titleText = item.degree;
            subtitleText = `${item.institution} | ${item.location} (${item.period})`;
            descText = item.gpa ? `GPA/Percentage: ${item.gpa}` : '';
        } else if (section === 'experience') {
            titleText = item.role;
            subtitleText = `${item.company} | ${item.location} (${item.period})`;
            descText = item.bullets ? item.bullets.split('\n').map(b => '• ' + b).join('\n') : '';
        } else if (section === 'projects') {
            titleText = item.name;
            subtitleText = `${item.tech ? 'Tech: ' + item.tech : ''} (${item.period})`;
            descText = item.bullets ? item.bullets.split('\n').map(b => '• ' + b).join('\n') : '';
        }

        itemEl.innerHTML = `
            <div class="item-content">
                <h4>${esc(titleText)}</h4>
                <div class="item-meta">${esc(subtitleText)}</div>
                <p style="font-size: 0.85rem; color: var(--text-secondary); white-space: pre-line;">${esc(descText)}</p>
            </div>
            <div class="item-actions">
                <button class="btn-icon-only btn-edit" data-section="${section}" data-index="${index}"><i data-lucide="edit-2" style="width: 14px; height: 14px;"></i></button>
                <button class="btn-icon-only btn-delete" data-section="${section}" data-index="${index}"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
            </div>
        `;

        // Register edit/delete actions
        itemEl.querySelector('.btn-edit').addEventListener('click', () => openItemEditor(section, index));
        itemEl.querySelector('.btn-delete').addEventListener('click', () => deleteItem(section, index));

        listContainer.appendChild(itemEl);
    });

    if (window.lucide) window.lucide.createIcons();
}

function deleteItem(section, index) {
    if (confirm("Are you sure you want to delete this entry?")) {
        state.profile[section].splice(index, 1);
        saveProfileToLocalStorage();
        renderAllPersonaLists();
    }
}

// Item Editor Modal CRUD popup
let activeEditorIndex = null;
let activeEditorSection = null;

function openItemEditor(section, index) {
    activeEditorSection = section;
    activeEditorIndex = index;

    const modal = document.getElementById('modal-item-editor');
    const titleEl = document.getElementById('item-editor-title');
    const bodyEl = document.getElementById('item-editor-body');

    titleEl.textContent = `${index !== null ? 'Edit' : 'Add'} ${section.charAt(0).toUpperCase() + section.slice(1, -1)}`;
    bodyEl.innerHTML = '';

    const data = index !== null ? state.profile[section][index] : {};

    // Render corresponding input elements
    let html = `<div class="modal-grid-form">`;
    if (section === 'education') {
        html += `
            <div class="form-group">
                <label for="edit-edu-degree">Degree / Major</label>
                <input type="text" id="edit-edu-degree" value="${esc(data.degree)}" placeholder="e.g. B.Tech in Computer Science" required>
            </div>
            <div class="form-group">
                <label for="edit-edu-institution">Institution / School</label>
                <input type="text" id="edit-edu-institution" value="${esc(data.institution)}" placeholder="e.g. BITS Pilani" required>
            </div>
            <div class="form-group">
                <label for="edit-edu-location">Location (City, Country)</label>
                <input type="text" id="edit-edu-location" value="${esc(data.location)}" placeholder="e.g. Hyderabad, India">
            </div>
            <div class="form-group">
                <label for="edit-edu-period">Attending Period</label>
                <input type="text" id="edit-edu-period" value="${esc(data.period)}" placeholder="e.g. 2021 - 2025" required>
            </div>
            <div class="form-group">
                <label for="edit-edu-gpa">GPA or Marks Details</label>
                <input type="text" id="edit-edu-gpa" value="${esc(data.gpa)}" placeholder="e.g. 9.1 CGPA, 92%">
            </div>
        `;
    } else if (section === 'experience') {
        html += `
            <div class="form-group">
                <label for="edit-exp-role">Job Title / Role</label>
                <input type="text" id="edit-exp-role" value="${esc(data.role)}" placeholder="e.g. Software Development Intern" required>
            </div>
            <div class="form-group">
                <label for="edit-exp-company">Company Name</label>
                <input type="text" id="edit-exp-company" value="${esc(data.company)}" placeholder="e.g. Microsoft" required>
            </div>
            <div class="form-group">
                <label for="edit-exp-location">Location (City, Country)</label>
                <input type="text" id="edit-exp-location" value="${esc(data.location)}" placeholder="e.g. Bengaluru, India">
            </div>
            <div class="form-group">
                <label for="edit-exp-period">Working Period</label>
                <input type="text" id="edit-exp-period" value="${esc(data.period)}" placeholder="e.g. May 2023 - July 2023" required>
            </div>
            <div class="form-group">
                <label for="edit-exp-bullets">Achievements / Bullet points (one per line)</label>
                <textarea id="edit-exp-bullets" rows="6" placeholder="Built a responsive dashboard using React, speeding up data load by 20%&#10;Collaborated with 3 engineers to debug routing issues" required>${esc(data.bullets)}</textarea>
            </div>
        `;
    } else if (section === 'projects') {
        html += `
            <div class="form-group">
                <label for="edit-proj-name">Project Name</label>
                <input type="text" id="edit-proj-name" value="${esc(data.name)}" placeholder="e.g. Distributed Key-Value Store" required>
            </div>
            <div class="form-group">
                <label for="edit-proj-tech">Technologies Used (Comma-separated)</label>
                <input type="text" id="edit-proj-tech" value="${esc(data.tech)}" placeholder="e.g. Go, gRPC, Docker, Kubernetes">
            </div>
            <div class="form-group">
                <label for="edit-proj-period">Project Duration / Month</label>
                <input type="text" id="edit-proj-period" value="${esc(data.period)}" placeholder="e.g. Jan 2024 - Feb 2024">
            </div>
            <div class="form-group">
                <label for="edit-proj-bullets">Project Highlights (one per line)</label>
                <textarea id="edit-proj-bullets" rows="6" placeholder="Implemented Raft consensus algorithm for zero-data-loss consistency&#10;Designed key range replication partitioning" required>${esc(data.bullets)}</textarea>
            </div>
        `;
    }
    html += `</div>`;
    bodyEl.innerHTML = html;

    // Show modal
    modal.classList.add('active');

    // Register Save and Close
    const saveItemBtn = document.getElementById('btn-save-item-entry');
    const closeItemBtn = document.getElementById('btn-close-editor-modal');

    const handleSave = () => {
        let entry = {};
        if (section === 'education') {
            entry = {
                degree: document.getElementById('edit-edu-degree').value.trim(),
                institution: document.getElementById('edit-edu-institution').value.trim(),
                location: document.getElementById('edit-edu-location').value.trim(),
                period: document.getElementById('edit-edu-period').value.trim(),
                gpa: document.getElementById('edit-edu-gpa').value.trim()
            };
        } else if (section === 'experience') {
            entry = {
                role: document.getElementById('edit-exp-role').value.trim(),
                company: document.getElementById('edit-exp-company').value.trim(),
                location: document.getElementById('edit-exp-location').value.trim(),
                period: document.getElementById('edit-exp-period').value.trim(),
                bullets: document.getElementById('edit-exp-bullets').value.trim()
            };
        } else if (section === 'projects') {
            entry = {
                name: document.getElementById('edit-proj-name').value.trim(),
                tech: document.getElementById('edit-proj-tech').value.trim(),
                period: document.getElementById('edit-proj-period').value.trim(),
                bullets: document.getElementById('edit-proj-bullets').value.trim()
            };
        }

        // Validate basic parameters
        if (!entry[Object.keys(entry)[0]] || !entry[Object.keys(entry)[1]]) {
            alert('Please fill out the required primary fields.');
            return;
        }

        if (index !== null) {
            state.profile[section][index] = entry;
        } else {
            state.profile[section].push(entry);
        }

        saveProfileToLocalStorage();
        renderAllPersonaLists();
        modal.classList.remove('active');
        
        // Clean event listeners to prevent loops
        saveItemBtn.removeEventListener('click', handleSave);
    };

    saveItemBtn.addEventListener('click', handleSave);

    const handleClose = () => {
        modal.classList.remove('active');
        saveItemBtn.removeEventListener('click', handleSave);
        closeItemBtn.removeEventListener('click', handleClose);
    };

    closeItemBtn.addEventListener('click', handleClose);
}

// 4. TAILOR OPERATIONS
function initTailorHandlers() {
    const btnTailor = document.getElementById('btn-tailor-resume');
    const aiLoading = document.getElementById('ai-loading');
    const loadingTitle = document.getElementById('loading-step-title');
    const loadingSubtitle = document.getElementById('loading-step-subtitle');

    btnTailor.addEventListener('click', async () => {
        // Validation Checks
        if (!state.apiKey) {
            alert('Please configure your Gemini API Key first.');
            document.getElementById('btn-api-settings').click();
            return;
        }

        const jobTitle = document.getElementById('job-title-input').value.trim();
        const companyName = document.getElementById('company-name-input').value.trim();
        const jdText = document.getElementById('jd-input').value.trim();
        const tone = document.getElementById('tailor-tone').value;
        const length = document.getElementById('tailor-pages').value;

        if (!jobTitle || !companyName || !jdText) {
            alert('Please fill in target job title, company name, and copy-paste the Job Description.');
            return;
        }

        // Ensure user has profile details
        if (state.profile.experience.length === 0 && state.profile.projects.length === 0) {
            alert('Your Master Persona is empty! Please add experiences or projects in the "My Persona" tab first.');
            document.querySelector('.sidebar-nav .nav-btn[data-target="persona-view"]').click();
            return;
        }

        // Trigger Loading screen
        aiLoading.style.display = 'flex';
        loadingTitle.textContent = "Analyzing Job Requirements...";
        loadingSubtitle.textContent = `Finding key skills and tech stacks requested by ${companyName}...`;

        // Progress text steps
        const steps = [
            { text: "Tailoring profile achievements...", sub: "Mapping achievements to job qualifications using the STAR method..." },
            { text: "Polishing bullet phrasing...", sub: "Adding active metrics and balancing professional tone..." },
            { text: "Finalizing layout checks...", sub: "Fitting copy formatting requirements..." }
        ];

        let currentStep = 0;
        const stepInterval = setInterval(() => {
            if (currentStep < steps.length) {
                loadingTitle.textContent = steps[currentStep].text;
                loadingSubtitle.textContent = steps[currentStep].sub;
                currentStep++;
            }
        }, 3500);

        try {
            const tailoredResult = await tailorResume(
                state.apiKey,
                state.profile,
                jobTitle,
                companyName,
                jdText,
                tone,
                length
            );

            clearInterval(stepInterval);

            if (tailoredResult) {
                state.tailoredResume = tailoredResult;
                localStorage.setItem('resutailor_tailored', JSON.stringify(tailoredResult));
                
                // Route to Preview View
                const previewBtn = document.querySelector('.sidebar-nav .nav-btn[data-target="preview-view"]');
                if (previewBtn) {
                    previewBtn.click();
                }
            }
        } catch (err) {
            clearInterval(stepInterval);
            alert(`Tailoring failed: ${err.message}`);
        } finally {
            aiLoading.style.display = 'none';
        }
    });
}

// 5. PREVIEW VIEW AND PRINT ENGINE
function initPreviewHandlers() {
    const sheet = document.getElementById('resume-sheet');
    const templateButtons = document.querySelectorAll('.template-selector .template-btn');

    templateButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            templateButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const styleName = btn.getAttribute('data-style');
            sheet.className = `resume-sheet template-${styleName}`;
        });
    });

    // Customizer check toggles
    document.getElementById('toggle-opt-projects').addEventListener('change', (e) => {
        const projSec = sheet.querySelector('.sec-projects');
        if (projSec) projSec.style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('toggle-opt-skills').addEventListener('change', (e) => {
        const skillSec = sheet.querySelector('.sec-skills');
        if (skillSec) skillSec.style.display = e.target.checked ? 'block' : 'none';
    });

    // Back to edit
    document.getElementById('btn-back-to-tailor').addEventListener('click', () => {
        document.querySelector('.sidebar-nav .nav-btn[data-target="tailor-view"]').click();
    });

    // Native PDF print command
    document.getElementById('btn-print-resume').addEventListener('click', () => {
        window.print();
    });
}

function renderResumePreview() {
    const sheet = document.getElementById('resume-sheet');
    const data = state.tailoredResume;
    
    if (!data) return;

    // Build components
    let contactInfo = state.profile.contact;
    let emailStr = contactInfo.email ? `<span>Email: ${esc(contactInfo.email)}</span>` : '';
    let phoneStr = contactInfo.phone ? `<span>Phone: ${esc(contactInfo.phone)}</span>` : '';
    let locStr = contactInfo.location ? `<span>Loc: ${esc(contactInfo.location)}</span>` : '';
    let linkStr = contactInfo.linkedin ? `<span>LinkedIn: ${esc(contactInfo.linkedin)}</span>` : '';
    let gitStr = contactInfo.github ? `<span>GitHub: ${esc(contactInfo.github)}</span>` : '';
    
    let skillsObj = data.skills || { languages: [], frameworks: [], databases: [], custom: [] };

    let expHTML = data.experience?.map(exp => `
        <div class="resume-item">
            <div class="resume-item-header">
                <span>${esc(exp.role)}</span>
                <span>${esc(exp.period)}</span>
            </div>
            <div class="resume-item-subheader">
                <span>${esc(exp.company)}</span>
                <span>${esc(exp.location)}</span>
            </div>
            <ul class="resume-item-bullets">
                ${exp.bullets?.map(b => `<li>${esc(b)}</li>`).join('')}
            </ul>
        </div>
    `).join('') || '';

    let projHTML = data.projects?.map(proj => `
        <div class="resume-item">
            <div class="resume-item-header">
                <span>${esc(proj.name)}</span>
                <span>${esc(proj.period)}</span>
            </div>
            <div class="resume-item-subheader">
                <span>Tech Stack: ${esc(proj.tech)}</span>
            </div>
            <ul class="resume-item-bullets">
                ${proj.bullets?.map(b => `<li>${esc(b)}</li>`).join('')}
            </ul>
        </div>
    `).join('') || '';

    let eduHTML = data.education?.map(edu => `
        <div class="resume-item">
            <div class="resume-item-header">
                <span>${esc(edu.degree)}</span>
                <span>${esc(edu.period)}</span>
            </div>
            <div class="resume-item-subheader">
                <span>${esc(edu.institution)}</span>
                <span>${esc(edu.location)} ${edu.gpa ? '| GPA: ' + esc(edu.gpa) : ''}</span>
            </div>
        </div>
    `).join('') || '';

    sheet.innerHTML = `
        <header class="resume-header">
            <div class="resume-name">${esc(contactInfo.fullname) || 'Master Persona'}</div>
            <div class="resume-meta">
                ${emailStr}
                ${phoneStr}
                ${locStr}
                ${linkStr}
                ${gitStr}
            </div>
        </header>

        ${data.summary ? `
        <section class="resume-section">
            <div class="resume-section-title">Summary</div>
            <p style="font-size: 12.5px; color: #334155; text-align: justify;\">${esc(data.summary)}</p>
        </section>
        ` : ''}

        <section class="resume-section sec-skills">
            <div class="resume-section-title">Technical Skills</div>
            <div class="resume-skills-block">
                ${skillsObj.languages?.length > 0 ? `<div class="resume-skill-line"><strong>Languages:</strong> ${esc(skillsObj.languages.join(', '))}</div>` : ''}
                ${skillsObj.frameworks?.length > 0 ? `<div class="resume-skill-line"><strong>Frameworks & Libraries:</strong> ${esc(skillsObj.frameworks.join(', '))}</div>` : ''}
                ${skillsObj.databases?.length > 0 ? `<div class="resume-skill-line"><strong>Databases & Tools:</strong> ${esc(skillsObj.databases.join(', '))}</div>` : ''}
                ${skillsObj.custom?.length > 0 ? `<div class="resume-skill-line"><strong>Other Technologies:</strong> ${esc(skillsObj.custom.join(', '))}</div>` : ''}
            </div>
        </section>

        ${expHTML ? `
        <section class="resume-section">
            <div class="resume-section-title">Work Experience</div>
            ${expHTML}
        </section>
        ` : ''}

        ${projHTML ? `
        <section class="resume-section sec-projects">
            <div class="resume-section-title">Academic & Personal Projects</div>
            ${projHTML}
        </section>
        ` : ''}

        ${eduHTML ? `
        <section class="resume-section">
            <div class="resume-section-title">Education</div>
            ${eduHTML}
        </section>
        ` : ''}
    `;

    // Sync toggle statuses
    const showProjects = document.getElementById('toggle-opt-projects').checked;
    const showSkills = document.getElementById('toggle-opt-skills').checked;
    
    const projSec = sheet.querySelector('.sec-projects');
    const skillSec = sheet.querySelector('.sec-skills');
    
    if (projSec) projSec.style.display = showProjects ? 'block' : 'none';
    if (skillSec) skillSec.style.display = showSkills ? 'block' : 'none';

    // The user has a generated resume in front of them — gently mention support
    showSupportBannerIfNotDismissed();
}

// 6. GENERAL DASHBOARD METRICS
function updateDashboardStats() {
    document.getElementById('stat-experience').textContent = state.profile.experience.length;
    document.getElementById('stat-projects').textContent = state.profile.projects.length;
    
    // Skill tags calculation
    const allSkills = [
        state.profile.skills.languages,
        state.profile.skills.frameworks,
        state.profile.skills.databases,
        state.profile.skills.custom
    ].filter(s => s?.trim() !== '');

    const tagsContainer = document.getElementById('tech-tags-container');
    tagsContainer.innerHTML = '';

    const listBtn = document.getElementById('btn-analyze-tech');

    if (allSkills.length > 0) {
        let tagCount = 0;
        allSkills.join(',').split(',').map(s => s.trim()).filter(s => s !== '').forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tech-tag';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
            tagCount++;
        });
        document.getElementById('stat-skills').textContent = tagCount;
        listBtn.style.display = 'inline-flex';
    } else {
        document.getElementById('stat-skills').textContent = '0';
        tagsContainer.innerHTML = `<span class="placeholder-tag">No tech stack detected yet. Add details in Persona.</span>`;
        listBtn.style.display = 'none';
    }
}

// 7. SUPPORT BANNER (free tool — optional gratitude tip)
const SUPPORT_BANNER_DISMISS_KEY = 'resutailor_support_banner_dismissed';

function initSupportBanner() {
    const banner = document.getElementById('support-banner');
    const supportBtn = document.getElementById('btn-banner-support');
    const dismissBtn = document.getElementById('btn-banner-dismiss');

    supportBtn.addEventListener('click', () => {
        document.querySelector('.sidebar-nav .nav-btn[data-target="support-view"]').click();
    });

    dismissBtn.addEventListener('click', () => {
        banner.style.display = 'none';
        localStorage.setItem(SUPPORT_BANNER_DISMISS_KEY, 'true');
    });

    // Copy UPI ID on the support page
    const copyUpiBtn = document.getElementById('btn-copy-upi');
    copyUpiBtn.addEventListener('click', async () => {
        const upiId = document.getElementById('upi-id-text').textContent;
        try {
            await navigator.clipboard.writeText(upiId);
            copyUpiBtn.textContent = 'Copied!';
            setTimeout(() => { copyUpiBtn.textContent = 'Copy UPI ID'; }, 2000);
        } catch {
            prompt('Copy the UPI ID below:', upiId);
        }
    });
}

// Renders a scannable UPI QR code entirely client-side (no third-party QR API, no network call)
function renderSupportQR() {
    const container = document.getElementById('upi-qr-code');
    if (!container || !window.QRCode) return;

    const upiId = document.getElementById('upi-id-text').textContent.trim();
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&cu=INR`;

    new window.QRCode(container, {
        text: upiUri,
        width: 168,
        height: 168,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M
    });
}

function showSupportBannerIfNotDismissed() {
    if (localStorage.getItem(SUPPORT_BANNER_DISMISS_KEY) === 'true') return;
    const banner = document.getElementById('support-banner');
    banner.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
}
