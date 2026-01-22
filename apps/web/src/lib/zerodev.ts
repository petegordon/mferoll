// ZeroDev configuration for session keys and smart wallets
import { CHAIN_ID } from './contracts';

// ZeroDev Project ID - get this from https://dashboard.zerodev.app
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;

if (!ZERODEV_PROJECT_ID) {
  console.warn('NEXT_PUBLIC_ZERODEV_PROJECT_ID not set - session keys will not work');
}

// ZeroDev RPC endpoints by chain (v3 API with /chain/ path format)
export const ZERODEV_CONFIG = {
  [CHAIN_ID.BASE_SEPOLIA]: {
    bundlerUrl: `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/${CHAIN_ID.BASE_SEPOLIA}`,
    paymasterUrl: `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/${CHAIN_ID.BASE_SEPOLIA}`,
    rpcUrl: `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/${CHAIN_ID.BASE_SEPOLIA}`,
  },
  [CHAIN_ID.BASE_MAINNET]: {
    bundlerUrl: `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/${CHAIN_ID.BASE_MAINNET}`,
    paymasterUrl: `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/${CHAIN_ID.BASE_MAINNET}`,
    rpcUrl: `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/${CHAIN_ID.BASE_MAINNET}`,
  },
} as const;

// Get ZeroDev config for a specific chain
export function getZeroDevConfig(chainId: number) {
  return ZERODEV_CONFIG[chainId as keyof typeof ZERODEV_CONFIG] || null;
}

// Check if ZeroDev is configured
export function isZeroDevConfigured(): boolean {
  return !!ZERODEV_PROJECT_ID;
}

// Entry point address for ERC-4337 (v0.7)
export const ENTRYPOINT_ADDRESS_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const;

// Kernel version
export const KERNEL_VERSION = '0.3.1' as const;

// Session key storage key prefix
export const SESSION_KEY_STORAGE_PREFIX = 'zerodev_session_' as const;

// Session key expiry duration (24 hours in seconds)
export const SESSION_KEY_EXPIRY_SECONDS = 24 * 60 * 60;
