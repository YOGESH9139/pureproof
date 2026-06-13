'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';

export default function DashboardPage() {
  const router = useRouter();
  const { walletAddress, kycStatus, x402Earnings, setX402Earnings, disconnectWallet } = useAppStore();
  const [logs, setLogs] = useState<{id: number, time: string, amount: number}[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Protect route
  useEffect(() => {
    if (!isMounted) return;
    if (!walletAddress) {
      router.push('/');
    } else if (kycStatus === 'UNVERIFIED') {
      router.push('/scanner');
    }
  }, [walletAddress, kycStatus, router, isMounted]);

  // Mock incoming microtransactions
  useEffect(() => {
    if (kycStatus !== 'VERIFIED') return;
    
    const interval = setInterval(() => {
      const amount = Number((Math.random() * 0.05 + 0.01).toFixed(3));
      
      setX402Earnings(useAppStore.getState().x402Earnings + amount);
      
      setLogs(prev => [
        { id: Date.now(), time: new Date().toLocaleTimeString(), amount },
        ...prev
      ].slice(0, 10)); // keep last 10
      
    }, 4500); // every 4.5s
    
    return () => clearInterval(interval);
  }, [kycStatus, setX402Earnings]);

  const handleUpdate = () => {
    alert("Simulating transaction signature via Pera Wallet...");
  };

  const handleDisconnect = () => {
    disconnectWallet();
    router.push('/');
  };

  if (!walletAddress || kycStatus === 'UNVERIFIED') return null;

  return (
    <div className="min-h-screen bg-neutral-950 p-6 font-sans text-white pb-20">
      <header className="flex justify-between items-center mb-8 pt-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-neutral-400 mt-1 font-mono">
            {walletAddress.substring(0, 8)}...{walletAddress.substring(walletAddress.length - 8)}
          </p>
        </div>
        <button onClick={handleDisconnect} className="p-3 bg-neutral-900 rounded-full text-neutral-400 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 mb-8">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-900/40 to-emerald-950/20 border border-emerald-500/20 shadow-lg">
          <p className="text-emerald-400 text-sm font-medium mb-1">Total Earned (USDC)</p>
          <p className="text-4xl font-extrabold tracking-tight">${x402Earnings.toFixed(3)}</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)] animate-pulse"></span>
            <span className="text-xs text-neutral-400">x402 streaming active</span>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 flex justify-between items-center">
          <div>
            <p className="text-neutral-400 text-sm font-medium mb-1">KYC Status</p>
            <p className="text-xl font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Verified
            </p>
          </div>
          <button 
            onClick={handleUpdate}
            className="text-sm font-semibold text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 px-4 py-2 rounded-lg transition-colors"
          >
            Update
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-neutral-200">Recent Activity</h2>
        {logs.length === 0 ? (
          <p className="text-neutral-500 text-sm text-center py-8">Waiting for AI agent queries...</p>
        ) : (
          <div className="space-y-3">
            {logs.map(log => (
              <div key={log.id} className="flex justify-between items-center p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-200">AI Agent Verification</p>
                    <p className="text-xs text-neutral-500">{log.time}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-emerald-400">+{log.amount.toFixed(3)} USDC</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
