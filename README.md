# PureProof

> **x402-powered KYC verification for DeFi platforms — Aadhaar identity via ZK proofs on Algorand TestNet.**

Built at the **x402 Build Sprint — AlgoBharat Dev Retreat Hackathon**.

---

## What is PureProof?

PureProof is a decentralized KYC (Know Your Customer) system for DeFi. Instead of handing your Aadhaar details to every platform, you generate a **ZK proof** of your identity once, and pay a **USDC micropayment** (via x402 on Algorand) to issue, verify or update your KYC credential.

- **No raw Aadhaar data ever leaves your device** — only a ZK proof
- **Payment = identity confirmation** — the x402 payer wallet IS the KYC subject
- **DeFi platforms call `/kyc/verify`** (pay $0.005 USDC) to check a wallet before granting access

---

## How x402 Works Here

```
User                   Frontend (React)            PureProof Server         Algorand TestNet
 │                          │                             │                        │
 │── connect wallet ────────▶│                             │                        │
 │                          │──── POST /kyc/issue ────────▶│                        │
 │                          │◀─── 402 Payment Required ───│                        │
 │                          │                             │                        │
 │◀── sign payment ─────────│                             │                        │
 │── approve ───────────────▶│                             │                        │
 │                          │──── POST /kyc/issue ────────▶│                        │
 │                          │   (with payment-signature)  │──── verify payment ───▶│
 │                          │                             │◀─── confirmed ─────────│
 │                          │◀─── KYC credential ─────────│                        │
```

---

## Repository Structure

```
pureproof/
├── pureproof-server/                ← Backend (Node.js + Hono + x402)
│   ├── index.ts                     Main server entry point
│   ├── endpoints.config.ts          Payment prices for each KYC endpoint
│   ├── handlers/
│   │   ├── kyc-issue.ts             POST /kyc/issue handler
│   │   ├── kyc-verify.ts            GET  /kyc/verify handler
│   │   └── kyc-modify.ts            POST /kyc/modify handler
│   ├── store/
│   │   └── kycStore.ts              In-memory credential store + ZK stub
│   ├── .env.example                 Environment variable template
│   └── package.json
│
├── pureproof-usecase/               ← Frontend (React + Vite + use-wallet)
│   └── projects/X402-Usecase/
│       └── src/
│           ├── utils/
│           │   └── kycApi.ts        x402-aware KYC fetch functions (UI team)
│           ├── components/
│           └── App.tsx
│
└── pureproof-client/                ← CLI client (git submodule, reference only)
```

---

## API Endpoints

All KYC endpoints are **payment-gated via x402**. Without a valid USDC payment, they return `402 Payment Required`.

| Method | Endpoint | Price | Description |
|--------|----------|-------|-------------|
| `POST` | `/kyc/issue` | $0.01 USDC | Issue a new KYC credential |
| `GET`  | `/kyc/verify` | $0.005 USDC | Verify an existing credential |
| `POST` | `/kyc/modify` | $0.01 USDC | Update an existing credential |
| `GET`  | `/health` | Free | Server health check |
| `GET`  | `/info` | Free | Endpoint info + stats |

### POST /kyc/issue — Request Body
```json
{
  "walletAddress": "ALGORAND_ADDRESS...",
  "level": "BASIC",
  "zkProof": {
    "proof": "<base64 ZK proof from self.xyz>",
    "publicSignals": [],
    "aadhaarHash": "<64-char hex SHA-256 of Aadhaar>",
    "nullifier": "<unique string>"
  }
}
```

### GET /kyc/verify — Query Param
```
GET /kyc/verify?address=ALGORAND_ADDRESS...
```

### POST /kyc/modify — Request Body
```json
{
  "walletAddress": "ALGORAND_ADDRESS...",
  "updates": { "level": "FULL" },
  "zkProof": { "...same shape as issue..." }
}
```

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- A TestNet Algorand wallet (Pera / Defly / Exodus / Lute)
- TestNet USDC: [AlgoFaucet](https://dispenser.testnet.algorand.network)

### 1. Backend Setup

```bash
cd pureproof-server
npm install
```

Create `.env` (copy from `.env.example`):
```env
AVM_ADDRESS=YOUR_ALGORAND_WALLET_ADDRESS
FACILITATOR_URL=https://facilitator.goplausible.xyz
PORT=4021
```

```bash
npm start
# → PUREPROOF — x402 DeFi KYC SERVER running on :4021
```

### 2. Frontend Setup

```bash
cd pureproof-usecase/projects/X402-Usecase
npm install
```

Create `.env.local`:
```env
VITE_ALGOD_SERVER=https://testnet-api.algonode.cloud
VITE_ALGOD_NETWORK=testnet
VITE_API_BASE_URL=http://localhost:4021
VITE_FACILITATOR_URL=https://facilitator.goplausible.xyz
```

```bash
npm run dev
# → http://localhost:5173
```

### 3. Test the Payment Gate

```bash
# Should return 402 (payment required) — this is correct!
curl http://localhost:4021/kyc/verify?address=TEST

# Should return 200
curl http://localhost:4021/health
curl http://localhost:4021/info
```

---

## Team Integration Points

### UI Team
```typescript
import { issueKYC, verifyKYC, modifyKYC } from '../utils/kycApi'

const signer = { address: activeAddress, signTransactions }
const result = await issueKYC(signer, zkProofPayload)
```

### ZK Team
Implement `validateZKProof()` in `pureproof-server/store/kycStore.ts`:
```typescript
// Replace the stub body with real self.xyz verification:
export function validateZKProof(payload: ZKProofPayload): boolean {
  // Your self.xyz SDK call here
}
```

Your proof output must match `ZKProofPayload`:
```typescript
interface ZKProofPayload {
  proof:         string    // base64 ZK proof bytes
  publicSignals: any[]     // public signals array
  aadhaarHash:   string    // 64-char hex SHA-256
  nullifier:     string    // unique per issuance
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Algorand TestNet |
| Payment Protocol | x402 (USDC micropayments) |
| Facilitator | [GoPlausible](https://facilitator.goplausible.xyz) |
| Backend | Node.js, Hono, @x402/hono |
| Frontend | React, Vite, @txnlab/use-wallet |
| Identity | Aadhaar ZK proofs via self.xyz |
| Wallets | Pera, Defly, Exodus, Lute |

---

## License

MIT — Built at AlgoBharat Dev Retreat 2026.
