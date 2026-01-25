'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMemeWalletBalances } from '@/hooks/useSevenEleven';
import { useAccount } from 'wagmi';
import { GoldCoinExplosion } from './GoldCoinExplosion';

interface MemeWalletBalancesProps {
  darkMode: boolean;
  /** Trigger animation immediately on win (increment to trigger) */
  winTrigger?: number;
  /** Optimistic payouts from RollSettled event for instant display */
  optimisticPayouts?: { mfer: bigint; bnkr: bigint; drb: bigint } | null;
  /** Callback when optimistic state is cleared */
  onOptimisticPayoutsCleared?: () => void;
}

interface AnimatedBalanceItemProps {
  token: { symbol: string; icon: string };
  balanceFormatted: string;
  darkMode: boolean;
  isAnimating: boolean;
  onAnimationComplete: () => void;
  /** Optimistic payout to add during animation */
  optimisticPayout?: bigint;
}

function AnimatedBalanceItem({
  token,
  balanceFormatted,
  darkMode,
  isAnimating,
  onAnimationComplete,
  optimisticPayout,
}: AnimatedBalanceItemProps) {
  const [showExplosion, setShowExplosion] = useState(false);
  const [glowing, setGlowing] = useState(false);

  useEffect(() => {
    if (isAnimating) {
      setShowExplosion(true);
      setGlowing(true);

      // Stop glowing after animation
      const glowTimer = setTimeout(() => {
        setGlowing(false);
      }, 800);

      return () => clearTimeout(glowTimer);
    }
  }, [isAnimating]);

  const handleExplosionComplete = useCallback(() => {
    setShowExplosion(false);
    onAnimationComplete();
  }, [onAnimationComplete]);

  // Calculate display value with optimistic payout
  const displayValue = useMemo(() => {
    if (glowing && optimisticPayout && optimisticPayout > BigInt(0)) {
      // Parse current balance and add optimistic payout
      const currentValue = parseFloat(balanceFormatted.replace(/[KM]/g, '')) || 0;
      const multiplier = balanceFormatted.includes('M') ? 1000000 :
                        balanceFormatted.includes('K') ? 1000 : 1;
      const current = currentValue * multiplier;
      const payout = Number(optimisticPayout) / 1e18; // Assume 18 decimals
      const total = current + payout;

      // Format the total
      if (total >= 1000000) return `${(total / 1000000).toFixed(2)}M`;
      if (total >= 1000) return `${(total / 1000).toFixed(2)}K`;
      if (total >= 1) return total.toFixed(2);
      return total.toFixed(4);
    }
    return balanceFormatted;
  }, [balanceFormatted, optimisticPayout, glowing]);

  return (
    <div className="flex flex-col items-center relative overflow-visible">
      <div className="relative overflow-visible">
        <img
          src={token.icon}
          alt={token.symbol}
          className={`w-7 h-7 rounded-full transition-transform duration-300 ${
            glowing ? 'scale-125' : ''
          }`}
          style={{
            filter: glowing ? 'drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 20px #FFA500)' : 'none',
          }}
        />
        <GoldCoinExplosion active={showExplosion} onComplete={handleExplosionComplete} />
      </div>
      <span
        className={`font-medium text-xs transition-all duration-300 ${
          darkMode ? 'text-white' : 'text-gray-800'
        } ${glowing ? 'scale-110' : ''}`}
        style={{
          color: glowing ? '#FFD700' : undefined,
          textShadow: glowing ? '0 0 10px #FFD700, 0 0 20px #FFA500' : 'none',
        }}
      >
        {displayValue}
      </span>
    </div>
  );
}

export function MemeWalletBalances({
  darkMode,
  winTrigger = 0,
  optimisticPayouts,
  onOptimisticPayoutsCleared,
}: MemeWalletBalancesProps) {
  const { isConnected } = useAccount();
  const { balances } = useMemeWalletBalances();

  // Track previous win trigger to detect new wins
  const prevWinTriggerRef = useRef(winTrigger);

  // Animation queue - which tokens need to animate
  const [animationQueue, setAnimationQueue] = useState<string[]>([]);
  const [currentlyAnimating, setCurrentlyAnimating] = useState<string | null>(null);

  // Reorder to MFER, DRB, BNKR
  const orderedBalances = [
    balances.find(b => b.token.symbol.includes('MFER')),
    balances.find(b => b.token.symbol.includes('DRB')),
    balances.find(b => b.token.symbol.includes('BNKR')),
  ].filter(Boolean);

  // Get optimistic payout for a token
  const getOptimisticPayout = useCallback((symbol: string): bigint | undefined => {
    if (!optimisticPayouts) return undefined;
    if (symbol.includes('MFER')) return optimisticPayouts.mfer;
    if (symbol.includes('DRB')) return optimisticPayouts.drb;
    if (symbol.includes('BNKR')) return optimisticPayouts.bnkr;
    return undefined;
  }, [optimisticPayouts]);

  // Trigger animation immediately when winTrigger changes (win event from parent)
  useEffect(() => {
    if (winTrigger > 0 && winTrigger !== prevWinTriggerRef.current) {
      prevWinTriggerRef.current = winTrigger;

      // Queue all three tokens for animation in order
      const tokenSymbols = orderedBalances
        .filter(Boolean)
        .map(item => item!.token.symbol);

      if (tokenSymbols.length > 0 && currentlyAnimating === null) {
        setAnimationQueue(tokenSymbols);
      }
    }
  }, [winTrigger, orderedBalances, currentlyAnimating]);

  // Process animation queue
  useEffect(() => {
    if (animationQueue.length > 0 && currentlyAnimating === null) {
      // Start animating the first token in queue
      const nextToken = animationQueue[0];
      setCurrentlyAnimating(nextToken);
      setAnimationQueue(prev => prev.slice(1));
    }
  }, [animationQueue, currentlyAnimating]);

  const handleAnimationComplete = useCallback(() => {
    // Delay before starting next animation
    setTimeout(() => {
      setCurrentlyAnimating((prev) => {
        // If this was the last animation in the queue, clear optimistic state
        if (animationQueue.length === 0 && onOptimisticPayoutsCleared) {
          onOptimisticPayoutsCleared();
        }
        return null;
      });
    }, 300);
  }, [animationQueue.length, onOptimisticPayoutsCleared]);

  // Only show when connected
  if (!isConnected) return null;

  return (
    <div
      className={`fixed flex flex-col items-center gap-3 ${
        darkMode ? 'text-white' : 'text-gray-900'
      }`}
      style={{ bottom: '12vh', right: '2vw', zIndex: currentlyAnimating ? 50 : 0 }}
    >
      {orderedBalances.map((item) => item && (
        <AnimatedBalanceItem
          key={item.token.symbol}
          token={item.token}
          balanceFormatted={item.balanceFormatted}
          darkMode={darkMode}
          isAnimating={currentlyAnimating === item.token.symbol}
          onAnimationComplete={handleAnimationComplete}
          optimisticPayout={getOptimisticPayout(item.token.symbol)}
        />
      ))}
    </div>
  );
}
