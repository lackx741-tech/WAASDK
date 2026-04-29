# WAASDK Backend

Production-ready backend for the WAASDK project.  
Built with **Fastify**, **MongoDB (Mongoose)**, and **Telegram Bot alerts**.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Environment Variables](#environment-variables)
4. [Telegram Setup](#telegram-setup)
5. [MongoDB Setup](#mongodb-setup)
6. [Docker Deploy](#docker-deploy)
7. [Cloud Deploy (Railway / Render)](#cloud-deploy)
8. [API Reference](#api-reference)
9. [Connecting the Frontend SDK](#connecting-the-frontend-sdk)

---

## Quick Start

```bash
cd backend
cp .env.example .env
# Edit .env with your values
npm install
npm start
```

Server starts on `http://localhost:3000`.

---

## Project Structure

```
backend/
├── src/
│   ├── server.js              # Fastify entry point
│   ├── config.js              # Environment config
│   ├── db.js                  # MongoDB connection
│   ├── telegram.js            # Telegram bot + alerts
│   ├── analytics.js           # Shared analytics queries
│   ├── chainNames.js          # Chain ID → name map
│   ├── routes/
│   │   ├── health.js          # GET /api/health
│   │   ├── sessions.js        # /api/sessions
│   │   ├── transactions.js    # /api/transactions
│   │   ├── analytics.js       # /api/analytics
│   │   ├── webhook.js         # /api/webhook
│   │   └── sponsor.js         # /api/sponsor
│   ├── models/
│   │   ├── Session.js
│   │   ├── Transaction.js
│   │   └── Contributor.js
│   ├── middleware/
│   │   ├── auth.js            # X-API-Key check
│   │   └── rateLimit.js       # Rate limit configs
│   └── plugins/
│       ├── mongo.js           # Mongoose Fastify plugin
│       └── cors.js            # CORS plugin
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in every value.

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default `3000`) |
| `NODE_ENV` | No | `production` or `development` |
| `API_KEY` | **Yes** | Secret key sent in `X-API-Key` header |
| `MONGODB_URI` | **Yes** | Full MongoDB connection string |
| `MONGODB_DB_NAME` | No | Database name (default `waassdk`) |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token from BotFather |
| `TELEGRAM_CHAT_ID` | No | Target chat/channel ID for alerts |
| `RPC_URL_ETHEREUM` | No | Ethereum JSON-RPC endpoint |
| `RPC_URL_BSC` | No | BSC JSON-RPC endpoint |
| `RPC_URL_POLYGON` | No | Polygon JSON-RPC endpoint |
| `SPONSOR_PRIVATE_KEY` | No | Private key for gas sponsorship wallet |
| `PRESALE_CONTRACT_ADDRESS` | No | Your presale contract address |
| `HARDCAP_ETH` | No | Presale hard cap in ETH (default `100`) |
| `SOFTCAP_ETH` | No | Presale soft cap in ETH (default `20`) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

---

## Telegram Setup

### Step 1 — Create a Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Choose a name (e.g. "IntegratedDEX Alerts") and a username (must end in `bot`)
4. BotFather replies with your **Bot Token** — copy it to `TELEGRAM_BOT_TOKEN`

### Step 2 — Get Your Chat ID

1. Start a conversation with your new bot (send `/start`)
2. Open this URL in your browser (replace `TOKEN`):  
   `https://api.telegram.org/botTOKEN/getUpdates`
3. Look for `"chat": { "id": 123456789 }` — copy that number to `TELEGRAM_CHAT_ID`

### What alerts you'll receive

| Alert | Trigger |
|---|---|
| 🔑 New Session Created | User signs a session key |
| ⚡ Session TX Sent | Transaction sent via session key |
| ⚠️ Session Expiring | Session has < 1 hour left |
| 🚫 Session Revoked | Operator revokes a session |
| 🟢 Wallet Connected | Wallet connects via webhook |
| 💰 New Contribution | Presale contribution detected |
| 📤 Transaction Sent | Any transaction logged |
| 🔴 Error | Backend or contract error |
| 📊 Daily Summary | Every day at 08:00 UTC |

---

## MongoDB Setup

### Local

```bash
# macOS
brew install mongodb-community && brew services start mongodb-community

# Ubuntu/Debian
sudo apt install mongodb && sudo systemctl start mongod
```

Set `MONGODB_URI=mongodb://localhost:27017/waassdk`.

### MongoDB Atlas (Cloud, Free Tier)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → Create free cluster
2. Add a database user (Settings → Database Access)
3. Whitelist your IP (Network Access → Add IP → `0.0.0.0/0` for open)
4. Click **Connect** → **Drivers** → copy the connection string
5. Replace `<password>` with your password and set as `MONGODB_URI`

---

## Docker Deploy

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Run

```bash
cd backend
cp .env.example .env
# Fill in your values
docker compose up -d
```

This starts:
- **api** — Fastify backend on port `3000`
- **mongo** — MongoDB 7 with persistent volume

### Logs

```bash
docker compose logs -f api
```

### Stop

```bash
docker compose down
```

---

## Cloud Deploy

### Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the repo, set **Root Directory** to `backend`
4. Add a MongoDB plugin (Railway Dashboard → Add Plugin → MongoDB)
5. Set all environment variables in Railway Dashboard → Variables
6. Railway auto-deploys on every push

### Render

1. Go to [render.com](https://render.com) → New Web Service
2. Connect your GitHub repo, set **Root Directory** to `backend`
3. **Build Command:** `npm install`
4. **Start Command:** `node src/server.js`
5. Add environment variables in Render Dashboard → Environment
6. Use [MongoDB Atlas](#mongodb-atlas-cloud-free-tier) for the database

---

## API Reference

All endpoints except `GET /api/health` require the `X-API-Key` header.

```
X-API-Key: your-secret-api-key-here
```

### Health

```
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "db": "connected",
  "uptime": 3600,
  "version": "1.0.0",
  "timestamp": "2025-01-01T08:00:00.000Z"
}
```

---

### Sessions

#### Save a new session
```
POST /api/sessions
Content-Type: application/json

{
  "id": "sess_abc123",
  "userAddress": "0xUserAddress",
  "sessionKey": "0xTempKey",
  "allowedContracts": ["0xContract"],
  "allowedFunctions": ["mint(uint256)", "claim()"],
  "spendingLimit": "0.5",
  "spendingLimitToken": "ETH",
  "expiresAt": 1735689600,
  "chainId": 1,
  "signature": "0xSig...",
  "txHash": "0xTxHash..."
}
```

#### Get all sessions (paginated)
```
GET /api/sessions?page=1&limit=50&status=active
```

#### Get sessions for a user
```
GET /api/sessions/address/0xUserAddress
```

#### Get single session
```
GET /api/sessions/sess_abc123
```

#### Get active sessions
```
GET /api/sessions/active
```

#### Get sessions expiring < 1 hour
```
GET /api/sessions/expiring
```

#### Revoke a session
```
DELETE /api/sessions/sess_abc123
```

---

### Transactions

#### Log a transaction
```
POST /api/transactions
Content-Type: application/json

{
  "txHash": "0xTransactionHash",
  "userAddress": "0xUserAddress",
  "contractAddress": "0xContract",
  "functionName": "mint",
  "args": [100],
  "value": "0.1",
  "chainId": 1,
  "status": "pending",
  "sessionKeyUsed": "0xSessionKey"
}
```

#### Get all transactions
```
GET /api/transactions?page=1&limit=50&status=success&chainId=1
```

#### Get transactions for a user
```
GET /api/transactions/address/0xUserAddress
```

#### Get single transaction
```
GET /api/transactions/tx/0xTransactionHash
```

#### Update transaction status
```
PATCH /api/transactions/tx/0xTransactionHash
Content-Type: application/json

{ "status": "success", "gasUsed": "21000", "blockNumber": 19000000 }
```

---

### Analytics

#### Presale stats
```
GET /api/analytics/presale
```
```json
{
  "raised": "45.2000",
  "hardcap": "100.0000",
  "softcap": "20.0000",
  "contributors": 87,
  "txCount": 234,
  "percentFilled": "45.20"
}
```

#### Session stats
```
GET /api/analytics/sessions
```

#### Full overview
```
GET /api/analytics/overview
```

#### Chart data (time series)
```
GET /api/analytics/chart?days=30
```

---

### Webhooks

Fire these from your frontend SDK:

#### Session created
```
POST /api/webhook/session
{ /* same fields as POST /api/sessions */ }
```

#### Transaction sent
```
POST /api/webhook/transaction
{
  "txHash": "0x...",
  "userAddress": "0x...",
  "chainId": 1,
  "isContribution": true,   // set to true for presale contributions
  "value": "0.1"
}
```

#### Wallet connected
```
POST /api/webhook/connect
{ "address": "0xUserAddress", "chainId": 1 }
```

---

### Gas Sponsorship

#### Estimate gas
```
POST /api/sponsor/estimate
{ "to": "0xContract", "data": "0xcalldata...", "chainId": 1 }
```

#### Submit sponsored transaction
```
POST /api/sponsor/submit
{ "to": "0xContract", "data": "0xcalldata...", "chainId": 1 }
```

#### Sponsor wallet balance
```
GET /api/sponsor/balance?chainId=1
```

---

## Connecting the Frontend SDK

Set the base URL and API key before making any calls:

```js
const BACKEND_URL = "https://your-backend.railway.app";
const API_KEY = "your-secret-api-key-here";

// Fire webhook when wallet connects
async function onWalletConnect(address, chainId) {
  await fetch(`${BACKEND_URL}/api/webhook/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ address, chainId }),
  });
}

// Log a session after it's signed
async function logSession(session) {
  await fetch(`${BACKEND_URL}/api/webhook/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify(session),
  });
}

// Log a transaction
async function logTransaction(tx) {
  await fetch(`${BACKEND_URL}/api/webhook/transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify(tx),
  });
}
```

---

## Rate Limits

| Route group | Limit |
|---|---|
| All routes (default) | 100 req / minute per IP |
| `/api/webhook/*` | 50 req / minute per IP |
| `/api/sponsor/*` | 10 req / minute per IP |

Exceeding the limit returns `429 Too Many Requests` with a `retryAfter` field.
