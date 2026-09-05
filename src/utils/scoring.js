const { normalize } = require("./validators");

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
    "user name",
    "cardholder",
    "nom du titulaire"
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
    "montant à payer",
    "valeur"
  ],

  email: [
    "email",
    "e-mail",
    "mail",
    "email address",
    "adresse email",
    "adresse e-mail",
    "courriel"
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
    "numéro de téléphone",
    "momo",
    "om",
    "orange money",
    "mtn money",
    "mobile money"
  ]
};

const PAYMENT_BUTTON_KEYWORDS = [
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
  "orange",
  "acheter",
  "commander",
  "régler"
];

/**
 * Calcule un score de pertinence pour un champ HTML donné en fonction du type attendu.
 * @param {object} field 
 * @param {string} type 
 * @returns {number}
 */
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

  // Bonus spécifique pour input type="email" ou "tel"
  if (type === "email" && field.type === "email") score += 50;
  if (type === "phone" && (field.type === "tel" || field.inputmode === "tel")) score += 50;
  if (type === "amount" && (field.type === "number" || field.inputmode === "numeric")) score += 30;

  return score;
}

/**
 * Détermine si un bouton correspond à une action de paiement ou validation.
 * @param {object} button 
 * @returns {boolean}
 */
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

  return PAYMENT_BUTTON_KEYWORDS.some((word) =>
    text.includes(normalize(word))
  );
}

module.exports = {
  FIELD_ALIASES,
  PAYMENT_BUTTON_KEYWORDS,
  scoreField,
  isPaymentButton
};
