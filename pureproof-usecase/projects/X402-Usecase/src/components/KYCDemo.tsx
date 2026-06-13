import React, { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { issueKYC, verifyKYC, modifyKYC, ZKProofPayload } from '../utils/kycApi'

const KYCDemo: React.FC = () => {
  const { activeAddress, signTransactions } = useWallet()
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [credential, setCredential] = useState<any>(null)
  const [txId, setTxId] = useState<string>('')

  // 1. Mock Passport Data
  const mockPassportData = {
    surname: "DOE",
    givenNames: "JOHN",
    nationality: "IN",
    dateOfBirth: "900101",
    sex: "M",
    expiryDate: "300101", // Expires in 2030
    documentNumber: "A1234567",
    sodBytes: "mock_sod_bytes_base64",
    chipAuthSuccess: true
  }

  // Helper to generate a SHA-256 hash
  const hashString = async (message: string) => {
    const msgBuffer = new TextEncoder().encode(message)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const handleAction = async (action: 'issue' | 'verify' | 'modify') => {
    if (!activeAddress || !signTransactions) {
      setErrorMsg('Please connect your wallet first')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setTxId('')
    setStatusMsg(`Processing ${action}...`)

    try {
      const signer = { address: activeAddress, signTransactions }

      // 2. Generate the ZK Nullifier Hash (mocking the circuit output)
      // We hash the document number + nationality to simulate a unique identity
      const nullifier = await hashString(`${mockPassportData.documentNumber}-${mockPassportData.nationality}`)

      const publicSignals = {
        nullifier,
        ageGte18: true,
        ageGte21: true,
        nationalityCode: 73 * 256 + 78, // "IN"
        currentTimestamp: Math.floor(Date.now() / 1000)
      }

      const dummyProof = {
        proof: 'mock_zk_proof_bytes_base64',
        publicSignals: [],
        aadhaarHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // empty sha256
        nullifier
      }

      if (action === 'issue') {
        const res = await issueKYC(signer, dummyProof, publicSignals, mockPassportData, 'BASIC')
        setCredential(res.credential)
        if (res.txId) setTxId(res.txId)
        setStatusMsg('KYC Issued Successfully! Identity stored on-chain.')
      } else if (action === 'verify') {
        // Now verifying by nullifier instead of wallet address!
        const res = await verifyKYC(signer, nullifier)
        setCredential(res.credential)
        if (res.txId) setTxId(res.txId)
        setStatusMsg(res.verified ? 'KYC Verified: Found on-chain!' : `KYC Not Active: ${res.reason}`)
      } else if (action === 'modify') {
        const res = await modifyKYC(signer, nullifier, { level: 'FULL' }, dummyProof, publicSignals)
        setCredential(res.credential)
        if (res.txId) setTxId(res.txId)
        setStatusMsg('KYC Modified (Level: FULL)!')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred')
      setStatusMsg('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title mb-4">PureProof KYC Actions</h2>
        
        <div className="alert alert-info mb-4">
          <div>
            <span>
              Wallet Status:{' '}
              <span className="font-bold">
                {activeAddress ? `Connected (${activeAddress.slice(0, 8)}...)` : 'Not Connected'}
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button 
            className={`btn btn-primary ${loading ? 'loading' : ''}`} 
            onClick={() => handleAction('issue')} 
            disabled={!activeAddress || loading}
          >
            Issue KYC (Pay 0.01 USDC)
          </button>
          <button 
            className={`btn btn-secondary ${loading ? 'loading' : ''}`} 
            onClick={() => handleAction('verify')} 
            disabled={!activeAddress || loading}
          >
            Verify KYC (Pay 0.005 USDC)
          </button>
          <button 
            className={`btn btn-accent ${loading ? 'loading' : ''}`} 
            onClick={() => handleAction('modify')} 
            disabled={!activeAddress || loading}
          >
            Upgrade to FULL (Pay 0.01 USDC)
          </button>
        </div>

        {statusMsg && (
          <div className="alert alert-success mt-2">
            <div>
              <span>{statusMsg}</span>
              {txId && (
                <a 
                  href={`https://testnet.explorer.perawallet.app/tx/${txId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-xs btn-outline ml-4"
                >
                  View on Pera Explorer
                </a>
              )}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="alert alert-error mt-2">
            <div>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {credential && (
          <div className="mockup-code bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-lg shadow-lg border border-slate-700 mt-4">
            <pre className="text-sm overflow-auto max-h-64 font-mono text-emerald-300 leading-relaxed">
              <code className="whitespace-pre-wrap break-words">{JSON.stringify(credential, null, 2)}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default KYCDemo
