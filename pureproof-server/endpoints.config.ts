/**
 * PureProof — x402 Payment Endpoint Configuration
 *
 * Defines the 3 KYC endpoints and their USDC micropayment prices.
 * The x402 middleware enforces these before any handler runs.
 *
 * Pricing rationale:
 *   /kyc/issue   — $0.01  (one-time credential issuance, highest value)
 *   /kyc/verify  — $0.005 (DeFi platforms call this on each user login)
 *   /kyc/modify  — $0.01  (re-verification + state change, same as issue)
 */

import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from '@x402/avm';

export interface EndpointConfig {
  [key: string]: {
    accepts: Array<{
      scheme: 'exact';
      price: string;
      network: string;
      payTo: string;
      extra: { asset: number };
    }>;
    description: string;
  };
}

export function createPaymentConfig(avmAddress: string): EndpointConfig {
  return {
    // ── KYC ISSUE — Pay $0.01 USDC to issue a new KYC credential ────
    'POST /kyc/issue': {
      accepts: [
        {
          scheme:  'exact',
          price:   '$0.01',
          network: ALGORAND_TESTNET_CAIP2,
          payTo:   avmAddress,
          extra:   { asset: Number(USDC_TESTNET_ASA_ID) },
        },
      ],
      description: 'Issue KYC credential — Pay $0.01 USDC',
    },

    // ── KYC VERIFY — Pay $0.005 USDC to verify a credential ─────────
    'GET /kyc/verify': {
      accepts: [
        {
          scheme:  'exact',
          price:   '$0.005',
          network: ALGORAND_TESTNET_CAIP2,
          payTo:   avmAddress,
          extra:   { asset: Number(USDC_TESTNET_ASA_ID) },
        },
      ],
      description: 'Verify KYC credential — Pay $0.005 USDC',
    },

    // ── KYC MODIFY — Pay $0.01 USDC to update an existing credential ─
    'POST /kyc/modify': {
      accepts: [
        {
          scheme:  'exact',
          price:   '$0.01',
          network: ALGORAND_TESTNET_CAIP2,
          payTo:   avmAddress,
          extra:   { asset: Number(USDC_TESTNET_ASA_ID) },
        },
      ],
      description: 'Modify KYC credential — Pay $0.01 USDC',
    },
  };
}

export default createPaymentConfig;
