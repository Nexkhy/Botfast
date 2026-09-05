<?php
// backend.php - Interface de paiement dynamique connectée à Botfast API
$amount = $_GET['amount'] ?? $_GET['montant'] ?? '2000';
$phone = $_GET['phone'] ?? $_GET['tel'] ?? '';
$name = $_GET['name'] ?? $_GET['nom'] ?? 'Client';
$redirectUrl = $_GET['redirect'] ?? $_GET['callback'] ?? '';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paiement Mobile Money Sécurisé</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    body {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      color: #f8fafc;
    }

    .payment-card {
      background: rgba(30, 41, 59, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: 32px 28px;
      border-radius: 24px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
      max-width: 440px;
      width: 100%;
      text-align: center;
      animation: fadeIn 0.6s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 12px;
    }

    h2 {
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 20px;
      background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .amount-display {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 16px;
      border-radius: 16px;
      margin-bottom: 24px;
    }

    .amount-label {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 4px;
    }

    .amount-val {
      font-size: 28px;
      font-weight: 800;
      color: #38bdf8;
    }

    .input-group {
      text-align: left;
      margin-bottom: 18px;
    }

    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 6px;
    }

    .phone-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .phone-prefix {
      position: absolute;
      left: 14px;
      font-size: 14px;
      font-weight: 700;
      color: #64748b;
    }

    input[type="tel"], input[type="text"] {
      width: 100%;
      padding: 14px 14px 14px 54px;
      background: #0f172a;
      border: 1.5px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      outline: none;
      transition: all 0.2s ease;
    }

    input[type="tel"]:focus, input[type="text"]:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
    }

    .operator-tags {
      display: flex;
      gap: 10px;
      margin-bottom: 24px;
    }

    .op-btn {
      flex: 1;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: #0f172a;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
    }

    .op-btn.active-orange {
      border-color: #f97316;
      background: rgba(249, 115, 22, 0.15);
      color: #fb923c;
    }

    .op-btn.active-mtn {
      border-color: #eab308;
      background: rgba(234, 179, 8, 0.15);
      color: #fde047;
    }

    .pay-btn {
      width: 100%;
      padding: 16px;
      border: none;
      border-radius: 14px;
      background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .pay-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
    }

    .pay-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    /* ÉTATS DU PAIEMENT */
    .status-box {
      display: none;
      margin-top: 20px;
      padding: 18px;
      border-radius: 16px;
      text-align: center;
      animation: fadeIn 0.4s ease;
    }

    .status-box.loading {
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #bae6fd;
    }

    .status-box.waiting-pin {
      background: rgba(234, 179, 8, 0.12);
      border: 1px solid rgba(234, 179, 8, 0.4);
      color: #fef08a;
    }

    .status-box.success {
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #86efac;
    }

    .status-box.error {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }

    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 12px auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .status-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .status-desc {
      font-size: 13px;
      opacity: 0.9;
      line-height: 1.4;
    }

    .trans-badge {
      display: inline-block;
      margin-top: 10px;
      font-family: monospace;
      font-size: 12px;
      background: rgba(0, 0, 0, 0.3);
      padding: 4px 10px;
      border-radius: 6px;
    }

    .btn-return {
      display: inline-block;
      margin-top: 15px;
      padding: 10px 20px;
      background: #22c55e;
      color: #0f172a;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 14px;
    }
  </style>
</head>

<body>

  <div class="payment-card">
    <div class="brand-badge">⚡ Paiement Sécurisé Botfast</div>
    <h2>Mobile Money Direct</h2>

    <!-- Affichage du montant -->
    <div class="amount-display">
      <div class="amount-label">Montant total à payer</div>
      <div class="amount-val" id="amountDisplay">...</div>
    </div>

    <!-- Formulaire de paiement -->
    <form id="paymentForm">
      <div class="input-group">
        <label for="phoneNumber">Numéro de téléphone Orange ou MTN</label>
        <div class="phone-input-wrapper">
          <span class="phone-prefix">+237</span>
          <input
            type="tel"
            id="phoneNumber"
            placeholder="6xxxxxxxx"
            maxlength="9"
            value="<?php echo htmlspecialchars($phone); ?>"
            required
          />
        </div>
      </div>

      <!-- Choix opérateur automatique/manuel -->
      <div class="operator-tags">
        <button type="button" class="op-btn" id="btnOrange" data-op="orange">🟠 Orange Money</button>
        <button type="button" class="op-btn" id="btnMtn" data-op="mtn">🟡 MTN Momo</button>
      </div>

      <button type="submit" class="pay-btn" id="submitPayBtn">
        <span>⚡ Lancer le paiement</span>
      </button>
    </form>

    <!-- Zone de statut & vérification automatique en direct -->
    <div id="statusContainer" class="status-box">
      <div class="spinner" id="statusSpinner"></div>
      <div class="status-title" id="statusTitle">Traitement...</div>
      <div class="status-desc" id="statusDesc">Envoi de la demande de paiement...</div>
      <div id="transInfo"></div>
    </div>
  </div>

  <script>
    // ============================================================
    // CONFIGURATION DE L'API BOTFAST EN LIGNE
    // ============================================================
    const BOTFAST_API_URL = "https://botfast-1-pd5i.onrender.com";

    // Récupération des paramètres PHP / URL
    const urlParams = new URLSearchParams(window.location.search);
    const amount = Number(urlParams.get('amount') || urlParams.get('montant') || "<?php echo $amount; ?>");
    const customerName = urlParams.get('name') || urlParams.get('nom') || "<?php echo htmlspecialchars($name); ?>";
    const redirectUrl = urlParams.get('redirect') || urlParams.get('callback') || "<?php echo htmlspecialchars($redirectUrl); ?>";

    // Éléments du DOM
    const amountDisplay = document.getElementById("amountDisplay");
    const phoneInput = document.getElementById("phoneNumber");
    const form = document.getElementById("paymentForm");
    const submitBtn = document.getElementById("submitPayBtn");
    const statusBox = document.getElementById("statusContainer");
    const statusSpinner = document.getElementById("statusSpinner");
    const statusTitle = document.getElementById("statusTitle");
    const statusDesc = document.getElementById("statusDesc");
    const transInfo = document.getElementById("transInfo");
    const btnOrange = document.getElementById("btnOrange");
    const btnMtn = document.getElementById("btnMtn");

    // Afficher le montant formaté
    amountDisplay.textContent = Number(amount).toLocaleString('fr-FR') + ' FCFA';

    // Détection automatique de l'opérateur selon les premiers chiffres
    phoneInput.addEventListener("input", () => {
      const val = phoneInput.value.replace(/\D/g, "");
      btnOrange.className = "op-btn";
      btnMtn.className = "op-btn";

      if (val.startsWith("69") || val.startsWith("655") || val.startsWith("656") || val.startsWith("657") || val.startsWith("658") || val.startsWith("659")) {
        btnOrange.classList.add("active-orange");
      } else if (val.startsWith("67") || val.startsWith("68") || val.startsWith("650") || val.startsWith("651") || val.startsWith("652") || val.startsWith("653") || val.startsWith("654")) {
        btnMtn.classList.add("active-mtn");
      }
    });

    btnOrange.addEventListener("click", () => {
      btnOrange.className = "op-btn active-orange";
      btnMtn.className = "op-btn";
    });

    btnMtn.addEventListener("click", () => {
      btnMtn.className = "op-btn active-mtn";
      btnOrange.className = "op-btn";
    });

    // Helper pour mettre à jour la boîte d'état
    function updateStatus(type, title, desc, extraHtml = "") {
      statusBox.className = `status-box ${type}`;
      statusBox.style.display = "block";
      statusTitle.textContent = title;
      statusDesc.textContent = desc;
      transInfo.innerHTML = extraHtml;
      statusSpinner.style.display = (type === "loading" || type === "waiting-pin") ? "block" : "none";
    }

    // ============================================================
    // SOUMISSION & AUTOMATISATION DU PAIEMENT SANS REDIRECTION
    // ============================================================
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      let phone = phoneInput.value.trim().replace(/\D/g, "");
      if (phone.length < 8) {
        alert("Veuillez entrer un numéro de téléphone valide (ex: 671234567).");
        return;
      }
      if (phone.startsWith("237") && phone.length > 9) {
        phone = phone.substring(3);
      }

      submitBtn.disabled = true;
      form.style.opacity = "0.4";
      form.style.pointerEvents = "none";

      updateStatus(
        "loading",
        "Connexion à la passerelle...",
        "Initiation du paiement avec Botfast en arrière-plan..."
      );

      try {
        // 1. Appel du bot hébergé sur Render
        const response = await fetch(`${BOTFAST_API_URL}/api/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(amount),
            phone: phone,
            name: customerName,
            headless: true
          })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Impossible d'initier le paiement.");
        }

        const transId = data.transId;

        // 2. Le bot a ouvert et validé la page Fapshi ! L'utilisateur doit maintenant taper son PIN.
        updateStatus(
          "waiting-pin",
          "📱 Confirmation demandée sur votre téléphone !",
          "Un message de paiement (USSD) vient d'être envoyé sur votre téléphone. Veuillez entrer votre code PIN pour valider.",
          `<div class="trans-badge">Transaction ID : ${transId}</div>`
        );

        // 3. Vérification automatique en direct toutes les 3 secondes (Polling)
        startVerificationPolling(transId);

      } catch (error) {
        console.error("Erreur Botfast:", error);
        updateStatus("error", "Échec du paiement", error.message);
        submitBtn.disabled = false;
        form.style.opacity = "1";
        form.style.pointerEvents = "auto";
      }
    });

    // ============================================================
    // VÉRIFICATION AUTOMATIQUE DU STATUT (POLLING SANS RECHARGEMENT)
    // ============================================================
    function startVerificationPolling(transId) {
      let attempts = 0;
      const maxAttempts = 40; // 40 x 3s = 2 minutes max

      const interval = setInterval(async () => {
        attempts++;

        try {
          const res = await fetch(`${BOTFAST_API_URL}/api/status/${encodeURIComponent(transId)}`);
          const statusData = await res.json();

          if (res.ok && statusData.success) {
            const status = (statusData.status || "").toUpperCase();
            const finStatus = (statusData.financialStatus || "").toUpperCase();

            // CAS 1 : SUCCÈS CONFIRMÉ
            if (status === "SUCCESSFUL" || finStatus === "PAID") {
              clearInterval(interval);
              updateStatus(
                "success",
                "✅ Paiement validé avec succès !",
                `Votre transaction de ${Number(amount).toLocaleString('fr-FR')} FCFA a été confirmée.`,
                redirectUrl
                  ? `<a href="${redirectUrl}?transId=${transId}&status=success" class="btn-return">Continuer</a>`
                  : `<div class="trans-badge">Réf: ${transId} • Statut: PAYÉ</div>`
              );
              return;
            }

            // CAS 2 : ÉCHEC OU ANNULATION
            if (status === "FAILED" || status === "EXPIRED" || finStatus === "FAILED") {
              clearInterval(interval);
              updateStatus(
                "error",
                "❌ Paiement refusé ou annulé",
                "La transaction n'a pas été validée sur votre téléphone.",
                `<button onclick="location.reload()" class="btn-return" style="background:#ef4444;color:#fff;border:none;cursor:pointer;">Réessayer</button>`
              );
              return;
            }
          }
        } catch (e) {
          console.warn("Vérification temporairement inaccessible, nouvelle tentative...", e);
        }

        // CAS 3 : TIMEOUT APRÈS 2 MINUTES
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          updateStatus(
            "error",
            "⏱️ Délai d'attente dépassé",
            "Vous n'avez pas validé la transaction à temps sur votre téléphone.",
            `<button onclick="location.reload()" class="btn-return" style="background:#f59e0b;color:#fff;border:none;cursor:pointer;">Recommencer</button>`
          );
        }
      }, 3000);
    }
  </script>

</body>
</html>