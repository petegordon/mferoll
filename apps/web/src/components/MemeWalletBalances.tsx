'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMemeWalletBalances } from '@/hooks/useSevenEleven';
import { useAccount } from 'wagmi';

interface MemeWalletBalancesProps {
  darkMode: boolean;
}

interface CoinParticle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  scale: number;
  opacity: number;
}

function GoldCoinExplosion({ active, onComplete }: { active: boolean; onComplete: () => void }) {
  const [particles, setParticles] = useState<CoinParticle[]>([]);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (active) {
      // Create particles
      const newParticles: CoinParticle[] = [];
      const particleCount = 12;

      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        newParticles.push({
          id: i,
          x: 0,
          y: 0,
          angle,
          speed: 40 + Math.random() * 30,
          scale: 0.5 + Math.random() * 0.5,
          opacity: 1,
        });
      }

      setParticles(newParticles);
      startTimeRef.current = Date.now();

      // Animate particles
      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const duration = 600;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 1) {
          setParticles(prev => prev.map(p => ({
            ...p,
            x: Math.cos(p.angle) * p.speed * progress,
            y: Math.sin(p.angle) * p.speed * progress - 20 * progress * progress, // Arc upward
            opacity: 1 - progress,
            scale: p.scale * (1 - progress * 0.5),
          })));
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setParticles([]);
          onComplete();
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [active, onComplete]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(${p.x - 6}px, ${p.y - 6}px) scale(${p.scale})`,
            opacity: p.opacity,
          }}
        >
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
              boxShadow: '0 0 4px #FFD700, inset 0 -1px 2px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      ))}
    </div>
  );
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
            filter: glowing ? 'drop-shadow(0 0 8px #FFD700) drop-shadow(0 0 16px #FFA500)' : 'none',
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
          textShadow: glowing ? '0 0 8px #FFD700, 0 0 16px #FFA500' : 'none',
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
