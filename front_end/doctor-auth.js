(function attachDoctorAuth(windowRef) {
  const storageKeys = {
    records: "medivault.recordsBaseUrl",
    authToken: "medivault.authToken",
  };

  function clearSession() {
    localStorage.removeItem(storageKeys.authToken);
  }

  function redirectToDoctorLogin() {
    windowRef.location.replace("./login.html?portal=doctor");
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

  async function requireDoctorSession(options = {}) {
    const token = localStorage.getItem(storageKeys.authToken);
    const baseUrl = (localStorage.getItem(storageKeys.records) || options.baseUrl || "http://127.0.0.1:8000").replace(/\/$/, "");

    if (!token) {
      clearSession();
      redirectToDoctorLogin();
      return null;
    }

    try {
      const session = await fetchJson(`${baseUrl}/auth/sessions/${encodeURIComponent(token)}`);
      if (session.role !== "doctor" || !session.doctor_id) {
        clearSession();
        redirectToDoctorLogin();
        return null;
      }

      if (options.welcomeElementId) {
        const welcomeElement = document.getElementById(options.welcomeElementId);
        if (welcomeElement) {
          welcomeElement.textContent = `Welcome, ${session.full_name}.`;
        }
      }

      if (options.logoutButtonId) {
        const logoutButton = document.getElementById(options.logoutButtonId);
        if (logoutButton && !logoutButton.dataset.boundLogout) {
          logoutButton.dataset.boundLogout = "true";
          logoutButton.addEventListener("click", () => {
            clearSession();
            redirectToDoctorLogin();
          });
        }
      }

      return session;
    } catch (error) {
      console.warn("Doctor session validation failed", error);
      clearSession();
      redirectToDoctorLogin();
      return null;
    }
  }

  windowRef.MediVaultAuth = {
    clearSession,
    requireDoctorSession,
  };
})(window);
