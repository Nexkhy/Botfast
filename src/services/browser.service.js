const { chromium } = require("playwright");
const config = require("../config");
const { isValidUrl, normalize, toCameroonPhone9Digits } = require("../utils/validators");
const { scoreField, isPaymentButton } = require("../utils/scoring");

/**
 * Automatise le remplissage et la validation de paiement via Playwright.
 * @param {object} params
 * @param {string} params.url - URL de la page de paiement.
 * @param {object} params.fields - Données à injecter ({ name, amount, email, phone, ... }).
 * @param {boolean} [params.submit=true] - Faut-il soumettre le formulaire ?
 * @param {boolean} [params.headless] - Mode invisible (true) ou visible en direct (false).
 * @param {Function} [params.onProgress] - Callback pour émettre des logs en temps réel.
 * @returns {Promise<object>}
 */
async function automatePayment({
  url,
  fields = {},
  submit = true,
  headless = config.browser.headless,
  onProgress = () => {},
}) {
  if (!isValidUrl(url)) {
    throw new Error(`URL de paiement invalide : "${url}"`);
  }

  let browser;
  const isDirectVisibleMode = !headless;

  try {
    onProgress("BROWSER_START", {
      message: `Lancement du navigateur Chromium (${isDirectVisibleMode ? "Mode VISIBLE en direct 👀" : "Mode HEADLESS en arrière-plan ⚡"})...`,
      headless,
    });

    browser = await chromium.launch({
      headless,
      slowMo: isDirectVisibleMode ? 80 : 0, // Ralenti en mode visible pour que l'œil humain voie chaque frappe
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        isDirectVisibleMode ? "--window-size=1280,800" : "",
      ].filter(Boolean),
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    let gatewayResponse = null;

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(String(error));
    });

    // Écoute des réponses réseau de la passerelle de paiement (ex: Fapshi / MTN / Orange)
    page.on("response", async (res) => {
      const resUrl = res.url();
      if (resUrl.includes("merchantpay") || resUrl.includes("fapshi") && res.request().method() === "POST") {
        try {
          const bodyText = await res.text();
          let parsed;
          try { parsed = JSON.parse(bodyText); } catch { parsed = bodyText; }
          gatewayResponse = {
            status: res.status(),
            url: resUrl,
            data: parsed,
          };
          onProgress("GATEWAY_RESPONSE", {
            message: `Réponse de la passerelle de paiement (${res.status()})`,
            gatewayResponse,
          });
        } catch {
          // Ignore
        }
      }
    });

    onProgress("PAGE_NAVIGATING", { message: `Navigation vers la page : ${url}` });
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    try {
      await page.waitForLoadState("networkidle", { timeout: 8000 });
    } catch {
      // Les pages dynamiques Next.js/React peuvent avoir des flux longs
    }

    await page.waitForTimeout(1500);

    const isFapshiCheckout = url.includes("checkout.fapshi.com");
    const filled = { name: false, phone: false, email: false, amount: false };
    const rawPhone = fields.phone || "";
    const phone9Digits = toCameroonPhone9Digits(rawPhone);

    onProgress("FIELDS_DETECTING", { message: "Détection des champs du formulaire de paiement..." });

    // ========================================================
    // CAS A : PAGE OFFICIELLE FAPSHI CHECKOUT
    // ========================================================
    if (isFapshiCheckout) {
      onProgress("FAPSHI_SPECIALIZED", { message: "Structure Fapshi Checkout reconnue." });

      // 1. Champ Téléphone Fapshi
      const phoneSelector = "#bootstrap-input-phone, input[name='phone'], input[placeholder*='6xxxx']";
      const phoneInput = page.locator(phoneSelector);
      if (await phoneInput.count() > 0) {
        onProgress("FIELD_TYPING", { field: "phone", value: phone9Digits, message: `Saisie du numéro de téléphone : ${phone9Digits}` });
        await phoneInput.first().click();
        await phoneInput.first().fill(phone9Digits);
        await phoneInput.first().dispatchEvent("input");
        await phoneInput.first().dispatchEvent("change");
        filled.phone = true;
      }

      // 2. Champ Nom Fapshi
      const nameSelector = "#bootstrap-input-name, input[name='clientName']";
      const nameInput = page.locator(nameSelector);
      if (fields.name && await nameInput.count() > 0) {
        onProgress("FIELD_TYPING", { field: "name", value: fields.name, message: `Saisie du nom : ${fields.name}` });
        await nameInput.first().click();
        await nameInput.first().fill(String(fields.name));
        await nameInput.first().dispatchEvent("input");
        await nameInput.first().dispatchEvent("change");
        filled.name = true;
      }
    }

    // ========================================================
    // CAS B : FORMULAIRE WEB GÉNÉRIQUE (SCORING HEURISTIQUE)
    // ========================================================
    if (!filled.phone || !filled.name) {
      const candidates = await page.locator("input, textarea, select").evaluateAll((elements) => {
        return elements
          .filter((el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0 &&
              !el.disabled &&
              el.type !== "hidden" &&
              el.type !== "submit" &&
              el.type !== "button"
            );
          })
          .map((el) => {
            let label = "";
            if (el.id) {
              const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
              if (labelEl) label = labelEl.innerText || "";
            }
            if (!label) {
              const parent = el.closest("label");
              if (parent) label = parent.innerText || "";
            }
            return {
              name: el.getAttribute("name") || "",
              id: el.id || "",
              placeholder: el.getAttribute("placeholder") || "",
              ariaLabel: el.getAttribute("aria-label") || "",
              autocomplete: el.getAttribute("autocomplete") || "",
              inputmode: el.getAttribute("inputmode") || "",
              type: el.getAttribute("type") || "",
              label,
              parentText: el.parentElement?.innerText?.substring(0, 300) || "",
              value: el.value || "",
            };
          });
      });

      const fieldTypes = ["phone", "name", "amount", "email"];
      const interactiveElements = page.locator(
        "input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select"
      );

      for (const type of fieldTypes) {
        if (filled[type]) continue; // Déjà rempli par Fapshi spécialisé

        let best = null;
        let bestScore = 0;
        for (let i = 0; i < candidates.length; i++) {
          const score = scoreField(candidates[i], type);
          if (score > bestScore) {
            bestScore = score;
            best = { index: i, ...candidates[i] };
          }
        }

        const val = type === "phone" ? phone9Digits : fields[type];
        if (best && bestScore > 0 && val !== undefined && val !== null) {
          try {
            const locator = interactiveElements.nth(best.index);
            onProgress("FIELD_TYPING", { field: type, value: val, message: `Remplissage du champ ${type} : "${val}"` });
            await locator.scrollIntoViewIfNeeded();
            await locator.click();
            await locator.fill(String(val));
            await locator.dispatchEvent("input");
            await locator.dispatchEvent("change");
            filled[type] = true;
          } catch (e) {
            console.warn(`[PLAYWRIGHT] Erreur sur ${type}:`, e.message);
          }
        }
      }
    }

    // ========================================================
    // 3. CLIC SUR LE BOUTON DE PAIEMENT
    // ========================================================
    let submitted = false;
    let paymentButtonText = null;

    if (submit) {
      onProgress("BUTTON_SEARCH", { message: "Recherche du bouton de paiement / validation..." });

      // Priorité 1: Bouton spécifique Fapshi Momo/OM
      const fapshiBtn = page.locator("button:has-text('Pay with Momo Or OM'), button:has-text('Pay with')");
      if (await fapshiBtn.count() > 0 && await fapshiBtn.first().isVisible()) {
        paymentButtonText = (await fapshiBtn.first().innerText()).trim();
        onProgress("BUTTON_CLICKING", { message: `Clic sur le bouton Fapshi : "${paymentButtonText}"...` });
        await fapshiBtn.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await fapshiBtn.first().click({ timeout: 10000 });
        submitted = true;
      } else {
        // Priorité 2: Recherche heuristique
        const allButtons = page.locator("button, input[type='submit'], input[type='button'], [role='button'], a");
        const count = await allButtons.count();

        for (let i = 0; i < count; i++) {
          const locator = allButtons.nth(i);
          try {
            if (!(await locator.isVisible())) continue;
            const info = await locator.evaluate((el) => ({
              text: el.innerText || el.textContent || "",
              value: el.getAttribute("value") || "",
              ariaLabel: el.getAttribute("aria-label") || "",
              title: el.getAttribute("title") || "",
              name: el.getAttribute("name") || "",
            }));

            if (!isPaymentButton(info)) continue;

            paymentButtonText = info.text.trim() || info.value || info.ariaLabel || "Payer";
            onProgress("BUTTON_CLICKING", { message: `Clic sur le bouton détecté : "${paymentButtonText}"...` });
            await locator.scrollIntoViewIfNeeded();
            await page.waitForTimeout(400);
            await locator.click({ timeout: 10000 });
            submitted = true;
            break;
          } catch {
            // Continuer
          }
        }
      }

      if (submitted) {
        onProgress("PAYMENT_SUBMITTED", {
          message: "Formulaire soumis ! Attente de la confirmation réseau de l'opérateur...",
          paymentButton: paymentButtonText,
        });

        // Laisser 6 à 8 secondes pour que la requête USSD parte vers l'opérateur
        const waitTime = isDirectVisibleMode ? 8000 : 5000;
        await page.waitForTimeout(waitTime);
      }
    }

    onProgress("DONE", {
      message: submitted
        ? "✅ Automatisation terminée ! Vérifiez la notification USSD / SMS sur votre téléphone."
        : "⚠️ Formulaire rempli mais aucun bouton de paiement cliqué.",
      filled,
      submitted,
    });

    return {
      success: true,
      filled,
      submitted,
      paymentButton: paymentButtonText,
      finalUrl: page.url(),
      gatewayResponse,
      consoleErrors,
      pageErrors,
    };
  } finally {
    if (browser) {
      await browser.close();
      onProgress("BROWSER_CLOSED", { message: "Navigateur fermé." });
    }
  }
}

module.exports = {
  automatePayment,
};
