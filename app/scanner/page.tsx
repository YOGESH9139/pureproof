'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';

export default function ScannerPage() {
  const router = useRouter();
  const webcamRef = useRef<Webcam>(null);
  const { walletAddress, setKycStatus } = useAppStore();
  
  const [isScanning, setIsScanning] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  // If no wallet connected, maybe they shouldn't be here, but let's allow it for hackathon
  useEffect(() => {
    if (!walletAddress) {
      // Optional: router.push('/'); 
    }
  }, [walletAddress, router]);

  const loadingMessages = [
    "Capturing Document...",
    "Computing ZK Snark...",
    "Generating Commitments...",
    "Verifying Proof on Algorand..."
  ];

  const handleScan = useCallback(() => {
    setIsScanning(true);
    let step = 0;
    
    // Mock the proof generation with a sequence of loading steps
    const interval = setInterval(() => {
      step++;
      setLoadingStep(step);
      
      if (step >= loadingMessages.length) {
        clearInterval(interval);
        completeVerification();
      }
    }, 1200); // Progresses every 1.2 seconds
  }, [walletAddress]);

  const completeVerification = async () => {
    // Mock Payload we would theoretically send to the backend
    const mockPayload = {
      address: walletAddress || "NOT_CONNECTED",
      documentHash: "ALGO_MOCK_HASH_" + Math.random().toString(36).substring(7),
      isValid: true
    };

    try {
      // Simulate backend POST request delay to /issue
      await new Promise(resolve => setTimeout(resolve, 800));
      
      console.log('Mock ZK Proof Successful. Payload:', mockPayload);
      setKycStatus('VERIFIED');
      router.push('/dashboard');
    } catch (error) {
      console.error('Verification failed', error);
      setIsScanning(false);
      setLoadingStep(0);
    }
  };

  return (
    <div className="relative w-full h-screen bg-neutral-950 overflow-hidden flex flex-col font-sans">
      {/* Header */}
      <div className="absolute top-0 w-full z-10 p-6 pt-12 bg-gradient-to-b from-black/90 to-transparent">
        <h1 className="text-white text-2xl font-bold tracking-wider">Identity Scanner</h1>
        <p className="text-neutral-400 text-sm mt-1">Center your ID card within the frame.</p>
      </div>

      {/* Camera View */}
      <div className="flex-1 w-full h-full relative flex items-center justify-center bg-black">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: "environment" }}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Scanning Reticle Overlay */}
        <div className="relative z-10 w-[85%] max-w-md aspect-[1.58/1] border border-white/20 rounded-xl overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-emerald-500/10" />
          
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
          
          {/* Scanning line animation */}
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400/80 shadow-[0_0_20px_rgba(52,211,153,1)] animate-[scan_2.5s_ease-in-out_infinite]" />
        </div>
      </div>

      {/* Action Area */}
      <div className="absolute bottom-0 w-full z-20 p-6 pb-12 bg-gradient-to-t from-black via-black/90 to-transparent flex justify-center">
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="w-full max-w-md bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-4 rounded-2xl shadow-[0_4px_30px_rgba(16,185,129,0.3)] transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-2"
        >
          {isScanning ? (
             <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
          ) : null}
          {isScanning ? "Processing..." : "Generate Proof & Verify"}
        </button>
      </div>

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
          
          {/* Progress Bar */}
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
          100% { transform: translateY(220px); opacity: 0; }
        }
      `}} />
    </div>
  );
}
