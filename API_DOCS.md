# 📚 Documentation API Botfast v2.0

Guide d'intégration de **Botfast** pour votre backend (Node.js, PHP, Python, etc.).

---

## 🌐 URL de base (Base URL)
- **Local** : `http://localhost:3000`
- **Production** : `https://votre-domaine-botfast.com`

---

## 📌 Sommaire des Endpoints

| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/pay` | Initie un paiement Fapshi et automatise la validation avec Playwright |
| `GET` | `/api/status/:transId` | Vérifie l'état en direct d'une transaction Fapshi |
| `POST` | `/api/automate` | Automatise le remplissage et la soumission de n'importe quel formulaire web |
| `GET` | `/health` | Vérifie la santé du microservice |

---

## 1. 🚀 Initier un Paiement & Automatisation (`POST /api/pay`)

Déclenche l'API Fapshi, génère le lien de paiement, démarre le bot Playwright, remplit le numéro de téléphone et clique sur le bouton de paiement.

### 📥 Corps de la requête (Request Body - JSON)

```json
{
  "amount": 2500,
  "phone": "670000000",
  "name": "Jean Dupont",
  "email": "jean.dupont@email.com",
  "message": "Paiement commande #1042",
  "headless": true
}
```

> **Note sur les clés API :** Si `FAPSHI_API_KEY` et `FAPSHI_API_USER` sont définis dans votre fichier `.env`, vous n'avez pas besoin de les envoyer dans le body. Sinon, vous pouvez les transmettre dynamiquement avec `"fapshiApiKey": "..."` et `"fapshiApiUser": "..."`.

### 📤 Réponse Succès (`200 OK`)

```json
{
  "success": true,
  "message": "Paiement Fapshi initié et formulaire automatisé avec succès.",
  "transId": "fl48qUfz",
  "externalId": "BOTFAST-1788623182969-UEFOR2",
  "paymentLink": "https://checkout.fapshi.com/payment/6a9c3827f5c8d07ef8d16b86",
  "automation": {
    "success": true,
    "filled": {
      "name": true,
      "phone": true,
      "amount": false,
      "email": false
    },
    "submitted": true,
    "paymentButton": "Pay with Momo Or OM",
    "finalUrl": "https://checkout.fapshi.com/payment/6a9c3827f5c8d07ef8d16b86"
  }
}
```

---

## 2. 🔍 Vérifier le Statut d'un Paiement (`GET /api/status/:transId`)

Permet à votre backend de savoir si le client a validé le paiement sur son téléphone.

### 📥 Paramètres d'URL
- `transId` *(obligatoire)* : L'identifiant de transaction retourné par `/api/pay`.

### 📤 Réponse Succès (`200 OK`)

```json
{
  "success": true,
  "transId": "fl48qUfz",
  "status": "SUCCESSFUL",
  "financialStatus": "PAID",
  "amount": 2500,
  "fapshiResponse": {
    "status": "SUCCESSFUL",
    "financialStatus": "PAID",
    "amount": 2500,
    "payerName": "Jean Dupont"
  }
}
```

---

## 3. 🌐 Automatiser une page web quelconque (`POST /api/automate`)

Permet de remplir automatiquement n'importe quel formulaire web sur Internet et de valider.

### 📥 Corps de la requête (Request Body - JSON)

```json
{
  "url": "https://exemple.com/formulaire-checkout",
  "fields": {
    "name": "Jean Dupont",
    "phone": "670000000",
    "email": "jean@email.com",
    "amount": "5000"
  },
  "submit": true,
  "headless": true
}
```

---

## 💻 Exemples d'Intégration dans votre Backend

### 🟢 Exemple 1 : Node.js / Express (avec `fetch` ou `axios`)

```javascript
// services/botfast.js
const BOTFAST_URL = process.env.BOTFAST_URL || "http://localhost:3000";

async function processPayment({ amount, phone, name, email }) {
  try {
    const response = await fetch(`${BOTFAST_URL}/api/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        phone,
        name,
        email,
        message: `Commande client ${name}`
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Échec du paiement Botfast");
    }

    // Retourne le transId pour suivi
    return {
      transId: data.transId,
      paymentLink: data.paymentLink,
      status: "PENDING_USSD_CONFIRMATION"
    };
  } catch (error) {
    console.error("Erreur Botfast:", error.message);
    throw error;
  }
}

async function checkPayment(transId) {
  const response = await fetch(`${BOTFAST_URL}/api/status/${transId}`);
  return await response.json();
}

module.exports = { processPayment, checkPayment };
```

---

### 🐘 Exemple 2 : PHP / Laravel

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Exception;

class BotfastService
{
    protected string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = env('BOTFAST_URL', 'http://localhost:3000');
    }

    public function initiateAndAutomatePay(float $amount, string $phone, string $name, string $email)
    {
        $response = Http::post("{$this->baseUrl}/api/pay", [
            'amount'  => $amount,
            'phone'   => $phone,
            'name'    => $name,
            'email'   => $email,
            'message' => "Paiement commande " . $name
        ]);

        if ($response->failed() || !$response->json('success')) {
            throw new Exception($response->json('error', 'Erreur lors du paiement Botfast'));
        }

        return $response->json();
    }

    public function getStatus(string $transId)
    {
        $response = Http::get("{$this->baseUrl}/api/status/{$transId}");
        return $response->json();
    }
}
```

---

### 🐍 Exemple 3 : Python (FastAPI / Django / Flask)

```python
import requests

BOTFAST_URL = "http://localhost:3000"

def trigger_payment(amount: float, phone: str, name: str, email: str):
    url = f"{BOTFAST_URL}/api/pay"
    payload = {
        "amount": amount,
        "phone": phone,
        "name": name,
        "email": email,
        "message": f"Paiement {name}"
    }
    
    response = requests.post(url, json=payload, timeout=60)
    data = response.json()
    
    if response.status_code != 200 or not data.get("success"):
        raise Exception(data.get("error", "Erreur Botfast"))
        
    return data

def verify_payment_status(trans_id: str):
    url = f"{BOTFAST_URL}/api/status/{trans_id}"
    response = requests.get(url, timeout=15)
    return response.json()
```

---

### ⚡ Exemple 4 : Requête cURL

```bash
curl -X POST http://localhost:3000/api/pay \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "phone": "670000000",
    "name": "Jean Dupont",
    "email": "jean@email.com"
  }'
```
