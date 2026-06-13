'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';

export default function HomePage() {
  const router = useRouter();
  const { walletAddress, kycStatus, connectWallet, initializePeraWallet } = useAppStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    initializePeraWallet();
  }, [initializePeraWallet]);

  useEffect(() => {
    if (!isMounted) return;
    if (walletAddress) {
      if (kycStatus === 'UNVERIFIED') {
        router.push('/scanner');
      } else if (kycStatus === 'VERIFIED') {
        router.push('/dashboard');
      }
    }
  }, [walletAddress, kycStatus, router, isMounted]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 p-6 font-sans">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-500 shadow-[0_0_40px_rgba(16,185,129,0.4)] flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
          Nexus2 KYC
        </h1>
        <p className="text-lg text-neutral-400 mb-10 leading-relaxed">
          Decentralized identity verification powered by x402 on the Algorand Testnet.
        </p>

        <button
          onClick={connectWallet}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-4 px-8 rounded-2xl shadow-[0_4px_30px_rgba(16,185,129,0.3)] transition-all transform active:scale-95 text-lg flex items-center justify-center gap-3"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Connect Pera Wallet
        </button>
      </div>
    </main>
  );
}
