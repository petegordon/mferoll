import { connectorsForWallets, getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  coinbaseWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  injectedWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

// Configure wallets with Coinbase Wallet prioritized for in-app browser detection
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [
        // Injected wallet first - this catches Coinbase Wallet in-app browser
        injectedWallet,
        coinbaseWallet,
        metaMaskWallet,
        rainbowWallet,
        walletConnectWallet,
      ],
    },
  ],
  {
    appName: 'mferoll',
    projectId,
  }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

// Contract addresses
export const MFERCOIN_ADDRESS = '0xe3086852a4b125803c815a158249ae468a3254ca' as const;

// Contract will be deployed - placeholder for now
export const DICE_BETTING_ADDRESS = {
  [base.id]: '0x0000000000000000000000000000000000000000' as const,
  [baseSepolia.id]: '0x0000000000000000000000000000000000000000' as const,
} as const;
