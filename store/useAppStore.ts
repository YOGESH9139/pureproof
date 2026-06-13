import { create } from 'zustand';
import { PeraWalletConnect } from '@perawallet/connect';

export interface KYCRecord {
  id: string;
  documentType: string;
  fullName: string;
  idNumber: string;
  verifiedAt: string;
}

interface AppState {
  walletAddress: string | null;
  kycStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
  documents: KYCRecord[];
  peraWallet: PeraWalletConnect | null;
  
  setWalletAddress: (address: string | null) => void;
  setKycStatus: (status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED') => void;
  addDocument: (doc: KYCRecord) => void;
  
  initializePeraWallet: () => void;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  walletAddress: null,
  kycStatus: 'UNVERIFIED',
  documents: [],
  peraWallet: null,

  setWalletAddress: (address) => set({ walletAddress: address }),
  setKycStatus: (status) => set({ kycStatus: status }),
  addDocument: (doc) => set((state) => ({ documents: [doc, ...state.documents] })),

  initializePeraWallet: () => {
    if (typeof window !== 'undefined' && !get().peraWallet) {
      const peraWallet = new PeraWalletConnect();
      set({ peraWallet });
      
      peraWallet.reconnectSession().then((accounts) => {
        if (accounts.length) {
          set({ walletAddress: accounts[0] });
        }
      }).catch((error) => console.log('Pera reconnect error:', error));
    }
  },

  connectWallet: async () => {
    const { peraWallet } = get();
    if (!peraWallet) return;
    try {
      const newAccounts = await peraWallet.connect();
      if (newAccounts.length) {
        set({ walletAddress: newAccounts[0] });
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  },

  disconnectWallet: () => {
    const { peraWallet } = get();
    if (peraWallet) {
      peraWallet.disconnect();
    }
    set({ walletAddress: null, kycStatus: 'UNVERIFIED' });
  },
}));
