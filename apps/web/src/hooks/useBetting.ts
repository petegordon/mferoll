'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, maxUint256 } from 'viem';
import { MFERCOIN_ADDRESS, DICE_BETTING_ADDRESS } from '@/lib/wagmi';
import { ERC20_ABI, DICE_BETTING_ABI, BetType, PAYOUT_MULTIPLIERS } from '@/lib/contracts';
import { TEST_MODE, generateDiceResult, simulateVRFDelay } from '@/lib/testMode';
import { useTestBalance } from './useTestBalance';

interface BetResult {
  die1: number;
  die2: number;
  won: boolean;
  payout: number;
}

export function useBetting() {
  const { address, chainId } = useAccount();
  const [isApproving, setIsApproving] = useState(false);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [pendingResult, setPendingResult] = useState<BetResult | null>(null);

  // Test mode balance management
  const testBalance = useTestBalance();

  const diceBettingAddress = chainId
    ? DICE_BETTING_ADDRESS[chainId as keyof typeof DICE_BETTING_ADDRESS]
    : undefined;

  // Check current allowance (only in production mode)
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MFERCOIN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && diceBettingAddress ? [address, diceBettingAddress] : undefined,
    query: {
      enabled: !TEST_MODE && !!address && !!diceBettingAddress,
    },
  });

  // Get token decimals
  const { data: decimals } = useReadContract({
    address: MFERCOIN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: !TEST_MODE,
    },
  });

  const { writeContractAsync } = useWriteContract();

  // Check if approval is needed (always false in test mode)
  const needsApproval = useMemo(() => {
    if (TEST_MODE) return false;
    if (!allowance) return true;
    return allowance === BigInt(0);
  }, [allowance]);

  // Approve tokens (production only)
  const approve = useCallback(async () => {
    if (TEST_MODE) return;
    if (!diceBettingAddress) throw new Error('Contract not deployed on this network');

    setIsApproving(true);
    try {
      const hash = await writeContractAsync({
        address: MFERCOIN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [diceBettingAddress, maxUint256],
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));
      await refetchAllowance();
      return hash;
    } finally {
      setIsApproving(false);
    }
  }, [diceBettingAddress, writeContractAsync, refetchAllowance]);

  // Check if bet won
  const checkWin = useCallback(
    (betType: BetType, prediction: number, die1: number, die2: number): boolean => {
      const sum = die1 + die2;

      switch (betType) {
        case BetType.Exact:
          return sum === prediction;
        case BetType.Over:
          return sum > 7;
        case BetType.Under:
          return sum < 7;
        case BetType.Odd:
          return sum % 2 === 1;
        case BetType.Even:
          return sum % 2 === 0;
        case BetType.Doubles:
          return die1 === die2;
        case BetType.Range:
          if (prediction === 0) return sum >= 2 && sum <= 6;
          if (prediction === 1) return sum >= 5 && sum <= 9;
          if (prediction === 2) return sum >= 8 && sum <= 12;
          return false;
        default:
          return false;
      }
    },
    []
  );

  // Calculate payout
  const calculatePayout = useCallback(
    (betType: BetType, prediction: number, amount: number): number => {
      const typeMultipliers = PAYOUT_MULTIPLIERS[betType];
      let multiplier: number;

      if (betType === BetType.Exact) {
        multiplier = typeMultipliers[prediction] || 1;
      } else {
        multiplier = typeMultipliers[0] || 1;
      }

      return amount * multiplier;
    },
    []
  );

  // Place a bet (test mode or production)
  const placeBet = useCallback(
    async (
      betType: BetType,
      prediction: number,
      amount: number
    ): Promise<{ die1: number; die2: number } | null> => {
      if (TEST_MODE) {
        // Test mode: simulate betting
        if (!testBalance.placeBet(amount)) {
          throw new Error('Insufficient test balance');
        }

        setIsPlacingBet(true);
        setPendingResult(null);

        try {
          // Simulate VRF delay
          await simulateVRFDelay();

          // Generate random result
          const { die1, die2 } = generateDiceResult();
          const won = checkWin(betType, prediction, die1, die2);
          const payout = won ? calculatePayout(betType, prediction, amount) : 0;

          // Settle the bet
          testBalance.settleBet(betType, prediction, amount, die1, die2, won, payout);

          const result = { die1, die2, won, payout };
          setPendingResult(result);

          return { die1, die2 };
        } finally {
          setIsPlacingBet(false);
        }
      } else {
        // Production mode: call smart contract
        if (!diceBettingAddress) throw new Error('Contract not deployed on this network');

        if (needsApproval) {
          await approve();
        }

        setIsPlacingBet(true);
        try {
          const amountWei = parseUnits(amount.toString(), decimals || 18);

          await writeContractAsync({
            address: diceBettingAddress,
            abi: DICE_BETTING_ABI,
            functionName: 'placeBet',
            args: [betType, prediction, amountWei],
          });

          // In production, result comes from VRF callback event
          // This will be handled by event listeners
          return null;
        } finally {
          setIsPlacingBet(false);
        }
      }
    },
    [
      testBalance,
      diceBettingAddress,
      needsApproval,
      approve,
      decimals,
      writeContractAsync,
      checkWin,
      calculatePayout,
    ]
  );

  return {
    placeBet,
    approve,
    isApproving,
    isPlacingBet,
    needsApproval,
    allowance,
    pendingResult,
    // Test mode specific
    isTestMode: TEST_MODE,
    testBalance: TEST_MODE ? testBalance.balance : null,
    testHistory: TEST_MODE ? testBalance.history : null,
    resetTestBalance: TEST_MODE ? testBalance.resetBalance : undefined,
    addTestBonus: TEST_MODE ? testBalance.addBonus : undefined,
  };
}
