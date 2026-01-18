'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { TEST_BALANCE_KEY, INITIAL_TEST_BALANCE } from '@/lib/testMode';

interface TestBalanceState {
  balance: number;
  history: BetHistoryItem[];
}

interface BetHistoryItem {
  id: string;
  timestamp: number;
  betType: number;
  prediction: number;
  amount: number;
  die1: number;
  die2: number;
  won: boolean;
  payout: number;
}

function getStorageKey(address: string): string {
  return `${TEST_BALANCE_KEY}-${address.toLowerCase()}`;
}

function loadState(address: string): TestBalanceState {
  if (typeof window === 'undefined') {
    return { balance: INITIAL_TEST_BALANCE, history: [] };
  }

  try {
    const stored = localStorage.getItem(getStorageKey(address));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }

  return { balance: INITIAL_TEST_BALANCE, history: [] };
}

function saveState(address: string, state: TestBalanceState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(getStorageKey(address), JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function useTestBalance() {
  const { address } = useAccount();
  const [state, setState] = useState<TestBalanceState>({
    balance: INITIAL_TEST_BALANCE,
    history: [],
  });

  // Load balance when address changes
  useEffect(() => {
    if (address) {
      setState(loadState(address));
    }
  }, [address]);

  // Deduct bet amount
  const placeBet = useCallback(
    (amount: number): boolean => {
      if (!address) return false;
      if (amount > state.balance) return false;

      const newState = {
        ...state,
        balance: state.balance - amount,
      };
      setState(newState);
      saveState(address, newState);
      return true;
    },
    [address, state]
  );

  // Settle bet with result
  const settleBet = useCallback(
    (
      betType: number,
      prediction: number,
      amount: number,
      die1: number,
      die2: number,
      won: boolean,
      payout: number
    ) => {
      if (!address) return;

      const historyItem: BetHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        betType,
        prediction,
        amount,
        die1,
        die2,
        won,
        payout,
      };

      const newBalance = won ? state.balance + payout : state.balance;
      const newState: TestBalanceState = {
        balance: newBalance,
        history: [historyItem, ...state.history].slice(0, 100), // Keep last 100 bets
      };

      setState(newState);
      saveState(address, newState);
    },
    [address, state]
  );

  // Reset balance to initial amount
  const resetBalance = useCallback(() => {
    if (!address) return;

    const newState: TestBalanceState = {
      balance: INITIAL_TEST_BALANCE,
      history: [],
    };
    setState(newState);
    saveState(address, newState);
  }, [address]);

  // Add bonus balance (for testing)
  const addBonus = useCallback(
    (amount: number) => {
      if (!address) return;

      const newState = {
        ...state,
        balance: state.balance + amount,
      };
      setState(newState);
      saveState(address, newState);
    },
    [address, state]
  );

  return {
    balance: state.balance,
    history: state.history,
    placeBet,
    settleBet,
    resetBalance,
    addBonus,
  };
}
