const recordsBaseUrlInput = document.getElementById("records-base-url");
const summaryBaseUrlInput = document.getElementById("summary-base-url");
const attachmentBaseUrlInput = document.getElementById("attachment-base-url");
const consultBaseUrlInput = document.getElementById("consult-base-url");
const clinicianFilterInput = document.getElementById("clinician-filter");
const searchInput = document.getElementById("search-input");
const refreshDashboardButton = document.getElementById("refresh-dashboard-button");
const dashboardStatus = document.getElementById("dashboard-status");
const queueMeta = document.getElementById("queue-meta");
const queueList = document.getElementById("queue-list");
const detailTitle = document.getElementById("detail-title");
const detailStack = document.getElementById("detail-stack");
const primaryActionButton = document.getElementById("primary-action-button");
const openSummaryLink = document.getElementById("open-summary-link");

const metricActive = document.getElementById("metric-active");
const metricReady = document.getElementById("metric-ready");
const metricWait = document.getElementById("metric-wait");
const metricCompleted = document.getElementById("metric-completed");

const serviceUrlStorageKeys = {
  records: "medivault.recordsBaseUrl",
  summary: "medivault.summaryBaseUrl",
  attachment: "medivault.attachmentBaseUrl",
  consult: "medivault.consultBaseUrl",
};

let dashboardRows = [];
let filteredRows = [];
let selectedConsultId = "";

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
  const storedAttachment = localStorage.getItem(serviceUrlStorageKeys.attachment);
  const storedConsult = localStorage.getItem(serviceUrlStorageKeys.consult);

  if (storedRecords) {
    recordsBaseUrlInput.value = storedRecords;
  }
  if (storedSummary) {
    summaryBaseUrlInput.value = storedSummary;
  }
  if (storedAttachment) {
    attachmentBaseUrlInput.value = storedAttachment;
  }
  if (storedConsult) {
    consultBaseUrlInput.value = storedConsult;
  }
}

function persistServiceUrls() {
  localStorage.setItem(serviceUrlStorageKeys.records, recordsBaseUrlInput.value.trim());
  localStorage.setItem(serviceUrlStorageKeys.summary, summaryBaseUrlInput.value.trim());
  localStorage.setItem(serviceUrlStorageKeys.attachment, attachmentBaseUrlInput.value.trim());
  localStorage.setItem(serviceUrlStorageKeys.consult, consultBaseUrlInput.value.trim());
}

function getBaseUrls() {
  return {
    records: recordsBaseUrlInput.value.trim().replace(/\/$/, ""),
    summary: summaryBaseUrlInput.value.trim().replace(/\/$/, ""),
    attachment: attachmentBaseUrlInput.value.trim().replace(/\/$/, ""),
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

function formatRelativeMinutes(timestamp) {
  if (!timestamp) {
    return "just now";
  }
  const createdAt = new Date(timestamp);
  const diffMs = Date.now() - createdAt.getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

function formatQueueAge(timestamp) {
  if (!timestamp) {
    return 0;
  }
  return Math.max(1, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000));
}

function statusPresentation(status) {
  const map = {
    created: { label: "New", tone: "warning" },
    intake_completed: { label: "Ready", tone: "ready" },
    patient_checked_in: { label: "Checked in", tone: "ready" },
    in_progress: { label: "In consult", tone: "progress" },
    transcribing: { label: "Listening", tone: "progress" },
    draft_ready: { label: "Draft ready", tone: "progress" },
    under_review: { label: "Reviewing", tone: "progress" },
    finalized: { label: "Finalized", tone: "neutral" },
    closed: { label: "Closed", tone: "neutral" },
    cancelled: { label: "Cancelled", tone: "neutral" },
  };
  return map[status] || { label: status.replaceAll("_", " "), tone: "neutral" };
}

function intakeCompletion(summary, attachments, consultStatus) {
  let score = 8;
  if (summary?.summary_text) {
    score += 32;
  }
  if ((summary?.allergies || []).length) {
    score += 18;
  }
  if ((summary?.active_medications || []).length) {
    score += 18;
  }
  if ((summary?.chronic_conditions || []).length || (summary?.past_procedures || []).length) {
    score += 10;
  }
  if ((attachments || []).length) {
    score += 12;
  }
  if (consultStatus === "intake_completed" || consultStatus === "patient_checked_in") {
    score += 10;
  }
  return Math.min(score, 100);
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`GET ${url} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`POST ${url} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function putJson(url, payload) {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`PUT ${url} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

function setDashboardStatus(online, message) {
  dashboardStatus.textContent = message;
  dashboardStatus.classList.remove("online", "offline");
  dashboardStatus.classList.add(online ? "online" : "offline");
}

function activeRows(rows) {
  return rows.filter((row) => !["closed", "cancelled"].includes(row.consult.status));
}

function readyRows(rows) {
  return rows.filter((row) => ["intake_completed", "patient_checked_in", "draft_ready"].includes(row.consult.status));
}

function completedRows(rows) {
  return rows.filter((row) => ["finalized", "closed"].includes(row.consult.status));
}

function sortRows(rows) {
  const statusRank = {
    patient_checked_in: 1,
    intake_completed: 2,
    created: 3,
    in_progress: 4,
    transcribing: 5,
    draft_ready: 6,
    under_review: 7,
    finalized: 8,
    closed: 9,
    cancelled: 10,
  };
  return [...rows].sort((left, right) => {
    const leftRank = statusRank[left.consult.status] || 99;
    const rightRank = statusRank[right.consult.status] || 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return new Date(right.consult.created_at).getTime() - new Date(left.consult.created_at).getTime();
  });
}

function sortConsultSessions(sessions) {
  const statusRank = {
    patient_checked_in: 1,
    intake_completed: 2,
    created: 3,
    in_progress: 4,
    transcribing: 5,
    draft_ready: 6,
    under_review: 7,
    finalized: 8,
    closed: 9,
    cancelled: 10,
  };
  return [...sessions].sort((left, right) => {
    const leftRank = statusRank[left.status] || 99;
    const rightRank = statusRank[right.status] || 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

function buildQueueCard(row) {
  const patient = row.patient;
  const status = statusPresentation(row.consult.status);
  const age = calculateAge(patient.birth_date);
  const initials = `${patient.given_name?.[0] || ""}${patient.family_name?.[0] || ""}`.toUpperCase();
  const completion = row.intakeCompletion;
  const attachmentCount = row.attachments.length;
  const isActive = row.consult.id === selectedConsultId;

  return `
    <article class="queue-card ${isActive ? "active" : ""}" data-consult-id="${escapeHtml(row.consult.id)}">
      <div class="queue-meta-row">
        <span class="patient-badge">${escapeHtml(initials || "MV")}</span>
        <div>
          <div class="queue-patient-name">
            <strong>${escapeHtml(`${patient.given_name} ${patient.family_name}`)}</strong>
            <small>${age ?? "?"}${age !== null ? " y/o" : ""}</small>
          </div>
          <p class="queue-subtitle">${escapeHtml(row.consult.chief_complaint || "Chief complaint not recorded yet.")}</p>
        </div>
        <span class="status-chip ${status.tone}">${escapeHtml(status.label)}</span>
      </div>
      <div class="queue-footer">
        <span class="tag-chip ${completion >= 85 ? "success" : completion >= 55 ? "warning" : "neutral"}">Intake ${completion}%</span>
        <span class="attachment-chip">${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}</span>
        <span class="attachment-chip">${escapeHtml(formatRelativeMinutes(row.consult.created_at))}</span>
      </div>
    </article>
  `;
}

function renderQueue() {
  if (!filteredRows.length) {
    queueList.innerHTML = `
      <article class="empty-state">
        <h3>No matching patients in the queue.</h3>
        <p>Send an intake from the patient app or adjust the clinician and search filters.</p>
      </article>
    `;
    queueMeta.textContent = "0 patients shown";
    renderDetail(null);
    return;
  }

  queueList.innerHTML = filteredRows.map(buildQueueCard).join("");
  queueMeta.textContent = `${filteredRows.length} patient${filteredRows.length === 1 ? "" : "s"} shown`;

  queueList.querySelectorAll(".queue-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedConsultId = card.dataset.consultId || "";
      renderQueue();
      renderSelectedRow();
    });
  });
}

function renderMetrics(rows) {
  const active = activeRows(rows);
  const ready = readyRows(rows);
  const completed = completedRows(rows);
  const avgQueueAge = active.length
    ? Math.round(active.reduce((sum, row) => sum + formatQueueAge(row.consult.created_at), 0) / active.length)
    : 0;

  metricActive.textContent = String(active.length);
  metricReady.textContent = String(ready.length);
  metricWait.textContent = `${avgQueueAge}m`;
  metricCompleted.textContent = String(completed.length);
}

function getSelectedRow() {
  return filteredRows.find((row) => row.consult.id === selectedConsultId) || filteredRows[0] || null;
}

function ensureStructuredDrafts(row) {
  if (!row?.encounter) {
    return;
  }

  if (!Array.isArray(row.encounter.diagnoses)) {
    row.encounter.diagnoses = [];
  }

  if (!Array.isArray(row.encounter.prescriptions)) {
    row.encounter.prescriptions = [];
  }

  if (typeof row.encounter.diagnosisDraftText !== "string") {
    row.encounter.diagnosisDraftText = row.encounter.diagnoses
      .map((diagnosis) =>
        [diagnosis.label, diagnosis.icd10_code, diagnosis.category, diagnosis.notes].filter(Boolean).join(" | "),
      )
      .join("\n");
  }

  if (typeof row.encounter.prescriptionDraftText !== "string") {
    row.encounter.prescriptionDraftText = row.encounter.prescriptions
      .map((prescription) =>
        [
          prescription.medication_name,
          prescription.strength,
          prescription.dose,
          prescription.route,
          prescription.frequency,
          prescription.duration,
          prescription.instructions,
          prescription.status,
        ]
          .filter(Boolean)
          .join(" | "),
      )
      .join("\n");
  }
}

function renderDiagnosisDrafts(row) {
  if (!row?.encounter) {
    return `
      <article class="detail-card">
        <p class="section-label">Diagnosis Draft</p>
        <p>No encounter linked yet, so structured diagnoses cannot be saved from the dashboard.</p>
      </article>
    `;
  }

  const diagnoses = row.encounter.diagnoses || [];
  return `
    <article class="detail-card draft-entry-card">
      <div class="draft-entry-header">
        <div>
          <p class="section-label">Diagnosis Draft</p>
          <h3>Write the diagnosis the way you naturally would.</h3>
        </div>
        <div class="draft-entry-actions">
          <button class="primary-button compact-button" type="button" id="save-diagnosis-draft-button">Save diagnoses</button>
        </div>
      </div>
      <p class="draft-helper-copy">One line per diagnosis. Optional format: <code>Label | ICD-10 | category | notes</code></p>
      <textarea class="draft-entry-textarea" id="diagnosis-draft-textarea" placeholder="Essential hypertension | I10 | primary&#10;Headache | R51 | symptom">${escapeHtml(
        row.encounter.diagnosisDraftText || "",
      )}</textarea>
      ${
        diagnoses.length
          ? `<div class="saved-chip-row">${diagnoses
              .map((diagnosis) => `<span class="attachment-chip">${escapeHtml(diagnosis.label)}</span>`)
              .join("")}</div>`
          : ""
      }
    </article>
  `;
}

function renderPrescriptionDrafts(row) {
  if (!row?.encounter) {
    return `
      <article class="detail-card">
        <p class="section-label">Prescription Draft</p>
        <p>No encounter linked yet, so structured prescriptions cannot be saved from the dashboard.</p>
      </article>
    `;
  }

  const prescriptions = row.encounter.prescriptions || [];
  return `
    <article class="detail-card draft-entry-card">
      <div class="draft-entry-header">
        <div>
          <p class="section-label">Prescription Draft</p>
          <h3>Write prescription lines quickly before final review.</h3>
        </div>
        <div class="draft-entry-actions">
          <button class="primary-button compact-button" type="button" id="save-prescription-draft-button">Save prescriptions</button>
        </div>
      </div>
      <p class="draft-helper-copy">One line per medication. Optional format: <code>Name | strength | dose | route | frequency | duration | instructions | status</code></p>
      <textarea class="draft-entry-textarea" id="prescription-draft-textarea" placeholder="Losartan | 50 mg | 1 tablet | oral | once daily | 30 days | Continue maintenance | continue">${escapeHtml(
        row.encounter.prescriptionDraftText || "",
      )}</textarea>
      ${
        prescriptions.length
          ? `<div class="saved-chip-row">${prescriptions
              .map((prescription) => `<span class="attachment-chip">${escapeHtml(prescription.medication_name)}</span>`)
              .join("")}</div>`
          : ""
      }
    </article>
  `;
}

function summaryHtml(row) {
  if (!row) {
    detailTitle.textContent = "Choose a patient from the queue.";
    primaryActionButton.disabled = true;
    primaryActionButton.textContent = "Start consultation";
    return `
      <article class="empty-state">
        <h3>No consult selected.</h3>
        <p>The doctor summary will appear here once you pick someone from the queue.</p>
      </article>
    `;
  }

  const { patient, summary, consult, attachments, encounter, consultDetail } = row;
  const age = calculateAge(patient.birth_date);
  const status = statusPresentation(consult.status);
  const note = encounter?.notes?.[0] || null;
  const allergies = summary?.allergies || [];
  const medications = summary?.active_medications || [];
  const conditions = summary?.chronic_conditions || [];
  const procedures = summary?.past_procedures || [];
  const events = consultDetail?.events || [];
  ensureStructuredDrafts(row);

  detailTitle.textContent = `${patient.given_name} ${patient.family_name} · ${age ?? "?"}, ${patient.sex_at_birth || "patient"}`;
  primaryActionButton.disabled = false;
  if (["created", "intake_completed", "patient_checked_in"].includes(consult.status)) {
    primaryActionButton.textContent = "Start consultation";
  } else {
    primaryActionButton.textContent = "Refresh selected consult";
  }

  return `
    <section class="detail-hero">
      <div class="header-meta">
        <span class="patient-badge">${escapeHtml(`${patient.given_name?.[0] || ""}${patient.family_name?.[0] || ""}`.toUpperCase())}</span>
        <div>
          <h3>${escapeHtml(`${patient.given_name} ${patient.family_name}`)}</h3>
          <p class="meta-copy">${escapeHtml(formatRelativeMinutes(consult.created_at))} · Intake ${row.intakeCompletion}% complete · ${escapeHtml(status.label)}</p>
        </div>
      </div>
    </section>

    <div class="detail-grid">
      <article class="detail-card soft">
        <p class="section-label">Chief Complaint</p>
        <h3>${escapeHtml(consult.chief_complaint || encounter?.chief_complaint || "Not yet recorded")}</h3>
      </article>
      <article class="detail-card">
        <p class="section-label">Consult Status</p>
        <div class="chip-row">
          <span class="status-chip ${status.tone}">${escapeHtml(status.label)}</span>
          <span class="attachment-chip">Session ${escapeHtml(consult.id.slice(0, 8))}</span>
        </div>
      </article>
      <article class="detail-card ${allergies.length ? "alert" : ""}">
        <p class="section-label">Allergies</p>
        ${
          allergies.length
            ? `<div class="chip-row">${allergies.map((item) => `<span class="tag-chip warning">${escapeHtml(item)}</span>`).join("")}</div>`
            : "<p>No allergies recorded yet.</p>"
        }
      </article>
      <article class="detail-card">
        <p class="section-label">Uploaded Documents</p>
        ${
          attachments.length
            ? `<div class="attachment-list">${attachments
                .map(
                  (attachment) => `
                <div class="attachment-item">
                  <strong>${escapeHtml(attachment.original_filename || attachment.file_kind)}</strong>
                  <div><a href="${escapeHtml(getBaseUrls().attachment + `/attachments/${attachment.id}/download`)}" target="_blank" rel="noreferrer">Open document</a></div>
                </div>
              `,
                )
                .join("")}</div>`
            : "<p>No attachments uploaded yet.</p>"
        }
      </article>
      <article class="detail-card">
        <p class="section-label">Active Medications</p>
        ${
          medications.length
            ? `<div class="medication-list">${medications
                .map(
                  (item) => `
                <div class="medication-card">
                  <strong>${escapeHtml(item)}</strong>
                </div>
              `,
                )
                .join("")}</div>`
            : "<p>No medications recorded yet.</p>"
        }
      </article>
      <article class="detail-card">
        <p class="section-label">Conditions & Procedures</p>
        ${
          conditions.length || procedures.length
            ? `<div class="chip-row">
                ${conditions.map((item) => `<span class="attachment-chip">${escapeHtml(item)}</span>`).join("")}
                ${procedures.map((item) => `<span class="attachment-chip">${escapeHtml(item)}</span>`).join("")}
              </div>`
            : "<p>No chronic conditions or procedures recorded yet.</p>"
        }
      </article>
      <article class="detail-card soft">
        <p class="section-label">Summary Narrative</p>
        <p>${escapeHtml(summary?.summary_text || "No summary narrative written yet.")}</p>
      </article>
      <article class="detail-card">
        <p class="section-label">Consult Timeline</p>
        ${
          events.length
            ? `<div class="event-list">${events
                .map(
                  (event) => `
                <div class="event-item">
                  <strong>${escapeHtml(event.event_type.replaceAll("_", " "))}</strong>
                  <small>${escapeHtml(formatRelativeMinutes(event.created_at))}</small>
                </div>
              `,
                )
                .join("")}</div>`
            : "<p>No consult events yet.</p>"
        }
      </article>
      <article class="detail-card">
        <p class="section-label">Draft Intake Note</p>
        <pre class="draft-note">${escapeHtml(note?.subjective || "No draft note available yet.")}</pre>
      </article>
      ${renderDiagnosisDrafts(row)}
      ${renderPrescriptionDrafts(row)}
    </div>
  `;
}

function renderDetail(row) {
  if (row) {
    const params = new URLSearchParams({ consult_id: row.consult.id });
    openSummaryLink.href = `./previsit-summary.html?${params.toString()}`;
    openSummaryLink.classList.remove("disabled-link");
    openSummaryLink.setAttribute("aria-disabled", "false");
  } else {
    openSummaryLink.href = "./previsit-summary.html";
    openSummaryLink.classList.add("disabled-link");
    openSummaryLink.setAttribute("aria-disabled", "true");
  }
  detailStack.innerHTML = summaryHtml(row);
  attachDetailDraftEvents(row);
}

function renderSelectedRow() {
  const selectedRow = getSelectedRow();
  if (selectedRow) {
    selectedConsultId = selectedRow.consult.id;
  }
  renderDetail(selectedRow);
}

function sanitizeDiagnoses(diagnoses) {
  return diagnoses
    .map((diagnosis) => ({
      label: (diagnosis.label || "").trim(),
      icd10_code: (diagnosis.icd10_code || "").trim(),
      category: (diagnosis.category || "primary").trim(),
      notes: (diagnosis.notes || "").trim(),
    }))
    .filter((diagnosis) => diagnosis.label);
}

function parseDiagnosisDraftText(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label = "", icd10_code = "", category = "", ...noteParts] = line.split("|").map((part) => part.trim());
      return {
        label,
        icd10_code,
        category: category || (index === 0 ? "primary" : "secondary"),
        notes: noteParts.join(" | "),
      };
    })
    .filter((diagnosis) => diagnosis.label);
}

function sanitizePrescriptions(prescriptions) {
  return prescriptions
    .map((prescription) => ({
      medication_name: (prescription.medication_name || "").trim(),
      strength: (prescription.strength || "").trim(),
      dose: (prescription.dose || "").trim(),
      route: (prescription.route || "").trim(),
      frequency: (prescription.frequency || "").trim(),
      duration: (prescription.duration || "").trim(),
      instructions: (prescription.instructions || "").trim(),
      status: (prescription.status || "active").trim(),
    }))
    .filter((prescription) => prescription.medication_name);
}

function parsePrescriptionDraftText(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [medication_name = "", strength = "", dose = "", route = "", frequency = "", duration = "", instructions = "", status = "active"] = line
        .split("|")
        .map((part) => part.trim());
      return {
        medication_name,
        strength,
        dose,
        route,
        frequency,
        duration,
        instructions,
        status: status || "active",
      };
    })
    .filter((prescription) => prescription.medication_name);
}

function attachDetailDraftEvents(row) {
  if (!row?.encounter) {
    return;
  }

  document.getElementById("diagnosis-draft-textarea")?.addEventListener("input", (event) => {
    row.encounter.diagnosisDraftText = event.currentTarget.value;
  });

  document.getElementById("prescription-draft-textarea")?.addEventListener("input", (event) => {
    row.encounter.prescriptionDraftText = event.currentTarget.value;
  });

  document.getElementById("save-diagnosis-draft-button")?.addEventListener("click", async () => {
    const urls = getBaseUrls();
    try {
      const parsedDiagnoses = parseDiagnosisDraftText(row.encounter.diagnosisDraftText || "");
      const diagnoses = await putJson(`${urls.records}/encounters/${row.encounter.id}/diagnoses`, {
        actor_id: clinicianFilterInput.value.trim() || "dr-reyes",
        diagnoses: sanitizeDiagnoses(parsedDiagnoses),
      });
      row.encounter.diagnoses = diagnoses;
      row.encounter.diagnosisDraftText = diagnoses
        .map((diagnosis) => [diagnosis.label, diagnosis.icd10_code, diagnosis.category, diagnosis.notes].filter(Boolean).join(" | "))
        .join("\n");
      setDashboardStatus(true, `Saved ${diagnoses.length} diagnosis draft${diagnoses.length === 1 ? "" : "s"} for ${row.patient.given_name}`);
      renderDetail(row);
    } catch (error) {
      setDashboardStatus(false, `Diagnosis draft save failed: ${error.message}`);
    }
  });

  document.getElementById("save-prescription-draft-button")?.addEventListener("click", async () => {
    const urls = getBaseUrls();
    try {
      const parsedPrescriptions = parsePrescriptionDraftText(row.encounter.prescriptionDraftText || "");
      const prescriptions = await putJson(`${urls.records}/encounters/${row.encounter.id}/prescriptions`, {
        actor_id: clinicianFilterInput.value.trim() || "dr-reyes",
        prescriptions: sanitizePrescriptions(parsedPrescriptions),
      });
      row.encounter.prescriptions = prescriptions;
      row.encounter.prescriptionDraftText = prescriptions
        .map((prescription) =>
          [
            prescription.medication_name,
            prescription.strength,
            prescription.dose,
            prescription.route,
            prescription.frequency,
            prescription.duration,
            prescription.instructions,
            prescription.status,
          ]
            .filter(Boolean)
            .join(" | "),
        )
        .join("\n");
      setDashboardStatus(true, `Saved ${prescriptions.length} prescription draft${prescriptions.length === 1 ? "" : "s"} for ${row.patient.given_name}`);
      renderDetail(row);
    } catch (error) {
      setDashboardStatus(false, `Prescription draft save failed: ${error.message}`);
    }
  });
}

function applyFilters() {
  const clinicianFilter = clinicianFilterInput.value.trim().toLowerCase();
  const searchTerm = searchInput.value.trim().toLowerCase();
  filteredRows = sortRows(
    dashboardRows.filter((row) => {
      const clinicianMatch = !clinicianFilter || (row.consult.clinician_id || "").toLowerCase().includes(clinicianFilter);
      const searchBlob = `${row.patient.given_name} ${row.patient.family_name} ${row.consult.chief_complaint || ""}`.toLowerCase();
      const searchMatch = !searchTerm || searchBlob.includes(searchTerm);
      return clinicianMatch && searchMatch;
    }),
  );
  if (!filteredRows.some((row) => row.consult.id === selectedConsultId)) {
    selectedConsultId = filteredRows[0]?.consult.id || "";
  }
  renderQueue();
  renderSelectedRow();
}

async function loadDashboard() {
  const urls = getBaseUrls();
  if (!urls.records || !urls.summary || !urls.attachment || !urls.consult) {
    setDashboardStatus(false, "All service URLs are required");
    return;
  }

  persistServiceUrls();
  setDashboardStatus(false, "Loading queue...");
  refreshDashboardButton.disabled = true;

  try {
    const consultPath = clinicianFilterInput.value.trim()
      ? `${urls.consult}/consult-sessions?clinician_id=${encodeURIComponent(clinicianFilterInput.value.trim())}`
      : `${urls.consult}/consult-sessions`;

    const consultSessions = await fetchJson(consultPath);
    const activeAndRecent = sortConsultSessions(
      consultSessions.filter((session) => !["closed", "cancelled"].includes(session.status)),
    );

    dashboardRows = await Promise.all(
      activeAndRecent.map(async (consult) => {
        const [patient, summary, attachments, consultDetail, encounter] = await Promise.all([
          fetchJson(`${urls.records}/patients/${consult.patient_id}`),
          fetchJson(`${urls.summary}/patients/${consult.patient_id}/summary/latest`).catch(() => null),
          fetchJson(`${urls.attachment}/patients/${consult.patient_id}/attachments`).catch(() => []),
          fetchJson(`${urls.consult}/consult-sessions/${consult.id}`).catch(() => null),
          consult.encounter_id ? fetchJson(`${urls.records}/encounters/${consult.encounter_id}`).catch(() => null) : Promise.resolve(null),
        ]);

        return {
          consult,
          consultDetail,
          patient,
          summary,
          attachments: attachments || [],
          encounter,
          intakeCompletion: intakeCompletion(summary, attachments || [], consult.status),
        };
      }),
    );

    renderMetrics(dashboardRows);
    applyFilters();
    setDashboardStatus(true, `${dashboardRows.length} consult session${dashboardRows.length === 1 ? "" : "s"} loaded`);
  } catch (error) {
    dashboardRows = [];
    filteredRows = [];
    renderMetrics([]);
    renderQueue();
    setDashboardStatus(false, `Dashboard error: ${error.message}`);
  } finally {
    refreshDashboardButton.disabled = false;
  }
}

async function advanceSelectedConsult() {
  const selectedRow = filteredRows.find((row) => row.consult.id === selectedConsultId);
  if (!selectedRow) {
    return;
  }
  const params = new URLSearchParams({ consult_id: selectedRow.consult.id });
  window.location.href = `./previsit-summary.html?${params.toString()}`;
}

refreshDashboardButton.addEventListener("click", loadDashboard);
searchInput.addEventListener("input", applyFilters);
clinicianFilterInput.addEventListener("input", applyFilters);
primaryActionButton.addEventListener("click", advanceSelectedConsult);

[recordsBaseUrlInput, summaryBaseUrlInput, attachmentBaseUrlInput, consultBaseUrlInput].forEach((input) => {
  input.addEventListener("change", persistServiceUrls);
});

async function bootstrap() {
  initializeStoredServiceUrls();
  const session = await window.MediVaultAuth?.requireDoctorSession({
    welcomeElementId: "doctor-welcome",
    logoutButtonId: "doctor-logout-button",
  });
  if (!session) {
    return;
  }
  loadDashboard();
}

bootstrap();
