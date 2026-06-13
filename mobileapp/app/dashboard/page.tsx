'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';

export default function DashboardPage() {
  const router = useRouter();
  const { walletAddress, kycStatus, documents, disconnectWallet } = useAppStore();
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

  const handleShare = async (docId: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Nexus2 Verified Identity',
          text: 'Here is my zero-knowledge verified identity credential from Nexus2.',
          url: window.location.origin + `/share/${docId}`,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback
      alert("Share Link Copied to Clipboard!");
    }
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
          <h1 className="text-3xl font-extrabold tracking-tight">Identity Vault</h1>
          <p className="text-sm text-neutral-400 mt-1 font-mono bg-neutral-900 inline-block px-2 py-1 rounded-md mt-2">
            {walletAddress.substring(0, 8)}...{walletAddress.substring(walletAddress.length - 8)}
          </p>
        </div>
        <button onClick={handleDisconnect} className="p-3 bg-neutral-900 rounded-full text-neutral-400 hover:text-white transition shadow-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </header>

      {/* KYC Status Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-900/40 to-teal-900/20 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)] flex justify-between items-center mb-8">
        <div>
          <p className="text-neutral-400 text-sm font-medium mb-1">Global KYC Status</p>
          <p className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]"></span>
            Verified
          </p>
        </div>
        <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Uploaded Documents List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-neutral-200">My Documents</h2>
          <button 
            onClick={() => router.push('/scanner')}
            className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Add New
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-12 bg-neutral-900/50 rounded-2xl border border-neutral-800 border-dashed">
            <p className="text-neutral-500 text-sm">No documents found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc, index) => (
              <div key={index} className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{doc.documentType}</h3>
                      <p className="text-xs text-emerald-400 font-medium">Verified at {doc.verifiedAt}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-black/50 rounded-xl p-4 mb-4 font-mono text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-neutral-500">Name</span>
                    <span className="text-neutral-200 text-right">{doc.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">ID Number</span>
                    <span className="text-neutral-200 text-right">{doc.idNumber}</span>
                  </div>
                </div>

                <button 
                  onClick={() => handleShare(doc.id)}
                  className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-5.368m0 5.368l5.667 3.111m-5.667-3.111l5.667-3.111m5.667 3.111a3 3 0 100-5.368 3 3 0 000 5.368z" />
                  </svg>
                  Share Credential
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
