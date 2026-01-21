'use client';

import { useCallback, useEffect, useMemo } from 'react';
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import {
  SEVEN_ELEVEN_ABI,
  ERC20_ABI,
  CHAIN_ID,
  TOKEN_ADDRESSES_BY_CHAIN,
  SEVEN_ELEVEN_ADDRESS_BY_CHAIN,
  getSevenElevenAddress,
  SEVEN_ELEVEN_CONSTANTS,
  getTokenIconUrl,
  type PlayerStats,
} from '@/lib/contracts';

// Token configuration type
export interface SupportedToken {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
}

// Mainnet tokens
const MAINNET_TOKENS: SupportedToken[] = [
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].MFERCOIN,
    symbol: 'MFER',
    name: 'mfercoin',
    decimals: 18,
    icon: 'https://coin-images.coingecko.com/coins/images/36550/small/mfercoin-logo.png',
  },
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].DRB,
    symbol: 'DRB',
    name: 'drb',
    decimals: 18,
    icon: 'https://coin-images.coingecko.com/coins/images/54784/small/1000143570.jpg',
  },
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].BANKR,
    symbol: 'BANKR',
    name: 'bankr',
    decimals: 18,
    icon: getTokenIconUrl(TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].BANKR),
  },
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].USDC,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: getTokenIconUrl(TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].USDC),
  },
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].WETH,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    icon: getTokenIconUrl(TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET].WETH),
  },
];

// Testnet tokens (Base Sepolia)
const TESTNET_TOKENS: SupportedToken[] = [
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_SEPOLIA].USDC,
    symbol: 'USDC',
    name: 'USD Coin (Testnet)',
    decimals: 6,
    icon: 'https://assets-cdn.trustwallet.com/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png',
  },
  {
    address: TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_SEPOLIA].WETH,
    symbol: 'WETH',
    name: 'Wrapped Ether (Testnet)',
    decimals: 18,
    icon: 'https://assets-cdn.trustwallet.com/blockchains/base/assets/0x4200000000000000000000000000000000000006/logo.png',
  },
];

// Get tokens for a specific chain
export function getTokensForChain(chainId: number): SupportedToken[] {
  if (chainId === CHAIN_ID.BASE_SEPOLIA) {
    return TESTNET_TOKENS;
  }
  return MAINNET_TOKENS;
}

// Legacy export for backwards compatibility
export const SUPPORTED_TOKENS = MAINNET_TOKENS;

interface UseSevenElevenReturn {
  // State
  isConnected: boolean;
  address: `0x${string}` | undefined;
  chainId: number;
  contractAddress: `0x${string}`;

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

  // Entropy fee (for Pyth VRF)
  entropyFee: bigint | undefined;
  entropyFeeFormatted: string;

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
  refetchEntropyFee: () => void;
}

export function useSevenEleven(token: SupportedToken): UseSevenElevenReturn {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Get the contract address for the current chain
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
      totalFeePaid: bigint;
      firstPlayTime: bigint;
      lastPlayTime: bigint;
      totalSessions: bigint;
    };
    return stats;
  }, [playerStatsRaw]);

  // Read bet amount
  const { data: betAmount } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getBetAmount',
    args: [token.address],
    query: {
      enabled: isConnected && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Read min deposit
  const { data: minDeposit } = useReadContract({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    functionName: 'getMinDeposit',
    args: [token.address],
    query: {
      enabled: isConnected && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Read entropy fee (required for Pyth VRF)
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
      enabled: isConnected && contractAddress !== '0x0000000000000000000000000000000000000000',
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

  // Wait for transaction confirmations and refetch on success
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

  // Refetch balances when transactions confirm
  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
    }
  }, [isApproveSuccess, refetchAllowance]);

  useEffect(() => {
    if (isDepositSuccess) {
      refetchBalance();
      refetchAllowance();
    }
  }, [isDepositSuccess, refetchBalance, refetchAllowance]);

  useEffect(() => {
    if (isWithdrawSuccess) {
      refetchBalance();
    }
  }, [isWithdrawSuccess, refetchBalance]);

  useEffect(() => {
    if (isRollSuccess) {
      refetchBalance();
      refetchStats();
    }
  }, [isRollSuccess, refetchBalance, refetchStats]);

  // Functions
  const approve = useCallback(
    async (amount: bigint) => {
      writeApprove({
        address: token.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contractAddress, amount],
      });
    },
    [writeApprove, token.address, contractAddress]
  );

  const deposit = useCallback(
    async (amount: bigint) => {
      writeDeposit({
        address: contractAddress,
        abi: SEVEN_ELEVEN_ABI,
        functionName: 'deposit',
        args: [token.address, amount],
      });
    },
    [writeDeposit, token.address, contractAddress]
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

  // Roll function - house pays entropy fee, no ETH needed from user
  const roll = useCallback(async () => {
    writeRoll({
      address: contractAddress,
      abi: SEVEN_ELEVEN_ABI,
      functionName: 'roll',
      args: [token.address],
    });
  }, [writeRoll, token.address, contractAddress]);

  // Watch for events to trigger refetches
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
    onLogs: () => {
      refetchBalance();
    },
  });

  // Refetch balance immediately when roll is requested (balance is deducted on roll, not on settle)
  useWatchContractEvent({
    address: contractAddress,
    abi: SEVEN_ELEVEN_ABI,
    eventName: 'RollRequested',
    onLogs: () => {
      refetchBalance();
    },
  });

  useWatchContractEvent({
    address: contractAddress,
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

  const entropyFeeFormatted = useMemo(() => {
    if (entropyFee === undefined) return '0';
    return formatUnits(entropyFee, 18); // ETH has 18 decimals
  }, [entropyFee]);

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
    chainId,
    contractAddress,
    balance,
    balanceFormatted,
    walletBalance,
    walletBalanceFormatted,
    playerStats,
    betAmount,
    betAmountFormatted,
    minDeposit,
    minDepositFormatted,
    entropyFee,
    entropyFeeFormatted,
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
    refetchEntropyFee,
  };
}

// Hook to get tokens for the current chain
export function useSupportedTokens(): SupportedToken[] {
  const chainId = useChainId();
  return useMemo(() => getTokensForChain(chainId), [chainId]);
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
