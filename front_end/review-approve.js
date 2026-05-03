const recordsBaseUrlInput = document.getElementById("records-base-url");
const summaryBaseUrlInput = document.getElementById("summary-base-url");
const consultBaseUrlInput = document.getElementById("consult-base-url");
const consultIdInput = document.getElementById("consult-id-input");
const loadReviewButton = document.getElementById("load-review-button");
const backAiLink = document.getElementById("back-ai-link");
const pageStatus = document.getElementById("page-status");
const reviewLayout = document.getElementById("review-layout");

const serviceUrlStorageKeys = {
  records: "medivault.recordsBaseUrl",
  summary: "medivault.summaryBaseUrl",
  consult: "medivault.consultBaseUrl",
};

const reviewerId = "dr-reyes";

const state = {
  consult: null,
  patient: null,
  summary: null,
  encounter: null,
  noteDraft: null,
  diagnosesDraft: [],
  prescriptionsDraft: [],
  noDiagnosisConfirmed: false,
  noPrescriptionConfirmed: false,
  activeNoteId: null,
  activeNoteStatus: null,
  editMode: false,
  suggestionsState: "pending",
  saving: false,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function initializeStoredServiceUrls() {
  const storedRecords = localStorage.getItem(serviceUrlStorageKeys.records);
  const storedSummary = localStorage.getItem(serviceUrlStorageKeys.summary);
  const storedConsult = localStorage.getItem(serviceUrlStorageKeys.consult);

  if (storedRecords) {
    recordsBaseUrlInput.value = storedRecords;
  }
  if (storedSummary) {
    summaryBaseUrlInput.value = storedSummary;
  }
  if (storedConsult) {
    consultBaseUrlInput.value = storedConsult;
  }
}

function persistServiceUrls() {
  localStorage.setItem(serviceUrlStorageKeys.records, recordsBaseUrlInput.value.trim());
  localStorage.setItem(serviceUrlStorageKeys.summary, summaryBaseUrlInput.value.trim());
  localStorage.setItem(serviceUrlStorageKeys.consult, consultBaseUrlInput.value.trim());
}

function getBaseUrls() {
  return {
    records: recordsBaseUrlInput.value.trim().replace(/\/$/, ""),
    summary: summaryBaseUrlInput.value.trim().replace(/\/$/, ""),
    consult: consultBaseUrlInput.value.trim().replace(/\/$/, ""),
  };
}

function calculateAge(birthDate) {
  if (!birthDate) {
    return null;
  }
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

async function parseResponse(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await parseResponse(response);
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function postJson(url, payload) {
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function patchJson(url, payload) {
  return fetchJson(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function putJson(url, payload) {
  return fetchJson(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function setPageStatus(online, message) {
  pageStatus.textContent = message;
  pageStatus.classList.remove("online", "offline");
  pageStatus.classList.add(online ? "online" : "offline");
}

function getConsultIdFromUrl() {
  return new URLSearchParams(window.location.search).get("consult_id") || "";
}

function renderEmptyState(message) {
  reviewLayout.innerHTML = `
    <article class="empty-state">
      <h2>No consult selected yet.</h2>
      <p>${escapeHtml(message)}</p>
    </article>
  `;
}

function getLatestRelevantNote(encounter) {
  const notes = [...(encounter?.notes || [])].sort(
    (left, right) => new Date(right.updated_at || right.created_at) - new Date(left.updated_at || left.created_at),
  );
  return notes.find((note) => note.status !== "finalized") || notes[0] || null;
}

function buildReviewNote(consult, summary, note) {
  const complaint = (consult.chief_complaint || "headache and fatigue").toLowerCase();
  const allergies = (summary?.allergies || []).join(", ") || "no recorded allergies";
  const medications = (summary?.active_medications || []).join(", ") || "no maintenance medicines listed";
  const conditions = (summary?.chronic_conditions || []).join(", ") || "medical history still being gathered";

  return {
    subjective:
      note?.subjective ||
      `Patient presents with ${complaint}. Reports intermittent symptoms with worse mornings and recent fatigue. Notes missed maintenance doses last week. Medication context from intake includes ${medications}.`,
    objective:
      note?.objective ||
      `Patient appears alert and oriented. Initial in-consultation assessment pending, but intake suggests no immediate red-flag deterioration. Key allergy context: ${allergies}.`,
    assessment:
      note?.assessment ||
      `Working concerns include symptom burden related to ${conditions}. Medication non-adherence should be reviewed because it may be contributing to the current complaint.`,
    plan:
      note?.plan ||
      "Review medication access barriers, confirm home adherence, perform focused physical exam, and finalize treatment plan after direct doctor assessment.",
  };
}

function buildDiagnosisDraft(encounter) {
  if (encounter?.diagnoses?.length) {
    return encounter.diagnoses.map((diagnosis) => ({
      label: diagnosis.label || "",
      icd10_code: diagnosis.icd10_code || "",
      category: diagnosis.category || "primary",
      notes: diagnosis.notes || "",
    }));
  }
  return [];
}

function buildPrescriptionDraft(encounter) {
  if (encounter?.prescriptions?.length) {
    return encounter.prescriptions.map((prescription) => ({
      medication_name: prescription.medication_name || "",
      strength: prescription.strength || "",
      dose: prescription.dose || "",
      route: prescription.route || "",
      frequency: prescription.frequency || "",
      duration: prescription.duration || "",
      instructions: prescription.instructions || "",
      status: prescription.status || "active",
    }));
  }
  return [];
}

function highlightSegments(text, enabled) {
  const safeText = escapeHtml(text);
  if (!enabled) {
    return safeText;
  }

  return safeText
    .replace(/missed maintenance doses/gi, '<span class="highlight">missed maintenance doses</span>')
    .replace(/medication non-adherence/gi, '<span class="highlight">medication non-adherence</span>')
    .replace(/current complaint/gi, '<span class="highlight">current complaint</span>');
}

function renderNoteSection(field, label, value, options = {}) {
  const isEditing = state.editMode && !state.saving;
  const noteClass = options.highlight ? "note-body rich-text" : "note-body";
  const displayValue = options.highlight ? highlightSegments(value, state.suggestionsState !== "rejected") : escapeHtml(value);

  return `
    <article class="note-card">
      <div class="note-header">
        <div>
          <p class="section-label">${escapeHtml(label)}</p>
          <h3>AI-drafted · editable</h3>
        </div>
        ${options.badge ? `<span class="suggestion-badge">${escapeHtml(options.badge)}</span>` : ""}
      </div>
      ${isEditing
        ? `<textarea class="note-editor" data-note-field="${escapeHtml(field)}">${escapeHtml(value)}</textarea>`
        : `<p class="${noteClass}">${displayValue}</p>`}
    </article>
  `;
}

function renderDiagnosisSection() {
  const isEditing = state.editMode && !state.saving;
  return `
    <article class="note-card structured-card">
      <div class="note-header">
        <div>
          <p class="section-label">Diagnoses</p>
          <h3>Doctor-authored diagnoses only</h3>
        </div>
        ${isEditing && !state.noDiagnosisConfirmed ? '<button class="ghost-button mini-button" id="add-diagnosis-button" type="button">Add diagnosis</button>' : ""}
      </div>
      <label class="confirmation-toggle">
        <input type="checkbox" id="no-diagnosis-checkbox" ${state.noDiagnosisConfirmed ? "checked" : ""} ${state.saving ? "disabled" : ""} />
        <span>No diagnosis for this visit</span>
      </label>
      <div class="structured-stack">
        ${
          state.noDiagnosisConfirmed
            ? `<div class="structured-row read-only">
                <p class="structured-copy">Doctor confirmed there is no diagnosis to save for this visit.</p>
              </div>`
            : ""
        }
        ${state.diagnosesDraft
          .map((diagnosis, index) =>
            isEditing
              ? `
                <div class="structured-row">
                  <div class="structured-row-head">
                    <strong>Diagnosis ${index + 1}</strong>
                    <button class="ghost-button mini-button" type="button" data-remove-diagnosis="${index}">Remove</button>
                  </div>
                  <div class="structured-grid">
                    <label class="structured-field">
                      <span>Label</span>
                      <input type="text" data-diagnosis-index="${index}" data-diagnosis-field="label" value="${escapeHtml(diagnosis.label)}" />
                    </label>
                    <label class="structured-field">
                      <span>ICD-10 code</span>
                      <input type="text" data-diagnosis-index="${index}" data-diagnosis-field="icd10_code" value="${escapeHtml(diagnosis.icd10_code)}" />
                    </label>
                    <label class="structured-field">
                      <span>Category</span>
                      <select data-diagnosis-index="${index}" data-diagnosis-field="category">
                        ${["primary", "secondary", "symptom"]
                          .map((category) => `<option value="${category}" ${diagnosis.category === category ? "selected" : ""}>${category}</option>`)
                          .join("")}
                      </select>
                    </label>
                    <label class="structured-field structured-field-wide">
                      <span>Notes</span>
                      <input type="text" data-diagnosis-index="${index}" data-diagnosis-field="notes" value="${escapeHtml(diagnosis.notes)}" />
                    </label>
                  </div>
                </div>
              `
              : `
                <div class="structured-row read-only">
                  <div class="structured-row-head">
                    <strong>${escapeHtml(diagnosis.label || "Diagnosis not entered")}</strong>
                    <span class="pill">${escapeHtml(diagnosis.category || "primary")}</span>
                  </div>
                  <p class="structured-copy">${escapeHtml(diagnosis.icd10_code || "No ICD-10 code added")}</p>
                  ${diagnosis.notes ? `<p class="structured-copy">${escapeHtml(diagnosis.notes)}</p>` : ""}
                </div>
              `,
          )
          .join("")}
        ${
          !state.noDiagnosisConfirmed && !state.diagnosesDraft.length
            ? `<div class="structured-row read-only">
                <p class="structured-copy">No doctor-entered diagnosis yet. Add one or explicitly mark that there is no diagnosis for this visit.</p>
              </div>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderPrescriptionSection() {
  const isEditing = state.editMode && !state.saving;
  return `
    <article class="note-card structured-card">
      <div class="note-header">
        <div>
          <p class="section-label">Prescriptions</p>
          <h3>Doctor-authored prescriptions only</h3>
        </div>
        ${isEditing && !state.noPrescriptionConfirmed ? '<button class="ghost-button mini-button" id="add-prescription-button" type="button">Add medication</button>' : ""}
      </div>
      <label class="confirmation-toggle">
        <input type="checkbox" id="no-prescription-checkbox" ${state.noPrescriptionConfirmed ? "checked" : ""} ${state.saving ? "disabled" : ""} />
        <span>No prescription for this visit</span>
      </label>
      <div class="structured-stack">
        ${
          state.noPrescriptionConfirmed
            ? `<div class="structured-row read-only">
                <p class="structured-copy">Doctor confirmed there is no prescription to save for this visit.</p>
              </div>`
            : ""
        }
        ${state.prescriptionsDraft
          .map((prescription, index) =>
            isEditing
              ? `
                <div class="structured-row">
                  <div class="structured-row-head">
                    <strong>Medication ${index + 1}</strong>
                    <button class="ghost-button mini-button" type="button" data-remove-prescription="${index}">Remove</button>
                  </div>
                  <div class="structured-grid">
                    <label class="structured-field">
                      <span>Name</span>
                      <input type="text" data-prescription-index="${index}" data-prescription-field="medication_name" value="${escapeHtml(prescription.medication_name)}" />
                    </label>
                    <label class="structured-field">
                      <span>Strength</span>
                      <input type="text" data-prescription-index="${index}" data-prescription-field="strength" value="${escapeHtml(prescription.strength)}" />
                    </label>
                    <label class="structured-field">
                      <span>Dose</span>
                      <input type="text" data-prescription-index="${index}" data-prescription-field="dose" value="${escapeHtml(prescription.dose)}" />
                    </label>
                    <label class="structured-field">
                      <span>Route</span>
                      <input type="text" data-prescription-index="${index}" data-prescription-field="route" value="${escapeHtml(prescription.route)}" />
                    </label>
                    <label class="structured-field">
                      <span>Frequency</span>
                      <input type="text" data-prescription-index="${index}" data-prescription-field="frequency" value="${escapeHtml(prescription.frequency)}" />
                    </label>
                    <label class="structured-field">
                      <span>Duration</span>
                      <input type="text" data-prescription-index="${index}" data-prescription-field="duration" value="${escapeHtml(prescription.duration)}" />
                    </label>
                    <label class="structured-field">
                      <span>Status</span>
                      <select data-prescription-index="${index}" data-prescription-field="status">
                        ${["active", "continue", "stop"]
                          .map((status) => `<option value="${status}" ${prescription.status === status ? "selected" : ""}>${status}</option>`)
                          .join("")}
                      </select>
                    </label>
                    <label class="structured-field structured-field-wide">
                      <span>Instructions</span>
                      <input type="text" data-prescription-index="${index}" data-prescription-field="instructions" value="${escapeHtml(prescription.instructions)}" />
                    </label>
                  </div>
                </div>
              `
              : `
                <div class="structured-row read-only">
                  <div class="structured-row-head">
                    <strong>${escapeHtml(prescription.medication_name || "Medication not entered")}</strong>
                    <span class="pill">${escapeHtml(prescription.status || "active")}</span>
                  </div>
                  <p class="structured-copy">${escapeHtml(
                    [prescription.strength, prescription.dose, prescription.route, prescription.frequency, prescription.duration]
                      .filter(Boolean)
                      .join(" · ") || "No dosing details added",
                  )}</p>
                  ${prescription.instructions ? `<p class="structured-copy">${escapeHtml(prescription.instructions)}</p>` : ""}
                </div>
              `,
          )
          .join("")}
        ${
          !state.noPrescriptionConfirmed && !state.prescriptionsDraft.length
            ? `<div class="structured-row read-only">
                <p class="structured-copy">No doctor-entered prescription yet. Add one or explicitly mark that there is no prescription for this visit.</p>
              </div>`
            : ""
        }
      </div>
    </article>
  `;
}

function getSuggestionsTitle() {
  if (state.suggestionsState === "accepted") {
    return "All suggestions accepted";
  }
  if (state.suggestionsState === "rejected") {
    return "Highlights muted for manual review";
  }
  return "7 sections drafted from the consultation";
}

function getSuggestionsCopy() {
  if (state.suggestionsState === "accepted") {
    return "The highlighted terms have been accepted into the draft. The doctor can still edit every section before signing.";
  }
  if (state.suggestionsState === "rejected") {
    return "The suggested highlights are hidden so the doctor can revise the note manually before final approval.";
  }
  return "3 highlighted suggestions need your eyes before anything becomes part of the final record.";
}

function renderReview() {
  const { consult, patient, noteDraft, activeNoteStatus, saving } = state;
  const age = calculateAge(patient.birth_date);
  const initials = `${patient.given_name?.[0] || ""}${patient.family_name?.[0] || ""}`.toUpperCase();
  const pendingLabel = saving
    ? "Saving..."
    : state.editMode
      ? "Editing draft"
      : activeNoteStatus === "finalized"
        ? "Finalized note exists"
        : "Pending approval";

  reviewLayout.innerHTML = `
    <section class="review-card">
      <header class="review-header">
        <div class="header-grid">
          <span class="patient-badge">${escapeHtml(initials || "MV")}</span>
          <div>
            <h2>${escapeHtml(`${patient.given_name} ${patient.family_name}`)} · ${age ?? "?"}</h2>
            <p class="meta-copy">AI suggestions highlighted. Nothing saves without explicit doctor sign-off.</p>
          </div>
        </div>
        <span class="pending-chip">${escapeHtml(pendingLabel)}</span>
      </header>

      <div class="review-grid">
        <div class="note-stack">
          ${renderNoteSection("subjective", "Subjective", noteDraft.subjective, { highlight: true, badge: "AI draft" })}
          ${renderNoteSection("objective", "Objective", noteDraft.objective)}
          ${renderNoteSection("assessment", "Assessment", noteDraft.assessment, { highlight: true })}
          ${renderNoteSection("plan", "Plan", noteDraft.plan)}
          ${renderDiagnosisSection()}
          ${renderPrescriptionSection()}
        </div>

        <div class="side-stack">
          <article class="side-card">
            <p class="section-label">AI suggestions</p>
            <h3>${escapeHtml(getSuggestionsTitle())}</h3>
            <p class="side-copy">${escapeHtml(getSuggestionsCopy())}</p>
            <div class="suggestion-actions">
              <button class="ghost-button" id="accept-all-button" type="button">Accept all</button>
              <button class="ghost-button" id="reject-suggestions-button" type="button">Reject</button>
            </div>
          </article>

          <article class="side-card signoff-card">
            <p class="section-label">Sign-off required</p>
            <p class="side-copy">By approving, you confirm this note reflects today’s consultation.</p>
            <div class="signer-box">
              <small class="side-copy">SIGNING AS</small>
              <h3>Dr. J. Reyes</h3>
              <p class="side-copy">Internal Medicine</p>
            </div>
          </article>

          <article class="side-card">
            <button class="primary-button approve-button" id="approve-save-button" type="button" ${saving ? "disabled" : ""}>Approve & save</button>
            <button class="secondary-button approve-button secondary" id="approve-refer-button" type="button" ${saving ? "disabled" : ""}>Approve & refer</button>
            <button class="ghost-button approve-button" id="edit-before-saving-button" type="button" ${saving ? "disabled" : ""}>${state.editMode ? "Done editing" : "Edit before saving"}</button>
          </article>
        </div>
      </div>
    </section>
  `;

  backAiLink.href = `./ai-note-assistant.html?consult_id=${encodeURIComponent(consult.id)}`;
  attachReviewEvents();
}

function attachReviewEvents() {
  const editButton = document.getElementById("edit-before-saving-button");
  const approveSaveButton = document.getElementById("approve-save-button");
  const approveReferButton = document.getElementById("approve-refer-button");
  const acceptAllButton = document.getElementById("accept-all-button");
  const rejectButton = document.getElementById("reject-suggestions-button");
  const addDiagnosisButton = document.getElementById("add-diagnosis-button");
  const addPrescriptionButton = document.getElementById("add-prescription-button");
  const noDiagnosisCheckbox = document.getElementById("no-diagnosis-checkbox");
  const noPrescriptionCheckbox = document.getElementById("no-prescription-checkbox");

  document.querySelectorAll("[data-note-field]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const { noteField } = event.currentTarget.dataset;
      state.noteDraft[noteField] = event.currentTarget.value;
    });
  });

  document.querySelectorAll("[data-diagnosis-field]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const { diagnosisIndex, diagnosisField } = event.currentTarget.dataset;
      state.diagnosesDraft[Number(diagnosisIndex)][diagnosisField] = event.currentTarget.value;
    });
    input.addEventListener("change", (event) => {
      const { diagnosisIndex, diagnosisField } = event.currentTarget.dataset;
      state.diagnosesDraft[Number(diagnosisIndex)][diagnosisField] = event.currentTarget.value;
    });
  });

  document.querySelectorAll("[data-prescription-field]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const { prescriptionIndex, prescriptionField } = event.currentTarget.dataset;
      state.prescriptionsDraft[Number(prescriptionIndex)][prescriptionField] = event.currentTarget.value;
    });
    input.addEventListener("change", (event) => {
      const { prescriptionIndex, prescriptionField } = event.currentTarget.dataset;
      state.prescriptionsDraft[Number(prescriptionIndex)][prescriptionField] = event.currentTarget.value;
    });
  });

  document.querySelectorAll("[data-remove-diagnosis]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.removeDiagnosis);
      state.diagnosesDraft.splice(index, 1);
      if (!state.diagnosesDraft.length) {
        state.diagnosesDraft.push({ label: "", icd10_code: "", category: "primary", notes: "" });
      }
      renderReview();
    });
  });

  document.querySelectorAll("[data-remove-prescription]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.removePrescription);
      state.prescriptionsDraft.splice(index, 1);
      if (!state.prescriptionsDraft.length) {
        state.prescriptionsDraft.push({
          medication_name: "",
          strength: "",
          dose: "",
          route: "oral",
          frequency: "",
          duration: "",
          instructions: "",
          status: "active",
        });
      }
      renderReview();
    });
  });

  noDiagnosisCheckbox?.addEventListener("change", (event) => {
    state.noDiagnosisConfirmed = event.currentTarget.checked;
    if (state.noDiagnosisConfirmed) {
      state.diagnosesDraft = [];
    }
    renderReview();
  });

  noPrescriptionCheckbox?.addEventListener("change", (event) => {
    state.noPrescriptionConfirmed = event.currentTarget.checked;
    if (state.noPrescriptionConfirmed) {
      state.prescriptionsDraft = [];
    }
    renderReview();
  });

  addDiagnosisButton?.addEventListener("click", () => {
    state.noDiagnosisConfirmed = false;
    state.diagnosesDraft.push({ label: "", icd10_code: "", category: "secondary", notes: "" });
    renderReview();
  });

  addPrescriptionButton?.addEventListener("click", () => {
    state.noPrescriptionConfirmed = false;
    state.prescriptionsDraft.push({
      medication_name: "",
      strength: "",
      dose: "",
      route: "oral",
      frequency: "",
      duration: "",
      instructions: "",
      status: "active",
    });
    renderReview();
  });

  editButton?.addEventListener("click", () => {
    state.editMode = !state.editMode;
    renderReview();
  });

  acceptAllButton?.addEventListener("click", () => {
    state.suggestionsState = "accepted";
    renderReview();
  });

  rejectButton?.addEventListener("click", () => {
    state.suggestionsState = "rejected";
    renderReview();
  });

  approveSaveButton?.addEventListener("click", () => {
    handleApproval("save");
  });

  approveReferButton?.addEventListener("click", () => {
    handleApproval("refer");
  });
}

function sanitizeDiagnoses() {
  return state.diagnosesDraft
    .map((diagnosis) => ({
      label: diagnosis.label.trim(),
      icd10_code: diagnosis.icd10_code.trim(),
      category: diagnosis.category.trim() || "primary",
      notes: diagnosis.notes.trim(),
    }))
    .filter((diagnosis) => diagnosis.label);
}

function sanitizePrescriptions() {
  return state.prescriptionsDraft
    .map((prescription) => ({
      medication_name: prescription.medication_name.trim(),
      strength: prescription.strength.trim(),
      dose: prescription.dose.trim(),
      route: prescription.route.trim(),
      frequency: prescription.frequency.trim(),
      duration: prescription.duration.trim(),
      instructions: prescription.instructions.trim(),
      status: prescription.status.trim() || "active",
    }))
    .filter((prescription) => prescription.medication_name);
}

function validateDoctorOwnedFields() {
  const diagnoses = sanitizeDiagnoses();
  const prescriptions = sanitizePrescriptions();

  if (!diagnoses.length && !state.noDiagnosisConfirmed) {
    throw new Error("Doctor diagnosis is required before approval, or explicitly mark 'No diagnosis for this visit'.");
  }

  if (!prescriptions.length && !state.noPrescriptionConfirmed) {
    throw new Error("Doctor prescription is required before approval, or explicitly mark 'No prescription for this visit'.");
  }
}

async function ensureConsultEvent(urls, consultId, consultStatus, eventType, skipStatuses = []) {
  if (!consultId || skipStatuses.includes(consultStatus)) {
    return;
  }
  await postJson(`${urls.consult}/consult-sessions/${consultId}/events`, {
    event_type: eventType,
    actor_id: reviewerId,
    payload: {},
  });
}

async function saveOrCreateNote(urls) {
  const { encounter, noteDraft, activeNoteId, activeNoteStatus } = state;
  if (!encounter?.id) {
    throw new Error("This consult is not linked to an encounter yet.");
  }

  let note;
  if (activeNoteId && activeNoteStatus !== "finalized") {
    note = await patchJson(`${urls.records}/notes/${activeNoteId}`, noteDraft);
  } else {
    note = await postJson(`${urls.records}/encounters/${encounter.id}/notes`, {
      note_type: "soap",
      source: "ai_note_assistant",
      authored_by: "ai-note-assistant",
      ...noteDraft,
    });
  }

  state.activeNoteId = note.id;
  state.activeNoteStatus = note.status;
  return note;
}

async function saveStructuredEncounterData(urls) {
  const encounterId = state.encounter?.id;
  if (!encounterId) {
    return;
  }

  const diagnoses = state.noDiagnosisConfirmed ? [] : sanitizeDiagnoses();
  const prescriptions = state.noPrescriptionConfirmed ? [] : sanitizePrescriptions();

  await Promise.all([
    putJson(`${urls.records}/encounters/${encounterId}/diagnoses`, {
      actor_id: reviewerId,
      diagnoses,
    }),
    putJson(`${urls.records}/encounters/${encounterId}/prescriptions`, {
      actor_id: reviewerId,
      prescriptions,
    }),
  ]);
}

async function finalizeActiveNote(urls, noteId, noteStatus) {
  if (noteStatus === "finalized") {
    return fetchJson(`${urls.records}/notes/${noteId}`);
  }
  const finalized = await postJson(`${urls.records}/notes/${noteId}/finalize`, {
    reviewer_id: reviewerId,
  });
  state.activeNoteStatus = finalized.status;
  return finalized;
}

async function handleApproval(mode) {
  const urls = getBaseUrls();
  if (!state.consult || !state.patient) {
    setPageStatus(false, "Load a consult before approving the note");
    return;
  }

  try {
    validateDoctorOwnedFields();
  } catch (error) {
    setPageStatus(false, error.message);
    return;
  }

  state.saving = true;
  state.editMode = false;
  renderReview();
  setPageStatus(false, mode === "refer" ? "Approving note and preparing referral handoff..." : "Approving note and saving record...");

  try {
    await ensureConsultEvent(urls, state.consult.id, state.consult.status, "review_started", [
      "under_review",
      "finalized",
      "closed",
      "cancelled",
    ]);

    const savedNote = await saveOrCreateNote(urls);
    await saveStructuredEncounterData(urls);
    await finalizeActiveNote(urls, savedNote.id, savedNote.status);

    const refreshedConsult = await fetchJson(`${urls.consult}/consult-sessions/${state.consult.id}`);
    state.consult = refreshedConsult;

    await ensureConsultEvent(urls, state.consult.id, state.consult.status, "consult_finalized", [
      "finalized",
      "closed",
      "cancelled",
    ]);

    const finalizedConsult = await fetchJson(`${urls.consult}/consult-sessions/${state.consult.id}`);
    state.consult = finalizedConsult;

    await ensureConsultEvent(urls, state.consult.id, state.consult.status, "consult_closed", ["closed", "cancelled"]);

    const search = new URLSearchParams({
      consult_id: state.consult.id,
      mode,
    });
    window.location.href = `./saved-record.html?${search.toString()}`;
  } catch (error) {
    state.saving = false;
    renderReview();
    setPageStatus(false, `Review action failed: ${error.message}`);
  }
}

async function loadReview() {
  const urls = getBaseUrls();
  const consultId = consultIdInput.value.trim();
  if (!urls.records || !urls.summary || !urls.consult || !consultId) {
    setPageStatus(false, "Consult session ID and all service URLs are required");
    renderEmptyState("Open this page from the AI note assistant or paste a consult session ID above.");
    return;
  }

  persistServiceUrls();
  setPageStatus(false, "Loading review screen...");
  loadReviewButton.disabled = true;

  try {
    const consult = await fetchJson(`${urls.consult}/consult-sessions/${consultId}`);
    const [patient, summary, encounter] = await Promise.all([
      fetchJson(`${urls.records}/patients/${consult.patient_id}`),
      fetchJson(`${urls.summary}/patients/${consult.patient_id}/summary/latest`).catch(() => null),
      consult.encounter_id ? fetchJson(`${urls.records}/encounters/${consult.encounter_id}`) : Promise.resolve(null),
    ]);

    const activeNote = getLatestRelevantNote(encounter);
    state.consult = consult;
    state.patient = patient;
    state.summary = summary;
    state.encounter = encounter;
    state.activeNoteId = activeNote?.id || null;
    state.activeNoteStatus = activeNote?.status || null;
    state.noteDraft = buildReviewNote(consult, summary, activeNote);
    state.diagnosesDraft = buildDiagnosisDraft(encounter);
    state.prescriptionsDraft = buildPrescriptionDraft(encounter);
    state.noDiagnosisConfirmed = false;
    state.noPrescriptionConfirmed = false;
    state.editMode = false;
    state.suggestionsState = "pending";
    state.saving = false;

    renderReview();
    setPageStatus(true, "Review screen loaded");
  } catch (error) {
    renderEmptyState(error.message);
    setPageStatus(false, `Review error: ${error.message}`);
  } finally {
    loadReviewButton.disabled = false;
  }
}

loadReviewButton.addEventListener("click", loadReview);

[recordsBaseUrlInput, summaryBaseUrlInput, consultBaseUrlInput].forEach((input) => {
  input.addEventListener("change", persistServiceUrls);
});

async function bootstrap() {
  initializeStoredServiceUrls();
  const session = await window.MediVaultAuth?.requireDoctorSession();
  if (!session) {
    return;
  }

  const consultIdFromUrl = getConsultIdFromUrl();
  if (consultIdFromUrl) {
    consultIdInput.value = consultIdFromUrl;
    loadReview();
  }
}

bootstrap();
