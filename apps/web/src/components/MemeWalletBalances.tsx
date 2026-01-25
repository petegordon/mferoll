'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMemeWalletBalances } from '@/hooks/useSevenEleven';
import { useAccount } from 'wagmi';
import { GoldCoinExplosion } from './GoldCoinExplosion';

interface MemeWalletBalancesProps {
  darkMode: boolean;
}

interface AnimatedBalanceItemProps {
  token: { symbol: string; icon: string };
  balanceFormatted: string;
  darkMode: boolean;
  isAnimating: boolean;
  onAnimationComplete: () => void;
}

function AnimatedBalanceItem({
  token,
  balanceFormatted,
  darkMode,
  isAnimating,
  onAnimationComplete,
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

  return (
    <div className="flex flex-col items-center relative">
      <div className="relative">
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
        {balanceFormatted}
      </span>
    </div>
  );
}

export function MemeWalletBalances({ darkMode }: MemeWalletBalancesProps) {
  const { isConnected } = useAccount();
  const { balances } = useMemeWalletBalances();

  // Track previous balances to detect increases
  const prevBalancesRef = useRef<Map<string, string>>(new Map());

  // Animation queue - which tokens need to animate
  const [animationQueue, setAnimationQueue] = useState<string[]>([]);
  const [currentlyAnimating, setCurrentlyAnimating] = useState<string | null>(null);

  // Reorder to MFER, DRB, BNKR
  const orderedBalances = [
    balances.find(b => b.token.symbol.includes('MFER')),
    balances.find(b => b.token.symbol.includes('DRB')),
    balances.find(b => b.token.symbol.includes('BNKR')),
  ].filter(Boolean);

  // Detect balance increases and queue animations
  useEffect(() => {
    const tokensToAnimate: string[] = [];

    orderedBalances.forEach(item => {
      if (!item) return;

      const prevBalance = prevBalancesRef.current.get(item.token.symbol);
      const currentBalance = item.balanceFormatted;

      // Check if balance increased (compare as numbers)
      if (prevBalance !== undefined && prevBalance !== currentBalance) {
        const prevNum = parseFloat(prevBalance.replace(/[KM]/g, '')) || 0;
        const currNum = parseFloat(currentBalance.replace(/[KM]/g, '')) || 0;

        // Handle K/M suffixes
        const prevMultiplier = prevBalance.includes('M') ? 1000000 : prevBalance.includes('K') ? 1000 : 1;
        const currMultiplier = currentBalance.includes('M') ? 1000000 : currentBalance.includes('K') ? 1000 : 1;

        if (currNum * currMultiplier > prevNum * prevMultiplier) {
          tokensToAnimate.push(item.token.symbol);
        }
      }

      // Update previous balance
      prevBalancesRef.current.set(item.token.symbol, currentBalance);
    });

    // Add to animation queue if not already animating these tokens
    if (tokensToAnimate.length > 0 && currentlyAnimating === null) {
      setAnimationQueue(prev => {
        const newQueue = [...prev];
        tokensToAnimate.forEach(token => {
          if (!newQueue.includes(token)) {
            newQueue.push(token);
          }
        });
        return newQueue;
      });
    }
  }, [orderedBalances, currentlyAnimating]);

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
      setCurrentlyAnimating(null);
    }, 300);
  }, []);

  // Only show when connected
  if (!isConnected) return null;

  return (
    <div
      className={`fixed z-0 flex flex-col items-center gap-3 ${
        darkMode ? 'text-white' : 'text-gray-900'
      }`}
      style={{ bottom: '12vh', right: '2vw' }}
    >
      {orderedBalances.map((item) => item && (
        <AnimatedBalanceItem
          key={item.token.symbol}
          token={item.token}
          balanceFormatted={item.balanceFormatted}
          darkMode={darkMode}
          isAnimating={currentlyAnimating === item.token.symbol}
          onAnimationComplete={handleAnimationComplete}
        />
      ))}
    </div>
  );
}
