'use client';

import { useCallback, useMemo } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import {
  SEVEN_ELEVEN_ABI,
  SEVEN_ELEVEN_ADDRESS,
  ERC20_ABI,
  TOKEN_ADDRESSES,
  SEVEN_ELEVEN_CONSTANTS,
  getTokenIconUrl,
  type PlayerStats,
} from '@/lib/contracts';

// Supported tokens for the 7/11 game
export const SUPPORTED_TOKENS = [
  {
    address: TOKEN_ADDRESSES.MFERCOIN,
    symbol: 'MFER',
    name: 'mfercoin',
    decimals: 18,
    icon: getTokenIconUrl(TOKEN_ADDRESSES.MFERCOIN),
  },
  {
    address: TOKEN_ADDRESSES.DRB,
    symbol: 'DRB',
    name: 'drb',
    decimals: 18,
    icon: getTokenIconUrl(TOKEN_ADDRESSES.DRB),
  },
  {
    address: TOKEN_ADDRESSES.BANKR,
    symbol: 'BANKR',
    name: 'bankr',
    decimals: 18,
    icon: getTokenIconUrl(TOKEN_ADDRESSES.BANKR),
  },
  {
    address: TOKEN_ADDRESSES.USDC,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: getTokenIconUrl(TOKEN_ADDRESSES.USDC),
  },
  {
    address: TOKEN_ADDRESSES.WETH,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    icon: getTokenIconUrl(TOKEN_ADDRESSES.WETH),
  },
] as const;

export type SupportedToken = (typeof SUPPORTED_TOKENS)[number];

interface UseSevenElevenReturn {
  // State
  isConnected: boolean;
  address: `0x${string}` | undefined;

  // Player balance in contract
  balance: bigint | undefined;
  balanceFormatted: string;

  // Wallet balance (for deposit)
  walletBalance: bigint | undefined;
  walletBalanceFormatted: string;

  // Player stats
  playerStats: PlayerStats | undefined;

  // Bet info
  betAmount: bigint | undefined;
  betAmountFormatted: string;
  minDeposit: bigint | undefined;
  minDepositFormatted: string;

  // Token allowance
  allowance: bigint | undefined;
  needsApproval: boolean;

  // House liquidity
  houseLiquidity: bigint | undefined;

  // Write functions
  approve: (amount: bigint) => Promise<void>;
  deposit: (amount: bigint) => Promise<void>;
  withdraw: (amount: bigint) => Promise<void>;
  roll: () => Promise<void>;

  // Transaction states
  isApproving: boolean;
  isDepositing: boolean;
  isWithdrawing: boolean;
  isRolling: boolean;
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
}

export function useSevenEleven(token: SupportedToken): UseSevenElevenReturn {
  const { address, isConnected } = useAccount();

  // Read player balance in contract
  const {
    data: balance,
    refetch: refetchBalance,
  } = useReadContract({
    address: SEVEN_ELEVEN_ADDRESS,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getBalance',
    args: address ? [address, token.address] : undefined,
    query: {
      enabled: isConnected && !!address,
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
    address: SEVEN_ELEVEN_ADDRESS,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getPlayerStats',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
    },
  });

  const playerStats = useMemo(() => {
    if (!playerStatsRaw) return undefined;
    const stats = playerStatsRaw as {
      totalWins: bigint;
      totalLosses: bigint;
      totalFeePaid: bigint;
      firstPlayTime: bigint;
      lastPlayTime: bigint;
      totalSessions: bigint;
    };
    return stats;
  }, [playerStatsRaw]);

  // Read bet amount
  const { data: betAmount } = useReadContract({
    address: SEVEN_ELEVEN_ADDRESS,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getBetAmount',
    args: [token.address],
    query: {
      enabled: isConnected,
    },
  });

  // Read min deposit
  const { data: minDeposit } = useReadContract({
    address: SEVEN_ELEVEN_ADDRESS,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getMinDeposit',
    args: [token.address],
    query: {
      enabled: isConnected,
    },
  });

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, SEVEN_ELEVEN_ADDRESS] : undefined,
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Read house liquidity
  const { data: houseLiquidity } = useReadContract({
    address: SEVEN_ELEVEN_ADDRESS,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'houseLiquidity',
    args: [token.address],
    query: {
      enabled: isConnected,
    },
  });

  // Write contracts
  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
  } = useWriteContract();

  const {
    writeContract: writeDeposit,
    data: depositHash,
    isPending: isDepositPending,
    error: depositError,
  } = useWriteContract();

  const {
    writeContract: writeWithdraw,
    data: withdrawHash,
    isPending: isWithdrawPending,
    error: withdrawError,
  } = useWriteContract();

  const {
    writeContract: writeRoll,
    data: rollHash,
    isPending: isRollPending,
    error: rollError,
  } = useWriteContract();

  // Wait for transaction confirmations
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const { isLoading: isDepositConfirming } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  const { isLoading: isWithdrawConfirming } = useWaitForTransactionReceipt({
    hash: withdrawHash,
  });

  const { isLoading: isRollConfirming } = useWaitForTransactionReceipt({
    hash: rollHash,
  });

  // Functions
  const approve = useCallback(
    async (amount: bigint) => {
      writeApprove({
        address: token.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SEVEN_ELEVEN_ADDRESS, amount],
      });
    },
    [writeApprove, token.address]
  );

  const deposit = useCallback(
    async (amount: bigint) => {
      writeDeposit({
        address: SEVEN_ELEVEN_ADDRESS,
        abi: SEVEN_ELEVEN_ABI,
        functionName: 'deposit',
        args: [token.address, amount],
      });
    },
    [writeDeposit, token.address]
  );

  const withdraw = useCallback(
    async (amount: bigint) => {
      writeWithdraw({
        address: SEVEN_ELEVEN_ADDRESS,
        abi: SEVEN_ELEVEN_ABI,
        functionName: 'withdraw',
        args: [token.address, amount],
      });
    },
    [writeWithdraw, token.address]
  );

  const roll = useCallback(async () => {
    writeRoll({
      address: SEVEN_ELEVEN_ADDRESS,
      abi: SEVEN_ELEVEN_ABI,
      functionName: 'roll',
      args: [token.address],
    });
  }, [writeRoll, token.address]);

  // Watch for events to trigger refetches
  useWatchContractEvent({
    address: SEVEN_ELEVEN_ADDRESS,
    abi: SEVEN_ELEVEN_ABI,
    eventName: 'Deposited',
    onLogs: () => {
      refetchBalance();
      refetchAllowance();
    },
  });

  useWatchContractEvent({
    address: SEVEN_ELEVEN_ADDRESS,
    abi: SEVEN_ELEVEN_ABI,
    eventName: 'Withdrawn',
    onLogs: () => {
      refetchBalance();
    },
  });

  useWatchContractEvent({
    address: SEVEN_ELEVEN_ADDRESS,
    abi: SEVEN_ELEVEN_ABI,
    eventName: 'RollSettled',
    onLogs: () => {
      refetchBalance();
      refetchStats();
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

  // Check if approval needed
  const needsApproval = useMemo(() => {
    if (allowance === undefined || minDeposit === undefined) return false;
    return allowance < minDeposit;
  }, [allowance, minDeposit]);

  // Aggregate loading states
  const isApproving = isApprovePending || isApproveConfirming;
  const isDepositing = isDepositPending || isDepositConfirming;
  const isWithdrawing = isWithdrawPending || isWithdrawConfirming;
  const isRolling = isRollPending || isRollConfirming;
  const isPending = isApproving || isDepositing || isWithdrawing || isRolling;

  // Aggregate errors
  const error = approveError || depositError || withdrawError || rollError || null;

  return {
    isConnected,
    address,
    balance,
    balanceFormatted,
    walletBalance,
    walletBalanceFormatted,
    playerStats,
    betAmount,
    betAmountFormatted,
    minDeposit,
    minDepositFormatted,
    allowance,
    needsApproval,
    houseLiquidity,
    approve,
    deposit,
    withdraw,
    roll,
    isApproving,
    isDepositing,
    isWithdrawing,
    isRolling,
    isPending,
    approveHash,
    depositHash,
    withdrawHash,
    rollHash,
    error,
    refetchBalance,
    refetchStats,
  };
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
