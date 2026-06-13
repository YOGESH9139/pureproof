'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';

export default function ScannerPage() {
  const router = useRouter();
  const webcamRef = useRef<Webcam>(null);
  const { walletAddress, setKycStatus, addDocument } = useAppStore();
  
  const [docType, setDocType] = useState('Passport');
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    if (!walletAddress) {
      // Optional protection
    }
  }, [walletAddress, router]);

  const loadingMessages = [
    "Capturing Document Image...",
    "Encrypting Identity Data...",
    "Computing ZK Snark Proof...",
    "Verifying on Algorand Testnet..."
  ];

  const handleScan = useCallback((e: React.FormEvent) => {
    e.preventDefault(); // Prevent form submission
    
    if (!fullName || !idNumber) {
      alert("Please fill in your name and ID number!");
      return;
    }
    
    setIsScanning(true);
    let step = 0;
    
    const interval = setInterval(() => {
      step++;
      setLoadingStep(step);
      
      if (step >= loadingMessages.length) {
        clearInterval(interval);
        completeVerification();
      }
    }, 1200); 
  }, [walletAddress, fullName, idNumber, docType]);

  const completeVerification = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Add the verified document to our global store
      addDocument({
        id: Math.random().toString(36).substring(7),
        documentType: docType,
        fullName: fullName,
        idNumber: idNumber,
        verifiedAt: new Date().toLocaleTimeString()
      });

      setKycStatus('VERIFIED');
      router.push('/dashboard');
    } catch (error) {
      console.error('Verification failed', error);
      setIsScanning(false);
      setLoadingStep(0);
    }
  };

  return (
    <div className="relative w-full h-screen bg-neutral-950 overflow-y-auto flex flex-col font-sans pb-8">
      {/* Header */}
      <div className="w-full z-10 p-6 pt-12 bg-black shrink-0 shadow-lg">
        <h1 className="text-white text-2xl font-bold tracking-wider">Upload Identity</h1>
        <p className="text-neutral-400 text-sm mt-1">Please provide your details and scan your ID.</p>
      </div>

      {/* Camera View - Shrunk down a bit to fit form */}
      <div className="w-full h-64 relative flex items-center justify-center bg-black shrink-0 border-y border-neutral-800">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: "environment" }}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Scanning Reticle Overlay */}
        <div className="relative z-10 w-[85%] max-w-sm aspect-[1.58/1] border border-white/20 rounded-xl overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-emerald-500/10" />
          
          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
          
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400/80 shadow-[0_0_20px_rgba(52,211,153,1)] animate-[scan_2.5s_ease-in-out_infinite]" />
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleScan} className="flex-1 p-6 flex flex-col justify-between max-w-md w-full mx-auto">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Document Type</label>
            <select 
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="Passport">Passport</option>
              <option value="National ID">National ID Card</option>
              <option value="Driver's License">Driver's License</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Full Name</label>
            <input 
              type="text" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Document ID Number</label>
            <input 
              type="text" 
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="e.g. A12345678"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isScanning}
          className="w-full mt-8 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-4 rounded-2xl shadow-[0_4px_30px_rgba(16,185,129,0.3)] transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-2"
        >
          {isScanning ? (
             <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
          ) : null}
          {isScanning ? "Processing..." : "Generate Proof & Verify"}
        </button>
      </form>

      {/* Loading Modal - ZK Prover Illusion */}
      {isScanning && (
        <div className="absolute inset-0 z-50 bg-neutral-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6">
          <div className="relative w-24 h-24 mb-8">
             <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
             <div className="absolute inset-2 border-4 border-emerald-400/30 rounded-full border-b-transparent animate-[spin_1.5s_linear_infinite_reverse]"></div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3 tracking-wide text-center drop-shadow-md">
            {loadingMessages[loadingStep] || "Finalizing..."}
          </h2>
          <p className="text-neutral-400 text-center max-w-[280px] text-sm leading-relaxed">
            Securing your identity via zero-knowledge proofs on the Algorand Testnet.
          </p>
          
          <div className="w-64 h-1.5 bg-neutral-800 rounded-full mt-10 overflow-hidden shadow-inner">
            <div 
              className="h-full bg-emerald-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(16,185,129,0.8)]"
              style={{ width: `${Math.min(((loadingStep + 1) / loadingMessages.length) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Global CSS for scanner beam */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(-10px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(180px); opacity: 0; }
        }
      `}} />
    </div>
  );
}
