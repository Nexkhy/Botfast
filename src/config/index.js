require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  fapshi: {
    apiUrl: (process.env.FAPSHI_API_URL || "https://live.fapshi.com").replace(/\/$/, ""),
    defaultApiKey: process.env.FAPSHI_API_KEY || "FAK_7d7275a12942d1aa7f6a86e75db4fe37",
    defaultApiUser: process.env.FAPSHI_API_USER || "523f8249-0b49-48dc-8dfc-a1395caeb3e9",
  },
  defaults: {
    paymentName: process.env.DEFAULT_PAYMENT_NAME || "Junior Kameni",
    paymentEmail: process.env.DEFAULT_PAYMENT_EMAIL || "antigravity2371@gmail.com",
    minAmount: parseInt(process.env.MIN_AMOUNT, 10) || 100,
  },
  browser: {
    headless: process.env.HEADLESS !== "false",
  }
};
