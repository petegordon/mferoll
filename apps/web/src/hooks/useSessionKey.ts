'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useChainId, useWalletClient } from 'wagmi';
import { createPublicClient, http, type Hex, encodeFunctionData } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  type KernelAccountClient,
  constants,
} from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  toPermissionValidator,
  serializePermissionAccount,
  deserializePermissionAccount,
} from '@zerodev/permissions';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { toCallPolicy, CallPolicyVersion } from '@zerodev/permissions/policies';
import {
  getZeroDevConfig,
  isZeroDevConfigured,
  SESSION_KEY_STORAGE_PREFIX,
  SESSION_KEY_EXPIRY_SECONDS,
} from '@/lib/zerodev';
import { CHAIN_ID, SEVEN_ELEVEN_ABI, getSevenElevenAddress } from '@/lib/contracts';
import { debugLog } from '@/components/DebugConsole';

// Use entry point v0.7
const entryPoint = constants.getEntryPoint('0.7');
const kernelVersion = '0.3.1' as const;

// Helper to serialize objects with BigInt values to JSON
// BigInts are converted to hex strings for JSON-RPC compatibility
function stringifyWithBigInt(obj: unknown): string {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? `0x${value.toString(16)}` : value
  );
}

// Storage key for session key data
function getStorageKey(chainId: number, address: string): string {
  return `${SESSION_KEY_STORAGE_PREFIX}${chainId}_${address.toLowerCase()}`;
}

interface StoredSessionKey {
  serializedAccount: string;
  privateKey: Hex;
  kernelAddress: `0x${string}`; // The smart wallet address that calls rollFor
  createdAt: number;
  expiresAt: number;
}

interface UseSessionKeyReturn {
  // Session key state
  hasValidSessionKey: boolean;
  hasSessionKeyStored: boolean;
  isSessionKeyExpired: boolean;
  sessionKeyExpiresAt: number | undefined;
  isCreatingSessionKey: boolean;
  isLoadingSessionKey: boolean;

  // Session key wallet address (the smart wallet that calls rollFor)
  sessionKeyAddress: `0x${string}` | undefined;

  // Session key client for sending rolls
  sessionKeyClient: KernelAccountClient | undefined;

  // Actions
  createSessionKey: () => Promise<`0x${string}`>;  // Returns the kernel wallet address
  clearSessionKey: () => void;

  // Error
  error: Error | null;
}

export function useSessionKey(): UseSessionKeyReturn {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();

  const [sessionKeyClient, setSessionKeyClient] = useState<KernelAccountClient | undefined>();
  const [storedSession, setStoredSession] = useState<StoredSessionKey | null>(null);
  const [isCreatingSessionKey, setIsCreatingSessionKey] = useState(false);
  const [isLoadingSessionKey, setIsLoadingSessionKey] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Ref to skip deserialization when we just created a session key
  const skipDeserializationRef = useRef(false);

  const isZeroDevAvailable = useMemo(() => isZeroDevConfigured(), []);
  const zeroDevConfig = useMemo(() => getZeroDevConfig(chainId), [chainId]);
  const contractAddress = useMemo(() => getSevenElevenAddress(chainId), [chainId]);

  // Get the right chain config
  const chain = useMemo(() => {
    if (chainId === CHAIN_ID.BASE_SEPOLIA) return baseSepolia;
    if (chainId === CHAIN_ID.BASE_MAINNET) return base;
    return baseSepolia;
  }, [chainId]);

  // Check if session key is expired (only true if there WAS a session that expired)
  const isSessionKeyExpired = useMemo(() => {
    if (!storedSession) return false; // No session = not expired, just doesn't exist
    return Date.now() > storedSession.expiresAt;
  }, [storedSession]);

  // Check if a session key exists (even if expired or not yet loaded)
  const hasSessionKeyStored = !!storedSession;

  const hasValidSessionKey = useMemo(() => {
    return !!storedSession && !isSessionKeyExpired && !!sessionKeyClient;
  }, [storedSession, isSessionKeyExpired, sessionKeyClient]);

  // Load stored session key from localStorage on mount
  useEffect(() => {
    if (!address || !isConnected) {
      setStoredSession(null);
      setSessionKeyClient(undefined);
      return;
    }

    const storageKey = getStorageKey(chainId, address);
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredSessionKey;
        if (Date.now() < parsed.expiresAt) {
          setStoredSession(parsed);
        } else {
          // Expired, clear it
          localStorage.removeItem(storageKey);
          setStoredSession(null);
        }
      } catch {
        localStorage.removeItem(storageKey);
        setStoredSession(null);
      }
    }
  }, [address, isConnected, chainId]);

  // Deserialize session key when storedSession changes
  // Skip if sessionKeyClient is already set (e.g., just created a new session key)
  useEffect(() => {
    let isMounted = true;

    async function loadSessionKey() {
      if (!storedSession || !zeroDevConfig || !isZeroDevAvailable || isSessionKeyExpired) {
        setSessionKeyClient(undefined);
        return;
      }

      // Skip deserialization if we just created a session key (client already set)
      if (skipDeserializationRef.current) {
        skipDeserializationRef.current = false;
        return;
      }

      setIsLoadingSessionKey(true);
      setError(null);

      try {
        const zeroDevPublicClient = createPublicClient({
          chain,
          transport: http(zeroDevConfig.rpcUrl),
        });

        // Deserialize the session key account
        const sessionKeyAccount = await deserializePermissionAccount(
          zeroDevPublicClient,
          entryPoint,
          kernelVersion,
          storedSession.serializedAccount
        );

        if (!isMounted) return;

        // Create ZeroDev paymaster client
        const paymasterClient = createZeroDevPaymasterClient({
          chain,
          transport: http(zeroDevConfig.paymasterUrl),
        });

        // Create the kernel client for the session key
        const client = createKernelAccountClient({
          account: sessionKeyAccount,
          chain,
          bundlerTransport: http(zeroDevConfig.bundlerUrl),
          paymaster: paymasterClient,
        });

        if (!isMounted) return;

        setSessionKeyClient(client as KernelAccountClient);
        debugLog.info('Session key loaded from storage');
      } catch (err) {
        debugLog.error(`Failed to load session key: ${err}`);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load session key'));
          setSessionKeyClient(undefined);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSessionKey(false);
        }
      }
    }

    loadSessionKey();

    return () => {
      isMounted = false;
    };
  }, [storedSession, zeroDevConfig, isZeroDevAvailable, chain, isSessionKeyExpired]);

  // Create a new session key - returns the kernel wallet address for authorization
  const createSessionKey = useCallback(async (): Promise<`0x${string}`> => {
    if (!isConnected || !address || !walletClient || !zeroDevConfig || !isZeroDevAvailable) {
      throw new Error('Wallet not connected or ZeroDev not configured');
    }

    if (contractAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('Contract not deployed on this chain');
    }

    setIsCreatingSessionKey(true);
    setError(null);

    try {
      debugLog.info('Creating session key...');

      const zeroDevPublicClient = createPublicClient({
        chain,
        transport: http(zeroDevConfig.rpcUrl),
      });

      // Create ECDSA validator for sudo access (the user's wallet)
      const ecdsaValidator = await signerToEcdsaValidator(zeroDevPublicClient, {
        signer: walletClient,
        entryPoint,
        kernelVersion,
      });
      debugLog.info('ECDSA validator created');

      // Generate a new session key
      const sessionPrivateKey = generatePrivateKey();
      const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);

      // Create the session key signer
      const sessionKeySigner = await toECDSASigner({
        signer: sessionKeyAccount,
      });

      // Create call policy for the rollFor function
      // This limits the session key to only calling rollFor() on our contract
      const callPolicy = toCallPolicy({
        policyVersion: CallPolicyVersion.V0_0_4,
        permissions: [
          {
            target: contractAddress,
            abi: SEVEN_ELEVEN_ABI,
            functionName: 'rollFor',
          },
        ],
      });

      // Create the permission validator with the session key
      const permissionPlugin = await toPermissionValidator(zeroDevPublicClient, {
        signer: sessionKeySigner,
        policies: [callPolicy],
        entryPoint,
        kernelVersion,
      });
      debugLog.info('Permission validator created');

      // Create the kernel account with both sudo and regular (session key) plugins
      const kernelAccount = await createKernelAccount(zeroDevPublicClient, {
        plugins: {
          sudo: ecdsaValidator,
          regular: permissionPlugin,
        },
        entryPoint,
        kernelVersion,
      });
      debugLog.info(`Kernel account: ${kernelAccount.address.slice(0, 10)}...`);

      // Serialize the account for storage
      const serializedAccount = await serializePermissionAccount(
        kernelAccount,
        sessionPrivateKey
      );

      // Calculate expiry time
      const createdAt = Date.now();
      const expiresAt = createdAt + SESSION_KEY_EXPIRY_SECONDS * 1000;

      // Store the session key
      const sessionData: StoredSessionKey = {
        serializedAccount,
        privateKey: sessionPrivateKey,
        kernelAddress: kernelAccount.address,
        createdAt,
        expiresAt,
      };

      const storageKey = getStorageKey(chainId, address);
      localStorage.setItem(storageKey, JSON.stringify(sessionData));

      // Mark that we're creating a session key to skip the deserialization useEffect
      skipDeserializationRef.current = true;
      setStoredSession(sessionData);

      // Create ZeroDev paymaster client
      const paymasterClient = createZeroDevPaymasterClient({
        chain,
        transport: http(zeroDevConfig.paymasterUrl),
      });

      // Create the kernel client for immediate use
      const client = createKernelAccountClient({
        account: kernelAccount,
        chain,
        bundlerTransport: http(zeroDevConfig.bundlerUrl),
        paymaster: paymasterClient,
      });

      setSessionKeyClient(client as KernelAccountClient);

      debugLog.info('Session key created successfully');

      // Return the kernel address for authorization
      return kernelAccount.address;
    } catch (err) {
      debugLog.error(`Session key creation failed: ${err instanceof Error ? err.message : String(err)}`);
      setError(err instanceof Error ? err : new Error('Failed to create session key'));
      throw err;
    } finally {
      setIsCreatingSessionKey(false);
    }
  }, [
    isConnected,
    address,
    walletClient,
    zeroDevConfig,
    isZeroDevAvailable,
    chain,
    chainId,
    contractAddress,
  ]);

  // Clear the session key
  const clearSessionKey = useCallback(() => {
    if (address) {
      const storageKey = getStorageKey(chainId, address);
      localStorage.removeItem(storageKey);
    }
    setStoredSession(null);
    setSessionKeyClient(undefined);
  }, [address, chainId]);

  return {
    hasValidSessionKey,
    hasSessionKeyStored,
    isSessionKeyExpired,
    sessionKeyExpiresAt: storedSession?.expiresAt,
    isCreatingSessionKey,
    isLoadingSessionKey,
    sessionKeyAddress: storedSession?.kernelAddress,
    sessionKeyClient,
    createSessionKey,
    clearSessionKey,
    error,
  };
}
