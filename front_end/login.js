const recordsBaseUrlInput = document.getElementById("records-base-url");
const checkAuthButton = document.getElementById("check-auth-button");
const authStatus = document.getElementById("auth-status");
const registerForm = document.getElementById("register-form");
const doctorRegisterForm = document.getElementById("doctor-register-form");
const loginForm = document.getElementById("login-form");
const sessionState = document.getElementById("session-state");
const authLog = document.getElementById("auth-log");
const refreshSessionButton = document.getElementById("refresh-session-button");
const clearSessionButton = document.getElementById("clear-session-button");
const portalEyebrow = document.getElementById("portal-eyebrow");
const portalTitle = document.getElementById("portal-title");
const portalCopy = document.getElementById("portal-copy");
const patientRegisterPanel = document.getElementById("patient-register-panel");
const doctorRegisterPanel = document.getElementById("doctor-register-panel");

const storageKeys = {
  records: "medivault.recordsBaseUrl",
  authToken: "medivault.authToken",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function initializeStoredValues() {
  const storedRecords = localStorage.getItem(storageKeys.records);
  if (storedRecords) {
    recordsBaseUrlInput.value = storedRecords;
  }
}

function persistBaseUrl() {
  localStorage.setItem(storageKeys.records, recordsBaseUrlInput.value.trim());
}

function getBaseUrl() {
  return recordsBaseUrlInput.value.trim().replace(/\/$/, "");
}

function getPortalMode() {
  return new URLSearchParams(window.location.search).get("portal") || "general";
}

function portalDestinationForSession(session) {
  if (session.role === "doctor") {
    return "./doctor-dashboard.html";
  }
  if (session.role === "patient") {
    return "./intake-demo.html";
  }
  return "./index.html";
}

function applyPortalMode() {
  const portal = getPortalMode();
  if (portal === "patient") {
    portalEyebrow.textContent = "Patient Portal";
    portalTitle.textContent = "Sign in as a patient and continue your care journey.";
    portalCopy.textContent =
      "Use this flow for patient registration, patient login, and access to the patient-side intake and records experience.";
    patientRegisterPanel.classList.remove("hidden-panel");
    doctorRegisterPanel.classList.add("hidden-panel");
    return;
  }
  if (portal === "doctor") {
    portalEyebrow.textContent = "Doctor Portal";
    portalTitle.textContent = "Sign in as a doctor or clinic user and open the worklist.";
    portalCopy.textContent =
      "Use this flow for B2B clinic users, doctors, and staff who need dashboard access, review tools, and consult workflow pages.";
    patientRegisterPanel.classList.add("hidden-panel");
    doctorRegisterPanel.classList.remove("hidden-panel");
    return;
  }
  patientRegisterPanel.classList.remove("hidden-panel");
  doctorRegisterPanel.classList.remove("hidden-panel");
}

async function parseResponse(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await parseResponse(response);
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function postJson(url, payload) {
  return requestJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function setAuthStatus(online, message) {
  authStatus.textContent = message;
  authStatus.classList.remove("online", "offline");
  authStatus.classList.add(online ? "online" : "offline");
}

function setAuthLog(title, payload) {
  authLog.textContent = `${title}\n\n${JSON.stringify(payload, null, 2)}`;
}

function saveSession(session) {
  localStorage.setItem(storageKeys.authToken, session.token);
}

function clearSession() {
  localStorage.removeItem(storageKeys.authToken);
}

function renderSession(session) {
  if (!session) {
    sessionState.innerHTML = "<p>No saved session yet.</p>";
    return;
  }

  sessionState.innerHTML = `
    <p><strong>${escapeHtml(session.full_name)}</strong></p>
    <p>Role: ${escapeHtml(session.role)}</p>
    <p>User ID: ${escapeHtml(session.user_id)}</p>
    <p>${session.patient_id ? `Patient ID: ${escapeHtml(session.patient_id)}` : "No linked patient profile"}</p>
    <p>${session.doctor_id ? `Doctor ID: ${escapeHtml(session.doctor_id)}` : "No linked doctor profile"}</p>
    <p>Expires: ${escapeHtml(new Date(session.expires_at).toLocaleString())}</p>
  `;
}

async function refreshSession() {
  const token = localStorage.getItem(storageKeys.authToken);
  if (!token) {
    renderSession(null);
    setAuthStatus(false, "No saved session token");
    return;
  }

  try {
    const session = await requestJson(`${getBaseUrl()}/auth/sessions/${encodeURIComponent(token)}`);
    renderSession(session);
    setAuthLog("Session lookup", session);
    setAuthStatus(true, "Session is active");
  } catch (error) {
    renderSession(null);
    setAuthStatus(false, `Session error: ${error.message}`);
  }
}

checkAuthButton.addEventListener("click", async () => {
  persistBaseUrl();
  try {
    const health = await requestJson(`${getBaseUrl()}/health`);
    setAuthStatus(true, `Auth ready: ${health.status}`);
    setAuthLog("Health check", health);
  } catch (error) {
    setAuthStatus(false, `Health error: ${error.message}`);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  persistBaseUrl();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const session = await postJson(`${getBaseUrl()}/auth/register-patient`, payload);
    saveSession(session);
    renderSession(session);
    setAuthLog("Patient registration", session);
    setAuthStatus(true, "Patient registered and logged in");
    window.location.href = portalDestinationForSession(session);
  } catch (error) {
    setAuthStatus(false, `Registration error: ${error.message}`);
  }
});

doctorRegisterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  persistBaseUrl();
  const formData = new FormData(doctorRegisterForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const session = await postJson(`${getBaseUrl()}/auth/register-doctor`, payload);
    saveSession(session);
    renderSession(session);
    setAuthLog("Doctor registration", session);
    setAuthStatus(true, "Doctor registered and logged in");
    window.location.href = portalDestinationForSession(session);
  } catch (error) {
    setAuthStatus(false, `Doctor registration error: ${error.message}`);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  persistBaseUrl();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const session = await postJson(`${getBaseUrl()}/auth/login`, payload);
    saveSession(session);
    renderSession(session);
    setAuthLog("Login response", session);
    setAuthStatus(true, `Logged in as ${session.role}`);
    window.location.href = portalDestinationForSession(session);
  } catch (error) {
    setAuthStatus(false, `Login error: ${error.message}`);
  }
});

refreshSessionButton.addEventListener("click", refreshSession);
clearSessionButton.addEventListener("click", () => {
  clearSession();
  renderSession(null);
  setAuthLog("Session cleared", { ok: true });
  setAuthStatus(false, "Local session cleared");
});

recordsBaseUrlInput.addEventListener("change", persistBaseUrl);

initializeStoredValues();
applyPortalMode();
refreshSession();
