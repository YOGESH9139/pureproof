/**
 * PureProof — KYC API Client Utility
 *
 * Drop-in x402-aware fetch functions for the 3 KYC endpoints.
 * Wraps every request with x402 payment handling automatically.
 *
 * UI TEAM — just import and call:
 *   import { issueKYC, verifyKYC, modifyKYC } from '../utils/kycApi'
 *
 *   // In your component:
 *   const { activeAddress, signTransactions } = useWallet()
 *   const signer = { address: activeAddress, signTransactions }
 *
 *   const result = await issueKYC(signer, zkProofPayload)
 *   const status = await verifyKYC(signer, walletAddress)
 *   const updated = await modifyKYC(signer, walletAddress, { level: 'FULL' }, zkProofPayload)
 *
 * ZK TEAM — the ZKProofPayload type is defined here.
 * Your proof output should match this shape before calling any function.
 */

import { x402Client, wrapFetchWithPayment } from '@x402-avm/fetch'
import { ALGORAND_TESTNET_CAIP2 } from '@x402-avm/avm'
import type { ClientAvmSigner } from '@x402-avm/avm'
import { ExactAvmScheme } from '@x402-avm/avm/exact/client'

// ──────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────

export interface PassportData {
  surname: string;
  givenNames: string;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  expiryDate: string;
  documentNumber: string;
  sodBytes: string;
  chipAuthSuccess: boolean;
}

export interface PublicSignals {
  nullifier: string;
  ageGte18: boolean;
  ageGte21: boolean;
  nationalityCode: number;
  currentTimestamp: number;
}

export type KYCStatus = 'ACTIVE' | 'REVOKED' | 'PENDING'
export type KYCLevel  = 'BASIC'  | 'FULL'

/** Matches the ZKProofPayload type in pureproof-server/store/kycStore.ts */
export interface ZKProofPayload {
  proof: string           // ZK proof bytes as base64
  publicSignals: any[]    // Public signals from self.xyz SDK
  aadhaarHash: string     // SHA-256 hash of Aadhaar number (64-char hex)
  nullifier: string       // Unique per issuance — prevents double-issue
}

export interface KYCCredential {
  walletAddress: string
  aadhaarHash:   string
  nullifier:     string
  zkProofValid:  boolean
  status:        KYCStatus
  level:         KYCLevel
  issuedAt:      string
  modifiedAt:    string
}

export interface IssueKYCResponse {
  success:    boolean
  credential: KYCCredential
  message:    string
  nextSteps?: string
  txId?:      string
}

export interface VerifyKYCResponse {
  verified:   boolean
  credential: KYCCredential | null
  checkedAt:  string
  message?:   string
  reason?:    string
  txId?:      string
}

export interface ModifyKYCResponse {
  success:    boolean
  credential: KYCCredential
  message:    string
  changes:    Partial<Pick<KYCCredential, 'status' | 'level'>>
  txId?:      string
}

// ──────────────────────────────────────────────────────────────────
// X402 FETCH FACTORY (internal)
// ──────────────────────────────────────────────────────────────────

async function createX402Fetch(walletSigner: { address: string; signTransactions: Function }) {
  const client = new x402Client()
  let originalTxns: Uint8Array[] = []

  const x402Signer: ClientAvmSigner = {
    address: walletSigner.address,
    signTransactions: async (txns: Uint8Array[]) => {
      originalTxns = txns
      const walletResult = await walletSigner.signTransactions(txns)

      if (!Array.isArray(walletResult)) return walletResult

      return walletResult.map((item: any, i: number) => {
        if (item === null || item === undefined) return originalTxns[i]
        if (item instanceof Uint8Array) return item
        if (typeof item === 'string') {
          const binary = atob(item)
          const bytes  = new Uint8Array(binary.length)
          for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)
          return bytes
        }
        return originalTxns[i]
      })
    },
  }

  client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(x402Signer))
  return wrapFetchWithPayment(fetch, client)
}

// ──────────────────────────────────────────────────────────────────
// PUBLIC API FUNCTIONS
// ──────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4021'

/**
 * Issue a new KYC credential.
 * Triggers x402 payment of $0.01 USDC via wallet.
 *
 * @param walletSigner - { address, signTransactions } from useWallet()
 * @param zkProof      - ZK proof payload from self.xyz SDK
 * @param level        - 'BASIC' (default) or 'FULL'
 */
export async function issueKYC(
  walletSigner: { address: string; signTransactions: Function },
  zkProof: ZKProofPayload,
  publicSignals: PublicSignals,
  passportData: PassportData,
  level: KYCLevel = 'BASIC',
): Promise<IssueKYCResponse> {
  const fetchFn = await createX402Fetch(walletSigner)

  const response = await fetchFn(`${API_BASE}/kyc/issue`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: walletSigner.address,
      zkProof,
      public_signals: publicSignals,
      passport_data: passportData,
      level,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
    throw new Error(err.error || `KYC issue failed: HTTP ${response.status}`)
  }

  const data = await response.json()
  
  const paymentResponse = response.headers.get('payment-response')
  if (paymentResponse) {
    try {
      const parsed = JSON.parse(atob(paymentResponse))
      if (parsed.transaction) data.txId = parsed.transaction
    } catch (e) {
      // ignore
    }
  }

  return data
}

/**
 * Verify an existing KYC credential.
 * Triggers x402 payment of $0.005 USDC via wallet.
 *
 * @param walletSigner  - { address, signTransactions } from useWallet()
 * @param addressToCheck - Algorand wallet address to verify (can be different from payer)
 */
export async function verifyKYC(
  walletSigner: { address: string; signTransactions: Function },
  nullifier: string,
): Promise<VerifyKYCResponse> {
  const fetchFn = await createX402Fetch(walletSigner)

  const response = await fetchFn(
    `${API_BASE}/kyc/verify?nullifier=${encodeURIComponent(nullifier)}`,
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
    throw new Error(err.error || `KYC verify failed: HTTP ${response.status}`)
  }

  const data = await response.json()
  
  const paymentResponse = response.headers.get('payment-response')
  if (paymentResponse) {
    try {
      const parsed = JSON.parse(atob(paymentResponse))
      if (parsed.transaction) data.txId = parsed.transaction
    } catch (e) {
      // ignore
    }
  }

  return data
}

/**
 * Modify an existing KYC credential.
 * Triggers x402 payment of $0.01 USDC via wallet.
 * Requires a fresh ZK proof to authorize the change.
 *
 * @param walletSigner - { address, signTransactions } from useWallet()
 * @param walletAddress - address whose credential to modify
 * @param updates      - { level?, status? }
 * @param zkProof      - fresh ZK proof (re-verification required)
 */
export async function modifyKYC(
  walletSigner: { address: string; signTransactions: Function },
  nullifier: string,
  updates: Partial<Pick<KYCCredential, 'status' | 'level'>>,
  zkProof: ZKProofPayload,
  publicSignals: PublicSignals,
): Promise<ModifyKYCResponse> {
  const fetchFn = await createX402Fetch(walletSigner)

  const response = await fetchFn(`${API_BASE}/kyc/modify`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nullifier, updates, zkProof, public_signals: publicSignals }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
    throw new Error(err.error || `KYC modify failed: HTTP ${response.status}`)
  }

  const data = await response.json()
  
  const paymentResponse = response.headers.get('payment-response')
  if (paymentResponse) {
    try {
      const parsed = JSON.parse(atob(paymentResponse))
      if (parsed.transaction) data.txId = parsed.transaction
    } catch (e) {
      // ignore
    }
  }

  return data
}
