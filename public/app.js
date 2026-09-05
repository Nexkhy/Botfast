document.addEventListener("DOMContentLoaded", () => {
  // Elements Formulaires & Onglets
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  const resTabButtons = document.querySelectorAll(".res-tab-btn");
  const resTabContents = document.querySelectorAll(".res-tab-content");

  const fapshiForm = document.getElementById("fapshiForm");
  const statusForm = document.getElementById("statusForm");
  const genericForm = document.getElementById("genericForm");

  const apiKeyInput = document.getElementById("apiKey");
  const apiUserInput = document.getElementById("apiUser");
  const statusApiKeyInput = document.getElementById("statusApiKey");
  const statusApiUserInput = document.getElementById("statusApiUser");

  const statusBadge = document.getElementById("statusBadge");
  const statusTitle = document.getElementById("statusTitle");
  const statusDesc = document.getElementById("statusDesc");
  const jsonViewer = document.getElementById("jsonViewer");
  const liveTerminal = document.getElementById("liveTerminal");
  const btnClearLogs = document.getElementById("btnClearLogs");
  const btnCopyJson = document.getElementById("btnCopyJson");

  const summaryCards = document.getElementById("summaryCards");
  const sumTransId = document.getElementById("sumTransId");
  const sumButton = document.getElementById("sumButton");
  const sumSubmitted = document.getElementById("sumSubmitted");

  const DEFAULT_API_USER = "523f8249-0b49-48dc-8dfc-a1395caeb3e9";
  const DEFAULT_API_KEY = "FAK_7d7275a12942d1aa7f6a86e75db4fe37";

  // Charger les identifiants mémorisés en localStorage ou valeur par défaut
  const savedApiKey = localStorage.getItem("botfast_apiKey") || DEFAULT_API_KEY;
  const savedApiUser = localStorage.getItem("botfast_apiUser") || DEFAULT_API_USER;
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
    statusApiKeyInput.value = savedApiKey;
  }
  if (savedApiUser) {
    apiUserInput.value = savedApiUser;
    statusApiUserInput.value = savedApiUser;
  }

  function saveCredentials(key, user) {
    if (key) localStorage.setItem("botfast_apiKey", key);
    if (user) localStorage.setItem("botfast_apiUser", user);
  }

  // Onglets du panneau gauche
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      document.getElementById(tabId.replace("Tab", "Form")).classList.add("active");
    });
  });

  // Onglets du panneau de résultats (Terminal Live vs JSON)
  resTabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      resTabButtons.forEach((b) => b.classList.remove("active"));
      resTabContents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-restab");
      document.getElementById(tabId).classList.add("active");
    });
  });

  // Helper pour ajouter une ligne au terminal en direct
  function appendTerminal(badgeType, message) {
    const time = new Date().toLocaleTimeString();
    const line = document.createElement("div");
    line.className = "terminal-line";

    let badgeClass = "info";
    if (badgeType === "success" || badgeType === "DONE" || badgeType === "PAYMENT_SUBMITTED") badgeClass = "success";
    if (badgeType === "error" || badgeType === "GATEWAY_ERROR") badgeClass = "error";
    if (badgeType === "warning") badgeClass = "warning";

    line.innerHTML = `
      <span class="t-time">[${time}]</span>
      <span class="t-badge ${badgeClass}">${badgeType}</span>
      <span class="t-text">${message}</span>
    `;

    // Supprimer le message initial "en attente" si présent
    const mutedInit = liveTerminal.querySelector(".terminal-line.muted");
    if (mutedInit) mutedInit.remove();

    liveTerminal.appendChild(line);
    liveTerminal.scrollTop = liveTerminal.scrollHeight;
  }

  function clearTerminal() {
    liveTerminal.innerHTML = '<div class="terminal-line muted">En attente d\'une action...</div>';
  }

  // Vérification de santé du serveur
  async function checkServerHealth() {
    try {
      const res = await fetch("/health");
      const data = await res.json();
      const dot = document.querySelector(".status-dot");
      const text = document.getElementById("serverStatusText");
      if (data.status === "healthy") {
        dot.className = "status-dot online";
        text.textContent = "En ligne";
      } else {
        dot.className = "status-dot offline";
        text.textContent = "Erreur";
      }
    } catch {
      const dot = document.querySelector(".status-dot");
      const text = document.getElementById("serverStatusText");
      dot.className = "status-dot offline";
      text.textContent = "Hors ligne";
    }
  }
  checkServerHealth();
  setInterval(checkServerHealth, 15000);

  function setStatus(type, title, desc, data = null) {
    statusBadge.className = `result-status-card ${type}`;
    statusTitle.textContent = title;
    statusDesc.textContent = desc;

    if (data) {
      jsonViewer.textContent = JSON.stringify(data, null, 2);
      if (data.transId || data.automation) {
        summaryCards.style.display = "grid";
        sumTransId.textContent = data.transId || "—";
        sumButton.textContent = data.automation?.paymentButton || "—";
        sumSubmitted.textContent = data.automation?.submitted ? "Oui ✅" : "Non ❌";
      }
    }
  }

  // ==========================================================
  // 1. PAIEMENT FAPSHI LIVE AVEC LOGS EN TEMPS RÉEL (SSE)
  // ==========================================================
  fapshiForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnPay");
    btn.disabled = true;

    const apiKey = apiKeyInput.value.trim();
    const apiUser = apiUserInput.value.trim();
    const amount = document.getElementById("amount").value;
    const phone = document.getElementById("phone").value;
    const name = document.getElementById("customerName").value;
    const email = document.getElementById("customerEmail").value;
    const isVisibleBrowser = document.getElementById("showBrowser").checked;
    const headless = !isVisibleBrowser;

    saveCredentials(apiKey, apiUser);

    // Basculer sur l'onglet Terminal en direct
    document.querySelector("[data-restab='liveLogTab']").click();
    clearTerminal();
    summaryCards.style.display = "none";
    setStatus("loading", "Paiement en cours d'exécution...", "Observation du flux Fapshi & Playwright en direct...");

    if (isVisibleBrowser) {
      appendTerminal("INFO", "👀 Mode Visible activé : La fenêtre du navigateur Chromium va s'ouvrir sur votre écran !");
    }

    try {
      const payload = {
        amount,
        phone,
        name,
        email,
        headless,
      };
      if (apiKey) payload.fapshiApiKey = apiKey;
      if (apiUser) payload.fapshiApiUser = apiUser;

      const response = await fetch("/api/pay/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erreur serveur HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let eventType = "message";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.replace("event: ", "").trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.replace("data: ", "").trim();
            }
          }

          if (!dataStr) continue;
          let parsedData;
          try { parsedData = JSON.parse(dataStr); } catch { parsedData = { message: dataStr }; }

          if (eventType === "log") {
            appendTerminal(parsedData.type || "INFO", parsedData.message);
            if (parsedData.data?.gatewayResponse) {
              const gw = parsedData.data.gatewayResponse;
              appendTerminal(gw.status === 200 ? "SUCCESS" : "GATEWAY", `Passerelle statut HTTP ${gw.status} : ${JSON.stringify(gw.data)}`);
            }
          } else if (eventType === "complete") {
            finalResult = parsedData;
            appendTerminal("SUCCESS", `🎉 ${parsedData.message}`);
            if (parsedData.transId) {
              document.getElementById("statusTransId").value = parsedData.transId;
            }
            setStatus("success", "Paiement et automatisation terminés !", `TransId: ${parsedData.transId}`, parsedData);
          } else if (eventType === "error") {
            appendTerminal("ERROR", `❌ ${parsedData.error}`);
            setStatus("error", "Échec", parsedData.error, parsedData);
          }
        }
      }

      if (finalResult) {
        jsonViewer.textContent = JSON.stringify(finalResult, null, 2);
      }
    } catch (err) {
      appendTerminal("ERROR", `❌ Erreur : ${err.message}`);
      setStatus("error", "Erreur", err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // ==========================================================
  // 2. VÉRIFICATION DU STATUT DE TRANSACTION
  // ==========================================================
  statusForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnCheckStatus");
    btn.disabled = true;

    const transId = document.getElementById("statusTransId").value.trim();
    const apiKey = statusApiKeyInput.value.trim() || apiKeyInput.value.trim();
    const apiUser = statusApiUserInput.value.trim() || apiUserInput.value.trim();

    saveCredentials(apiKey, apiUser);

    document.querySelector("[data-restab='liveLogTab']").click();
    clearTerminal();
    appendTerminal("STATUS_CHECK", `Interrogation de Fapshi pour le transId : ${transId}...`);
    setStatus("loading", "Interrogation du statut...", `Vérification du transId : ${transId}`);
    summaryCards.style.display = "none";

    try {
      const params = new URLSearchParams();
      if (apiKey) params.append("apiKey", apiKey);
      if (apiUser) params.append("apiUser", apiUser);
      const queryStr = params.toString() ? `?${params.toString()}` : "";

      const response = await fetch(`/api/status/${encodeURIComponent(transId)}${queryStr}`);
      const result = await response.json();

      if (response.ok && result.success) {
        appendTerminal("SUCCESS", `Statut : ${result.status} | Statut Financier : ${result.financialStatus} | Montant : ${result.amount || 0} XAF`);
        setStatus(
          "success",
          `Statut : ${result.status || "Inconnu"}`,
          `Statut financier : ${result.financialStatus || "N/A"} (${result.amount || 0} XAF)`,
          result
        );
      } else {
        appendTerminal("ERROR", `Erreur statut : ${result.error}`);
        setStatus("error", "Erreur statut", result.error || "Impossible de récupérer le statut.", result);
      }
    } catch (err) {
      appendTerminal("ERROR", `Erreur réseau : ${err.message}`);
      setStatus("error", "Erreur réseau", err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // ==========================================================
  // 3. AUTOMATISATION D'URL GÉNÉRIQUE
  // ==========================================================
  genericForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnAutomate");
    btn.disabled = true;

    const url = document.getElementById("genericUrl").value.trim();
    const name = document.getElementById("genName").value.trim();
    const phone = document.getElementById("genPhone").value.trim();
    const amount = document.getElementById("genAmount").value.trim();
    const email = document.getElementById("genEmail").value.trim();
    const submit = document.getElementById("genSubmit").checked;

    document.querySelector("[data-restab='liveLogTab']").click();
    clearTerminal();
    appendTerminal("URL_AUTOMATE", `Démarrage de l'analyse pour l'URL : ${url}`);
    setStatus("loading", "Analyse en cours...", `Navigation vers ${url} avec Playwright...`);
    summaryCards.style.display = "none";

    try {
      const response = await fetch("/api/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          fields: { name, phone, amount, email },
          submit,
          headless: true,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        appendTerminal("SUCCESS", `Automatisation terminée ! Page finale : ${result.finalUrl}`);
        if (result.paymentButton) appendTerminal("SUCCESS", `Bouton cliqué : "${result.paymentButton}"`);
        setStatus("success", "Automatisation terminée", `Page finale : ${result.finalUrl}`, result);
      } else {
        appendTerminal("ERROR", `Échec : ${result.error}`);
        setStatus("error", "Échec automatisation", result.error || "Erreur de traitement.", result);
      }
    } catch (err) {
      appendTerminal("ERROR", `Erreur réseau : ${err.message}`);
      setStatus("error", "Erreur réseau", err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // Effacer la console
  btnClearLogs.addEventListener("click", () => {
    clearTerminal();
    setStatus("idle", "Prêt à tester", "Sélectionnez une action et lancez une requête.");
    jsonViewer.textContent = "// Les résultats des requêtes s'afficheront ici...";
    summaryCards.style.display = "none";
  });

  // Copier le JSON
  btnCopyJson.addEventListener("click", () => {
    navigator.clipboard.writeText(jsonViewer.textContent).then(() => {
      const original = btnCopyJson.textContent;
      btnCopyJson.textContent = "Copié !";
      setTimeout(() => (btnCopyJson.textContent = original), 2000);
    });
  });
});
