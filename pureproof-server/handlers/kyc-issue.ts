import type { Context } from 'hono';
import { validatePassport, type PassportData } from '../lib/passport';
import { commitToChain } from '../lib/algorand';

export async function handleKYCIssue(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED — POST /kyc/issue executing');

    const paymentSig = c.req.header('payment-signature') ?? '';
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Request body must be valid JSON' }, 400);
    }

    const walletAddress: string = body.walletAddress ?? paymentSig.split(':')[0] ?? '';
    if (!walletAddress) {
      return c.json({ error: 'Cannot determine wallet address' }, 400);
    }

    const nullifier = body.public_signals?.nullifier;
    const passportData = body.passport_data;

    if (!nullifier || !passportData) {
      return c.json({ error: 'Missing nullifier or passport_data' }, 400);
    }

    // 1. Validate Passport Data
    const passportResult = await validatePassport(passportData);
    if (!passportResult.valid) {
      return c.json({ error: `Passport validation failed: ${passportResult.reason}` }, 422);
    }

    // 2. Commit to Algorand Blockchain
    const mnemonic = process.env.ISSUER_MNEMONIC;
    let onChainTxId = '';
    if (mnemonic) {
      try {
        onChainTxId = await commitToChain(body.zkProof?.proof || '', body.public_signals, mnemonic);
        console.log(`✓ Nullifier committed to chain in txn: ${onChainTxId}`);
      } catch (err) {
        console.error('Failed to commit to chain:', err);
        return c.json({ error: 'Failed to write to blockchain' }, 500);
      }
    } else {
      console.warn('ISSUER_MNEMONIC not set in .env! Skipping on-chain commit.');
    }

    const credential = {
      nullifier,
      status: 'ACTIVE',
      level: body.level === 'FULL' ? 'FULL' : 'BASIC',
      issuedAt: new Date().toISOString(),
    };

    return c.json({
      success: true,
      credential,
      message: 'KYC credential issued and committed on-chain',
      onChainTxId,
      nextSteps: 'Use POST /kyc/verify with nullifier to verify',
    });
  } catch (error) {
    console.error('Error in /kyc/issue handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
