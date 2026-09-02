const express = require("express");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// CONFIGURATIONs
// ============================================================

const FAPSHI_API_URL =
  process.env.FAPSHI_API_URL || "https://fapshi.com";

const PAYMENT_NAME = "Junior Kameni";
const PAYMENT_EMAIL = "antigravity2371@gmail.com";

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
  const digits = cleanPhone(phone).replace(/\D/g, "");

  return digits.length >= 8 && digits.length <= 15;
}

function generateExternalId() {
  return (
    "BOTFAST-" +
    Date.now() +
    "-" +
    Math.random().toString(36).substring(2, 8)
  );
}

// ============================================================
// ALIAS DES CHAMPS
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

// ============================================================
// SCORE DES CHAMPS
// ============================================================

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
      const a = normalize(alias);

      if (value === a) {
        score += 100;
      } else if (value.includes(a)) {
        score += 40;
      }
    }
  }

  return score;
}

// ============================================================
// DÉTECTION BOUTON PAIEMENT
// ============================================================

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

  const words = [
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

  return words.some((word) =>
    text.includes(normalize(word))
  );
}

// ============================================================
// REQUÊTE FAPSHI
//
// Les identifiants sont reçus à chaque requête.
// Ils ne sont pas stockés dans Botfast.
// ============================================================

async function fapshiRequest(
  apiKey,
  apiUser,
  method,
  path,
  body
) {
  if (!apiKey) {
    throw new Error(
      "La clé API Fapshi est obligatoire."
    );
  }

  if (!apiUser) {
    throw new Error(
      "L'API User Fapshi est obligatoire."
    );
  }

  const url =
    FAPSHI_API_URL.replace(/\/$/, "") + path;

  const options = {
    method,

    headers: {
      "Content-Type": "application/json",

      apikey: apiKey,

      apiuser: apiUser
    }
  };

  if (body !== undefined) {
    options.body =
      JSON.stringify(body);
  }

  console.log("");
  console.log("==============================");
  console.log("REQUÊTE FAPSHI");
  console.log("==============================");
  console.log("URL:", url);
  console.log("METHOD:", method);

  // On ne log PAS la clé API.
  console.log(
    "API KEY: reçue"
  );

  console.log(
    "API USER: reçu"
  );

  if (body) {
    console.log(
      "BODY:",
      JSON.stringify(body)
    );
  }

  const response =
    await fetch(url, options);

  const text =
    await response.text();

  console.log(
    "HTTP:",
    response.status
  );

  console.log(
    "RESPONSE:",
    text
  );

  console.log("==============================");
  console.log("");

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text
    };
  }

  if (!response.ok) {
    const error =
      new Error(
        data?.message ||
        data?.error ||
        `Fapshi HTTP ${response.status}`
      );

    error.status =
      response.status;

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
    throw new Error(
      "URL de paiement invalide."
    );
  }

  let browser;

  try {
    browser =
      await chromium.launch({
        headless: true,

        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage"
        ]
      });

    const page =
      await browser.newPage({
        viewport: {
          width: 1365,
          height: 900
        }
      });

    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(
          msg.text()
        );
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(
        String(error)
      );
    });

    console.log(
      "Ouverture de:",
      url
    );

    await page.goto(url, {
      waitUntil:
        "domcontentloaded",
      timeout: 60000
    });

    try {
      await page.waitForLoadState(
        "networkidle",
        {
          timeout: 15000
        }
      );
    } catch {
      // Certaines pages React ne terminent jamais networkidle.
    }

    await page.waitForTimeout(
      2000
    );

    // ========================================================
    // DÉTECTION DES CHAMPS
    // ========================================================

    const candidates =
      await page.locator(
        "input, textarea, select"
      ).evaluateAll(
        (elements) => {

          return elements
            .filter((el) => {

              const style =
                window.getComputedStyle(
                  el
                );

              const rect =
                el.getBoundingClientRect();

              return (
                style.display !==
                  "none" &&

                style.visibility !==
                  "hidden" &&

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
                  label =
                    labelElement.innerText ||
                    "";
                }
              }

              if (!label) {

                const parent =
                  el.closest("label");

                if (parent) {
                  label =
                    parent.innerText ||
                    "";
                }
              }

              return {

                name:
                  el.getAttribute(
                    "name"
                  ) || "",

                id:
                  el.id || "",

                placeholder:
                  el.getAttribute(
                    "placeholder"
                  ) || "",

                ariaLabel:
                  el.getAttribute(
                    "aria-label"
                  ) || "",

                autocomplete:
                  el.getAttribute(
                    "autocomplete"
                  ) || "",

                inputmode:
                  el.getAttribute(
                    "inputmode"
                  ) || "",

                type:
                  el.getAttribute(
                    "type"
                  ) || "",

                label,

                parentText:
                  el.parentElement
                    ?.innerText
                    ?.substring(
                      0,
                      300
                    ) || "",

                value:
                  el.value || ""
              };
            });
        }
      );

    // ========================================================
    // SÉLECTION DES MEILLEURS CHAMPS
    // ========================================================

    const selectedFields = {};

    for (
      const type of [
        "name",
        "amount",
        "email",
        "phone"
      ]
    ) {

      let best = null;
      let bestScore = 0;

      for (
        let i = 0;
        i < candidates.length;
        i++
      ) {

        const score =
          scoreField(
            candidates[i],
            type
          );

        if (
          score > bestScore
        ) {

          bestScore =
            score;

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

    // ========================================================
    // REMPLISSAGE
    // ========================================================

    const filled = {};

    for (
      const type of [
        "name",
        "amount",
        "email",
        "phone"
      ]
    ) {

      const selected =
        selectedFields[type];

      if (!selected) {
        filled[type] = false;
        continue;
      }

      const value =
        fields[type];

      if (
        value === undefined ||
        value === null
      ) {

        filled[type] = false;
        continue;
      }

      const locator =
        page.locator(
          "input, textarea, select"
        ).nth(
          selected.index
        );

      try {

        const tag =
          await locator.evaluate(
            (el) =>
              el.tagName
                .toLowerCase()
          );

        if (tag === "select") {

          try {

            await locator.selectOption({
              label:
                String(value)
            });

          } catch {

            await locator.selectOption(
              String(value)
            );
          }

        } else {

          await locator.fill(
            String(value)
          );
        }

        await page.waitForTimeout(
          300
        );

        const current =
          await locator.inputValue();

        filled[type] =
          normalize(current) ===
          normalize(value);

      } catch {

        filled[type] = false;
      }
    }

    // ========================================================
    // RECHERCHE BOUTON
    // ========================================================

    const buttons =
      await page.locator(
        "button, input[type='submit'], input[type='button'], [role='button'], a"
      ).evaluateAll(
        (elements) => {

          return elements
            .filter((el) => {

              const style =
                window.getComputedStyle(
                  el
                );

              const rect =
                el.getBoundingClientRect();

              return (
                style.display !==
                  "none" &&

                style.visibility !==
                  "hidden" &&

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
                el.getAttribute(
                  "value"
                ) || "",

              ariaLabel:
                el.getAttribute(
                  "aria-label"
                ) || "",

              title:
                el.getAttribute(
                  "title"
                ) || "",

              name:
                el.getAttribute(
                  "name"
                ) || ""
            }));
        }
      );

    let paymentButton = null;

    for (
      const button of buttons
    ) {

      if (
        isPaymentButton(button)
      ) {

        paymentButton =
          button;

        break;
      }
    }

    // ========================================================
    // CLIC
    // ========================================================

    let submitted = false;

    if (
      submit &&
      paymentButton
    ) {

      const allButtons =
        page.locator(
          "button, input[type='submit'], input[type='button'], [role='button'], a"
        );

      const count =
        await allButtons.count();

      for (
        let i = 0;
        i < count;
        i++
      ) {

        const locator =
          allButtons.nth(i);

        try {

          if (
            !(await locator.isVisible())
          ) {
            continue;
          }

          const info =
            await locator.evaluate(
              (el) => ({

                text:
                  el.innerText ||
                  el.textContent ||
                  "",

                value:
                  el.getAttribute(
                    "value"
                  ) || "",

                ariaLabel:
                  el.getAttribute(
                    "aria-label"
                  ) || "",

                title:
                  el.getAttribute(
                    "title"
                  ) || "",

                name:
                  el.getAttribute(
                    "name"
                  ) || ""
              })
            );

          if (
            !isPaymentButton(info)
          ) {
            continue;
          }

          await locator
            .scrollIntoViewIfNeeded();

          await page.waitForTimeout(
            500
          );

          await locator.click({
            timeout: 15000
          });

          submitted = true;

          await page.waitForTimeout(
            2500
          );

          break;

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

      finalUrl:
        page.url(),

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
// ACCUEIL
// ============================================================

app.get("/", (req, res) => {

  res.json({
    name: "Botfast",
    status: "running"
  });

});

// ============================================================
// HEALTH
// ============================================================

app.get("/health", (req, res) => {

  res.json({
    status: "healthy"
  });

});

// ============================================================
// AUTOMATE
// ============================================================

app.post(
  "/api/automate",
  async (req, res) => {

    try {

      const {
        url,
        fields = {},
        submit = true
      } = req.body || {};

      if (!url) {

        return res.status(400).json({
          success: false,
          error:
            "URL obligatoire."
        });
      }

      const result =
        await automatePayment({
          url,
          fields,
          submit
        });

      return res.json(result);

    } catch (error) {

      console.error(
        "Erreur automate:",
        error.message
      );

      return res.status(500).json({
        success: false,
        error:
          error.message
      });
    }
  }
);

// ============================================================
// PAIEMENT FAPSHI
//
// LE BACKEND ENVOIE:
//
// {
//   amount,
//   phone,
//   fapshiApiKey,
//   fapshiApiUser
// }
//
// BOTFAST NE STOCKE PAS CES IDENTIFIANTS.
// ============================================================

app.post(
  "/api/pay",
  async (req, res) => {

    try {

      const {
        amount,
        phone,
        fapshiApiKey,
        fapshiApiUser
      } = req.body || {};

      // ------------------------------------------------------
      // VALIDATION
      // ------------------------------------------------------

      const numericAmount =
        Number(amount);

      if (
        !Number.isFinite(
          numericAmount
        ) ||
        numericAmount < MIN_AMOUNT
      ) {

        return res.status(400).json({
          success: false,
          error:
            `Montant minimum : ${MIN_AMOUNT} FCFA`
        });
      }

      if (
        !isValidPhone(phone)
      ) {

        return res.status(400).json({
          success: false,
          error:
            "Numéro de téléphone invalide."
        });
      }

      if (!fapshiApiKey) {

        return res.status(400).json({
          success: false,
          error:
            "fapshiApiKey obligatoire."
        });
      }

      if (!fapshiApiUser) {

        return res.status(400).json({
          success: false,
          error:
            "fapshiApiUser obligatoire."
        });
      }

      const cleanPhoneNumber =
        cleanPhone(phone);

      const externalId =
        generateExternalId();

      console.log("");
      console.log(
        "=============================="
      );

      console.log(
        "NOUVEAU PAIEMENT"
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

      console.log(
        "Identifiants Fapshi reçus."
      );

      // ------------------------------------------------------
      // INITIATE-PAY
      // ------------------------------------------------------

      const payload = {

        amount:
          numericAmount,

        email:
          PAYMENT_EMAIL,

        redirectUrl:
          "",

        userId:
          cleanPhoneNumber,

        externalId,

        message:
          "Paiement " +
          PAYMENT_NAME
      };

      const fapshi =
        await fapshiRequest(
          fapshiApiKey,
          fapshiApiUser,
          "POST",
          "/initiate-pay",
          payload
        );

      // ------------------------------------------------------
      // LIEN FAPSHI
      // ------------------------------------------------------

      const paymentLink =
        fapshi?.link;

      const transId =
        fapshi?.transId;

      if (!paymentLink) {

        console.error(
          "Fapshi n'a pas retourné de link."
        );

        return res.status(502).json({

          success: false,

          error:
            "Fapshi n'a pas retourné de lien.",

          fapshiResponse:
            fapshi
        });
      }

      console.log(
        "Lien Fapshi reçu."
      );

      console.log(
        "TransId:",
        transId || "absent"
      );

      // ------------------------------------------------------
      // PLAYWRIGHT
      // ------------------------------------------------------

      const automation =
        await automatePayment({

          url:
            paymentLink,

          fields: {

            name:
              PAYMENT_NAME,

            amount:
              String(
                numericAmount
              ),

            email:
              PAYMENT_EMAIL,

            phone:
              cleanPhoneNumber
          },

          submit: true
        });

      // ------------------------------------------------------
      // RÉPONSE
      // ------------------------------------------------------

      return res.json({

        success: true,

        message:
          "Paiement initié et page Fapshi automatisée.",

        transId:
          transId || null,

        externalId,

        paymentLink,

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

      console.error("");
      console.error(
        "=============================="
      );

      console.error(
        "ERREUR PAIEMENT"
      );

      console.error(
        error.message
      );

      if (error.data) {

        console.error(
          "Fapshi:",
          JSON.stringify(
            error.data,
            null,
            2
          )
        );
      }

      console.error(
        "=============================="
      );

      return res.status(500).json({

        success: false,

        error:
          error.message ||
          "Erreur paiement.",

        fapshiResponse:
          error.data || null
      });
    }
  }
);

// ============================================================
// TESTEUR
// ============================================================

app.get(
  "/tester",
  (req, res) => {

    res.send(`
<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>Botfast Test</title>

<style>

body {
  font-family: Arial, sans-serif;
  background: #f3f4f6;
  margin: 0;
  padding: 20px;
}

.card {
  max-width: 500px;
  margin: auto;
  background: white;
  padding: 25px;
  border-radius: 12px;
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
  padding: 12px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 7px;
  font-size: 16px;
}

button {
  width: 100%;
  padding: 14px;
  margin-top: 20px;
  border: 0;
  border-radius: 7px;
  background: #111;
  color: white;
  font-size: 16px;
}

button:disabled {
  opacity: .5;
}

#status {
  margin-top: 20px;
  padding: 15px;
  border-radius: 8px;
  background: #eee;
  white-space: pre-wrap;
  word-break: break-word;
}

.success {
  background: #d1fae5 !important;
}

.error {
  background: #fee2e2 !important;
}

</style>

</head>

<body>

<div class="card">

<h1>🚀 Botfast</h1>

<p>
Test rapide de l'initiation Fapshi.
</p>

<label>Clé API Fapshi</label>

<input
  id="apiKey"
  type="password"
  placeholder="Colle ta clé API"
/>

<label>API User Fapshi</label>

<input
  id="apiUser"
  type="text"
  placeholder="Colle ton API User"
/>

<label>Montant</label>

<input
  id="amount"
  type="number"
  value="4000"
  min="4000"
/>

<label>Téléphone</label>

<input
  id="phone"
  type="text"
  value="670000000"
/>

<button
  id="button"
  onclick="pay()"
>
🚀 Initier le paiement
</button>

<div id="status">
Prêt.
</div>

</div>

<script>

async function pay() {

  const button =
    document.getElementById(
      "button"
    );

  const status =
    document.getElementById(
      "status"
    );

  const apiKey =
    document.getElementById(
      "apiKey"
    ).value;

  const apiUser =
    document.getElementById(
      "apiUser"
    ).value;

  const amount =
    document.getElementById(
      "amount"
    ).value;

  const phone =
    document.getElementById(
      "phone"
    ).value;

  if (!apiKey || !apiUser) {

    status.className =
      "error";

    status.textContent =
      "❌ Clé API et API User obligatoires.";

    return;
  }

  button.disabled = true;

  status.className = "";

  status.textContent =
    "⏳ Initiation du paiement...";

  try {

    const response =
      await fetch(
        "/api/pay",
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            amount,

            phone,

            fapshiApiKey:
              apiKey,

            fapshiApiUser:
              apiUser

          })

        }
      );

    const data =
      await response.json();

    if (!response.ok) {

      status.className =
        "error";

      status.textContent =
        "❌ " +
        (
          data.error ||
          "Erreur inconnue."
        );

      if (
        data.fapshiResponse
      ) {

        status.textContent +=
          "\\n\\nRéponse Fapshi : " +
          JSON.stringify(
            data.fapshiResponse
          );
      }

      return;
    }

    status.className =
      "success";

    status.textContent =
      "✅ Paiement initié\\n\\n" +

      "TransId : " +
      (
        data.transId ||
        "—"
      ) +

      "\\n\\nLien :\\n" +

      (
        data.paymentLink ||
        "—"
      ) +

      "\\n\\nBouton : " +

      (
        data.automation
          ?.paymentButton ||
        "—"
      ) +

      "\\n\\nAction exécutée : " +

      (
        data.automation
          ?.submitted
          ? "Oui"
          : "Non"
      );

  } catch (error) {

    status.className =
      "error";

    status.textContent =
      "❌ Erreur de connexion :\\n" +
      error.message;

  } finally {

    button.disabled = false;

  }
}

</script>

</body>

</html>
    `);

  }
);

// ============================================================
// 404
// ============================================================

app.use(
  (req, res) => {

    res.status(404).json({

      success: false,

      error:
        "Route introuvable."

    });

  }
);

// ============================================================
// DÉMARRAGE
// ============================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Botfast running on port ${PORT}`
    );

  }
);