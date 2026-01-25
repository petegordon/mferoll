'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useConfig,
} from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { parseUnits, formatUnits, encodeFunctionData } from 'viem';
import {
  SEVEN_ELEVEN_ABI,
  ERC20_ABI,
  CHAIN_ID,
  TOKEN_ADDRESSES_BY_CHAIN,
  POOL_ADDRESSES_BY_CHAIN,
  SEVEN_ELEVEN_ADDRESS_BY_CHAIN,
  getSevenElevenAddress,
  SEVEN_ELEVEN_CONSTANTS,
  getTokenIconUrl,
  type PlayerStats,
  type MemeWinnings,
} from '@/lib/contracts';
import { debugLog } from '@/components/DebugConsole';

// Token configuration type
export interface SupportedToken {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
  isDepositToken: boolean;  // V2: Whether this can be deposited
  isPayoutToken: boolean;   // V2: Whether this is a payout token
  poolAddress?: `0x${string}` | null;  // Uniswap V3 pool for payout tokens
}

// Deposit tokens (USDC only in V2 - simpler UX)
const MAINNET_DEPOSIT_TOKENS: SupportedToken[] = [
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].USDC,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: getTokenIconUrl(TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].USDC),
    isDepositToken: true,
    isPayoutToken: false,
  },
];

// Payout tokens (meme coins)
const MAINNET_PAYOUT_TOKENS: SupportedToken[] = [
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].MFERCOIN,
    symbol: 'MFER',
    name: 'mfercoin',
    decimals: 18,
    icon: 'https://coin-images.coingecko.com/coins/images/36550/small/mfercoin-logo.png',
    isDepositToken: false,
    isPayoutToken: true,
    poolAddress: POOL_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].MFERCOIN_WETH,
  },
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].BANKR,
    symbol: 'BANKR',
    name: 'bankr',
    decimals: 18,
    icon: getTokenIconUrl(TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].BANKR),
    isDepositToken: false,
    isPayoutToken: true,
    poolAddress: POOL_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].BANKR_WETH,
  },
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].DRB,
    symbol: 'DRB',
    name: 'drb',
    decimals: 18,
    icon: 'https://coin-images.coingecko.com/coins/images/54784/small/1000143570.jpg',
    isDepositToken: false,
    isPayoutToken: true,
    poolAddress: POOL_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].DRB_WETH,
  },
];

// Testnet deposit tokens (USDC only)
const TESTNET_DEPOSIT_TOKENS: SupportedToken[] = [
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_SEPOLIA].USDC,
    symbol: 'USDC',
    name: 'USD Coin (Testnet)',
    decimals: 6,
    icon: 'https://assets-cdn.trustwallet.com/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png',
    isDepositToken: true,
    isPayoutToken: false,
  },
];

// Testnet payout tokens (mock meme coins) - addresses set after deployment
const TESTNET_PAYOUT_TOKENS: SupportedToken[] = [
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_SEPOLIA].MFERCOIN,
    symbol: 'mMFER',
    name: 'Mock MFER',
    decimals: 18,
    icon: 'https://coin-images.coingecko.com/coins/images/36550/small/mfercoin-logo.png',
    isDepositToken: false,
    isPayoutToken: true,
    poolAddress: null, // Testnet uses mock pricing
  },
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_SEPOLIA].BANKR,
    symbol: 'mBNKR',
    name: 'Mock BNKR',
    decimals: 18,
    icon: getTokenIconUrl(TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].BANKR),
    isDepositToken: false,
    isPayoutToken: true,
    poolAddress: null, // Testnet uses mock pricing
  },
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_SEPOLIA].DRB,
    symbol: 'mDRB',
    name: 'Mock DRB',
    decimals: 18,
    icon: 'https://coin-images.coingecko.com/coins/images/54784/small/1000143570.jpg',
    isDepositToken: false,
    isPayoutToken: true,
    poolAddress: null, // Testnet uses mock pricing
  },
];

// Get deposit tokens for a chain
export function getDepositTokensForChain(chainId: number): SupportedToken[] {
  if (chainId === CHAIN_ID.BASE_SEPOLIA) {
    return TESTNET_DEPOSIT_TOKENS;
  }
  return MAINNET_DEPOSIT_TOKENS;
}

// Get payout tokens for a chain
export function getPayoutTokensForChain(chainId: number): SupportedToken[] {
  if (chainId === CHAIN_ID.BASE_SEPOLIA) {
    return TESTNET_PAYOUT_TOKENS;
  }
  return MAINNET_PAYOUT_TOKENS;
}

// Get all tokens for a chain (for backwards compatibility)
export function getTokensForChain(chainId: number): SupportedToken[] {
  return [...getDepositTokensForChain(chainId), ...getPayoutTokensForChain(chainId)];
}

// Legacy export - deposit tokens only (V2: only USDC/WETH can be deposited)
export const SUPPORTED_TOKENS = MAINNET_DEPOSIT_TOKENS;

interface UseSevenElevenOptions {
  playerAddress?: `0x${string}`;
  sessionKeyAddress?: `0x${string}`;
  sessionKeyClient?: {
    sendUserOperation: (params: { calls: Array<{ to: `0x${string}`; data: `0x${string}`; value?: bigint }> }) => Promise<`0x${string}`>;
  };
}

interface UseSevenElevenReturn {
  // State
  isConnected: boolean;
  address: `0x${string}` | undefined;
  chainId: number;
  contractAddress: `0x${string}`;

  // Player balance in contract (deposit tokens only)
  balance: bigint | undefined;
  balanceFormatted: string;

  // Wallet balance (for deposit)
  walletBalance: bigint | undefined;
  walletBalanceFormatted: string;

  // Player stats
  playerStats: PlayerStats | undefined;

  // V2: Meme token winnings
  memeWinnings: MemeWinnings | undefined;

  // Bet info
  betAmount: bigint | undefined;
  betAmountFormatted: string;
  minDeposit: bigint | undefined;
  minDepositFormatted: string;

  // Entropy fee (for Pyth VRF)
  entropyFee: bigint | undefined;
  entropyFeeFormatted: string;

  // Token allowance
  allowance: bigint | undefined;
  needsApproval: boolean;

  // V2: Payout reserves
  payoutReserves: { mfer: bigint; bnkr: bigint; drb: bigint } | undefined;

  // House liquidity (for deposit tokens)
  houseLiquidity: bigint | undefined;

  // Session key / authorization
  authorizedRoller: `0x${string}` | undefined;
  hasAuthorizedRoller: boolean;

  // Write functions
  approve: (amount: bigint) => Promise<void>;
  deposit: (amount: bigint) => Promise<void>;
  depositAndAuthorize: (amount: bigint, roller: `0x${string}`) => Promise<void>;
  withdraw: (amount: bigint) => Promise<void>;
  withdrawAll: () => Promise<void>;  // V2: Withdraw all deposit tokens
  roll: () => Promise<void>;
  rollWithSessionKey: () => Promise<`0x${string}` | undefined>;
  authorizeRoller: (roller: `0x${string}`) => Promise<void>;
  revokeRoller: () => Promise<void>;

  // Session key state
  hasSessionKey: boolean;
  sessionKeyAddress: `0x${string}` | undefined;

  // Transaction states
  isApproving: boolean;
  isDepositing: boolean;
  isWithdrawing: boolean;
  isRolling: boolean;
  isRollingWithSessionKey: boolean;
  isAuthorizing: boolean;
  isPending: boolean;

  // Transaction hashes
  approveHash: `0x${string}` | undefined;
  depositHash: `0x${string}` | undefined;
  withdrawHash: `0x${string}` | undefined;
  rollHash: `0x${string}` | undefined;

  // Errors
  error: Error | null;

  // Refetch
  refetchBalance: () => void;
  refetchStats: () => void;
  refetchEntropyFee: () => void;
  refetchAuthorizedRoller: () => void;
  refetchMemeWinnings: () => void;
  refetchPayoutReserves: () => void;
}

export function useSevenEleven(
  token: SupportedToken,
  options: UseSevenElevenOptions = {}
): UseSevenElevenReturn {
  const { address: eoaAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const config = useConfig();

  const address = options.playerAddress || eoaAddress;
  const { sessionKeyClient, sessionKeyAddress } = options;

  const [isRollingWithSessionKey, setIsRollingWithSessionKey] = useState(false);

  const contractAddress = useMemo(() => {
    return getSevenElevenAddress(chainId);
  }, [chainId]);

  // Read player balance in contract
  const {
    data: balance,
    refetch: refetchBalance,
  } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getBalance',
    args: address ? [address, token.address] : undefined,
    query: {
      enabled: isConnected && !!address && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Read wallet balance
  const { data: walletBalance } = useReadContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Read player stats
  const {
    data: playerStatsRaw,
    refetch: refetchStats,
  } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getPlayerStats',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  const playerStats = useMemo(() => {
    if (!playerStatsRaw) return undefined;
    const stats = playerStatsRaw as {
      totalWins: bigint;
      totalLosses: bigint;
      totalDoublesWon: bigint;
      firstPlayTime: bigint;
      lastPlayTime: bigint;
      totalSessions: bigint;
    };
    return stats;
  }, [playerStatsRaw]);

  // V2: Read meme token winnings
  const {
    data: memeWinningsRaw,
    refetch: refetchMemeWinnings,
  } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getPlayerMemeWinnings',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  const memeWinnings = useMemo(() => {
    if (!memeWinningsRaw) return undefined;
    const [mfer, bnkr, drb] = memeWinningsRaw as [bigint, bigint, bigint];
    return { mfer, bnkr, drb };
  }, [memeWinningsRaw]);

  // V2: Read payout reserves
  const {
    data: payoutReservesRaw,
    refetch: refetchPayoutReserves,
  } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getPayoutReserves',
    query: {
      enabled: isConnected && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  const payoutReserves = useMemo(() => {
    if (!payoutReservesRaw) return undefined;
    const [mfer, bnkr, drb] = payoutReservesRaw as [bigint, bigint, bigint];
    return { mfer, bnkr, drb };
  }, [payoutReservesRaw]);

  // Read bet amount
  const { data: betAmount } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getBetAmount',
    args: [token.address],
    query: {
      enabled: isConnected && contractAddress !== '0x0000000000000000000000000000000000000000' && token.isDepositToken,
    },
  });

  // Read min deposit
  const { data: minDeposit } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getMinDeposit',
    args: [token.address],
    query: {
      enabled: isConnected && contractAddress !== '0x0000000000000000000000000000000000000000' && token.isDepositToken,
    },
  });

  // Read entropy fee
  const { data: entropyFee, refetch: refetchEntropyFee } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getEntropyFee',
    query: {
      enabled: isConnected && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, contractAddress] : undefined,
    query: {
      enabled: isConnected && !!address && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Read house liquidity
  const { data: houseLiquidity } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'houseLiquidity',
    args: [token.address],
    query: {
      enabled: isConnected && contractAddress !== '0x0000000000000000000000000000000000000000' && token.isDepositToken,
    },
  });

  // Read authorized roller
  const { data: authorizedRoller, refetch: refetchAuthorizedRoller } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getAuthorizedRoller',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Write contracts
  const {
    writeContractAsync: writeApproveAsync,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
  } = useWriteContract();

  const {
    writeContractAsync: writeDepositAsync,
    data: depositHash,
    isPending: isDepositPending,
    error: depositError,
  } = useWriteContract();

  const {
    writeContract: writeWithdraw,
    isPending: isWithdrawPending,
    error: withdrawError,
  } = useWriteContract();

  const {
    writeContractAsync: writeWithdrawAllAsync,
    data: withdrawHash,
    isPending: isWithdrawAllPending,
    error: withdrawAllError,
  } = useWriteContract();

  const {
    writeContract: writeRoll,
    data: rollHash,
    isPending: isRollPending,
    error: rollError,
  } = useWriteContract();

  const {
    writeContract: writeDepositAndAuthorize,
    isPending: isDepositAndAuthorizePending,
    error: depositAndAuthorizeError,
  } = useWriteContract();

  const {
    writeContractAsync: writeAuthorizeRollerAsync,
    isPending: isAuthorizePending,
    error: authorizeError,
  } = useWriteContract();

  const {
    writeContract: writeRevokeRoller,
    isPending: isRevokePending,
    error: revokeError,
  } = useWriteContract();

  // Transaction confirmations
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({
    hash: withdrawHash,
  });

  const { isLoading: isRollConfirming, isSuccess: isRollSuccess } = useWaitForTransactionReceipt({
    hash: rollHash,
  });

  // Refetch on success
  useEffect(() => {
    if (isApproveSuccess) refetchAllowance();
  }, [isApproveSuccess, refetchAllowance]);

  useEffect(() => {
    if (isDepositSuccess) {
      refetchBalance();
      refetchAllowance();
    }
  }, [isDepositSuccess, refetchBalance, refetchAllowance]);

  useEffect(() => {
    if (isWithdrawSuccess) refetchBalance();
  }, [isWithdrawSuccess, refetchBalance]);

  useEffect(() => {
    if (isRollSuccess) {
      refetchBalance();
      refetchStats();
      refetchMemeWinnings();
      refetchPayoutReserves();
    }
  }, [isRollSuccess, refetchBalance, refetchStats, refetchMemeWinnings, refetchPayoutReserves]);

  // Functions
  const approve = useCallback(
    async (amount: bigint): Promise<void> => {
      const hash = await writeApproveAsync({
        address: token.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contractAddress, amount],
      });
      await waitForTransactionReceipt(config, { hash });
      await refetchAllowance();
    },
    [writeApproveAsync, token.address, contractAddress, config, refetchAllowance]
  );

  const deposit = useCallback(
    async (amount: bigint): Promise<void> => {
      const hash = await writeDepositAsync({
        address: contractAddress,
        abi: SEVEN_ELEVEN_ABI,
        functionName: 'deposit',
        args: [token.address, amount],
      });
      await waitForTransactionReceipt(config, { hash });
      await Promise.all([refetchBalance(), refetchAllowance()]);
    },
    [writeDepositAsync, token.address, contractAddress, config, refetchBalance, refetchAllowance]
  );

  const withdraw = useCallback(
    async (amount: bigint) => {
      writeWithdraw({
        address: contractAddress,
        abi: SEVEN_ELEVEN_ABI,
        functionName: 'withdraw',
        args: [token.address, amount],
      });
    },
    [writeWithdraw, token.address, contractAddress]
  );

  // V2: Withdraw all deposit tokens (USDC + WETH)
  const withdrawAll = useCallback(async () => {
    const hash = await writeWithdrawAllAsync({
      address: contractAddress,
      abi: SEVEN_ELEVEN_ABI,
      functionName: 'withdrawAll',
      args: [],
    });
    await waitForTransactionReceipt(config, { hash });
    await refetchBalance();
  }, [writeWithdrawAllAsync, contractAddress, config, refetchBalance]);

  const roll = useCallback(async () => {
    writeRoll({
      address: contractAddress,
      abi: SEVEN_ELEVEN_ABI,
      functionName: 'roll',
      args: [token.address],
    });
  }, [writeRoll, token.address, contractAddress]);

  const depositAndAuthorize = useCallback(
    async (amount: bigint, roller: `0x${string}`) => {
      writeDepositAndAuthorize({
        address: contractAddress,
        abi: SEVEN_ELEVEN_ABI,
        functionName: 'depositAndAuthorize',
        args: [token.address, amount, roller],
      });
    },
    [writeDepositAndAuthorize, token.address, contractAddress]
  );

  const authorizeRoller = useCallback(
    async (roller: `0x${string}`): Promise<void> => {
      const hash = await writeAuthorizeRollerAsync({
        address: contractAddress,
        abi: SEVEN_ELEVEN_ABI,
        functionName: 'authorizeRoller',
        args: [roller],
      });
      await waitForTransactionReceipt(config, { hash });
      await refetchAuthorizedRoller();
    },
    [writeAuthorizeRollerAsync, contractAddress, config, refetchAuthorizedRoller]
  );

  const revokeRoller = useCallback(async () => {
    writeRevokeRoller({
      address: contractAddress,
      abi: SEVEN_ELEVEN_ABI,
      functionName: 'revokeRoller',
      args: [],
    });
  }, [writeRevokeRoller, contractAddress]);

  // Roll with session key
  const rollWithSessionKey = useCallback(async (): Promise<`0x${string}` | undefined> => {
    if (!sessionKeyClient) throw new Error('Session key client not available');
    if (!address) throw new Error('Player address not available');

    setIsRollingWithSessionKey(true);
    try {
      const callData = encodeFunctionData({
        abi: SEVEN_ELEVEN_ABI,
        functionName: 'rollFor',
        args: [address, token.address],
      });

      debugLog.debug(`Sending UserOp...`);
      const sendStart = Date.now();

      const userOpHash = await sessionKeyClient.sendUserOperation({
        calls: [{ to: contractAddress, data: callData }],
      });

      const sendTime = Date.now() - sendStart;
      debugLog.info(`RollFor submitted: ${userOpHash.slice(0, 10)}... (${sendTime}ms)`);

      setTimeout(() => {
        refetchBalance();
        refetchStats();
        refetchMemeWinnings();
        refetchPayoutReserves();
      }, 5000);

      return userOpHash;
    } catch (err) {
      console.error('Session key rollFor failed:', err);
      throw err;
    } finally {
      setIsRollingWithSessionKey(false);
    }
  }, [sessionKeyClient, address, token.address, contractAddress, refetchBalance, refetchStats, refetchMemeWinnings, refetchPayoutReserves]);

  // Watch contract events
  useWatchContractEvent({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    eventName: 'Deposited',
    onLogs: () => {
      refetchBalance();
      refetchAllowance();
    },
  });

  useWatchContractEvent({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    eventName: 'Withdrawn',
    onLogs: () => refetchBalance(),
  });

  useWatchContractEvent({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    eventName: 'WithdrawnAll',
    onLogs: () => refetchBalance(),
  });

  useWatchContractEvent({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    eventName: 'RollRequested',
    onLogs: () => refetchBalance(),
  });

  useWatchContractEvent({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    eventName: 'RollSettled',
    onLogs: () => {
      refetchBalance();
      refetchStats();
      refetchMemeWinnings();
      refetchPayoutReserves();
    },
  });

  // Format values
  const balanceFormatted = useMemo(() => {
    if (balance === undefined) return '0';
    return formatUnits(balance, token.decimals);
  }, [balance, token.decimals]);

  const walletBalanceFormatted = useMemo(() => {
    if (walletBalance === undefined) return '0';
    return formatUnits(walletBalance, token.decimals);
  }, [walletBalance, token.decimals]);

  const betAmountFormatted = useMemo(() => {
    if (betAmount === undefined) return '0';
    return formatUnits(betAmount, token.decimals);
  }, [betAmount, token.decimals]);

  const minDepositFormatted = useMemo(() => {
    if (minDeposit === undefined) return '0';
    return formatUnits(minDeposit, token.decimals);
  }, [minDeposit, token.decimals]);

  const entropyFeeFormatted = useMemo(() => {
    if (entropyFee === undefined) return '0';
    return formatUnits(entropyFee, 18);
  }, [entropyFee]);

  const needsApproval = useMemo(() => {
    if (allowance === undefined || minDeposit === undefined) return false;
    return allowance < minDeposit;
  }, [allowance, minDeposit]);

  // Aggregate states
  const isApproving = isApprovePending || isApproveConfirming;
  const isDepositing = isDepositPending || isDepositConfirming || isDepositAndAuthorizePending;
  const isWithdrawing = isWithdrawPending || isWithdrawAllPending || isWithdrawConfirming;
  const isRolling = isRollPending || isRollConfirming;
  const isAuthorizing = isAuthorizePending || isRevokePending;
  const isPending = isApproving || isDepositing || isWithdrawing || isRolling || isRollingWithSessionKey || isAuthorizing;

  const hasSessionKey = !!sessionKeyClient;
  const hasAuthorizedRoller = authorizedRoller !== undefined && authorizedRoller !== '0x0000000000000000000000000000000000000000';

  const error = approveError || depositError || withdrawError || withdrawAllError || rollError || depositAndAuthorizeError || authorizeError || revokeError || null;

  return {
    isConnected,
    address,
    chainId,
    contractAddress,
    balance,
    balanceFormatted,
    walletBalance,
    walletBalanceFormatted,
    playerStats,
    memeWinnings,
    betAmount,
    betAmountFormatted,
    minDeposit,
    minDepositFormatted,
    entropyFee,
    entropyFeeFormatted,
    allowance,
    needsApproval,
    payoutReserves,
    houseLiquidity,
    authorizedRoller: authorizedRoller as `0x${string}` | undefined,
    hasAuthorizedRoller,
    approve,
    deposit,
    depositAndAuthorize,
    withdraw,
    withdrawAll,
    roll,
    rollWithSessionKey,
    authorizeRoller,
    revokeRoller,
    hasSessionKey,
    sessionKeyAddress,
    isApproving,
    isDepositing,
    isWithdrawing,
    isRolling,
    isRollingWithSessionKey,
    isAuthorizing,
    isPending,
    approveHash,
    depositHash,
    withdrawHash,
    rollHash,
    error,
    refetchBalance,
    refetchStats,
    refetchEntropyFee,
    refetchAuthorizedRoller,
    refetchMemeWinnings,
    refetchPayoutReserves,
  };
}

// Hook to get deposit tokens for current chain
export function useDepositTokens(): SupportedToken[] {
  const chainId = useChainId();
  return useMemo(() => getDepositTokensForChain(chainId), [chainId]);
}

// Hook to get payout tokens for current chain
export function usePayoutTokens(): SupportedToken[] {
  const chainId = useChainId();
  return useMemo(() => getPayoutTokensForChain(chainId), [chainId]);
}

// Legacy hook - returns deposit tokens only
export function useSupportedTokens(): SupportedToken[] {
  return useDepositTokens();
}

// Helper hook for formatting token amounts
export function useFormatToken(amount: bigint | undefined, decimals: number): string {
  return useMemo(() => {
    if (amount === undefined) return '0';
    return formatUnits(amount, decimals);
  }, [amount, decimals]);
}

// Helper to parse token amounts
export function parseTokenAmount(amount: string, decimals: number): bigint {
  try {
    return parseUnits(amount, decimals);
  } catch {
    return BigInt(0);
  }
}

// Token price info type
export interface TokenPriceInfo {
  token: SupportedToken;
  priceUsdCents: bigint | undefined;
  priceUsd: string;
  isLoading: boolean;
}

// Hook to get token prices in USD
export function useTokenPrices(): {
  prices: Record<string, TokenPriceInfo>;
  isLoading: boolean;
} {
  const chainId = useChainId();
  const payoutTokens = useMemo(() => getPayoutTokensForChain(chainId), [chainId]);
  const contractAddress = useMemo(() => getSevenElevenAddress(chainId), [chainId]);

  // Read price for 1 token (1e18 for 18 decimal tokens)
  const oneToken = parseUnits('1', 18);

  // Fetch price for MFER
  const { data: mferPrice, isLoading: mferLoading } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getTokenValueInCents',
    args: [payoutTokens[0]?.address, oneToken],
    query: {
      enabled: contractAddress !== '0x0000000000000000000000000000000000000000' && payoutTokens.length > 0,
    },
  });

  // Fetch price for BNKR
  const { data: bnkrPrice, isLoading: bnkrLoading } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getTokenValueInCents',
    args: [payoutTokens[1]?.address, oneToken],
    query: {
      enabled: contractAddress !== '0x0000000000000000000000000000000000000000' && payoutTokens.length > 1,
    },
  });

  // Fetch price for DRB
  const { data: drbPrice, isLoading: drbLoading } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getTokenValueInCents',
    args: [payoutTokens[2]?.address, oneToken],
    query: {
      enabled: contractAddress !== '0x0000000000000000000000000000000000000000' && payoutTokens.length > 2,
    },
  });

  const formatPriceUsd = useCallback((cents: bigint | undefined): string => {
    if (cents === undefined) return '—';
    const usd = Number(cents) / 100;
    if (usd >= 0.01) return `$${usd.toFixed(2)}`;
    if (usd >= 0.0001) return `$${usd.toFixed(4)}`;
    if (usd >= 0.000001) return `$${usd.toFixed(6)}`;
    return `$${usd.toFixed(8)}`;
  }, []);

  const prices = useMemo(() => {
    const result: Record<string, TokenPriceInfo> = {};

    if (payoutTokens[0]) {
      result[payoutTokens[0].symbol] = {
        token: payoutTokens[0],
        priceUsdCents: mferPrice as bigint | undefined,
        priceUsd: formatPriceUsd(mferPrice as bigint | undefined),
        isLoading: mferLoading,
      };
    }

    if (payoutTokens[1]) {
      result[payoutTokens[1].symbol] = {
        token: payoutTokens[1],
        priceUsdCents: bnkrPrice as bigint | undefined,
        priceUsd: formatPriceUsd(bnkrPrice as bigint | undefined),
        isLoading: bnkrLoading,
      };
    }

    if (payoutTokens[2]) {
      result[payoutTokens[2].symbol] = {
        token: payoutTokens[2],
        priceUsdCents: drbPrice as bigint | undefined,
        priceUsd: formatPriceUsd(drbPrice as bigint | undefined),
        isLoading: drbLoading,
      };
    }

    return result;
  }, [payoutTokens, mferPrice, bnkrPrice, drbPrice, mferLoading, bnkrLoading, drbLoading, formatPriceUsd]);

  return {
    prices,
    isLoading: mferLoading || bnkrLoading || drbLoading,
  };
}
