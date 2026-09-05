const express = require("express");
const cors = require("cors");
const path = require("path");
const config = require("./src/config");
const paymentRoutes = require("./src/routes/payment.routes");

const app = express();

// ============================================================
// MIDDLEWARES & CORS (Autorise tous les domaines et requêtes)
// ============================================================
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "apikey", "apiuser", "x-api-key", "x-api-user"],
  credentials: false,
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Fichiers statiques pour l'interface de test moderne
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// ROUTES SYSTÈME & SANTÉ
// ============================================================
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "Botfast",
    version: "2.0.0",
  });
});

app.get("/api", (req, res) => {
  res.json({
    name: "Botfast API",
    version: "2.0.0",
    status: "running",
    endpoints: {
      pay: "POST /api/pay",
      status: "GET /api/status/:transId",
      automate: "POST /api/automate",
      health: "GET /health",
      dashboard: "GET /",
    },
  });
});

// Redirection pratique pour l'ancienne route /tester
app.get("/tester", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ============================================================
// ROUTES API
// ============================================================
app.use("/api", paymentRoutes);

// ============================================================
// GESTION DES ERREURS 404
// ============================================================
app.use((req, res) => {
  if (req.accepts("html")) {
    return res.sendFile(path.join(__dirname, "public", "index.html"));
  }
  res.status(404).json({
    success: false,
    error: `Route introuvable : ${req.method} ${req.originalUrl}`,
  });
});

// ============================================================
// GESTION GLOBALE DES ERREURS
// ============================================================
app.use((err, req, res, next) => {
  console.error("[FATAL SERVER ERROR]", err);
  res.status(500).json({
    success: false,
    error: err.message || "Erreur interne du serveur.",
  });
});

// ============================================================
// DÉMARRAGE DU SERVEUR
// ============================================================
if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, "0.0.0.0", () => {
    console.log("==================================================");
    console.log(`⚡ Botfast v2.0 démarré avec succès !`);
    console.log(`📡 URL locale  : http://localhost:${config.port}`);
    console.log(`🧪 Dashboard   : http://localhost:${config.port}/`);
    console.log(`🩺 Healthcheck : http://localhost:${config.port}/health`);
    console.log(`⚙️ Mode Browser: ${config.browser.headless ? "Headless (invisible)" : "Visible"}`);
    console.log("==================================================");
  });
}

module.exports = app;
