require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  fapshi: {
    apiUrl: (process.env.FAPSHI_API_URL || "https://live.fapshi.com").replace(/\/$/, ""),
    defaultApiKey: process.env.FAPSHI_API_KEY || null,
    defaultApiUser: process.env.FAPSHI_API_USER || null,
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
