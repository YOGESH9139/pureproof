/**
 * PureProof — Main Server
 *
 * x402-powered KYC verification backend for DeFi platforms.
 * Three payment-gated endpoints: issue, verify, modify.
 *
 * The x402 payment acts as the KYC gate:
 *   1. Client hits /kyc/* endpoint
 *   2. Server returns 402 Payment Required
 *   3. Client signs USDC micropayment via Algorand wallet (Pera/Defly/etc.)
 *   4. Facilitator verifies payment on-chain
 *   5. Handler executes (payment verified = identity confirmed)
 *
 * Start: npm start
 * Health: GET http://localhost:4021/health
 */

import { config } from 'dotenv';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { paymentMiddleware } from '@x402/hono';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import { ALGORAND_TESTNET_CAIP2 } from '@x402/avm';

// KYC Handlers
import { handleKYCIssue }  from './handlers/kyc-issue';
import { handleKYCVerify } from './handlers/kyc-verify';
import { handleKYCModify } from './handlers/kyc-modify';

// KYC Store (for /info stats)

// Endpoint payment config
import createPaymentConfig, { EndpointConfig } from './endpoints.config';

// ════════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ════════════════════════════════════════════════════════════════════

config();

const avmAddress    = process.env.AVM_ADDRESS;
const facilitatorUrl = process.env.FACILITATOR_URL;
const port          = parseInt(process.env.PORT || '4021', 10);

if (!avmAddress || !facilitatorUrl) {
  console.error(
    '❌ Missing required environment variables:\n' +
    '   AVM_ADDRESS   — your Algorand wallet that receives USDC payments\n' +
    '   FACILITATOR_URL — x402 facilitator (https://facilitator.goplausible.xyz)',
  );
  process.exit(1);
}

console.log('\n' + '═'.repeat(60));
console.log('PUREPROOF — x402 DeFi KYC SERVER');
console.log('═'.repeat(60));
console.log(`  Receiver : ${avmAddress}`);
console.log(`  Facilitator : ${facilitatorUrl}`);
console.log(`  Port        : ${port}`);
console.log('═'.repeat(60) + '\n');

// ════════════════════════════════════════════════════════════════════
// X402 SETUP
// ════════════════════════════════════════════════════════════════════

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const x402Server        = new x402ResourceServer(facilitatorClient);
const avmServerScheme   = new ExactAvmScheme();
x402Server.register(ALGORAND_TESTNET_CAIP2, avmServerScheme);

// ════════════════════════════════════════════════════════════════════
// APP + MIDDLEWARE
// ════════════════════════════════════════════════════════════════════

const app = new Hono();

// CORS — must be first; x402 requires wildcard header exposure
app.use('*', async (c, next) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':   '*',
    'Access-Control-Allow-Methods':  'GET, POST, OPTIONS, PUT, DELETE, HEAD',
    'Access-Control-Allow-Headers':  '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Max-Age':        '86400',
  };
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  Object.entries(corsHeaders).forEach(([k, v]) => c.header(k, v));
  await next();
});

// Request logger
app.use('*', async (c, next) => {
  const ts = new Date().toISOString();
  console.log(`\n[${ts}] ${c.req.method} ${c.req.path}`);
  if (c.req.header('payment-signature')) {
    console.log('  ✓ Payment-Signature detected');
  }
  await next();
  console.log(`  → ${c.res.status}`);
});

// x402 payment middleware — enforces micropayment on all configured routes
const paymentConfig: EndpointConfig = createPaymentConfig(avmAddress);

console.log('📋 Payment-Protected KYC Endpoints:');
Object.entries(paymentConfig).forEach(([route, cfg]) => {
  const price = cfg.accepts[0]?.price || 'unknown';
  console.log(`   ${route}  →  ${price} USDC`);
});
console.log();

app.use(paymentMiddleware(paymentConfig as any, x402Server));

// ════════════════════════════════════════════════════════════════════
// KYC ROUTES — only reached after payment verified
// ════════════════════════════════════════════════════════════════════

app.post('/kyc/issue',  handleKYCIssue);
app.get('/kyc/verify',  handleKYCVerify);
app.post('/kyc/modify', handleKYCModify);

// ════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES — no payment required
// ════════════════════════════════════════════════════════════════════

app.get('/health', (c) =>
  c.json({
    status:    'ok',
    service:   'pureproof-server',
    uptime:    process.uptime(),
    timestamp: new Date().toISOString(),
  }),
);

app.get('/info', (c) =>
  c.json({
    service:     'pureproof-server',
    version:     '1.0.0',
    description: 'x402-powered KYC verification for DeFi — Aadhaar identity via ZK proofs',
    network:     'Algorand TestNet',
    receiver:    avmAddress,
    endpoints: {
      'POST /kyc/issue':  { price: '$0.01 USDC',  description: 'Issue new KYC credential' },
      'GET /kyc/verify':  { price: '$0.005 USDC', description: 'Verify existing credential' },
      'POST /kyc/modify': { price: '$0.01 USDC',  description: 'Update existing credential' },
    },
    stats: {
      credentialsIssued: 'Available On-Chain',
    },
    facilitator: facilitatorUrl,
    docs: 'See README.md',
  }),
);

app.notFound((c) =>
  c.json(
    {
      error:     'Endpoint not found',
      path:      c.req.path,
      available: ['POST /kyc/issue', 'GET /kyc/verify', 'POST /kyc/modify', 'GET /health', 'GET /info'],
    },
    404,
  ),
);

// ════════════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════════════

serve({ fetch: app.fetch, port }, () => {
  console.log('\n✅ PureProof Server is running!\n');
  console.log('═'.repeat(60));
  console.log(`  API      → http://localhost:${port}`);
  console.log(`  Health   → http://localhost:${port}/health`);
  console.log(`  Info     → http://localhost:${port}/info`);
  console.log('═'.repeat(60));
  console.log('\nQuick test (returns 402 without payment — expected):');
  console.log(`  curl http://localhost:${port}/kyc/verify?address=TEST`);
  console.log('\nHealth check (no payment):');
  console.log(`  curl http://localhost:${port}/health`);
  console.log('\n' + '═'.repeat(60) + '\n');
});