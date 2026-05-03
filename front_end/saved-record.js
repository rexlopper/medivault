const recordsBaseUrlInput = document.getElementById("records-base-url");
const summaryBaseUrlInput = document.getElementById("summary-base-url");
const attachmentBaseUrlInput = document.getElementById("attachment-base-url");
const consultBaseUrlInput = document.getElementById("consult-base-url");
const consultIdInput = document.getElementById("consult-id-input");
const loadRecordButton = document.getElementById("load-record-button");
const backReviewLink = document.getElementById("back-review-link");
const pageStatus = document.getElementById("page-status");
const recordLayout = document.getElementById("record-layout");

const serviceUrlStorageKeys = {
  records: "medivault.recordsBaseUrl",
  summary: "medivault.summaryBaseUrl",
  attachments: "medivault.attachmentBaseUrl",
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
  const storedAttachments = localStorage.getItem(serviceUrlStorageKeys.attachments);
  const storedConsult = localStorage.getItem(serviceUrlStorageKeys.consult);

  if (storedRecords) {
    recordsBaseUrlInput.value = storedRecords;
  }
  if (storedSummary) {
    summaryBaseUrlInput.value = storedSummary;
  }
  if (storedAttachments) {
    attachmentBaseUrlInput.value = storedAttachments;
  }
  if (storedConsult) {
    consultBaseUrlInput.value = storedConsult;
  }
}

function persistServiceUrls() {
  localStorage.setItem(serviceUrlStorageKeys.records, recordsBaseUrlInput.value.trim());
  localStorage.setItem(serviceUrlStorageKeys.summary, summaryBaseUrlInput.value.trim());
  localStorage.setItem(serviceUrlStorageKeys.attachments, attachmentBaseUrlInput.value.trim());
  localStorage.setItem(serviceUrlStorageKeys.consult, consultBaseUrlInput.value.trim());
}

function getBaseUrls() {
  return {
    records: recordsBaseUrlInput.value.trim().replace(/\/$/, ""),
    summary: summaryBaseUrlInput.value.trim().replace(/\/$/, ""),
    attachments: attachmentBaseUrlInput.value.trim().replace(/\/$/, ""),
    consult: consultBaseUrlInput.value.trim().replace(/\/$/, ""),
  };
}

async function parseResponse(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await parseResponse(response);
  if (!response.ok) {
    throw new Error(`GET ${url} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

function setPageStatus(online, message) {
  pageStatus.textContent = message;
  pageStatus.classList.remove("online", "offline");
  pageStatus.classList.add(online ? "online" : "offline");
}

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    consultId: params.get("consult_id") || "",
    mode: params.get("mode") || "save",
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

function formatDate(dateValue) {
  if (!dateValue) {
    return "Not available";
  }
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

function renderEmptyState(message) {
  recordLayout.innerHTML = `
    <article class="empty-state">
      <h2>No saved record selected yet.</h2>
      <p>${escapeHtml(message)}</p>
    </article>
  `;
}

function getFinalizedNote(encounter) {
  const notes = [...(encounter?.notes || [])].sort(
    (left, right) => new Date(right.reviewed_at || right.updated_at || right.created_at) - new Date(left.reviewed_at || left.updated_at || left.created_at),
  );
  return notes.find((note) => note.status === "finalized") || notes[0] || null;
}

function renderAttachments(attachments, attachmentBaseUrl) {
  if (!attachments.length) {
    return '<p class="side-copy">No supporting documents were attached for this consult.</p>';
  }

  return `
    <ul class="attachment-list">
      ${attachments
        .map(
          (attachment) => `
            <li>
              <a class="attachment-link" href="${escapeHtml(`${attachmentBaseUrl}/attachments/${attachment.id}/download`)}" target="_blank" rel="noreferrer">
                <strong>${escapeHtml(attachment.original_filename || "Attachment")}</strong><br />
                <span class="side-copy">${escapeHtml(attachment.file_kind || "supporting_document")}</span>
              </a>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderRecord(data, mode, attachmentBaseUrl) {
  const { consult, patient, summary, encounter, attachments, note } = data;
  const age = calculateAge(patient.birth_date);
  const statusLabel = mode === "refer" ? "Approved & referral-ready" : "Approved & saved";
  const bannerCopy =
    mode === "refer"
      ? "Referral handoff is ready for the next provider."
      : "Structured record is ready for reuse and follow-up.";
  const doctorName = encounter?.clinician_id ? encounter.clinician_id.replaceAll("-", " ") : "Dr. J. Reyes";
  const medications = encounter?.prescriptions?.length
    ? encounter.prescriptions.map((prescription) =>
        [
          prescription.medication_name,
          prescription.strength,
          prescription.dose,
          prescription.frequency,
          prescription.duration,
        ]
          .filter(Boolean)
          .join(" · "),
      )
    : [];
  const diagnoses = encounter?.diagnoses?.length
    ? encounter.diagnoses.map((diagnosis) =>
        [diagnosis.label, diagnosis.icd10_code, diagnosis.category].filter(Boolean).join(" · "),
      )
    : [];

  recordLayout.innerHTML = `
    <section class="top-banner">
      <div class="banner-copy">
        <strong>${escapeHtml(statusLabel)}</strong>
        <span>${escapeHtml(bannerCopy)}</span>
      </div>
      <div class="top-actions">
        <button class="ghost-button" type="button">Print</button>
        <button class="ghost-button" type="button">Export</button>
        <button class="primary-button" type="button">${mode === "refer" ? "Share referral" : "Share record"}</button>
      </div>
    </section>

    <section class="record-card">
      <div class="meta-grid">
        <article class="meta-card">
          <p class="section-label">Patient</p>
          <p class="meta-value">${escapeHtml(`${patient.given_name} ${patient.family_name}`)}${age ? ` · ${age}` : ""}${patient.sex_at_birth ? `, ${escapeHtml(patient.sex_at_birth)}` : ""}</p>
          <p class="meta-label">Date of visit</p>
          <p class="meta-value">${escapeHtml(formatDate(consult.finalized_at || consult.closed_at || encounter?.started_at || consult.created_at))}</p>
        </article>

        <article class="meta-card">
          <p class="section-label">Provider</p>
          <p class="meta-value">${escapeHtml(doctorName)}</p>
          <p class="meta-label">Visit type</p>
          <p class="meta-value">${escapeHtml(encounter?.encounter_type || "consultation")}</p>
        </article>
      </div>
    </section>

    <section class="record-card">
      <div class="record-grid">
        <div class="record-main">
          <article class="note-card">
            <p class="section-label">Consultation note</p>
            <div class="soap-block">
              <p class="section-label">S — Subjective</p>
              <p class="note-body">${escapeHtml(note?.subjective || "No subjective content saved.")}</p>
            </div>
            <div class="soap-block">
              <p class="section-label">O — Objective</p>
              <p class="note-body">${escapeHtml(note?.objective || "No objective content saved.")}</p>
            </div>
            <div class="soap-block">
              <p class="section-label">A — Assessment</p>
              <p class="note-body">${escapeHtml(note?.assessment || "No assessment content saved.")}</p>
            </div>
            <div class="soap-block">
              <p class="section-label">P — Plan</p>
              <p class="note-body">${escapeHtml(note?.plan || "No plan content saved.")}</p>
            </div>
          </article>

          <div class="meta-grid">
            <article class="meta-card">
              <p class="section-label">Diagnosis cues</p>
              <ul class="diagnosis-list">
                ${(diagnoses.length ? diagnoses : ["Doctor recorded no diagnosis for this visit."])
                  .map((diagnosis) => `<li class="list-copy">${escapeHtml(diagnosis)}</li>`)
                  .join("")}
              </ul>
            </article>

            <article class="meta-card">
              <p class="section-label">Prescriptions / active meds</p>
              <ul class="prescription-list">
                ${(medications.length ? medications : ["Doctor recorded no prescription for this visit."])
                  .map((medication) => `<li class="list-copy">${escapeHtml(medication)}</li>`)
                  .join("")}
              </ul>
            </article>
          </div>

          <article class="meta-card followup-card">
            <p class="section-label">Follow-up</p>
            <p class="meta-value">${escapeHtml(mode === "refer" ? "Referral package ready and follow-up handoff prepared." : "Record saved for follow-up review and future consults.")}</p>
          </article>
        </div>

        <div class="record-side">
          <div class="side-stack">
            <article class="meta-card signed-card">
              <p class="section-label">Signed by</p>
              <p class="meta-value">${escapeHtml(doctorName)}</p>
              <p class="signature-name">Reyes</p>
              <p class="side-copy">${escapeHtml(note?.reviewed_at ? `Signed ${formatDate(note.reviewed_at)}` : "Doctor approval captured")}</p>
            </article>

            <article class="meta-card">
              <p class="section-label">Consent trail</p>
              <ul class="consent-list">
                <li class="list-copy">Today's visit access granted by patient</li>
                <li class="list-copy">30-day follow-up access enabled for continuity of care</li>
                <li class="list-copy">${escapeHtml(mode === "refer" ? "Referral sharing prepared for referred specialist" : "No referral sharing requested in this save flow")}</li>
              </ul>
            </article>

            <article class="meta-card">
              <p class="section-label">Supporting documents</p>
              ${renderAttachments(attachments, attachmentBaseUrl)}
            </article>

            <article class="meta-card">
              <p class="section-label">Share</p>
              <div class="action-row">
                <button class="ghost-button" type="button">${mode === "refer" ? "Send referral letter" : "Generate patient copy"}</button>
                <button class="ghost-button" type="button">Forward to specialist</button>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  `;
}

async function loadRecord() {
  const urls = getBaseUrls();
  const consultId = consultIdInput.value.trim();
  const { mode } = getQueryParams();

  if (!urls.records || !urls.summary || !urls.attachments || !urls.consult || !consultId) {
    setPageStatus(false, "Consult session ID and all service URLs are required");
    renderEmptyState("Open this page from Review & Approve or paste a consult session ID above.");
    return;
  }

  persistServiceUrls();
  setPageStatus(false, "Loading saved record...");
  loadRecordButton.disabled = true;

  try {
    const consult = await fetchJson(`${urls.consult}/consult-sessions/${consultId}`);
    const [patient, summary, encounter, attachments] = await Promise.all([
      fetchJson(`${urls.records}/patients/${consult.patient_id}`),
      fetchJson(`${urls.summary}/patients/${consult.patient_id}/summary/latest`).catch(() => null),
      consult.encounter_id ? fetchJson(`${urls.records}/encounters/${consult.encounter_id}`) : Promise.resolve(null),
      consult.encounter_id
        ? fetchJson(`${urls.attachments}/encounters/${consult.encounter_id}/attachments`).catch(() => [])
        : fetchJson(`${urls.attachments}/patients/${consult.patient_id}/attachments`).catch(() => []),
    ]);

    const note = getFinalizedNote(encounter);
    renderRecord(
      {
        consult,
        patient,
        summary,
        encounter,
        attachments,
        note,
      },
      mode,
      urls.attachments,
    );
    backReviewLink.href = `./review-approve.html?consult_id=${encodeURIComponent(consult.id)}`;
    setPageStatus(true, "Saved record loaded");
  } catch (error) {
    renderEmptyState(error.message);
    setPageStatus(false, `Saved record error: ${error.message}`);
  } finally {
    loadRecordButton.disabled = false;
  }
}

loadRecordButton.addEventListener("click", loadRecord);

[recordsBaseUrlInput, summaryBaseUrlInput, attachmentBaseUrlInput, consultBaseUrlInput].forEach((input) => {
  input.addEventListener("change", persistServiceUrls);
});

async function bootstrap() {
  initializeStoredServiceUrls();
  const session = await window.MediVaultAuth?.requireDoctorSession();
  if (!session) {
    return;
  }

  const { consultId } = getQueryParams();
  if (consultId) {
    consultIdInput.value = consultId;
    loadRecord();
  }
}

bootstrap();
