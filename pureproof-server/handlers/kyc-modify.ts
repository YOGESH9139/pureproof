import type { Context } from 'hono';
import { checkOnChain } from '../lib/algorand';
import algosdk from 'algosdk';

export async function handleKYCModify(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED — POST /kyc/modify executing');

    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Request body must be valid JSON' }, 400);
    }

    const nullifier: string = body.nullifier ?? '';
    if (!nullifier) {
      return c.json({ error: 'Missing nullifier in request body' }, 400);
    }

    // 2. Check if identity exists on chain
    const { exists } = await checkOnChain(nullifier);
    if (!exists) {
      return c.json(
        {
          error: 'No KYC credential found for this identity',
          hint: 'Use POST /kyc/issue to create one first',
        },
        404,
      );
    }

    // 3. Validate requested updates
    const allowedStatuses = ['ACTIVE', 'REVOKED'];
    const allowedLevels = ['BASIC', 'FULL'];
    const updates: any = {};
    if (body.updates?.status) {
      if (!allowedStatuses.includes(body.updates.status)) {
        return c.json({ error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` }, 400);
      }
      updates.status = body.updates.status;
    }
    if (body.updates?.level) {
      if (!allowedLevels.includes(body.updates.level)) {
        return c.json({ error: `Invalid level. Allowed: ${allowedLevels.join(', ')}` }, 400);
      }
      updates.level = body.updates.level;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No valid updates provided' }, 400);
    }

    // In a real implementation with Smart Contracts, we would call the contract here to update box storage.
    // Since we are mocking with transaction notes, updates aren't natively supported without appending a new note.
    // For this mock, we will just return success.
    console.log(`✓ KYC modified for nullifier ${nullifier}:`, updates);

    return c.json({
      success: true,
      credential: {
        nullifier,
        ...updates,
      },
      message: 'KYC credential updated successfully (Mocked)',
      changes: updates,
    });
  } catch (error) {
    console.error('Error in /kyc/modify handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
