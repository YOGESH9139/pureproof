import algosdk from 'algosdk';

const client = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');

// Wait for a transaction to be confirmed
export async function waitForConfirmation(txId: string): Promise<void> {
  const status = await client.status().do();
  let lastRound = status.lastRound;
  while (true) {
    const pendingInfo = await client.pendingTransactionInformation(txId).do();
    if (pendingInfo.confirmedRound !== null && pendingInfo.confirmedRound !== undefined && pendingInfo.confirmedRound > 0) {
      return;
    }
    if (pendingInfo.poolError != null && pendingInfo.poolError.length > 0) {
      throw new Error(`Transaction failed: ${pendingInfo.poolError}`);
    }
    await client.statusAfterBlock(lastRound + 1n).do();
    lastRound += 1n;
  }
}

/**
 * Commits the KYC credential to the Track 1 Credential Store Smart Contract.
 */
export async function commitToChain(
  proof: string, 
  publicSignals: any, 
  mnemonic: string
): Promise<string> {
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const sp = await client.getTransactionParams().do();
  
  const appId = Number(process.env.CREDENTIAL_STORE_APP_ID || 0);
  if (!appId) throw new Error("CREDENTIAL_STORE_APP_ID missing in .env");

  const nullifierBytes = Buffer.from(publicSignals.nullifier, "hex");

  // ABI Type: (byte[],bool,bool,uint16,uint64)
  const abiType = algosdk.ABIType.from("(byte[],bool,bool,uint16,uint64)");
  const publicSignalsEncoded = abiType.encode([
    new Uint8Array(nullifierBytes),
    publicSignals.ageGte18,
    publicSignals.ageGte21,
    publicSignals.nationalityCode,
    BigInt(publicSignals.currentTimestamp),
  ]);

  let proofBytes = new Uint8Array();
  try {
    // Attempt to decode proof as hex, fallback to base64 if it fails
    if (/^[0-9A-Fa-f]+$/.test(proof)) {
        proofBytes = new Uint8Array(Buffer.from(proof, "hex"));
    } else {
        proofBytes = new Uint8Array(Buffer.from(proof, "base64"));
    }
  } catch (e) {
    console.log("Using empty proof bytes due to mock");
  }

  // 1. Payment Txn for Box MBR (0.005 ALGO to cover creation)
  const mbrTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: algosdk.getApplicationAddress(appId),
    amount: 5000, // 0.005 ALGO
    suggestedParams: sp,
  });

  // 2. App Call Txn
  const appTxn = algosdk.makeApplicationCallTxnFromObject({
    sender: account.addr,
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [
      algosdk.encodeUint64(1), // method selector — register_credential
      proofBytes,
      publicSignalsEncoded,
    ],
    boxes: [
      { appIndex: 0, name: new Uint8Array(nullifierBytes) }
    ],
    suggestedParams: sp,
  });

  const group = algosdk.assignGroupID([mbrTxn, appTxn]);
  const signedMbr = group[0].signTxn(account.sk);
  const signedApp = group[1].signTxn(account.sk);

  const { txid } = await client.sendRawTransaction([signedMbr, signedApp]).do();
  await waitForConfirmation(txid);
  return txid;
}

/**
 * Queries the Box Storage of the Credential Store contract to read the credential.
 */
export async function checkOnChain(nullifier: string): Promise<{ exists: boolean; credential?: any }> {
  const appId = Number(process.env.CREDENTIAL_STORE_APP_ID || 0);
  if (!appId) return { exists: false };

  const nullifierBytes = Buffer.from(nullifier, "hex");

  try {
    const box = await client.getApplicationBoxByName(appId, new Uint8Array(nullifierBytes)).do();
    
    // Decode Credential ABI struct: (bool, bool, uint16, uint64, uint64)
    const abiType = algosdk.ABIType.from("(bool,bool,uint16,uint64,uint64)");
    const decoded = abiType.decode(box.value) as any[];
    
    return {
      exists: true,
      credential: {
        nullifier,
        ageGte18: decoded[0] as boolean,
        ageGte21: decoded[1] as boolean,
        nationalityCode: decoded[2] as number,
        issuedAt: Number(decoded[3]),
        expiresAt: Number(decoded[4]),
        status: 'ACTIVE',
        level: 'BASIC',
        zkProofValid: true,
      },
    };
  } catch (error) {
    // If box is not found, getApplicationBoxByName throws an error
    return { exists: false };
  }
}
