const express = require("express");
const { chromium } = require("playwright");

const app = express();

app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const BOT_API_KEY = process.env.BOT_API_KEY;

/**
 * Normalise un texte
 */
function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Alias des champs courants
 */
const aliases = {
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

/**
 * Mots permettant d'identifier un bouton de paiement
 */
const paymentButtonWords = [
  "payer",
  "pay",
  "payment",
  "pay now",
  "pay now",
  "confirmer le paiement",
  "confirm payment",
  "valider le paiement",
  "effectuer le paiement",
  "proceed to payment",
  "make payment"
];

/**
 * Vérifie l'URL
 */
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

/**
 * Score d'un champ
 */
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
    candidate.label
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
      if (property && property.includes(word)) {
        score += 15;
      }
    }
  }

  const type = normalize(candidate.type);
  const inputmode = normalize(candidate.inputmode);

  if (key === "email") {
    if (type === "email") score += 100;

    if (candidate.autocomplete === "email") {
      score += 60;
    }
  }

  if (key === "phone") {
    if (type === "tel") score += 100;

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

/**
 * Page d'accueil
 */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Payment Bot is running"
  });
});

/**
 * Health check
 */
app.get("/health", (req, res) => {
  res.json({
    status: "healthy"
  });
});

/**
 * API principale
 */
app.post("/api/automate", async (req, res) => {
  let browser = null;

  try {
    /**
     * Protection facultative.
     * Dès que BOT_API_KEY est configurée sur Render,
     * l'API devient protégée.
     */
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

    /**
     * Vérification URL
     */
    if (!url || typeof url !== "string") {
      return res.status(400).json({
        success: false,
        reason: "invalid_url"
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        reason: "only_http_https_allowed"
      });
    }

    /**
     * Vérification des champs
     */
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

    console.log("Opening:", url);
    console.log(
      "Requested fields:",
      Object.keys(fields)
    );
    console.log(
      "Submit requested:",
      submit === true
    );

    /**
     * Lancement navigateur
     */
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

    /**
     * Chargement page
     */
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    /**
     * Attente React / JavaScript
     */
    try {
      await page.waitForLoadState(
        "networkidle",
        {
          timeout: 10000
        }
      );
    } catch {}

    await page.waitForTimeout(1500);

    console.log(
      "Page loaded:",
      await page.title()
    );

    /**
     * Analyse des champs
     */
    const candidates = await page
      .locator(
        "input, textarea, select"
      )
      .evaluateAll((elements) => {

        return elements.map(
          (el, index) => {

            const getText = (element) => {
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

            let label = "";

            /**
             * Label associé par ID
             */
            if (el.id) {

              const associated =
                document.querySelector(
                  `label[for="${CSS.escape(el.id)}"]`
                );

              if (associated) {
                label = getText(
                  associated
                );
              }
            }

            /**
             * Label parent
             */
            const parentLabel =
              el.closest("label");

            if (
              !label &&
              parentLabel
            ) {
              label =
                getText(parentLabel);
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

    const usedIndexes = new Set();
    const filled = {};

    /**
     * Détection + remplissage
     */
    for (
      const [fieldName, value]
      of Object.entries(fields)
    ) {

      const possible = candidates

        .filter(
          (candidate) =>
            candidate.visible &&
            !candidate.disabled &&
            !usedIndexes.has(
              candidate.index
            )
        )

        .map((candidate) => ({
          candidate,

          score:
            scoreField(
              candidate,
              fieldName
            )
        }))

        .sort(
          (a, b) =>
            b.score - a.score
        );

      const best =
        possible[0];

      if (
        !best ||
        best.score < 30
      ) {

        console.log(
          `Field not found: ${fieldName}`
        );

        return res.status(422).json({
          success: false,

          reason:
            "field_not_found",

          field:
            fieldName,

          filled
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
          .nth(candidate.index);

      /**
       * Select
       */
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

              await locator
                .selectOption(
                  String(value)
                );

            }
          );

      }

      /**
       * Input / textarea
       */
      else {

        await locator.fill(
          String(value)
        );

      }

      /**
       * Vérification
       */
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

          field:
            fieldName,

          filled
        });
      }

      usedIndexes.add(
        candidate.index
      );

      filled[fieldName] =
        true;
    }

    /**
     * Si submit = false,
     * on s'arrête après remplissage.
     */
    if (submit !== true) {

      return res.json({

        success: true,

        filled,

        submitted: false,

        message:
          "Fields detected and filled successfully"

      });
    }

    /**
     * Recherche du bouton de paiement
     */
    console.log(
      "Searching payment button..."
    );

    const buttons =
      await page
        .locator(
          'button, input[type="submit"], input[type="button"], [role="button"]'
        )
        .evaluateAll(
          (elements) => {

            return elements.map(
              (el, index) => {

                const text =
                  (
                    el.innerText ||
                    el.value ||
                    el.getAttribute(
                      "aria-label"
                    ) ||
                    el.getAttribute(
                      "title"
                    ) ||
                    ""
                  )
                    .replace(
                      /\s+/g,
                      " "
                    )
                    .trim();

                return {

                  index,

                  text,

                  normalized:
                    text
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(
                        /[\u0300-\u036f]/g,
                        ""
                      ),

                  visible:
                    !!(
                      el.offsetWidth ||
                      el.offsetHeight ||
                      el
                        .getClientRects()
                        .length
                    ),

                  disabled:
                    el.disabled
                };
              }
            );
          }
        );

    /**
     * Trouve un bouton explicitement lié
     * au paiement
     */
    const submitButton =
      buttons.find(
        (button) => {

          if (
            !button.visible ||
            button.disabled
          ) {
            return false;
          }

          return paymentButtonWords.some(
            (word) =>
              button.normalized.includes(
                normalize(word)
              )
          );
        }
      );

    if (!submitButton) {

      console.log(
        "Payment button not found"
      );

      return res.status(422).json({

        success: false,

        reason:
          "submit_button_not_found",

        filled,

        submitted: false

      });
    }

    console.log(
      "Payment button found:",
      submitButton.text
    );

    /**
     * Clic uniquement sur le bouton
     * identifié comme bouton de paiement
     */
    await page
      .locator(
        'button, input[type="submit"], input[type="button"], [role="button"]'
      )
      .nth(
        submitButton.index
      )
      .click();

    /**
     * Petite attente pour laisser
     * la page réagir
     */
    await page.waitForTimeout(
      2500
    );

    console.log(
      "Payment button clicked"
    );

    return res.json({

      success: true,

      filled,

      submitted: true,

      button:
        submitButton.text,

      finalUrl:
        page.url(),

      message:
        "Form submitted successfully"

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

/**
 * Interface de test
 */
app.get("/tester", (req, res) => {

  res.send(`
<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1"
/>

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

  box-shadow:
    0 2px 10px
    rgba(0,0,0,.08);

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

  border:
    1px solid #ccc;

  border-radius: 7px;

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

.warning {

  margin-top: 12px;

  padding: 10px;

  background: #fff3cd;

  border-radius: 7px;

  font-size: 14px;

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
URL du formulaire
</label>

<input
  id="url"
  type="url"
  placeholder="https://exemple.com/formulaire"
/>

<label>
Montant
</label>

<input
  id="amount"
  type="text"
  placeholder="4000"
/>

<label>
Email
</label>

<input
  id="email"
  type="email"
  placeholder="client@example.com"
/>

<label>
Téléphone
</label>

<input
  id="phone"
  type="text"
  placeholder="690000000"
/>

<label class="checkbox">

<input
  id="submit"
  type="checkbox"
/>

<span>
Lancer le paiement
</span>

</label>

<div class="warning">

⚠️ Si cette case est cochée,
le bot pourra réellement cliquer
sur le bouton de paiement trouvé
sur la page.

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
    submit
      ? "Ouverture et préparation du paiement..."
      : "Ouverture du formulaire...";

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

          body:
            JSON.stringify({

              url,

              fields: {

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

  }

  catch (error) {

    result.textContent =
      "❌ Erreur : " +
      error.message;

  }

  finally {

    button.disabled =
      false;

    button.textContent =
      "Tester le formulaire";

  }

}

</script>

</body>

</html>
  `);
});

/**
 * Démarrage serveur
 */
app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Server running on port ${PORT}`
    );

  }
);

