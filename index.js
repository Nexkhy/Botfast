const express = require("express");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// CONFIGURATION
// ============================================================

const BOT_API_KEY = process.env.BOT_API_KEY || "";

const FAPSHI_API_URL ="https://fapshi.com";

const FAPSHI_API_KEY ="FAK_a7c6dfdb7ec1612bbaec4e314ecfacad";

const FAPSHI_API_USER =
  process.env.FAPSHI_API_USER || "523f8249-0b49-48dc-8dfc-a1395caeb3e9";

// Informations fixes du paiement
const PAYMENT_NAME = "Junior Kameni";
const PAYMENT_EMAIL = "antigravity2371@gmail.com";

// Montant minimum
const MIN_AMOUNT = 4000;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// UTILITAIRES
// ============================================================

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isValidUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function cleanPhone(phone) {
  return String(phone || "")
    .trim()
    .replace(/[^\d+]/g, "");
}

function isValidPhone(phone) {
  const cleaned = cleanPhone(phone);

  const digits = cleaned.replace(/\D/g, "");

  return digits.length >= 8 && digits.length <= 15;
}

function generateExternalId() {
  return (
    "BOTFAST-" +
    Date.now() +
    "-" +
    Math.random().toString(36).substring(2, 10)
  );
}

// ============================================================
// DÉTECTION DES CHAMPS
// ============================================================

const FIELD_ALIASES = {
  name: [
    "name",
    "fullname",
    "full name",
    "nom",
    "nom complet",
    "customer name",
    "customer",
    "client",
    "username",
    "user name"
  ],

  amount: [
    "amount",
    "montant",
    "price",
    "prix",
    "total",
    "payment amount",
    "amount to pay",
    "montant a payer",
    "montant à payer"
  ],

  email: [
    "email",
    "e-mail",
    "mail",
    "email address",
    "adresse email",
    "adresse e-mail"
  ],

  phone: [
    "phone",
    "telephone",
    "téléphone",
    "tel",
    "mobile",
    "phone number",
    "numero",
    "numéro",
    "numero de telephone",
    "numéro de téléphone"
  ]
};

function scoreField(field, type) {
  const aliases = FIELD_ALIASES[type] || [];

  const values = [
    field.name,
    field.id,
    field.placeholder,
    field.ariaLabel,
    field.label,
    field.autocomplete,
    field.inputmode,
    field.parentText,
    field.type
  ]
    .filter(Boolean)
    .map(normalize);

  let score = 0;

  for (const value of values) {
    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);

      if (value === normalizedAlias) {
        score += 100;
      } else if (value.includes(normalizedAlias)) {
        score += 40;
      }
    }
  }

  return score;
}

function isPaymentButton(button) {
  const text = normalize(
    [
      button.text,
      button.value,
      button.ariaLabel,
      button.title,
      button.name
    ]
      .filter(Boolean)
      .join(" ")
  );

  const paymentWords = [
    "pay",
    "payer",
    "payment",
    "paiement",
    "continue",
    "continuer",
    "proceed",
    "valider",
    "confirm",
    "confirmer",
    "checkout",
    "momo",
    "mobile money",
    "orange money",
    "mtn",
    "orange"
  ];

  return paymentWords.some((word) =>
    text.includes(normalize(word))
  );
}

// ============================================================
// FAPSHI REQUEST
// ============================================================

async function fapshiRequest(method, path, body = undefined) {
  const url =
    FAPSHI_API_URL.replace(/\/$/, "") +
    path;

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: FAPSHI_API_KEY,
      apiuser: FAPSHI_API_USER
    }
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text
    };
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        `Fapshi HTTP ${response.status}`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

// ============================================================
// AUTOMATISATION PLAYWRIGHT
// ============================================================

async function automatePayment({
  url,
  fields,
  submit = true
}) {
  if (!isValidUrl(url)) {
    throw new Error("URL de paiement invalide.");
  }

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    const page = await browser.newPage({
      viewport: {
        width: 1365,
        height: 900
      }
    });

    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(String(error));
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    try {
      await page.waitForLoadState("networkidle", {
        timeout: 15000
      });
    } catch {
      // Certaines applications React/Next ne terminent jamais networkidle.
    }

    await page.waitForTimeout(2000);

    // --------------------------------------------------------
    // Récupération de tous les champs visibles
    // --------------------------------------------------------

    const candidates = await page.locator(
      "input, textarea, select"
    ).evaluateAll((elements) => {
      return elements
        .filter((el) => {
          const style = window.getComputedStyle(el);

          const rect = el.getBoundingClientRect();

          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0 &&
            !el.disabled
          );
        })
        .map((el) => {
          let label = "";

          if (el.id) {
            const labelElement =
              document.querySelector(
                `label[for="${CSS.escape(el.id)}"]`
              );

            if (labelElement) {
              label = labelElement.innerText || "";
            }
          }

          if (!label) {
            const parent = el.closest("label");

            if (parent) {
              label = parent.innerText || "";
            }
          }

          const parent =
            el.parentElement?.innerText || "";

          return {
            name: el.getAttribute("name") || "",
            id: el.id || "",
            placeholder:
              el.getAttribute("placeholder") || "",
            ariaLabel:
              el.getAttribute("aria-label") || "",
            autocomplete:
              el.getAttribute("autocomplete") || "",
            inputmode:
              el.getAttribute("inputmode") || "",
            type:
              el.getAttribute("type") || "",
            label,
            parentText: parent.substring(0, 300),
            value: el.value || ""
          };
        });
    });

    const selectedFields = {};

    // --------------------------------------------------------
    // Recherche du meilleur champ pour chaque donnée
    // --------------------------------------------------------

    for (const type of [
      "name",
      "amount",
      "email",
      "phone"
    ]) {
      let best = null;
      let bestScore = 0;

      for (let i = 0; i < candidates.length; i++) {
        const score = scoreField(
          candidates[i],
          type
        );

        if (score > bestScore) {
          bestScore = score;
          best = {
            index: i,
            ...candidates[i]
          };
        }
      }

      if (best) {
        selectedFields[type] = {
          ...best,
          score: bestScore
        };
      }
    }

    // --------------------------------------------------------
    // Remplissage
    // --------------------------------------------------------

    const filled = {};

    for (const type of [
      "name",
      "amount",
      "email",
      "phone"
    ]) {
      const selected = selectedFields[type];

      if (!selected) {
        filled[type] = false;
        continue;
      }

      const locator = page.locator(
        "input, textarea, select"
      ).nth(selected.index);

      let value = fields[type];

      if (
        value === undefined ||
        value === null
      ) {
        filled[type] = false;
        continue;
      }

      value = String(value);

      try {
        const tagName =
          await locator.evaluate(
            (el) => el.tagName.toLowerCase()
          );

        if (tagName === "select") {
          try {
            await locator.selectOption({
              label: value
            });
          } catch {
            await locator.selectOption(value);
          }
        } else {
          await locator.fill(value);
        }

        await page.waitForTimeout(300);

        const currentValue =
          await locator.inputValue();

        filled[type] =
          normalize(currentValue) ===
          normalize(value);
      } catch {
        filled[type] = false;
      }
    }

    // --------------------------------------------------------
    // Recherche du bouton de paiement
    // --------------------------------------------------------

    let paymentButton = null;

    const buttons = await page.locator(
      "button, input[type='submit'], input[type='button'], [role='button'], a"
    ).evaluateAll((elements) => {
      return elements
        .filter((el) => {
          const style =
            window.getComputedStyle(el);

          const rect =
            el.getBoundingClientRect();

          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0
          );
        })
        .map((el) => ({
          text:
            el.innerText ||
            el.textContent ||
            "",
          value:
            el.getAttribute("value") || "",
          ariaLabel:
            el.getAttribute("aria-label") || "",
          title:
            el.getAttribute("title") || "",
          name:
            el.getAttribute("name") || ""
        }));
    });

    for (const button of buttons) {
      if (isPaymentButton(button)) {
        paymentButton = button;
        break;
      }
    }

    let submitted = false;

    // --------------------------------------------------------
    // CLICK
    // --------------------------------------------------------

    if (submit && paymentButton) {
      const allButtons = page.locator(
        "button, input[type='submit'], input[type='button'], [role='button'], a"
      );

      const count = await allButtons.count();

      for (let i = 0; i < count; i++) {
        const locator = allButtons.nth(i);

        try {
          const visible =
            await locator.isVisible();

          if (!visible) {
            continue;
          }

          const info =
            await locator.evaluate((el) => ({
              text:
                el.innerText ||
                el.textContent ||
                "",
              value:
                el.getAttribute("value") || "",
              ariaLabel:
                el.getAttribute("aria-label") || "",
              title:
                el.getAttribute("title") || "",
              name:
                el.getAttribute("name") || ""
            }));

          if (isPaymentButton(info)) {
            await locator.scrollIntoViewIfNeeded();

            await page.waitForTimeout(500);

            await locator.click({
              timeout: 15000
            });

            submitted = true;

            await page.waitForTimeout(2500);

            break;
          }
        } catch {
          // On essaie le bouton suivant.
        }
      }
    }

    return {
      success: true,
      filled,
      submitted,
      paymentButton:
        paymentButton?.text ||
        paymentButton?.value ||
        paymentButton?.ariaLabel ||
        null,
      finalUrl: page.url(),
      consoleErrors,
      pageErrors
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ============================================================
// ROUTE PRINCIPALE
// ============================================================

app.get("/", (req, res) => {
  res.json({
    name: "Botfast",
    status: "running",
    version: "2.0.0"
  });
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/health", (req, res) => {
  res.json({
    status: "healthy"
  });
});

// ============================================================
// AUTOMATE GÉNÉRIQUE
// ============================================================

app.post("/api/automate", async (req, res) => {
  try {
    const {
      url,
      fields = {},
      submit = true
    } = req.body || {};

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "URL obligatoire."
      });
    }

    const result = await automatePayment({
      url,
      fields,
      submit
    });

    res.json(result);
  } catch (error) {
    console.error(
      "Erreur /api/automate:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        error.message ||
        "Erreur pendant l'automatisation."
    });
  }
});

// ============================================================
// INITIATION FAPSHI + AUTOMATISATION
//
// IMPORTANT:
// Cette route NE vérifie PAS le statut du paiement.
// Elle fait uniquement:
//
// 1. Validation
// 2. initiate-pay Fapshi
// 3. Récupération du link
// 4. Ouverture du link avec Playwright
// 5. Remplissage
// 6. Clic sur le bouton de paiement
//
// FIN.
// ============================================================

app.post("/api/pay", async (req, res) => {
  try {
    const {
      amount,
      phone
    } = req.body || {};

    // --------------------------------------------------------
    // Validation montant
    // --------------------------------------------------------

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < MIN_AMOUNT
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Le montant minimum est de ${MIN_AMOUNT} FCFA.`
      });
    }

    // --------------------------------------------------------
    // Validation téléphone
    // --------------------------------------------------------

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Numéro de téléphone invalide."
      });
    }

    const cleanPhoneNumber =
      cleanPhone(phone);

    const externalId =
      generateExternalId();

    console.log(
      "----------------------------------------"
    );

    console.log(
      "Nouveau paiement Botfast"
    );

    console.log(
      "Montant:",
      numericAmount
    );

    console.log(
      "Téléphone:",
      cleanPhoneNumber
    );

    console.log(
      "External ID:",
      externalId
    );

    // --------------------------------------------------------
    // 1. INITIATION FAPSHI
    // --------------------------------------------------------

    console.log(
      "Initiation Fapshi..."
    );

    const fapshi =
      await fapshiRequest(
        "POST",
        "/initiate-pay",
        {
          amount: numericAmount,
          email: PAYMENT_EMAIL,
          redirectUrl: "",
          userId: cleanPhoneNumber,
          externalId,
          message:
            "Paiement " +
            PAYMENT_NAME
        }
      );

    console.log(
      "Réponse Fapshi reçue."
    );

    const paymentLink =
      fapshi?.link;

    const transId =
      fapshi?.transId;

    if (!paymentLink) {
      console.error(
        "Fapshi n'a pas retourné de link:",
        fapshi
      );

      return res.status(502).json({
        success: false,
        message:
          "Fapshi n'a pas retourné de lien de paiement.",
        data: fapshi
      });
    }

    // --------------------------------------------------------
    // 2. AUTOMATISATION DU LIEN FAPSHI
    // --------------------------------------------------------

    console.log(
      "Ouverture de la page Fapshi..."
    );

    const automation =
      await automatePayment({
        url: paymentLink,

        fields: {
          name: PAYMENT_NAME,
          amount: String(numericAmount),
          email: PAYMENT_EMAIL,
          phone: cleanPhoneNumber
        },

        submit: true
      });

    console.log(
      "Automatisation terminée."
    );

    console.log(
      "Bouton:",
      automation.paymentButton
    );

    console.log(
      "Submitted:",
      automation.submitted
    );

    console.log(
      "----------------------------------------"
    );

    // --------------------------------------------------------
    // RÉPONSE
    //
    // Aucun payment-status ici.
    // --------------------------------------------------------

    return res.json({
      success: true,

      message:
        "Paiement Fapshi initié et action de paiement exécutée.",

      transId: transId || null,

      externalId,

      paymentLink,

      amount: numericAmount,

      phone: cleanPhoneNumber,

      automation: {
        success:
          automation.success,

        filled:
          automation.filled,

        submitted:
          automation.submitted,

        paymentButton:
          automation.paymentButton,

        finalUrl:
          automation.finalUrl
      }
    });
  } catch (error) {
    console.error(
      "Erreur /api/pay:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Impossible d'initier le paiement.",
      details:
        error.data || null
    });
  }
});

// ============================================================
// TESTEUR
// ============================================================

app.get("/tester", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Botfast Tester</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f4f6f8;
  color: #222;
}

.container {
  max-width: 600px;
  margin: 40px auto;
  padding: 20px;
}

.card {
  background: white;
  padding: 25px;
  border-radius: 14px;
  box-shadow: 0 5px 25px rgba(0,0,0,.08);
}

h1 {
  margin-top: 0;
}

label {
  display: block;
  margin-top: 15px;
  margin-bottom: 6px;
  font-weight: bold;
}

input {
  width: 100%;
  padding: 13px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 16px;
}

button {
  width: 100%;
  padding: 14px;
  margin-top: 20px;
  border: 0;
  border-radius: 8px;
  background: #111;
  color: white;
  font-size: 16px;
  cursor: pointer;
}

button:disabled {
  opacity: .5;
}

pre {
  margin-top: 20px;
  padding: 15px;
  background: #111;
  color: #eee;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

.info {
  margin-top: 15px;
  padding: 12px;
  background: #fff3cd;
  border-radius: 8px;
  font-size: 14px;
}
</style>
</head>

<body>

<div class="container">

<div class="card">

<h1>🚀 Botfast Tester</h1>

<p>
Test rapide de l'initiation Fapshi.
</p>

<div class="info">
⚠️ Ce test initie réellement un paiement.
Botfast ne vérifie pas le statut du paiement.
</div>

<label>Montant FCFA</label>

<input
  id="amount"
  type="number"
  value="4000"
  min="4000"
/>

<label>Numéro de téléphone</label>

<input
  id="phone"
  type="text"
  value="670000000"
  placeholder="Ex: 670000000"
/>

<button
  id="payButton"
  onclick="initPayment()"
>
🚀 Initier le paiement
</button>

<pre id="result">Prêt.</pre>

</div>

</div>

<script>

async function initPayment() {

  const amount =
    document.getElementById("amount").value;

  const phone =
    document.getElementById("phone").value;

  const button =
    document.getElementById("payButton");

  const result =
    document.getElementById("result");

  button.disabled = true;

  result.textContent =
    "⏳ Initiation du paiement...";

  try {

    const response =
      await fetch("/api/pay", {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          amount: amount,
          phone: phone
        })
      });

    const data =
      await response.json();

    result.textContent =
      JSON.stringify(
        data,
        null,
        2
      );

  } catch (error) {

    result.textContent =
      "❌ Erreur : " +
      error.message;

  } finally {

    button.disabled = false;
  }
}

</script>

</body>
</html>
  `);
});

// ============================================================
// ERREUR 404
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route introuvable."
  });
});

// ============================================================
// DÉMARRAGE
// ============================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Botfast running on port ${PORT}`
  );
});