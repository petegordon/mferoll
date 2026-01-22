'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, useWalletClient } from 'wagmi';
import { createPublicClient, http, type PublicClient } from 'viem';
import { baseSepolia, base } from 'viem/chains';
import { createKernelAccount, createKernelAccountClient, type KernelAccountClient, constants } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { getZeroDevConfig, isZeroDevConfigured } from '@/lib/zerodev';
import { CHAIN_ID } from '@/lib/contracts';

// Use entry point v0.7
const entryPoint = constants.getEntryPoint('0.7');
const kernelVersion = '0.3.1' as const;

interface UseSmartWalletReturn {
  // Smart wallet state
  smartWalletAddress: `0x${string}` | undefined;
  isSmartWalletReady: boolean;
  isInitializing: boolean;
  error: Error | null;

  // The kernel account client for sending transactions
  kernelClient: KernelAccountClient | undefined;

  // Check if ZeroDev is available
  isZeroDevAvailable: boolean;
}

export function useSmartWallet(): UseSmartWalletReturn {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();

  const [smartWalletAddress, setSmartWalletAddress] = useState<`0x${string}` | undefined>();
  const [kernelClient, setKernelClient] = useState<KernelAccountClient | undefined>();
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isZeroDevAvailable = useMemo(() => isZeroDevConfigured(), []);

  const zeroDevConfig = useMemo(() => getZeroDevConfig(chainId), [chainId]);

  // Get the right chain config
  const chain = useMemo(() => {
    if (chainId === CHAIN_ID.BASE_SEPOLIA) return baseSepolia;
    if (chainId === CHAIN_ID.BASE_MAINNET) return base;
    return baseSepolia; // Default to testnet
  }, [chainId]);

  // Initialize smart wallet when wallet connects
  useEffect(() => {
    let isMounted = true;

    async function initSmartWallet() {
      if (!isConnected || !address || !walletClient || !zeroDevConfig || !isZeroDevAvailable) {
        setSmartWalletAddress(undefined);
        setKernelClient(undefined);
        return;
      }

      setIsInitializing(true);
      setError(null);

      try {
        // Create a public client for ZeroDev
        const zeroDevPublicClient = createPublicClient({
          chain,
          transport: http(zeroDevConfig.rpcUrl),
        }) as PublicClient;

        // Create ECDSA validator from the user's wallet
        const ecdsaValidator = await signerToEcdsaValidator(zeroDevPublicClient, {
          signer: walletClient,
          entryPoint,
          kernelVersion,
        });

        // Create the Kernel account
        const kernelAccount = await createKernelAccount(zeroDevPublicClient, {
          plugins: {
            sudo: ecdsaValidator,
          },
          entryPoint,
          kernelVersion,
        });

        if (!isMounted) return;

        // Create the kernel account client
        const client = createKernelAccountClient({
          account: kernelAccount,
          chain,
          bundlerTransport: http(zeroDevConfig.bundlerUrl),
          paymaster: {
            getPaymasterData: async (userOperation) => {
              // Use ZeroDev's paymaster to sponsor gas
              const response = await fetch(zeroDevConfig.paymasterUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'pm_sponsorUserOperation',
                  params: [userOperation, entryPoint],
                }),
              });

              const data = await response.json();
              if (data.error) {
                throw new Error(data.error.message || 'Paymaster error');
              }

              return data.result;
            },
          },
        });

        if (!isMounted) return;

        setSmartWalletAddress(kernelAccount.address);
        setKernelClient(client as KernelAccountClient);

        console.log('Smart wallet initialized:', kernelAccount.address);
      } catch (err) {
        console.error('Failed to initialize smart wallet:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to initialize smart wallet'));
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    initSmartWallet();

    return () => {
      isMounted = false;
    };
  }, [isConnected, address, walletClient, zeroDevConfig, isZeroDevAvailable, chain]);

  const isSmartWalletReady = !!smartWalletAddress && !!kernelClient;

  return {
    smartWalletAddress,
    isSmartWalletReady,
    isInitializing,
    error,
    kernelClient,
    isZeroDevAvailable,
  };
}
