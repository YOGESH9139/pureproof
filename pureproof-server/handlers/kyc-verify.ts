import type { Context } from 'hono';
import { checkOnChain } from '../lib/algorand';
import algosdk from 'algosdk';

export async function handleKYCVerify(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED — GET /kyc/verify executing');

    const nullifier = c.req.query('nullifier');
    if (!nullifier) {
      return c.json(
        {
          error: 'Missing ?nullifier= query parameter',
          hint: 'GET /kyc/verify?nullifier=<zk_hash>',
        },
        400,
      );
    }

    console.log(`Checking on-chain for nullifier: ${nullifier}`);
    const { exists, credential } = await checkOnChain(nullifier);
    const checkedAt = new Date().toISOString();

    if (!exists) {
      console.log(`KYC not found on-chain for nullifier: ${nullifier}`);
      return c.json({
        verified: false,
        credential: null,
        reason: 'No KYC credential found on-chain for this identity — use POST /kyc/issue to get verified',
        checkedAt,
      });
    }

    console.log(`✓ KYC verify successful on-chain for: ${nullifier}`);

    return c.json({
      verified: true,
      credential,
      checkedAt,
      message: 'Identity is KYC verified and active on-chain',
    });
  } catch (error) {
    console.error('Error in /kyc/verify handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
