const form = document.getElementById("intake-form");
const apiBaseUrlInput = document.getElementById("api-base-url");
const summaryApiBaseUrlInput = document.getElementById("summary-api-base-url");
const attachmentApiBaseUrlInput = document.getElementById("attachment-api-base-url");
const consultApiBaseUrlInput = document.getElementById("consult-api-base-url");
const checkApiButton = document.getElementById("check-api-button");
const addAttachmentButton = document.getElementById("add-attachment-button");
const attachmentList = document.getElementById("attachment-list");
const apiStatus = document.getElementById("api-status");
const submitButton = document.getElementById("submit-button");
const patientWelcome = document.getElementById("patient-welcome");
const patientLogoutButton = document.getElementById("patient-logout-button");

const previewName = document.getElementById("preview-name");
const previewSubtitle = document.getElementById("preview-subtitle");
const previewClinic = document.getElementById("preview-clinic");
const previewDoctor = document.getElementById("preview-doctor");
const previewChiefComplaint = document.getElementById("preview-chief-complaint");
const previewConsent = document.getElementById("preview-consent");
const notePreview = document.getElementById("note-preview");

const submissionState = document.getElementById("submission-state");
const resultPatientId = document.getElementById("result-patient-id");
const resultEncounterId = document.getElementById("result-encounter-id");
const resultNoteId = document.getElementById("result-note-id");
const resultSummaryId = document.getElementById("result-summary-id");
const resultSummaryVersion = document.getElementById("result-summary-version");
const resultConsultId = document.getElementById("result-consult-id");
const resultConsultStatus = document.getElementById("result-consult-status");
const resultAttachmentId = document.getElementById("result-attachment-id");
const resultAttachmentDownload = document.getElementById("result-attachment-download");
const requestLog = document.getElementById("request-log");

let attachmentRowCounter = 0;
const serviceUrlStorageKeys = {
  records: "medivault.recordsBaseUrl",
  summary: "medivault.summaryBaseUrl",
  attachment: "medivault.attachmentBaseUrl",
  consult: "medivault.consultBaseUrl",
  authToken: "medivault.authToken",
};

function redirectToPatientLogin() {
  window.location.replace("./login.html?portal=patient");
}

function clearAuthSession() {
  localStorage.removeItem(serviceUrlStorageKeys.authToken);
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

function applyPatientProfile(patient, session) {
  const fullName = session.full_name?.trim() || [patient.given_name, patient.family_name].filter(Boolean).join(" ") || "Patient";
  patientWelcome.textContent = `Welcome, ${fullName}.`;

  if (patient.given_name) {
    form.elements.givenName.value = patient.given_name;
  }
  if (patient.family_name) {
    form.elements.familyName.value = patient.family_name;
  }
  if (patient.birth_date) {
    form.elements.birthDate.value = patient.birth_date;
  }
  if (patient.sex_at_birth) {
    form.elements.sexAtBirth.value = patient.sex_at_birth;
  }
  if (patient.mobile_number) {
    form.elements.mobileNumber.value = patient.mobile_number;
  }
}

async function requirePatientSession() {
  const token = localStorage.getItem(serviceUrlStorageKeys.authToken);
  const baseUrl = apiBaseUrlInput.value.trim().replace(/\/$/, "");

  if (!token || !baseUrl) {
    clearAuthSession();
    redirectToPatientLogin();
    return false;
  }

  try {
    const session = await fetchJson(`${baseUrl}/auth/sessions/${encodeURIComponent(token)}`);
    if (session.role === "doctor") {
      window.location.replace("./doctor-dashboard.html");
      return false;
    }
    if (session.role !== "patient" || !session.patient_id) {
      clearAuthSession();
      redirectToPatientLogin();
      return false;
    }

    const patient = await fetchJson(`${baseUrl}/patients/${encodeURIComponent(session.patient_id)}`);
    applyPatientProfile(patient, session);
    document.body.classList.remove("auth-pending");
    document.body.classList.add("auth-ready");
    return true;
  } catch (error) {
    console.warn("Patient session validation failed", error);
    clearAuthSession();
    redirectToPatientLogin();
    return false;
  }
}

function initializeStoredServiceUrls() {
  const storedRecords = localStorage.getItem(serviceUrlStorageKeys.records);
  const storedSummary = localStorage.getItem(serviceUrlStorageKeys.summary);
  const storedAttachment = localStorage.getItem(serviceUrlStorageKeys.attachment);
  const storedConsult = localStorage.getItem(serviceUrlStorageKeys.consult);

  if (storedRecords) {
    apiBaseUrlInput.value = storedRecords;
  }
  if (storedSummary) {
    summaryApiBaseUrlInput.value = storedSummary;
  }
  if (storedAttachment) {
    attachmentApiBaseUrlInput.value = storedAttachment;
  }
  if (storedConsult) {
    consultApiBaseUrlInput.value = storedConsult;
  }
}

function persistServiceUrls() {
  localStorage.setItem(serviceUrlStorageKeys.records, apiBaseUrlInput.value.trim());
  localStorage.setItem(serviceUrlStorageKeys.summary, summaryApiBaseUrlInput.value.trim());
  localStorage.setItem(serviceUrlStorageKeys.attachment, attachmentApiBaseUrlInput.value.trim());
  localStorage.setItem(serviceUrlStorageKeys.consult, consultApiBaseUrlInput.value.trim());
}

function parseLines(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readForm() {
  const data = new FormData(form);

  return {
    apiBaseUrl: (data.get("apiBaseUrl") || "").toString().trim().replace(/\/$/, ""),
    summaryApiBaseUrl: (data.get("summaryApiBaseUrl") || "").toString().trim().replace(/\/$/, ""),
    attachmentApiBaseUrl: (data.get("attachmentApiBaseUrl") || "").toString().trim().replace(/\/$/, ""),
    consultApiBaseUrl: (data.get("consultApiBaseUrl") || "").toString().trim().replace(/\/$/, ""),
    clinicName: (data.get("clinicName") || "").toString().trim(),
    doctorName: (data.get("doctorName") || "").toString().trim(),
    givenName: (data.get("givenName") || "").toString().trim(),
    familyName: (data.get("familyName") || "").toString().trim(),
    birthDate: (data.get("birthDate") || "").toString().trim(),
    sexAtBirth: (data.get("sexAtBirth") || "").toString().trim(),
    mobileNumber: (data.get("mobileNumber") || "").toString().trim(),
    clinicianId: (data.get("clinicianId") || "").toString().trim(),
    chiefComplaint: (data.get("chiefComplaint") || "").toString().trim(),
    symptoms: parseLines((data.get("symptoms") || "").toString()),
    medications: parseLines((data.get("medications") || "").toString()),
    allergies: parseLines((data.get("allergies") || "").toString()),
    history: (data.get("history") || "").toString().trim(),
    shareToday: data.get("shareToday") === "on",
    followUpAccess: data.get("followUpAccess") === "on",
    shareSpecialists: data.get("shareSpecialists") === "on",
    researchConsent: data.get("researchConsent") === "on",
    attachments: collectAttachments(),
  };
}

function collectAttachments() {
  return Array.from(document.querySelectorAll(".attachment-row"))
    .map((row) => {
      const type = row.querySelector(".attachment-kind")?.value?.trim() || "other";
      const uploadedBy = row.querySelector(".attachment-uploaded-by")?.value?.trim() || "patient-intake-ui";
      const fileInput = row.querySelector(".attachment-file");
      const file = fileInput?.files?.[0] || null;
      const pendingAttachmentId = row.dataset.pendingAttachmentId || "";
      const pendingDownloadUrl = row.dataset.pendingDownloadUrl || "";

      return {
        rowId: row.dataset.rowId,
        type,
        uploadedBy,
        file,
        pendingAttachmentId,
        pendingDownloadUrl,
      };
    })
    .filter((item) => (item.file && item.file.size > 0) || item.pendingAttachmentId);
}

function setAttachmentRowStatus(row, tone, message, linkUrl = "") {
  const status = row.querySelector(".attachment-upload-status");
  const link = row.querySelector(".attachment-upload-link");
  if (status) {
    status.className = `attachment-upload-status ${tone}`;
    status.textContent = message;
  }
  if (link) {
    if (linkUrl) {
      link.innerHTML = `<a href="${linkUrl}" target="_blank" rel="noreferrer">Preview uploaded file</a>`;
    } else {
      link.textContent = "";
    }
  }
}

function clearAttachmentUploadState(row, message = "Not uploaded yet.") {
  row.dataset.pendingAttachmentId = "";
  row.dataset.pendingDownloadUrl = "";
  setAttachmentRowStatus(row, "idle", message);
}

async function deletePendingAttachment(row) {
  const pendingAttachmentId = row.dataset.pendingAttachmentId || "";
  if (!pendingAttachmentId) {
    return;
  }

  const attachmentBaseUrl = attachmentApiBaseUrlInput.value.trim().replace(/\/$/, "");
  try {
    await fetch(`${attachmentBaseUrl}/pending-attachments/${pendingAttachmentId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.warn("Failed to delete pending attachment", error);
  }
}

async function invalidateAttachmentRow(row, message) {
  if (row.dataset.pendingAttachmentId) {
    await deletePendingAttachment(row);
  }
  clearAttachmentUploadState(row, message);
}

async function uploadPendingAttachment(row) {
  const attachmentBaseUrl = attachmentApiBaseUrlInput.value.trim().replace(/\/$/, "");
  const uploadButton = row.querySelector(".attachment-upload-button");
  const type = row.querySelector(".attachment-kind")?.value?.trim() || "other";
  const uploadedBy = row.querySelector(".attachment-uploaded-by")?.value?.trim() || "patient-intake-ui";
  const file = row.querySelector(".attachment-file")?.files?.[0] || null;

  if (!attachmentBaseUrl) {
    throw new Error("Attachment service base URL is required");
  }
  if (!file || file.size === 0) {
    throw new Error("Choose a file before uploading this attachment");
  }

  uploadButton.disabled = true;
  setAttachmentRowStatus(row, "uploading", "Uploading to local object storage...");

  try {
    if (row.dataset.pendingAttachmentId) {
      await deletePendingAttachment(row);
      clearAttachmentUploadState(row);
    }

    const payload = new FormData();
    payload.append("file_kind", type);
    payload.append("uploaded_by", uploadedBy);
    payload.append("file", file);

    const response = await fetch(`${attachmentBaseUrl}/pending-attachments`, {
      method: "POST",
      body: payload,
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(
        `POST ${attachmentBaseUrl}/pending-attachments failed (${response.status}): ${JSON.stringify(body)}`,
      );
    }

    row.dataset.pendingAttachmentId = body.pending_attachment.id;
    row.dataset.pendingDownloadUrl = `${attachmentBaseUrl}${body.download_url}`;
    setAttachmentRowStatus(row, "uploaded", `Uploaded: ${body.pending_attachment.original_filename || file.name}`, row.dataset.pendingDownloadUrl);
    updatePreview();
    return body;
  } finally {
    uploadButton.disabled = false;
  }
}

function createAttachmentRow() {
  attachmentRowCounter += 1;
  const row = document.createElement("div");
  row.className = "attachment-row";
  row.dataset.rowId = String(attachmentRowCounter);
  row.dataset.pendingAttachmentId = "";
  row.dataset.pendingDownloadUrl = "";
  row.innerHTML = `
    <div class="attachment-row-header">
      <strong>Attachment ${attachmentRowCounter}</strong>
      <div class="attachment-row-buttons">
        <button class="secondary-button attachment-upload-button" type="button">Upload now</button>
        <button class="attachment-remove-button" type="button">Remove</button>
      </div>
    </div>
    <div class="form-grid">
      <label class="field">
        <span>Attachment type</span>
        <select class="attachment-kind">
          <option value="lab_result">Lab result</option>
          <option value="prescription_photo">Prescription photo</option>
          <option value="medical_record">Medical record</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label class="field">
        <span>Uploaded by</span>
        <input class="attachment-uploaded-by" type="text" value="patient-intake-ui" />
      </label>
    </div>
    <label class="field">
      <span>Choose a file</span>
      <input class="attachment-file" type="file" />
    </label>
    <p class="attachment-upload-status idle">Not uploaded yet.</p>
    <div class="attachment-upload-link"></div>
  `;

  row.querySelector(".attachment-upload-button")?.addEventListener("click", async () => {
    try {
      await uploadPendingAttachment(row);
    } catch (error) {
      setAttachmentRowStatus(row, "error", error.message);
    }
  });

  row.querySelector(".attachment-remove-button")?.addEventListener("click", async () => {
    await deletePendingAttachment(row);
    row.remove();
    if (!attachmentList.children.length) {
      attachmentList.appendChild(createAttachmentRow());
    }
    updatePreview();
  });

  row.querySelectorAll("input, select").forEach((element) => {
    element.addEventListener("input", async () => {
      if (row.dataset.pendingAttachmentId) {
        await invalidateAttachmentRow(row, "Changed after upload. Upload again.");
      }
      updatePreview();
    });
    element.addEventListener("change", async () => {
      if (row.dataset.pendingAttachmentId) {
        await invalidateAttachmentRow(row, "Changed after upload. Upload again.");
      }
      updatePreview();
    });
  });

  return row;
}

function buildNoteText(values) {
  const symptomBlock = values.symptoms.length ? values.symptoms.map((item) => `- ${item}`).join("\n") : "- None entered";
  const medicationBlock = values.medications.length
    ? values.medications.map((item) => `- ${item}`).join("\n")
    : "- None entered";
  const allergyBlock = values.allergies.length ? values.allergies.map((item) => `- ${item}`).join("\n") : "- None entered";

  const consentLines = [
    values.shareToday ? "- Shared with today's doctor" : "- Not shared with today's doctor",
    values.followUpAccess ? "- 30-day follow-up access enabled" : "- No follow-up access",
    values.shareSpecialists ? "- Specialist sharing allowed" : "- Specialist sharing disabled",
    values.researchConsent ? "- Anonymized research use allowed" : "- No research sharing",
  ];

  return `Symptoms:\n${symptomBlock}\n\nMedications:\n${medicationBlock}\n\nAllergies:\n${allergyBlock}\n\nHistory:\n${values.history || "No extra history entered."}\n\nConsent:\n${consentLines.join("\n")}`;
}

function updatePreview() {
  const values = readForm();

  previewName.textContent = `${values.givenName || "Patient"} is almost checked in.`;
  previewSubtitle.textContent = `${values.doctorName || "The doctor"} will receive this summary before the consultation begins.`;
  previewClinic.textContent = values.clinicName || "Clinic not set";
  previewDoctor.textContent = values.doctorName || "Doctor not set";
  previewChiefComplaint.textContent = values.chiefComplaint || "No chief complaint yet";
  previewConsent.textContent = values.attachments.length
    ? `${values.attachments.length} attachment${values.attachments.length > 1 ? "s" : ""} ready`
    : values.followUpAccess
      ? "Active for 30 days"
      : "Visit-only access";
  notePreview.textContent = buildNoteText(values);
}

function setApiStatus(online, message) {
  apiStatus.textContent = message;
  apiStatus.classList.remove("online", "offline");
  apiStatus.classList.add(online ? "online" : "offline");
}

async function checkApi() {
  const baseUrl = apiBaseUrlInput.value.trim().replace(/\/$/, "");
  const summaryBaseUrl = summaryApiBaseUrlInput.value.trim().replace(/\/$/, "");
  const attachmentBaseUrl = attachmentApiBaseUrlInput.value.trim().replace(/\/$/, "");
  const consultBaseUrl = consultApiBaseUrlInput.value.trim().replace(/\/$/, "");
  if (!baseUrl || !summaryBaseUrl || !attachmentBaseUrl || !consultBaseUrl) {
    setApiStatus(false, "All base URLs required");
    return;
  }

  setApiStatus(false, "Checking services...");
  persistServiceUrls();

  try {
    const [recordsResponse, summaryResponse, attachmentResponse, consultResponse] = await Promise.all([
      fetch(`${baseUrl}/health`),
      fetch(`${summaryBaseUrl}/health`),
      fetch(`${attachmentBaseUrl}/health`),
      fetch(`${consultBaseUrl}/health`),
    ]);
    if (!recordsResponse.ok) {
      throw new Error(`Records healthcheck failed with status ${recordsResponse.status}`);
    }
    if (!summaryResponse.ok) {
      throw new Error(`Summary healthcheck failed with status ${summaryResponse.status}`);
    }
    if (!attachmentResponse.ok) {
      throw new Error(`Attachment healthcheck failed with status ${attachmentResponse.status}`);
    }
    if (!consultResponse.ok) {
      throw new Error(`Consult healthcheck failed with status ${consultResponse.status}`);
    }
    const recordsPayload = await recordsResponse.json();
    const summaryPayload = await summaryResponse.json();
    const attachmentPayload = await attachmentResponse.json();
    const consultPayload = await consultResponse.json();
    setApiStatus(
      true,
      `Records: ${recordsPayload.status} | Summary: ${summaryPayload.status} | Attachment: ${attachmentPayload.status} | Consult: ${consultPayload.status}`,
    );
  } catch (error) {
    setApiStatus(false, `Service error: ${error.message}`);
  }
}

async function sendJson(url, method, payload) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${method} ${url} failed (${response.status}): ${JSON.stringify(body)}`);
  }

  return body;
}

async function handleSubmit(event) {
  event.preventDefault();
  const values = readForm();
  const noteText = buildNoteText(values);
  persistServiceUrls();
  const attachmentsWaitingForUpload = values.attachments.filter((item) => item.file && !item.pendingAttachmentId);

  if (attachmentsWaitingForUpload.length > 0) {
    submissionState.className = "submission-state error";
    submissionState.textContent = "Upload each selected attachment first, then submit the intake.";
    requestLog.textContent = JSON.stringify(
      {
        pendingUploadsMissing: attachmentsWaitingForUpload.map((item) => ({
          rowId: item.rowId,
          type: item.type,
          fileName: item.file?.name || null,
        })),
      },
      null,
      2,
    );
    return;
  }

  submitButton.disabled = true;
  submissionState.className = "submission-state";
  submissionState.textContent = "Submitting intake to records service...";
  requestLog.textContent = "Sending request sequence...";

  try {
    const patientPayload = {
      given_name: values.givenName,
      family_name: values.familyName,
      birth_date: values.birthDate || null,
      sex_at_birth: values.sexAtBirth || null,
      mobile_number: values.mobileNumber || null,
    };

    const patient = await sendJson(`${values.apiBaseUrl}/patients`, "POST", patientPayload);

    const summaryPayload = {
      allergies: values.allergies,
      active_medications: values.medications,
      chronic_conditions: [],
      past_procedures: [],
      last_known_vitals: {},
      summary_text: noteText,
      source: "patient_intake_demo",
      updated_by: "patient-intake-ui",
    };

    const summary = await sendJson(
      `${values.summaryApiBaseUrl}/patients/${patient.id}/summary`,
      "PUT",
      summaryPayload,
    );

    const encounterPayload = {
      patient_id: patient.id,
      clinician_id: values.clinicianId,
      chief_complaint: values.chiefComplaint,
      source: "patient_intake_demo",
    };

    const encounter = await sendJson(`${values.apiBaseUrl}/encounters`, "POST", encounterPayload);

    const consultSession = await sendJson(`${values.consultApiBaseUrl}/consult-sessions`, "POST", {
      patient_id: patient.id,
      encounter_id: encounter.id,
      clinician_id: values.clinicianId,
      chief_complaint: values.chiefComplaint,
      created_by: "patient-intake-ui",
      source: "patient_intake_demo",
    });

    const consultSessionAfterIntake = await sendJson(
      `${values.consultApiBaseUrl}/consult-sessions/${consultSession.id}/events`,
      "POST",
      {
        event_type: "intake_completed",
        actor_id: "patient-intake-ui",
        payload: {
          summary_id: summary.id,
          intake_source: "patient_intake_demo",
        },
      },
    );

    const notePayload = {
      source: "patient_intake_demo",
      authored_by: "patient-intake-ui",
      subjective: noteText,
      assessment: `Pre-consult intake for ${values.doctorName} at ${values.clinicName}.`,
      plan: "Pending doctor review and in-consultation validation.",
    };

    const note = await sendJson(
      `${values.apiBaseUrl}/encounters/${encounter.id}/notes`,
      "POST",
      notePayload,
    );

    let attachmentResponse = [];
    const selectedFileInfo = values.attachments.map((item) => ({
      type: item.type,
      uploadedBy: item.uploadedBy,
      name: item.file?.name || null,
      size: item.file?.size || null,
      mimeType: item.file?.type || null,
      pendingAttachmentId: item.pendingAttachmentId || null,
    }));
    const committedPendingIds = values.attachments
      .map((item) => item.pendingAttachmentId)
      .filter(Boolean);
    if (committedPendingIds.length > 0) {
      attachmentResponse = await sendJson(`${values.attachmentApiBaseUrl}/attachments/commit`, "POST", {
        patient_id: patient.id,
        encounter_id: encounter.id,
        pending_attachment_ids: committedPendingIds,
      });
      resultAttachmentId.textContent = attachmentResponse.map((item) => item.attachment.id).join(", ");
      resultAttachmentDownload.innerHTML = attachmentResponse
        .map(
          (item, index) =>
            `<a href="${values.attachmentApiBaseUrl}${item.download_url}" target="_blank" rel="noreferrer">Open file ${index + 1}</a>`,
        )
        .join("<br />");

      document.querySelectorAll(".attachment-row").forEach((row) => {
        if (row.dataset.pendingAttachmentId) {
          row.querySelector(".attachment-file").value = "";
          row.dataset.pendingAttachmentId = "";
          row.dataset.pendingDownloadUrl = "";
          setAttachmentRowStatus(row, "uploaded", "Linked to the saved intake.");
        }
      });
    } else {
      resultAttachmentId.textContent = "No attachments uploaded";
      resultAttachmentDownload.textContent = "No attachments uploaded";
    }

    resultPatientId.textContent = patient.id;
    resultEncounterId.textContent = encounter.id;
    resultNoteId.textContent = note.id;
    resultSummaryId.textContent = summary.id;
    resultSummaryVersion.textContent = String(summary.summary_version);
    resultConsultId.textContent = consultSession.id;
    resultConsultStatus.textContent = consultSessionAfterIntake.status;

    submissionState.className = "submission-state success";
    submissionState.textContent =
      "Intake saved. Patient, summary, encounter, consult session, draft note, and any pre-uploaded attachments are now linked.";
    requestLog.textContent = JSON.stringify(
      {
        selectedFileInfo,
        patientPayload,
        patientResponse: patient,
        summaryPayload,
        summaryResponse: summary,
        encounterPayload,
        encounterResponse: encounter,
        consultSessionResponse: consultSession,
        consultSessionAfterIntake,
        notePayload,
        noteResponse: note,
        attachmentResponse,
      },
      null,
      2,
    );
  } catch (error) {
    submissionState.className = "submission-state error";
    submissionState.textContent = error.message;
    requestLog.textContent = error.stack || error.message;
  } finally {
    submitButton.disabled = false;
  }
}

checkApiButton.addEventListener("click", checkApi);
addAttachmentButton.addEventListener("click", () => {
  attachmentList.appendChild(createAttachmentRow());
});
form.addEventListener("input", updatePreview);
form.addEventListener("submit", handleSubmit);
patientLogoutButton.addEventListener("click", () => {
  clearAuthSession();
  redirectToPatientLogin();
});

async function bootstrap() {
  initializeStoredServiceUrls();
  attachmentList.appendChild(createAttachmentRow());

  const isAuthorized = await requirePatientSession();
  if (!isAuthorized) {
    return;
  }

  updatePreview();
}

bootstrap();
