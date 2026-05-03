const recordsBaseUrlInput = document.getElementById("records-base-url");
const summaryBaseUrlInput = document.getElementById("summary-base-url");
const attachmentBaseUrlInput = document.getElementById("attachment-base-url");
const consultBaseUrlInput = document.getElementById("consult-base-url");
const consultIdInput = document.getElementById("consult-id-input");
const loadSummaryButton = document.getElementById("load-summary-button");
const pageStatus = document.getElementById("page-status");
const summaryLayout = document.getElementById("summary-layout");

const serviceUrlStorageKeys = {
  records: "medivault.recordsBaseUrl",
  summary: "medivault.summaryBaseUrl",
  attachment: "medivault.attachmentBaseUrl",
  consult: "medivault.consultBaseUrl",
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

function statusPresentation(status) {
  const map = {
    created: { label: "New", tone: "neutral" },
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

function setPageStatus(online, message) {
  pageStatus.textContent = message;
  pageStatus.classList.remove("online", "offline");
  pageStatus.classList.add(online ? "online" : "offline");
}

function getConsultIdFromUrl() {
  return new URLSearchParams(window.location.search).get("consult_id") || "";
}

function renderEmptyState(message) {
  summaryLayout.innerHTML = `
    <article class="empty-state">
      <h2>No consult selected yet.</h2>
      <p>${escapeHtml(message)}</p>
    </article>
  `;
}

function symptomTimeline(summary, consult) {
  const narrative = summary?.summary_text || consult?.chief_complaint || "";
  const lines = narrative
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (!lines.length) {
    return "<p>No symptom timeline available yet.</p>";
  }

  return `
    <div class="timeline-list">
      ${lines
        .map(
          (line, index) => `
        <div class="timeline-item">
          <strong>${escapeHtml(line)}</strong>
          <small>${index === 0 ? "Captured from intake narrative" : "Additional context from intake"}</small>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderSummary(data) {
  const { consult, patient, summary, attachments, encounter, consultDetail } = data;
  const age = calculateAge(patient.birth_date);
  const status = statusPresentation(consult.status);
  const note = encounter?.notes?.[0] || null;
  const allergies = summary?.allergies || [];
  const medications = summary?.active_medications || [];
  const conditions = summary?.chronic_conditions || [];
  const procedures = summary?.past_procedures || [];
  const events = consultDetail?.events || [];
  const completion = intakeCompletion(summary, attachments, consult.status);
  const initials = `${patient.given_name?.[0] || ""}${patient.family_name?.[0] || ""}`.toUpperCase();

  summaryLayout.innerHTML = `
    <section class="summary-card">
      <div class="summary-header">
        <div class="header-grid">
          <span class="patient-badge">${escapeHtml(initials || "MV")}</span>
          <div>
            <h2>${escapeHtml(`${patient.given_name} ${patient.family_name}`)} · ${age ?? "?"}, ${escapeHtml(patient.sex_at_birth || "patient")}</h2>
            <p class="meta-copy">${escapeHtml(formatRelativeMinutes(consult.created_at))} · Intake ${completion}% complete · ${escapeHtml(status.label)}</p>
          </div>
        </div>
        <div class="action-group">
          <a class="secondary-button" href="./doctor-dashboard.html">Back to dashboard</a>
          <button class="primary-button" type="button" id="start-consult-button">Start consultation</button>
        </div>
      </div>

      <div class="summary-grid">
        <div class="left-stack">
          <article class="hero-card soft">
            <p class="section-label">Chief Complaint</p>
            <h3>${escapeHtml(consult.chief_complaint || encounter?.chief_complaint || "Not yet recorded")}</h3>
          </article>

          <article class="hero-card ${allergies.length ? "alert" : ""}">
            <p class="section-label">Allergies</p>
            ${
              allergies.length
                ? `<div class="chip-row">${allergies.map((item) => `<span class="tag-chip alert">${escapeHtml(item)}</span>`).join("")}</div>`
                : "<p>No allergies recorded yet.</p>"
            }
          </article>

          <article class="data-card">
            <p class="section-label">Symptom timeline</p>
            ${symptomTimeline(summary, consult)}
          </article>

          <article class="data-card">
            <p class="section-label">Active medications</p>
            ${
              medications.length
                ? `<div class="medication-grid">${medications
                    .map(
                      (item) => `
                    <div class="medication-item">
                      <strong>${escapeHtml(item)}</strong>
                      <small>Captured from patient intake</small>
                    </div>
                  `,
                    )
                    .join("")}</div>`
                : "<p>No medications recorded yet.</p>"
            }
          </article>

          <article class="data-card">
            <p class="section-label">Past diagnoses & procedures</p>
            ${
              conditions.length || procedures.length
                ? `<div class="condition-grid">
                    ${conditions.map((item) => `<div class="condition-item"><strong>${escapeHtml(item)}</strong><small>Chronic condition</small></div>`).join("")}
                    ${procedures.map((item) => `<div class="condition-item"><strong>${escapeHtml(item)}</strong><small>Past procedure</small></div>`).join("")}
                  </div>`
                : "<p>No diagnoses or procedures recorded yet.</p>"
            }
          </article>
        </div>

        <div class="right-stack">
          <article class="hero-card soft">
            <p class="section-label">Consult readiness</p>
            <div class="chip-row">
              <span class="status-chip ${status.tone}">${escapeHtml(status.label)}</span>
              <span class="attachment-chip">Session ${escapeHtml(consult.id.slice(0, 8))}</span>
              <span class="attachment-chip">${completion}% complete</span>
            </div>
          </article>

          <article class="data-card">
            <p class="section-label">Uploaded documents</p>
            ${
              attachments.length
                ? `<div class="document-list">${attachments
                    .map(
                      (attachment) => `
                    <div class="document-item">
                      <strong>${escapeHtml(attachment.original_filename || attachment.file_kind)}</strong>
                      <div><a href="${escapeHtml(getBaseUrls().attachment + `/attachments/${attachment.id}/download`)}" target="_blank" rel="noreferrer">Open document</a></div>
                    </div>
                  `,
                    )
                    .join("")}</div>`
                : "<p>No supporting documents uploaded yet.</p>"
            }
          </article>

          <article class="data-card">
            <p class="section-label">Summary narrative</p>
            <p>${escapeHtml(summary?.summary_text || "No summary narrative written yet.")}</p>
          </article>

          <article class="data-card">
            <p class="section-label">Consult timeline</p>
            ${
              events.length
                ? `<div class="timeline-list">${events
                    .map(
                      (event) => `
                    <div class="timeline-item">
                      <strong>${escapeHtml(event.event_type.replaceAll("_", " "))}</strong>
                      <small>${escapeHtml(formatRelativeMinutes(event.created_at))}</small>
                    </div>
                  `,
                    )
                    .join("")}</div>`
                : "<p>No consult events yet.</p>"
            }
          </article>

          <article class="data-card">
            <p class="section-label">Draft intake note</p>
            <pre class="note-preview">${escapeHtml(note?.subjective || "No draft note available yet.")}</pre>
          </article>
        </div>
      </div>
    </section>
  `;

  const startConsultButton = document.getElementById("start-consult-button");
  startConsultButton?.addEventListener("click", async () => {
    startConsultButton.disabled = true;
    try {
      const eventsToSend = [];
      if (["created", "intake_completed"].includes(consult.status)) {
        if (consult.status !== "patient_checked_in") {
          eventsToSend.push("patient_checked_in");
        }
        eventsToSend.push("consult_started");
      } else if (consult.status === "patient_checked_in") {
        eventsToSend.push("consult_started");
      }

      for (const eventType of eventsToSend) {
        await postJson(`${getBaseUrls().consult}/consult-sessions/${consult.id}/events`, {
          event_type: eventType,
          actor_id: "previsit-summary",
          payload: {
            trigger: "previsit_summary_start_consultation",
          },
        });
      }

      window.location.href = `./ai-note-assistant.html?consult_id=${encodeURIComponent(consult.id)}`;
    } finally {
      startConsultButton.disabled = false;
    }
  });
}

async function loadSummary() {
  const urls = getBaseUrls();
  const consultId = consultIdInput.value.trim();
  if (!urls.records || !urls.summary || !urls.attachment || !urls.consult || !consultId) {
    setPageStatus(false, "Consult session ID and all service URLs are required");
    renderEmptyState("Open this page from the doctor dashboard or paste a consult session ID above.");
    return;
  }

  persistServiceUrls();
  setPageStatus(false, "Loading consult summary...");
  loadSummaryButton.disabled = true;

  try {
    const consultDetail = await fetchJson(`${urls.consult}/consult-sessions/${consultId}`);
    const consult = consultDetail;
    const [patient, summary, attachments, encounter] = await Promise.all([
      fetchJson(`${urls.records}/patients/${consult.patient_id}`),
      fetchJson(`${urls.summary}/patients/${consult.patient_id}/summary/latest`).catch(() => null),
      fetchJson(`${urls.attachment}/patients/${consult.patient_id}/attachments`).catch(() => []),
      consult.encounter_id ? fetchJson(`${urls.records}/encounters/${consult.encounter_id}`).catch(() => null) : Promise.resolve(null),
    ]);

    renderSummary({
      consult,
      consultDetail,
      patient,
      summary,
      attachments: attachments || [],
      encounter,
    });
    setPageStatus(true, "Pre-visit summary loaded");
  } catch (error) {
    renderEmptyState(error.message);
    setPageStatus(false, `Summary error: ${error.message}`);
  } finally {
    loadSummaryButton.disabled = false;
  }
}

loadSummaryButton.addEventListener("click", loadSummary);

[recordsBaseUrlInput, summaryBaseUrlInput, attachmentBaseUrlInput, consultBaseUrlInput].forEach((input) => {
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
    loadSummary();
  }
}

bootstrap();
