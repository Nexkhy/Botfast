const config = require("../config");
const { generateExternalId, cleanPhone } = require("../utils/validators");

/**
 * Exécute un appel HTTP authentifié vers l'API Fapshi.
 * @param {string} apiKey 
 * @param {string} apiUser 
 * @param {string} method 
 * @param {string} path 
 * @param {object|undefined} body 
 * @returns {Promise<object>}
 */
async function fapshiRequest(apiKey, apiUser, method, path, body) {
  const key = apiKey || config.fapshi.defaultApiKey;
  const user = apiUser || config.fapshi.defaultApiUser;

  if (!key) {
    throw new Error("La clé API Fapshi (apiKey) est obligatoire.");
  }

  if (!user) {
    throw new Error("L'API User Fapshi (apiUser) est obligatoire.");
  }

  const url = `${config.fapshi.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      apiuser: user,
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  console.log(`[FAPSHI API] ${method} ${url}`);
  if (body) {
    console.log(`[FAPSHI BODY]`, JSON.stringify(body));
  }

  const response = await fetch(url, options);
  const text = await response.text();

  console.log(`[FAPSHI STATUS] ${response.status}`);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.substring(0, 2000) };
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || `Erreur Fapshi HTTP ${response.status}`
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Initie un paiement avec l'API Fapshi.
 */
async function initiatePayment({
  apiKey,
  apiUser,
  amount,
  phone,
  email,
  name,
  externalId,
  redirectUrl = "",
  message,
}) {
  const cleanPhoneNumber = cleanPhone(phone);
  const extId = externalId || generateExternalId();
  const customerEmail = email || config.defaults.paymentEmail;
  const customerName = name || config.defaults.paymentName;
  const paymentMessage = message || `Paiement ${customerName}`;

  const payload = {
    amount: Number(amount),
    email: customerEmail,
    userId: cleanPhoneNumber,
    externalId: extId,
    redirectUrl,
    message: paymentMessage,
  };

  const response = await fapshiRequest(apiKey, apiUser, "POST", "/initiate-pay", payload);

  return {
    success: true,
    transId: response.transId || null,
    paymentLink: response.link || null,
    externalId: extId,
    fapshiResponse: response,
  };
}

/**
 * Vérifie le statut d'un paiement Fapshi.
 */
async function getPaymentStatus({ apiKey, apiUser, transId }) {
  if (!transId) {
    throw new Error("Le transId est obligatoire pour vérifier le statut.");
  }

  const response = await fapshiRequest(apiKey, apiUser, "GET", `/payment-status/${encodeURIComponent(transId)}`);
  return {
    success: true,
    transId,
    status: response.status,
    financialStatus: response.financialStatus,
    amount: response.amount,
    fapshiResponse: response,
  };
}

/**
 * Expire un paiement Fapshi.
 */
async function expirePayment({ apiKey, apiUser, transId }) {
  if (!transId) {
    throw new Error("Le transId est obligatoire pour expirer un paiement.");
  }

  const response = await fapshiRequest(apiKey, apiUser, "POST", "/expire-pay", { transId });
  return {
    success: true,
    transId,
    fapshiResponse: response,
  };
}

module.exports = {
  fapshiRequest,
  initiatePayment,
  getPaymentStatus,
  expirePayment,
};
