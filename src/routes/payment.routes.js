const express = require("express");
const config = require("../config");
const { isValidPhone, cleanPhone, isValidUrl, toCameroonPhone9Digits } = require("../utils/validators");
const fapshiService = require("../services/fapshi.service");
const browserService = require("../services/browser.service");

const router = express.Router();

// ============================================================
// POST /api/pay/stream : Paiement + Stream de logs en TEMPS RÉEL (SSE)
// ============================================================
router.post("/pay/stream", async (req, res) => {
  // Configurer les headers SSE (Server-Sent Events)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const {
      amount,
      phone,
      fapshiApiKey,
      fapshiApiUser,
      name = config.defaults.paymentName,
      email = config.defaults.paymentEmail,
      message,
      redirectUrl = "",
      headless,
    } = req.body || {};

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < config.defaults.minAmount) {
      sendEvent("error", { error: `Montant minimum requis : ${config.defaults.minAmount} FCFA.` });
      return res.end();
    }

    if (!isValidPhone(phone)) {
      sendEvent("error", { error: "Numéro de téléphone invalide (8 à 15 chiffres requis)." });
      return res.end();
    }

    const apiKey = fapshiApiKey || config.fapshi.defaultApiKey;
    const apiUser = fapshiApiUser || config.fapshi.defaultApiUser;

    if (!apiKey || !apiUser) {
      sendEvent("error", { error: "Identifiants Fapshi manquants (apiKey / apiUser)." });
      return res.end();
    }

    const phone9Digits = toCameroonPhone9Digits(phone);
    const isHeadless = headless !== undefined ? Boolean(headless) : config.browser.headless;

    sendEvent("log", {
      step: 1,
      totalSteps: 5,
      type: "FAPSHI_START",
      message: `🚀 [1/5] Initiation du paiement de ${numericAmount} XAF sur Fapshi...`,
      data: { amount: numericAmount, phone: phone9Digits, name, email },
    });

    // 1. Appel API Fapshi
    const fapshiResult = await fapshiService.initiatePayment({
      apiKey,
      apiUser,
      amount: numericAmount,
      phone: phone9Digits,
      email,
      name,
      message,
      redirectUrl,
    });

    const paymentLink = fapshiResult.paymentLink;
    if (!paymentLink) {
      sendEvent("error", {
        error: "Fapshi n'a pas retourné de lien de paiement.",
        details: fapshiResult.fapshiResponse,
      });
      return res.end();
    }

    sendEvent("log", {
      step: 2,
      totalSteps: 5,
      type: "FAPSHI_LINK_READY",
      message: `🔗 [2/5] Lien de paiement Fapshi reçu !`,
      data: {
        transId: fapshiResult.transId,
        paymentLink,
        externalId: fapshiResult.externalId,
      },
    });

    // 2. Pilotage Playwright avec logs en direct
    sendEvent("log", {
      step: 3,
      totalSteps: 5,
      type: "BROWSER_STARTING",
      message: `🌐 [3/5] Démarrage de Chromium (${isHeadless ? "Mode invisible" : "Mode direct visible sur votre écran 👀"})...`,
    });

    const automationResult = await browserService.automatePayment({
      url: paymentLink,
      fields: {
        name,
        amount: String(numericAmount),
        email,
        phone: phone9Digits,
      },
      submit: true,
      headless: isHeadless,
      onProgress: (eventType, eventData) => {
        sendEvent("log", {
          step: 4,
          totalSteps: 5,
          type: eventType,
          message: eventData.message,
          data: eventData,
        });
      },
    });

    sendEvent("complete", {
      success: true,
      message: "Transaction Fapshi et automatisation terminées avec succès !",
      transId: fapshiResult.transId,
      externalId: fapshiResult.externalId,
      paymentLink,
      automation: automationResult,
    });

    res.end();
  } catch (error) {
    sendEvent("error", {
      error: error.message || "Erreur lors du traitement.",
      details: error.data || null,
    });
    res.end();
  }
});

// ============================================================
// POST /api/pay : Mode Standard JSON
// ============================================================
router.post("/pay", async (req, res) => {
  try {
    const {
      amount,
      phone,
      fapshiApiKey,
      fapshiApiUser,
      name = config.defaults.paymentName,
      email = config.defaults.paymentEmail,
      message,
      redirectUrl = "",
      headless,
    } = req.body || {};

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < config.defaults.minAmount) {
      return res.status(400).json({
        success: false,
        error: `Montant minimum requis : ${config.defaults.minAmount} FCFA.`,
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        error: "Numéro de téléphone invalide (8 à 15 chiffres requis).",
      });
    }

    const apiKey = fapshiApiKey || config.fapshi.defaultApiKey;
    const apiUser = fapshiApiUser || config.fapshi.defaultApiUser;

    if (!apiKey || !apiUser) {
      return res.status(400).json({
        success: false,
        error: "Identifiants Fapshi manquants (apiKey / apiUser).",
      });
    }

    const phone9Digits = toCameroonPhone9Digits(phone);
    const isHeadless = headless !== undefined ? Boolean(headless) : config.browser.headless;

    const fapshiResult = await fapshiService.initiatePayment({
      apiKey,
      apiUser,
      amount: numericAmount,
      phone: phone9Digits,
      email,
      name,
      message,
      redirectUrl,
    });

    const paymentLink = fapshiResult.paymentLink;
    if (!paymentLink) {
      return res.status(502).json({
        success: false,
        error: "Fapshi n'a pas retourné de lien de paiement.",
        fapshiResponse: fapshiResult.fapshiResponse,
      });
    }

    const automationResult = await browserService.automatePayment({
      url: paymentLink,
      fields: {
        name,
        amount: String(numericAmount),
        email,
        phone: phone9Digits,
      },
      submit: true,
      headless: isHeadless,
    });

    return res.json({
      success: true,
      message: "Paiement Fapshi initié et formulaire automatisé avec succès.",
      transId: fapshiResult.transId,
      externalId: fapshiResult.externalId,
      paymentLink,
      automation: automationResult,
    });
  } catch (error) {
    console.error("[ERREUR /api/pay]", error.message);
    const statusCode = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || "Erreur lors du traitement du paiement.",
      details: error.data || null,
    });
  }
});

// ============================================================
// GET /api/status/:transId : Vérification du statut Fapshi
// ============================================================
router.get("/status/:transId", async (req, res) => {
  try {
    const { transId } = req.params;
    const apiKey = req.query.apiKey || req.headers["x-api-key"] || config.fapshi.defaultApiKey;
    const apiUser = req.query.apiUser || req.headers["x-api-user"] || config.fapshi.defaultApiUser;

    if (!apiKey || !apiUser) {
      return res.status(400).json({
        success: false,
        error: "apiKey et apiUser requis pour vérifier le statut.",
      });
    }

    const result = await fapshiService.getPaymentStatus({
      apiKey,
      apiUser,
      transId,
    });

    return res.json(result);
  } catch (error) {
    console.error("[ERREUR /api/status]", error.message);
    const statusCode = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || "Erreur lors de la vérification du statut.",
      details: error.data || null,
    });
  }
});

// ============================================================
// POST /api/automate : Automatisation générique d'une URL
// ============================================================
router.post("/automate", async (req, res) => {
  try {
    const { url, fields = {}, submit = true, headless } = req.body || {};

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        error: "Une URL valide (http/https) est obligatoire.",
      });
    }

    const result = await browserService.automatePayment({
      url,
      fields,
      submit,
      headless: headless !== undefined ? Boolean(headless) : config.browser.headless,
    });

    return res.json(result);
  } catch (error) {
    console.error("[ERREUR /api/automate]", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Erreur d'automatisation.",
    });
  }
});

module.exports = router;
