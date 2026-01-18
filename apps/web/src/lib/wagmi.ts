import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'DiceRoll',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: [base, baseSepolia],
  ssr: true,
});

// Contract addresses
export const MFERCOIN_ADDRESS = '0xe3086852a4b125803c815a158249ae468a3254ca' as const;

// Contract will be deployed - placeholder for now
export const DICE_BETTING_ADDRESS = {
  [base.id]: '0x0000000000000000000000000000000000000000' as const,
  [baseSepolia.id]: '0x0000000000000000000000000000000000000000' as const,
} as const;
