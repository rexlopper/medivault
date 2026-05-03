const recordsBaseUrlInput = document.getElementById("records-base-url");
const summaryBaseUrlInput = document.getElementById("summary-base-url");
const consultBaseUrlInput = document.getElementById("consult-base-url");
const consultIdInput = document.getElementById("consult-id-input");
const loadAssistantButton = document.getElementById("load-assistant-button");
const backSummaryLink = document.getElementById("back-summary-link");
const pageStatus = document.getElementById("page-status");
const assistantLayout = document.getElementById("assistant-layout");

const serviceUrlStorageKeys = {
  records: "medivault.recordsBaseUrl",
  summary: "medivault.summaryBaseUrl",
  consult: "medivault.consultBaseUrl",
};

let transcriptTimer = null;

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

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
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

function getConsultIdFromUrl() {
  return new URLSearchParams(window.location.search).get("consult_id") || "";
}

function clearTranscriptSimulation() {
  if (transcriptTimer) {
    clearInterval(transcriptTimer);
    transcriptTimer = null;
  }
}

function buildFakeTranscript(patient, consult, summary) {
  const firstName = patient.given_name || "Pasyente";
  const complaint = (consult.chief_complaint || "iyong nararamdaman").toLowerCase();
  const topAllergy = (summary?.allergies?.[0] || "wala pang nabanggit na allergy").toLowerCase();
  const topMedication = (summary?.active_medications?.[0] || "wala pang maintenance na nailista").toLowerCase();

  return [
    { speaker: "doctor", text: `Magandang umaga, ${firstName}. Kumusta ang pakiramdam mo mula noong pinaschedule natin itong consult?` },
    { speaker: "patient", text: `Doc, ilang araw na po akong may ${complaint} at pabalik-balik po siya.` },
    { speaker: "doctor", text: "May kasama ba itong hilo, pagsusuka, o pagbabago sa paningin?" },
    { speaker: "patient", text: "Mas madalas po iyong hilo at pagod, lalo na sa umaga." },
    { speaker: "doctor", text: `Ini-inom mo pa rin ba nang regular ang ${topMedication}?` },
    { speaker: "patient", text: "May ilang dose po akong hindi nainom noong nakaraang linggo kasi naubusan ako sa bahay." },
    { speaker: "doctor", text: `Sige, noted iyon. Isasaalang-alang din natin ang ${topAllergy} habang binubuo natin ang susunod na plano.` },
  ];
}

function buildSoapDraft(patient, consult, summary) {
  const complaint = consult.chief_complaint || "headache and fatigue";
  const meds = (summary?.active_medications || []).join(", ") || "No maintenance medications listed";
  const allergies = (summary?.allergies || []).join(", ") || "No allergies recorded";
  const conditions = (summary?.chronic_conditions || []).join(", ") || "History still being gathered";

  return {
    subjective: [
      `Patient reports ${complaint.toLowerCase()}.`,
      "Symptoms appear intermittent and more noticeable in the morning.",
      `Medication context from intake: ${meds}.`,
    ].join(" "),
    objective: "Will populate from exam findings once the consult progresses.",
    assessment: `Likely working problems include symptom burden related to ${conditions.toLowerCase()}. Continue gathering context while the live transcript runs.`,
    plan: `Review adherence, verify triggers, and confirm safe treatment options given allergies: ${allergies.toLowerCase()}.`,
  };
}

function renderAssistant(data) {
  clearTranscriptSimulation();

  const { consult, patient, summary, encounter } = data;
  const age = calculateAge(patient.birth_date);
  const initials = `${patient.given_name?.[0] || ""}${patient.family_name?.[0] || ""}`.toUpperCase();
  const transcriptLines = buildFakeTranscript(patient, consult, summary);
  const soapDraft = buildSoapDraft(patient, consult, summary);
  const reviewUrl = `./review-approve.html?consult_id=${encodeURIComponent(consult.id)}`;

  assistantLayout.innerHTML = `
    <section class="assistant-card">
      <header class="assistant-header">
        <div class="patient-header">
          <span class="patient-badge">${escapeHtml(initials || "MV")}</span>
          <div>
            <h2>${escapeHtml(`${patient.given_name} ${patient.family_name}`)} · ${age ?? "?"}</h2>
            <p class="patient-copy">${escapeHtml(consult.chief_complaint || encounter?.chief_complaint || "No chief complaint recorded")}</p>
          </div>
        </div>
        <div class="header-actions">
          <span class="draft-badge">Draft — not saved</span>
          <a class="primary-button" href="${escapeHtml(reviewUrl)}">Review note</a>
        </div>
      </header>

      <div class="assistant-grid">
        <section class="panel-card">
          <div class="action-row">
            <span class="recording-chip"><span class="recording-dot"></span>Recording</span>
          </div>
          <div class="transcript-stack" id="transcript-container">
            <div class="transcript-line">
              <span class="speaker-tag">Doctor</span>
              <p>Listening for the first lines of the consultation...</p>
            </div>
          </div>
          <div class="action-row">
            <button class="ghost-button" type="button" id="pause-transcript-button">Pause</button>
            <span class="helper-copy">Suggest follow-up</span>
          </div>
        </section>

        <section class="panel-card">
          <div class="soap-header">
            <div>
              <p class="section-label">SOAP draft</p>
              <h3>Auto-generating</h3>
            </div>
            <span class="soap-tag">AI draft</span>
          </div>

          <div class="soap-stack">
            <article class="soap-card subjective">
              <p class="soap-label">S — Subjective</p>
              <p class="soap-content" id="soap-subjective">Listening...</p>
            </article>
            <article class="soap-card">
              <p class="soap-label">O — Objective</p>
              <p class="soap-placeholder" id="soap-objective">Will populate from exam findings...</p>
            </article>
            <article class="soap-card">
              <p class="soap-label">A — Assessment</p>
              <p class="soap-placeholder" id="soap-assessment">Generating once enough context is gathered...</p>
            </article>
            <article class="soap-card">
              <p class="soap-label">P — Plan</p>
              <p class="soap-placeholder" id="soap-plan">Suggested plan will appear here...</p>
            </article>
          </div>
        </section>
      </div>
    </section>
  `;

  backSummaryLink.href = `./previsit-summary.html?consult_id=${encodeURIComponent(consult.id)}`;

  const transcriptContainer = document.getElementById("transcript-container");
  const subjectiveNode = document.getElementById("soap-subjective");
  const objectiveNode = document.getElementById("soap-objective");
  const assessmentNode = document.getElementById("soap-assessment");
  const planNode = document.getElementById("soap-plan");
  const pauseButton = document.getElementById("pause-transcript-button");

  let transcriptIndex = 0;
  let paused = false;

  function appendTranscriptLine(line) {
    const wrapper = document.createElement("div");
    wrapper.className = "transcript-line";
    wrapper.innerHTML = `
      <span class="speaker-tag ${line.speaker === "patient" ? "patient" : ""}">${escapeHtml(line.speaker)}</span>
      <p>${escapeHtml(line.text)}</p>
    `;
    transcriptContainer.appendChild(wrapper);
  }

  function updateSoapDraft() {
    if (transcriptIndex >= 2) {
      subjectiveNode.textContent = soapDraft.subjective;
      subjectiveNode.className = "soap-content";
    }
    if (transcriptIndex >= 4) {
      objectiveNode.textContent = soapDraft.objective;
      objectiveNode.className = "soap-content";
    }
    if (transcriptIndex >= 5) {
      assessmentNode.textContent = soapDraft.assessment;
      assessmentNode.className = "soap-content";
    }
    if (transcriptIndex >= 6) {
      planNode.textContent = soapDraft.plan;
      planNode.className = "soap-content";
    }
  }

  transcriptContainer.innerHTML = "";
  appendTranscriptLine(transcriptLines[0]);
  transcriptIndex = 1;
  updateSoapDraft();

  transcriptTimer = setInterval(() => {
    if (paused) {
      return;
    }
    if (transcriptIndex < transcriptLines.length) {
      appendTranscriptLine(transcriptLines[transcriptIndex]);
      transcriptIndex += 1;
      updateSoapDraft();
      return;
    }

    const dots = document.createElement("div");
    dots.className = "transcript-dots";
    dots.innerHTML = "<span></span><span></span><span></span>";
    transcriptContainer.appendChild(dots);
    clearTranscriptSimulation();
  }, 1500);

  pauseButton?.addEventListener("click", () => {
    paused = !paused;
    pauseButton.textContent = paused ? "Resume" : "Pause";
  });
}

function renderEmptyState(message) {
  assistantLayout.innerHTML = `
    <article class="empty-state">
      <h2>No consult selected yet.</h2>
      <p>${escapeHtml(message)}</p>
    </article>
  `;
}

async function loadAssistant() {
  const urls = getBaseUrls();
  const consultId = consultIdInput.value.trim();
  if (!urls.records || !urls.summary || !urls.consult || !consultId) {
    setPageStatus(false, "Consult session ID and all service URLs are required");
    renderEmptyState("Open this page from the pre-visit summary or paste a consult session ID above.");
    return;
  }

  persistServiceUrls();
  setPageStatus(false, "Loading AI note assistant...");
  loadAssistantButton.disabled = true;

  try {
    const consult = await fetchJson(`${urls.consult}/consult-sessions/${consultId}`);
    const [patient, summary, encounter] = await Promise.all([
      fetchJson(`${urls.records}/patients/${consult.patient_id}`),
      fetchJson(`${urls.summary}/patients/${consult.patient_id}/summary/latest`).catch(() => null),
      consult.encounter_id ? fetchJson(`${urls.records}/encounters/${consult.encounter_id}`).catch(() => null) : Promise.resolve(null),
    ]);

    renderAssistant({
      consult,
      patient,
      summary,
      encounter,
    });
    setPageStatus(true, "AI note assistant loaded");
  } catch (error) {
    clearTranscriptSimulation();
    renderEmptyState(error.message);
    setPageStatus(false, `AI assistant error: ${error.message}`);
  } finally {
    loadAssistantButton.disabled = false;
  }
}

loadAssistantButton.addEventListener("click", loadAssistant);

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
    loadAssistant();
  }
}

bootstrap();
