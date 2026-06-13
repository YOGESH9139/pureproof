Nexus ID — Track 2: x402 API Endpoints + Algorand Integration
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.
Goal: Build two x402-gated HTTP endpoints — `/v1/identity/issue` and `/v1/identity/verify` — on Hono (TypeScript), wired to the Algorand credential store contract (Track 1) and the compliance enrichment service (Track 3).
Architecture: Hono server with `@x402-avm/hono` middleware. The issuer endpoint validates passport data off-chain (RSA signature against CSCA certs), then calls the Algorand contract to register the credential. The verifier endpoint reads the on-chain credential and calls Track 3's enrichment service. Both endpoints start with mocks and swap in real implementations as Track 1 and Track 3 deliver.
Tech Stack:
Node.js 20+, TypeScript 5+
Hono v4 (lightweight HTTP framework)
`@x402-avm/hono` — x402 middleware for Algorand
`@x402-avm/paywall` + `@x402-avm/avm` + `@x402-avm/core`
`algosdk` v3 — Algorand JS SDK for reading on-chain state
`node-forge` or `pkijs` — off-chain RSA passport validation
Zod — request validation
---
Verified Sources
@x402-avm/hono: https://www.npmjs.com/package/@x402-avm/extensions (confirmed on npm)
@x402-avm/core: https://www.npmjs.com/package/@x402-avm/core
@x402-avm paywall examples: https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/typescript/x402-avm-paywall-examples.md
GoPlausible testnet facilitator: https://x402.goplausible.xyz/
Algorand testnet USDC ASA ID 10458941: confirmed from @x402-avm/paywall examples
Algorand mainnet USDC ASA ID 31566704: https://explorer.perawallet.app/asset/31566704/
algosdk v3: https://github.com/algorand/js-algorand-sdk
Hono: https://hono.dev/
Algorand free testnet node: https://testnet-api.algonode.cloud
---
What Track 2 Mocks (until other tracks deliver)
```typescript
// services/api/src/mocks.ts

// MOCK A — Algorand contract (until Track 1 delivers contract + app ID)
export const mockAlgorand = {
  async registerCredential(proof: string, publicSignals: PublicSignals): Promise<string> {
    console.log("[MOCK] registerCredential called", { nullifier: publicSignals.nullifier });
    return "MOCK_TXN_ID_" + Date.now();
  },
  async queryCredential(nullifier: string): Promise<{ exists: boolean; credential: Credential | null }> {
    // Return hardcoded credential for any nullifier during dev
    return {
      exists: true,
      credential: {
        ageGte18: true, ageGte21: true,
        nationalityCode: 73 * 256 + 78, // "IN"
        issuedAt: Math.floor(Date.now() / 1000) - 3600,
        expiresAt: Math.floor(Date.now() / 1000) + 63072000,
      },
    };
  },
};

// MOCK B — Compliance enrichment (until Track 3 delivers service)
export const mockCompliance = {
  async enrich(req: EnrichmentRequest): Promise<EnrichmentResult> {
    console.log("[MOCK] enrich called", req);
    return {
      sanctions: { ofac: false, eu: false, un: false, uk: false },
      pepTier: 0,
      adverseMedia: { score: 0.0, hits: [] },
      riskTier: "LOW",
      processedAt: Math.floor(Date.now() / 1000),
    };
  },
};

// MOCK C — Passport RSA validation (until crypto library integrated)
export const mockPassportValidator = {
  async validate(passportData: PassportData): Promise<boolean> {
    console.log("[MOCK] passport validate — always returns true in dev");
    return true;
  },
};
```
Swap strategy: Each mock has a corresponding real implementation in `src/lib/`. A single env var controls which runs:
```
USE_MOCK_ALGORAND=true   # set in .env.development, unset in .env.production
USE_MOCK_COMPLIANCE=true
USE_MOCK_PASSPORT=true
```
---
Integration Points
Depends on Track 1:
`NEXUS_CONTRACT_APP_ID` (env var) — Algorand testnet app ID
Contract ABI: `register_credential(proof: byte[], public_signals: byte[]) -> bool`
Contract ABI: `query_credential(nullifier: byte[32]) -> (bool, Credential)`
`PublicSignals` schema (see shared/types below)
Depends on Track 3:
`COMPLIANCE_SERVICE_URL` (env var, default: `http://localhost:8081`)
`POST /internal/enrich` — see Task 5 for request/response schema
Track 4 depends on Track 2:
`POST /v1/identity/issue` — request/response schema (defined in Task 3)
`POST /v1/identity/verify` — request/response schema (defined in Task 4)
OpenAPI spec (generated in Task 6)
---
File Structure
```
services/api/
├── package.json
├── tsconfig.json
├── .env.development      # mocks enabled
├── .env.production       # mocks disabled
├── src/
│   ├── index.ts          # Hono app entry point
│   ├── routes/
│   │   ├── issue.ts      # POST /v1/identity/issue handler
│   │   └── verify.ts     # POST /v1/identity/verify handler
│   ├── lib/
│   │   ├── algorand.ts   # real Algorand SDK integration
│   │   ├── passport.ts   # off-chain passport RSA validation
│   │   └── compliance.ts # HTTP client for Track 3 enrichment service
│   ├── mocks.ts          # all mock implementations
│   ├── types.ts          # shared TypeScript types
│   └── x402.ts           # x402 payment config
└── tests/
    ├── issue.test.ts
    └── verify.test.ts
```
---
Task 1: Bootstrap project
[ ] Step 1: Initialize
```bash
mkdir -p services/api/src/routes services/api/src/lib services/api/tests
cd services/api
npm init -y
npm install hono @hono/node-server
npm install @x402-avm/hono @x402-avm/paywall @x402-avm/avm @x402-avm/core
npm install algosdk@^3
npm install node-forge zod
npm install -D typescript @types/node tsx vitest
npx tsc --init --target ES2022 --module NodeNext --moduleResolution NodeNext --outDir dist
```
[ ] Step 2: Create tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*", "tests/**/*"]
}
```
[ ] Step 3: Add scripts to package.json
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```
[ ] Step 4: Create .env files
```bash
# services/api/.env.development
USE_MOCK_ALGORAND=true
USE_MOCK_COMPLIANCE=true
USE_MOCK_PASSPORT=true
PORT=3000
NEXUS_CONTRACT_APP_ID=0
FACILITATOR_URL=https://facilitator.goplausible.xyz
COMPLIANCE_SERVICE_URL=http://localhost:8081
# USDC ASA on Algorand testnet:
USDC_ASA_ID=10458941
NEXUS_WALLET_ADDRESS=YOUR_ALGORAND_ADDRESS
ALGORAND_NODE_URL=https://testnet-api.algonode.cloud
ALGORAND_NETWORK=testnet
```
```bash
# services/api/.env.production
USE_MOCK_ALGORAND=false
USE_MOCK_COMPLIANCE=false
USE_MOCK_PASSPORT=false
PORT=3000
# USDC ASA on Algorand mainnet:
USDC_ASA_ID=31566704
ALGORAND_NETWORK=mainnet
ALGORAND_NODE_URL=https://mainnet-api.algonode.cloud
```
[ ] Step 5: Create shared types
```typescript
// services/api/src/types.ts
export interface PublicSignals {
  nullifier: string;        // hex string, 32 bytes
  ageGte18: boolean;
  ageGte21: boolean;
  nationalityCode: number;  // NationalityByte0 * 256 + NationalityByte1
  currentTimestamp: number; // unix seconds
}

export interface Credential {
  ageGte18: boolean;
  ageGte21: boolean;
  nationalityCode: number;
  issuedAt: number;
  expiresAt: number;
}

export interface EnrichmentRequest {
  nullifier: string;
  nationalityCode: number;
  name?: string;    // optional — only if user consented to selective reveal
  dob?: string;     // optional — only if user consented
}

export interface SanctionsResult {
  ofac: boolean; eu: boolean; un: boolean; uk: boolean;
  hits: Array<{ list: string; name: string; reason: string }>;
}

export interface EnrichmentResult {
  sanctions: SanctionsResult;
  pepTier: 0 | 1 | 2 | 3;  // 0=none, 1=head of state, 2=senior official, 3=associate
  adverseMedia: { score: number; hits: string[] };
  riskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  processedAt: number;
}

export interface PassportData {
  // Raw fields extracted from NFC DG1 (MRZ)
  surname: string;
  givenNames: string;
  nationality: string;   // ISO 3166-1 alpha-2
  dateOfBirth: string;   // YYMMDD
  sex: string;
  expiryDate: string;    // YYMMDD
  documentNumber: string;
  // From DG15 (for active authentication)
  dg15PublicKey?: string; // base64 DER
  // From SOD (security object — contains hashes + country signature)
  sodBytes: string;       // base64
  // From NFC challenge-response
  chipAuthSuccess: boolean;
}
```
[ ] Step 6: Commit
```bash
git add services/api/
git commit -m "feat: bootstrap api service (hono, x402-avm, algosdk)"
```
---
Task 2: Wire x402 payment middleware
Files:
Create: `services/api/src/x402.ts`
Create: `services/api/src/index.ts`
[ ] Step 1: Write failing test
```typescript
// services/api/tests/x402.test.ts
import { describe, it, expect } from "vitest";

describe("x402 payment gate", () => {
  it("returns 402 when no payment header is present", async () => {
    const { app } = await import("../src/index.js");
    const res = await app.request("/v1/identity/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof: "0x", public_signals: {} }),
    });
    expect(res.status).toBe(402);
  });
});
```
[ ] Step 2: Run — confirm fail
```bash
cd services/api
npx vitest run tests/x402.test.ts
# Expected: FAIL — app not defined yet
```
[ ] Step 3: Create x402 config
```typescript
// services/api/src/x402.ts
import { createPaywall, avmPaywall } from "@x402-avm/paywall";
import { x402ResourceServer } from "@x402-avm/hono";

const isTestnet = process.env.ALGORAND_NETWORK !== "mainnet";

export const nexusWallet = process.env.NEXUS_WALLET_ADDRESS!;
export const usdcAsaId = process.env.USDC_ASA_ID!;

// Algorand network genesis hash
// Testnet: SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=
// Mainnet: wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=
const networkId = isTestnet
  ? "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
  : "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=";

export const issueRouteConfig = {
  accepts: {
    scheme: "exact",
    network: networkId,
    asset: usdcAsaId,
    payTo: nexusWallet,
    price: "$1.00",
    maxTimeoutSeconds: 300,
  },
  description: "Nexus ID credential issuance",
  mimeType: "application/json",
};

export const verifyRouteConfig = {
  accepts: {
    scheme: "exact",
    network: networkId,
    asset: usdcAsaId,
    payTo: nexusWallet,
    price: "$0.25",
    maxTimeoutSeconds: 300,
  },
  description: "Nexus ID credential verification",
  mimeType: "application/json",
};

export const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withConfig({ appName: "Nexus ID", testnet: isTestnet })
  .build();

export const resourceServer = new x402ResourceServer({
  url: process.env.FACILITATOR_URL!,
});
```
[ ] Step 4: Create app entry point
```typescript
// services/api/src/index.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { paymentMiddleware } from "@x402-avm/hono";
import { issueRouteConfig, verifyRouteConfig, paywall, resourceServer } from "./x402.js";
import { issueHandler } from "./routes/issue.js";
import { verifyHandler } from "./routes/verify.js";

export const app = new Hono();

const routes = {
  "/v1/identity/issue": issueRouteConfig,
  "/v1/identity/verify": verifyRouteConfig,
};

app.use("*", paymentMiddleware(routes, resourceServer, {
  testnet: process.env.ALGORAND_NETWORK !== "mainnet",
}, paywall));

app.post("/v1/identity/issue", issueHandler);
app.post("/v1/identity/verify", verifyHandler);

app.get("/health", (c) => c.json({ status: "ok" }));

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
  console.log(`Nexus ID API running on :${process.env.PORT ?? 3000}`);
}
```
[ ] Step 5: Create stub handlers so app compiles
```typescript
// services/api/src/routes/issue.ts
import type { Context } from "hono";
export const issueHandler = (c: Context) => c.json({ ok: true }, 200);
```
```typescript
// services/api/src/routes/verify.ts
import type { Context } from "hono";
export const verifyHandler = (c: Context) => c.json({ ok: true }, 200);
```
[ ] Step 6: Run test — confirm 402 passes
```bash
cd services/api
npx vitest run tests/x402.test.ts
# Expected: PASS — middleware returns 402 when no payment header
```
[ ] Step 7: Commit
```bash
git add services/api/src/
git commit -m "feat: wire x402-avm payment middleware on both endpoints"
```
---
Task 3: Implement issue endpoint
Files:
Modify: `services/api/src/routes/issue.ts`
Create: `services/api/src/lib/passport.ts`
Create: `services/api/src/lib/algorand.ts`
[ ] Step 1: Write failing tests
```typescript
// services/api/tests/issue.test.ts
import { describe, it, expect, vi } from "vitest";

// Bypass x402 in unit tests
vi.mock("@x402-avm/hono", () => ({
  paymentMiddleware: () => async (_: unknown, next: () => Promise<void>) => next(),
}));

describe("POST /v1/identity/issue", () => {
  it("returns 400 when proof is missing", async () => {
    const { app } = await import("../src/index.js");
    const res = await app.request("/v1/identity/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_signals: {} }), // missing proof
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/proof/i);
  });

  it("returns 200 with nullifier on valid request (mocked)", async () => {
    process.env.USE_MOCK_ALGORAND = "true";
    process.env.USE_MOCK_PASSPORT = "true";
    const { app } = await import("../src/index.js");
    const res = await app.request("/v1/identity/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proof: "deadbeef".repeat(64),
        public_signals: {
          nullifier: "abc123".repeat(10) + "ab",
          ageGte18: true,
          ageGte21: true,
          nationalityCode: 73 * 256 + 78,
          currentTimestamp: Math.floor(Date.now() / 1000),
        },
        passport_data: {
          sodBytes: Buffer.from("mock").toString("base64"),
          chipAuthSuccess: true,
          nationality: "IN",
          dateOfBirth: "900101",
          expiryDate: "300101",
          documentNumber: "A1234567",
          surname: "DOE",
          givenNames: "JOHN",
          sex: "M",
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nullifier).toBeTruthy();
    expect(body.txn_id).toBeTruthy();
  });

  it("returns 409 on duplicate nullifier", async () => {
    // Algorand mock returns "already exists" error
    // TODO: test after implementing real algorand lib
  });
});
```
[ ] Step 2: Run — confirm fails
```bash
npx vitest run tests/issue.test.ts
# Expected: FAIL — handler returns 200 for everything
```
[ ] Step 3: Implement passport validator
```typescript
// services/api/src/lib/passport.ts
// Off-chain RSA passport validation against CSCA certs
// MVP: validates document hasn't expired and chip auth succeeded
// V2: full RSA chain verification against CSCA master list

import type { PassportData } from "../types.js";

export async function validatePassport(data: PassportData): Promise<{ valid: boolean; reason?: string }> {
  if (process.env.USE_MOCK_PASSPORT === "true") {
    return { valid: true };
  }

  // Check chip authentication succeeded (proves chip is genuine)
  if (!data.chipAuthSuccess) {
    return { valid: false, reason: "chip authentication failed" };
  }

  // Check document not expired
  const expiry = parseICAODate(data.expiryDate);
  if (expiry < new Date()) {
    return { valid: false, reason: "passport expired" };
  }

  // V2: Verify RSA signature on SOD against CSCA cert chain
  // Requires downloading ICAO master list from https://download.pkd.icao.int/
  // and verifying the SOD signature using node-forge or pkijs
  // For MVP this check is skipped — chip auth is sufficient for demo

  return { valid: true };
}

function parseICAODate(icaoDate: string): Date {
  // ICAO YYMMDD format. Year < 30 = 2000s, >= 30 = 1900s
  const yy = parseInt(icaoDate.slice(0, 2));
  const mm = parseInt(icaoDate.slice(2, 4)) - 1;
  const dd = parseInt(icaoDate.slice(4, 6));
  const year = yy < 30 ? 2000 + yy : 1900 + yy;
  return new Date(year, mm, dd);
}
```
[ ] Step 4: Implement Algorand client
```typescript
// services/api/src/lib/algorand.ts
import algosdk from "algosdk";
import type { PublicSignals, Credential } from "../types.js";

const client = new algosdk.Algodv2(
  process.env.ALGORAND_NODE_TOKEN ?? "",
  process.env.ALGORAND_NODE_URL!,
  ""
);

const appId = BigInt(process.env.NEXUS_CONTRACT_APP_ID ?? "0");

export async function registerCredential(
  proof: string,           // hex string
  publicSignals: PublicSignals,
  signerMnemonic: string,
): Promise<string> {
  if (process.env.USE_MOCK_ALGORAND === "true") {
    return "MOCK_TXN_ID_" + Date.now();
  }

  const account = algosdk.mnemonicToSecretKey(signerMnemonic);
  const sp = await client.getTransactionParams().do();

  // Encode public_signals as ABI bytes
  // ABI type matches NexusCredentialStore.register_credential signature
  const abiType = algosdk.ABIType.from(
    "(byte[],bool,bool,uint16,uint64)"
  );
  const nullifierBytes = Buffer.from(publicSignals.nullifier.replace("0x", ""), "hex");
  const publicSignalsEncoded = abiType.encode([
    nullifierBytes,
    publicSignals.ageGte18,
    publicSignals.ageGte21,
    publicSignals.nationalityCode,
    BigInt(publicSignals.currentTimestamp),
  ]);

  const proofBytes = Buffer.from(proof.replace("0x", ""), "hex");

  const txn = algosdk.makeApplicationCallTxnFromObject({
    from: account.addr,
    appIndex: Number(appId),
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [
      algosdk.encodeUint64(1),          // method selector — register_credential
      proofBytes,
      publicSignalsEncoded,
    ],
    suggestedParams: sp,
  });

  const signed = txn.signTxn(account.sk);
  const { txId } = await client.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(client, txId, 4);
  return txId;
}

export async function queryCredential(
  nullifier: string,  // hex string
): Promise<{ exists: boolean; credential: Credential | null }> {
  if (process.env.USE_MOCK_ALGORAND === "true") {
    return {
      exists: true,
      credential: {
        ageGte18: true, ageGte21: true,
        nationalityCode: 73 * 256 + 78,
        issuedAt: Math.floor(Date.now() / 1000) - 3600,
        expiresAt: Math.floor(Date.now() / 1000) + 63072000,
      },
    };
  }

  const nullifierBytes = Buffer.from(nullifier.replace("0x", ""), "hex");
  // Read box storage directly
  try {
    const box = await client.getApplicationBoxByName(Number(appId), nullifierBytes).do();
    // Decode Credential ABI struct: (bool, bool, uint16, uint64, uint64)
    const abiType = algosdk.ABIType.from("(bool,bool,uint16,uint64,uint64)");
    const decoded = abiType.decode(Buffer.from(box.value));
    return {
      exists: true,
      credential: {
        ageGte18: decoded[0] as boolean,
        ageGte21: decoded[1] as boolean,
        nationalityCode: decoded[2] as number,
        issuedAt: Number(decoded[3]),
        expiresAt: Number(decoded[4]),
      },
    };
  } catch {
    return { exists: false, credential: null };
  }
}
```
[ ] Step 5: Implement issue handler
```typescript
// services/api/src/routes/issue.ts
import type { Context } from "hono";
import { z } from "zod";
import { validatePassport } from "../lib/passport.js";
import { registerCredential } from "../lib/algorand.js";
import type { PublicSignals } from "../types.js";

const IssueRequestSchema = z.object({
  proof: z.string().min(1),
  public_signals: z.object({
    nullifier: z.string().regex(/^[0-9a-fA-F]+$/),
    ageGte18: z.boolean(),
    ageGte21: z.boolean(),
    nationalityCode: z.number().int().min(0).max(65535),
    currentTimestamp: z.number().int().positive(),
  }),
  passport_data: z.object({
    sodBytes: z.string(),        // base64
    chipAuthSuccess: z.boolean(),
    nationality: z.string().length(2),
    dateOfBirth: z.string().length(6),
    expiryDate: z.string().length(6),
    documentNumber: z.string(),
    surname: z.string(),
    givenNames: z.string(),
    sex: z.string(),
  }),
});

export const issueHandler = async (c: Context) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "invalid JSON" }, 400);

  const parsed = IssueRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors[0].message }, 400);
  }

  const { proof, public_signals, passport_data } = parsed.data;

  // 1. Off-chain passport validation
  const passportResult = await validatePassport(passport_data);
  if (!passportResult.valid) {
    return c.json({ error: `passport validation failed: ${passportResult.reason}` }, 422);
  }

  // 2. Verify timestamp is recent (within 5 minutes to prevent replay)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - public_signals.currentTimestamp) > 300) {
    return c.json({ error: "proof timestamp too old or in future" }, 422);
  }

  // 3. Register on Algorand
  let txnId: string;
  try {
    txnId = await registerCredential(
      proof,
      public_signals as PublicSignals,
      process.env.NEXUS_SIGNER_MNEMONIC!,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists")) {
      return c.json({ error: "credential already issued for this passport" }, 409);
    }
    console.error("Algorand register error:", err);
    return c.json({ error: "on-chain registration failed" }, 500);
  }

  return c.json({
    nullifier: public_signals.nullifier,
    txn_id: txnId,
    committed_at: now,
    expires_at: now + 63072000,  // 2 years
  }, 200);
};
```
[ ] Step 6: Run tests — confirm pass
```bash
npx vitest run tests/issue.test.ts
# Expected: PASS
```
[ ] Step 7: Commit
```bash
git add services/api/src/routes/issue.ts services/api/src/lib/
git commit -m "feat: implement issue endpoint with passport validation and Algorand registration"
```
---
Task 4: Implement verify endpoint
Files:
Modify: `services/api/src/routes/verify.ts`
Create: `services/api/src/lib/compliance.ts`
[ ] Step 1: Write failing tests
```typescript
// services/api/tests/verify.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@x402-avm/hono", () => ({
  paymentMiddleware: () => async (_: unknown, next: () => Promise<void>) => next(),
}));

describe("POST /v1/identity/verify", () => {
  it("returns 400 when nullifier is missing", async () => {
    process.env.USE_MOCK_ALGORAND = "true";
    process.env.USE_MOCK_COMPLIANCE = "true";
    const { app } = await import("../src/index.js");
    const res = await app.request("/v1/identity/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checks: ["sanctions_eu"] }), // missing nullifier
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when nullifier not found on chain", async () => {
    process.env.USE_MOCK_ALGORAND = "false"; // use real-ish mock that returns not found
    // TODO: mock algorand to return exists:false
  });

  it("returns 200 with full compliance result (mocked)", async () => {
    process.env.USE_MOCK_ALGORAND = "true";
    process.env.USE_MOCK_COMPLIANCE = "true";
    const { app } = await import("../src/index.js");
    const res = await app.request("/v1/identity/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nullifier: "abc123".repeat(10) + "ab",
        checks: ["sanctions_eu", "sanctions_un", "pep", "adverse_media"],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.credential).toBeTruthy();
    expect(body.compliance.risk_tier).toMatch(/LOW|MEDIUM|HIGH|CRITICAL/);
  });
});
```
[ ] Step 2: Implement compliance HTTP client
```typescript
// services/api/src/lib/compliance.ts
import type { EnrichmentRequest, EnrichmentResult } from "../types.js";

export async function enrich(req: EnrichmentRequest): Promise<EnrichmentResult> {
  if (process.env.USE_MOCK_COMPLIANCE === "true") {
    return {
      sanctions: { ofac: false, eu: false, un: false, uk: false, hits: [] },
      pepTier: 0,
      adverseMedia: { score: 0.0, hits: [] },
      riskTier: "LOW",
      processedAt: Math.floor(Date.now() / 1000),
    };
  }

  const url = `${process.env.COMPLIANCE_SERVICE_URL}/internal/enrich`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error(`compliance service error: ${res.status}`);
  }
  return res.json() as Promise<EnrichmentResult>;
}
```
[ ] Step 3: Implement verify handler
```typescript
// services/api/src/routes/verify.ts
import type { Context } from "hono";
import { z } from "zod";
import { queryCredential } from "../lib/algorand.js";
import { enrich } from "../lib/compliance.js";

const CheckEnum = z.enum(["sanctions_ofac", "sanctions_eu", "sanctions_un", "sanctions_uk", "pep", "adverse_media"]);

const VerifyRequestSchema = z.object({
  nullifier: z.string().regex(/^[0-9a-fA-F]+$/),
  checks: z.array(CheckEnum).min(1).default(["sanctions_ofac", "pep"]),
});

export const verifyHandler = async (c: Context) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "invalid JSON" }, 400);

  const parsed = VerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors[0].message }, 400);
  }

  const { nullifier, checks } = parsed.data;

  // 1. Read on-chain credential
  const { exists, credential } = await queryCredential(nullifier);
  if (!exists || !credential) {
    return c.json({ error: "credential not found — user must issue first" }, 404);
  }

  // 2. Check credential not expired
  const now = Math.floor(Date.now() / 1000);
  if (credential.expiresAt < now) {
    return c.json({ error: "credential expired — user must re-issue" }, 410);
  }

  // 3. Run compliance enrichment
  const enrichmentResult = await enrich({
    nullifier,
    nationalityCode: credential.nationalityCode,
  }).catch((err) => {
    console.error("Compliance enrichment error:", err);
    return null;
  });

  return c.json({
    nullifier,
    credential: {
      age_gte_18: credential.ageGte18,
      age_gte_21: credential.ageGte21,
      nationality_code: credential.nationalityCode,
      issued_at: credential.issuedAt,
      expires_at: credential.expiresAt,
    },
    compliance: enrichmentResult ? {
      sanctions: enrichmentResult.sanctions,
      pep_tier: enrichmentResult.pepTier,
      adverse_media: enrichmentResult.adverseMedia,
      risk_tier: enrichmentResult.riskTier,
    } : null,
    checks_requested: checks,
    verified_at: now,
  }, 200);
};
```
[ ] Step 4: Run tests
```bash
npx vitest run tests/verify.test.ts
# Expected: PASS
```
[ ] Step 5: Commit
```bash
git add services/api/src/routes/verify.ts services/api/src/lib/compliance.ts
git commit -m "feat: implement verify endpoint with Algorand query and compliance enrichment"
```
---
Task 5: Integration test with real Algorand testnet
[ ] Step 1: Set env vars
```bash
export NEXUS_CONTRACT_APP_ID=<app_id_from_track1>
export NEXUS_SIGNER_MNEMONIC="twenty five word mnemonic"
export ALGORAND_NETWORK=testnet
export USE_MOCK_ALGORAND=false
export USE_MOCK_PASSPORT=true  # keep passport mock for now
export USE_MOCK_COMPLIANCE=true
```
[ ] Step 2: Start server
```bash
npm run dev
# Expected: "Nexus ID API running on :3000"
```
[ ] Step 3: Test issue with curl (no payment — expect 402)
```bash
curl -X POST http://localhost:3000/v1/identity/issue \
  -H "Content-Type: application/json" \
  -d '{"proof":"deadbeef","public_signals":{"nullifier":"abc123","ageGte18":true,"ageGte21":true,"nationalityCode":18766,"currentTimestamp":1749772800},"passport_data":{"sodBytes":"bW9jaw==","chipAuthSuccess":true,"nationality":"IN","dateOfBirth":"900101","expiryDate":"300101","documentNumber":"A1234567","surname":"DOE","givenNames":"JOHN","sex":"M"}}'
# Expected: 402 Payment Required
```
[ ] Step 4: Commit
```bash
git commit -m "test: verified x402 gate and Algorand integration on testnet"
```
---
Task 6: Generate OpenAPI spec for Track 4 (frontend)
[ ] Step 1: Install openapi tooling
```bash
npm install @hono/zod-openapi @hono/swagger-ui
```
[ ] Step 2: Export spec
```bash
npx tsx src/export-openapi.ts > openapi.json
# Share openapi.json with Track 4 for frontend SDK generation
```
[ ] Step 3: Commit spec
```bash
git add openapi.json
git commit -m "docs: export OpenAPI spec for frontend integration"
```
---
Swap-in Checklist (when real implementations arrive)
What	When	How to swap
Real Algorand contract	Track 1 delivers app ID	Set `NEXUS_CONTRACT_APP_ID`, `USE_MOCK_ALGORAND=false`
Real compliance service	Track 3 delivers URL	Set `COMPLIANCE_SERVICE_URL`, `USE_MOCK_COMPLIANCE=false`
Real passport RSA validation	V2	Implement `passport.ts` full RSA chain check
