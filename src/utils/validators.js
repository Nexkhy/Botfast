/**
 * Normalise une chaîne de caractères (supprime les accents, met en minuscule et trim).
 * @param {*} value 
 * @returns {string}
 */
function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Nettoie un numéro de téléphone pour ne conserver que les chiffres et le '+' initial.
 * @param {*} phone 
 * @returns {string}
 */
function cleanPhone(phone) {
  return String(phone || "")
    .trim()
    .replace(/[^\d+]/g, "");
}

/**
 * Valide si un numéro de téléphone a une longueur comprise entre 8 et 15 chiffres.
 * @param {*} phone 
 * @returns {boolean}
 */
function isValidPhone(phone) {
  const digits = cleanPhone(phone).replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Extrait le format local camerounais à 9 chiffres (ex: 6xxxxxxxx).
 * Supprime le préfixe international +237 ou 237 si présent.
 * @param {*} phone 
 * @returns {string}
 */
function toCameroonPhone9Digits(phone) {
  let digits = cleanPhone(phone).replace(/\D/g, "");
  if (digits.startsWith("237") && digits.length > 9) {
    digits = digits.substring(3);
  }
  return digits;
}

/**
 * Vérifie si une chaîne est une URL HTTP ou HTTPS valide.
 * @param {*} value 
 * @returns {boolean}
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
 * Génère un identifiant externe unique pour les transactions Fapshi.
 * @param {string} prefix 
 * @returns {string}
 */
function generateExternalId(prefix = "BOTFAST") {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${randomStr}`;
}

module.exports = {
  normalize,
  cleanPhone,
  isValidPhone,
  toCameroonPhone9Digits,
  isValidUrl,
  generateExternalId
};
