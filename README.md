# ⚡ Botfast — Automated Payment & Form Bot

Botfast est une solution d'automatisation de paiement web et de remplissage intelligent de formulaires basée sur **Node.js, Express et Playwright**.

---

## 🚀 Démarrage Rapide

### 1. Installation
```bash
npm install
npx playwright install chromium
```

### 2. Configuration (`.env`)
Copiez `.env.example` vers `.env` et ajustez vos paramètres :
```env
PORT=3000
FAPSHI_API_URL=https://live.fapshi.com
FAPSHI_API_USER=523f8249-0b49-48dc-8dfc-a1395caeb3e9
FAPSHI_API_KEY=FAK_7d7275a12942d1aa7f6a86e75db4fe37
HEADLESS=true
```

### 3. Lancement
```bash
npm run dev
# ou
npm start
```

Le serveur sera accessible sur :
- **Dashboard Web de Test** : `http://localhost:3000/`
- **Documentation API** : Consultez le fichier [API_DOCS.md](API_DOCS.md)

---

## 📡 Endpoints Principaux

- `POST /api/pay` : Initiation de paiement Fapshi + pilotage automatique Playwright.
- `POST /api/pay/stream` : Même action avec logs diffusés en direct en Server-Sent Events (SSE).
- `GET /api/status/:transId` : Vérification de l'état d'un paiement en direct.
- `POST /api/automate` : Automatisation de n'importe quelle page web sur Internet.

---

## 📄 Licence
MIT
