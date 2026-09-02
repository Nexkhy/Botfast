const express = require("express");
const { chromium } = require("playwright");

const app = express();

app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const BOT_API_KEY = process.env.BOT_API_KEY;

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const aliases = {
  name: [
    "name",
    "full name",
    "fullname",
    "nom",
    "nom complet",
    "nom et prenom",
    "customer name",
    "customer full name"
  ],

  amount: [
    "amount",
    "montant",
    "total",
    "price",
    "prix",
    "cost",
    "somme",
    "payment amount",
    "montant paiement"
  ],

  email: [
    "email",
    "e mail",
    "mail",
    "courriel",
    "adresse email",
    "email address"
  ],

  phone: [
    "phone",
    "telephone",
    "tel",
    "mobile",
    "gsm",
    "numero",
    "numero telephone",
    "phone number",
    "telephone number"
  ]
};

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

function scoreField(candidate, requestedName) {
  const key = normalize(requestedName);

  const words = [
    key,
    ...(aliases[requestedName] || []),
    ...(aliases[key] || [])
  ].map(normalize);

  let score = 0;

  const strongProperties = [
    candidate.name,
    candidate.id,
    candidate.placeholder,
    candidate.ariaLabel,
    candidate.label,
    candidate.autocomplete
  ].map(normalize);

  const weakProperties = [
    candidate.parentText,
    candidate.nearbyText
  ].map(normalize);

  for (const word of words) {
    if (!word) continue;

    for (const property of strongProperties) {
      if (!property) continue;

      if (property === word) {
        score += 100;
      } else if (property.includes(word)) {
        score += 50;
      }
    }

    for (const property of weakProperties) {
      if (
        property &&
        property.includes(word)
      ) {
        score += 15;
      }
    }
  }

  const type = normalize(candidate.type);
  const inputmode = normalize(candidate.inputmode);

  if (key === "name") {
    if (candidate.autocomplete === "name") {
      score += 80;
    }

    if (type === "text") {
      score += 10;
    }
  }

  if (key === "email") {
    if (type === "email") {
      score += 100;
    }

    if (candidate.autocomplete === "email") {
      score += 60;
    }
  }

  if (key === "phone") {
    if (type === "tel") {
      score += 100;
    }

    if (inputmode === "tel") {
      score += 80;
    }

    if (candidate.autocomplete === "tel") {
      score += 60;
    }
  }

  if (key === "amount") {
    if (type === "number") {
      score += 60;
    }

    if (
      inputmode === "numeric" ||
      inputmode === "decimal"
    ) {
      score += 50;
    }
  }

  return score;
}

function isPaymentButton(text = "") {
  const value = normalize(text);

  const paymentWords = [
    "payer",
    "pay",
    "payment",
    "pay now",
    "confirmer le paiement",
    "confirm payment",
    "valider le paiement",
    "effectuer le paiement",
    "proceed to payment",
    "make payment"
  ];

  return paymentWords.some(word =>
    value.includes(normalize(word))
  );
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Payment Bot is running"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy"
  });
});

app.post("/api/automate", async (req, res) => {
  let browser = null;

  try {
    if (
      BOT_API_KEY &&
      req.headers["x-api-key"] !== BOT_API_KEY
    ) {
      return res.status(401).json({
        success: false,
        reason: "unauthorized"
      });
    }

    const {
      url,
      fields,
      submit = false
    } = req.body;

    if (
      !url ||
      typeof url !== "string"
    ) {
      return res.status(400).json({
        success: false,
        reason: "invalid_url"
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        reason:
          "only_http_https_allowed"
      });
    }

    if (
      !fields ||
      typeof fields !== "object" ||
      Array.isArray(fields) ||
      Object.keys(fields).length === 0
    ) {
      return res.status(400).json({
        success: false,
        reason: "invalid_fields"
      });
    }

    console.log(
      "================================="
    );

    console.log("Opening:", url);

    console.log(
      "Requested fields:",
      Object.keys(fields)
    );

    console.log(
      "Submit:",
      submit
    );

    console.log(
      "================================="
    );

    browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage({
      viewport: {
        width: 1365,
        height: 900
      }
    });

    page.setDefaultTimeout(15000);

    const consoleErrors = [];

    page.on("console", msg => {
      if (msg.type() === "error") {
        consoleErrors.push(
          msg.text()
        );

        console.log(
          "BROWSER ERROR:",
          msg.text()
        );
      }
    });

    const pageErrors = [];

    page.on("pageerror", error => {
      pageErrors.push(
        error.message
      );

      console.log(
        "PAGE ERROR:",
        error.message
      );
    });

    const networkEvents = [];

    page.on("response", response => {
      try {
        const responseUrl =
          response.url();

        if (
          /pay|payment|fapshi|transaction|checkout/i.test(
            responseUrl
          )
        ) {
          const event = {
            type: "response",
            status:
              response.status(),
            url:
              responseUrl
          };

          networkEvents.push(event);

          console.log(
            "NETWORK:",
            response.status(),
            responseUrl
          );
        }
      } catch {}
    });

    await page.goto(url, {
      waitUntil:
        "domcontentloaded",
      timeout: 30000
    });

    try {
      await page.waitForLoadState(
        "networkidle",
        {
          timeout: 10000
        }
      );
    } catch {}

    await page.waitForTimeout(2000);

    console.log(
      "Page loaded:",
      await page.title()
    );

    const candidates =
      await page.locator(
        "input, textarea, select"
      ).evaluateAll(elements => {

        const getText = element => {
          if (!element) return "";

          return (
            element.innerText ||
            element.textContent ||
            ""
          )
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300);
        };

        return elements.map(
          (el, index) => {

            let label = "";

            if (el.id) {
              const associated =
                document.querySelector(
                  `label[for="${CSS.escape(
                    el.id
                  )}"]`
                );

              if (associated) {
                label =
                  getText(
                    associated
                  );
              }
            }

            const parentLabel =
              el.closest("label");

            if (
              !label &&
              parentLabel
            ) {
              label =
                getText(
                  parentLabel
                );
            }

            const parent =
              el.parentElement ||
              el.closest("div");

            const nearbyText =
              parent
                ? getText(parent)
                : "";

            return {
              index,

              tag:
                el.tagName.toLowerCase(),

              type:
                el.getAttribute(
                  "type"
                ) || "",

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

              label,

              parentText:
                nearbyText,

              nearbyText,

              visible:
                !!(
                  el.offsetWidth ||
                  el.offsetHeight ||
                  el.getClientRects()
                    .length
                ),

              disabled:
                el.disabled
            };
          }
        );
      });

    console.log(
      "Detected elements:",
      candidates.length
    );

    const usedIndexes =
      new Set();

    const filled = {};

    for (
      const [fieldName, value]
      of Object.entries(fields)
    ) {

      const possible =
        candidates
          .filter(candidate =>
            candidate.visible &&
            !candidate.disabled &&
            !usedIndexes.has(
              candidate.index
            )
          )
          .map(candidate => ({
            candidate,

            score:
              scoreField(
                candidate,
                fieldName
              )
          }))
          .sort(
            (a, b) =>
              b.score -
              a.score
          );

      const best =
        possible[0];

      if (
        !best ||
        best.score < 30
      ) {

        console.log(
          "Field not found:",
          fieldName
        );

        return res.status(422).json({
          success: false,
          reason:
            "field_not_found",
          field: fieldName
        });
      }

      const candidate =
        best.candidate;

      console.log(
        `Field "${fieldName}" ->`,
        candidate.name ||
        candidate.id ||
        candidate.placeholder ||
        candidate.tag,
        `score=${best.score}`
      );

      const locator =
        page
          .locator(
            "input, textarea, select"
          )
          .nth(
            candidate.index
          );

      if (
        candidate.tag ===
        "select"
      ) {

        await locator
          .selectOption({
            label:
              String(value)
          })
          .catch(
            async () => {
              await locator.selectOption(
                String(value)
              );
            }
          );

      } else {

        await locator.fill(
          String(value)
        );
      }

      const actualValue =
        await locator.inputValue();

      if (
        String(actualValue) !==
        String(value)
      ) {

        return res.status(422).json({
          success: false,
          reason:
            "field_verification_failed",
          field: fieldName
        });
      }

      usedIndexes.add(
        candidate.index
      );

      filled[fieldName] =
        true;
    }

    if (submit !== true) {

      return res.json({
        success: true,
        filled,
        submitted: false,
        message:
          "Fields detected and filled successfully"
      });
    }

    console.log(
      "Looking for payment button..."
    );

    await page.waitForTimeout(
      1000
    );

    const buttons =
      await page.locator(
        "button, input[type='submit'], input[type='button'], [role='button']"
      ).evaluateAll(
        elements => {

          return elements.map(
            (el, index) => ({
              index,

              text: (
                el.innerText ||
                el.value ||
                el.textContent ||
                ""
              )
                .replace(
                  /\s+/g,
                  " "
                )
                .trim(),

              disabled:
                el.disabled ||
                el.getAttribute(
                  "aria-disabled"
                ) === "true",

              visible:
                !!(
                  el.offsetWidth ||
                  el.offsetHeight ||
                  el.getClientRects()
                    .length
                )
            })
          );
        }
      );

    console.log(
      "Buttons detected:",
      buttons
    );

    const paymentButton =
      buttons.find(button =>
        button.visible &&
        !button.disabled &&
        isPaymentButton(
          button.text
        )
      );

    if (!paymentButton) {

      return res.status(422).json({
        success: false,
        reason:
          "submit_button_not_found",
        filled,
        buttons
      });
    }

    console.log(
      "Payment button found:",
      paymentButton.text
    );

    const buttonLocator =
      page
        .locator(
          "button, input[type='submit'], input[type='button'], [role='button']"
        )
        .nth(
          paymentButton.index
        );

    const beforeUrl =
      page.url();

    await buttonLocator
      .scrollIntoViewIfNeeded();

    await buttonLocator.click();

    console.log(
      "Payment button clicked."
    );

    // Attendre le traitement du paiement
    await page.waitForTimeout(
      5000
    );

    try {
      await page.waitForLoadState(
        "networkidle",
        {
          timeout: 8000
        }
      );
    } catch {}

    await page.waitForTimeout(
      3000
    );

    const finalUrl =
      page.url();

    const pageTitle =
      await page.title();

    const pageText =
      await page
        .locator("body")
        .innerText()
        .catch(
          () => ""
        );

    const cleanPageText =
      pageText
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 5000);

    const errorKeywords = [
      "error",
      "erreur",
      "failed",
      "echec",
      "échoué",
      "invalid",
      "invalide",
      "declined",
      "refused",
      "refusé",
      "cancelled",
      "annulé",
      "expired",
      "insufficient",
      "insuffisant"
    ];

    const detectedErrors = [];

    const normalizedPageText =
      normalize(
        cleanPageText
      );

    for (
      const keyword
      of errorKeywords
    ) {

      if (
        normalizedPageText.includes(
          normalize(keyword)
        )
      ) {
        detectedErrors.push(
          keyword
        );
      }
    }

    console.log(
      "Final URL:",
      finalUrl
    );

    console.log(
      "Detected errors:",
      detectedErrors
    );

    return res.json({
      success:
        detectedErrors.length === 0,

      filled,

      submitted: true,

      paymentButton:
        paymentButton.text,

      beforeUrl,

      finalUrl,

      pageTitle,

      detectedErrors,

      consoleErrors,

      pageErrors,

      networkEvents,

      pageText:
        cleanPageText,

      message:
        detectedErrors.length === 0
          ? "Payment action executed and page checked"
          : "Payment action executed but possible error detected"
    });

  } catch (error) {

    console.error(
      "Automation error:",
      error
    );

    return res.status(500).json({
      success: false,
      reason:
        "automation_error",
      message:
        error.message
    });

  } finally {

    if (browser) {

      try {
        await browser.close();
      } catch {}
    }
  }
});

app.get("/tester", (req, res) => {

  res.send(`
<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1"
>

<title>Botfast Tester</title>

<style>

body {
  font-family: Arial, sans-serif;
  max-width: 600px;
  margin: 40px auto;
  padding: 20px;
  background: #f5f5f5;
}

.box {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,.08);
}

h1 {
  margin-top: 0;
}

label {
  display: block;
  margin-top: 15px;
  font-weight: bold;
}

input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  margin-top: 6px;
  border: 1px solid #ccc;
  border-radius: 7px;
}

button {
  width: 100%;
  margin-top: 22px;
  padding: 13px;
  border: 0;
  border-radius: 7px;
  background: #111;
  color: white;
  font-size: 16px;
  cursor: pointer;
}

button:disabled {
  opacity: .6;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}

.checkbox input {
  width: auto;
  margin: 0;
}

.warning {
  margin-top: 15px;
  padding: 12px;
  background: #fff3cd;
  border-radius: 8px;
}

pre {
  margin-top: 20px;
  padding: 15px;
  background: #111;
  color: #0f0;
  border-radius: 8px;
  white-space: pre-wrap;
  overflow-x: auto;
}

</style>

</head>

<body>

<div class="box">

<h1>🤖 Botfast Tester</h1>

<label>
Nom complet
</label>

<input
  id="name"
  type="text"
  placeholder="Jean Dupont"
>

<label>
URL du formulaire
</label>

<input
  id="url"
  type="url"
  placeholder="https://exemple.com/formulaire"
>

<label>
Montant
</label>

<input
  id="amount"
  type="text"
  placeholder="4000"
>

<label>
Email
</label>

<input
  id="email"
  type="email"
  placeholder="client@example.com"
>

<label>
Téléphone
</label>

<input
  id="phone"
  type="text"
  placeholder="690000000"
>

<div class="checkbox">

<input
  id="submit"
  type="checkbox"
>

<label
  for="submit"
  style="margin:0;"
>
Lancer le paiement
</label>

</div>

<div class="warning">

⚠️ Si cette option est cochée,
le bouton de paiement sera réellement
cliqué.

</div>

<button
  id="testBtn"
  onclick="runTest()"
>
Tester le formulaire
</button>

<pre id="result">
Résultat du test...
</pre>

</div>

<script>

async function runTest() {

  const button =
    document.getElementById(
      "testBtn"
    );

  const result =
    document.getElementById(
      "result"
    );

  const name =
    document.getElementById(
      "name"
    ).value.trim();

  const url =
    document.getElementById(
      "url"
    ).value.trim();

  const amount =
    document.getElementById(
      "amount"
    ).value.trim();

  const email =
    document.getElementById(
      "email"
    ).value.trim();

  const phone =
    document.getElementById(
      "phone"
    ).value.trim();

  const submit =
    document.getElementById(
      "submit"
    ).checked;

  if (!url) {

    result.textContent =
      "❌ Veuillez entrer une URL.";

    return;
  }

  button.disabled = true;

  button.textContent =
    "⏳ Test en cours...";

  result.textContent =
    "Ouverture du formulaire...";

  try {

    const response =
      await fetch(
        "/api/automate",
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            url,

            fields: {

              name,

              amount,

              email,

              phone

            },

            submit

          })

        }
      );

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

    button.textContent =
      "Tester le formulaire";
  }
}

</script>

</body>

</html>
  `);
});

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Server running on port ${PORT}`
    );

  }
);