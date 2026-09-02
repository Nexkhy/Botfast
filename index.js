const express = require("express");
const { chromium } = require("playwright");

const app = express();

app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const BOT_API_KEY = process.env.BOT_API_KEY;

/**
 * Normalise un texte pour faciliter la comparaison
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
 * Mots-clés connus pour les champs courants
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
 * Vérifie que l'URL est autorisée
 */
function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Calcule la pertinence d'un champ HTML
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
    if (candidate.autocomplete === "email") score += 60;
  }

  if (key === "phone") {
    if (type === "tel") score += 100;
    if (inputmode === "tel") score += 80;
    if (candidate.autocomplete === "tel") score += 60;
  }

  if (key === "amount") {
    if (type === "number") score += 60;
    if (inputmode === "numeric" || inputmode === "decimal") {
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
 * API principale d'automatisation
 */
app.post("/api/automate", async (req, res) => {
  let browser = null;

  try {
    // Protection de l'API
    if (
      BOT_API_KEY &&
      req.headers["x-api-key"] !== BOT_API_KEY
    ) {
      return res.status(401).json({
        success: false,
        reason: "unauthorized"
      });
    }

    const { url, fields } = req.body;

    // Vérification URL
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

    // Vérification des champs
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
    console.log("Requested fields:", Object.keys(fields));

    // Lancement du navigateur
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

    // Chargement de la page
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    // Attendre les applications React/Vue/etc.
    try {
      await page.waitForLoadState("networkidle", {
        timeout: 10000
      });
    } catch {}

    await page.waitForTimeout(1500);

    console.log("Page loaded:", await page.title());

    /**
     * Analyse du DOM
     */
    const candidates = await page.locator(
      "input, textarea, select"
    ).evaluateAll((elements) => {
      return elements.map((el, index) => {
        const getText = (element) => {
          if (!element) return "";

          return (element.innerText ||
            element.textContent ||
            "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300);
        };

        let label = "";

        if (el.id) {
          const associated = document.querySelector(
            `label[for="${CSS.escape(el.id)}"]`
          );

          if (associated) {
            label = getText(associated);
          }
        }

        const parentLabel = el.closest("label");

        if (!label && parentLabel) {
          label = getText(parentLabel);
        }

        const parent =
          el.parentElement ||
          el.closest("div");

        const nearbyText = parent
          ? getText(parent)
          : "";

        return {
          index,
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type") || "",
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
          label,
          parentText: nearbyText,
          nearbyText,
          visible:
            !!(
              el.offsetWidth ||
              el.offsetHeight ||
              el.getClientRects().length
            ),
          disabled: el.disabled
        };
      });
    });

    console.log(
      "Detected elements:",
      candidates.length
    );

    const usedIndexes = new Set();
    const filled = {};

    /**
     * Cherche et remplit chaque champ
     */
    for (const [fieldName, value] of Object.entries(fields)) {
      const possible = candidates
        .filter(
          (candidate) =>
            candidate.visible &&
            !candidate.disabled &&
            !usedIndexes.has(candidate.index)
        )
        .map((candidate) => ({
          candidate,
          score: scoreField(candidate, fieldName)
        }))
        .sort((a, b) => b.score - a.score);

      const best = possible[0];

      if (!best || best.score < 30) {
        console.log(
          `Field not found: ${fieldName}`
        );

        return res.status(422).json({
          success: false,
          reason: "field_not_found",
          field: fieldName
        });
      }

      const candidate = best.candidate;

      console.log(
        `Field "${fieldName}" ->`,
        candidate.name ||
          candidate.id ||
          candidate.placeholder ||
          candidate.tag,
        `score=${best.score}`
      );

      const locator = page
        .locator("input, textarea, select")
        .nth(candidate.index);

      if (candidate.tag === "select") {
        await locator.selectOption({
          label: String(value)
        }).catch(async () => {
          await locator.selectOption(
            String(value)
          );
        });
      } else {
        await locator.fill(String(value));
      }

      // Vérification
      let actualValue = "";

      if (candidate.tag === "select") {
        actualValue = await locator.inputValue();
      } else {
        actualValue = await locator.inputValue();
      }

      if (String(actualValue) !== String(value)) {
        return res.status(422).json({
          success: false,
          reason: "field_verification_failed",
          field: fieldName
        });
      }

      usedIndexes.add(candidate.index);
      filled[fieldName] = true;
    }

    /**
     * IMPORTANT :
     * On ne clique pas sur le bouton de paiement.
     */
    return res.json({
      success: true,
      filled,
      submitted: false,
      message:
        "Fields detected and filled successfully"
    });

  } catch (error) {
    console.error("Automation error:", error);

    return res.status(500).json({
      success: false,
      reason: "automation_error",
      message: error.message
    });

  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Server running on port ${PORT}`
  );
});
