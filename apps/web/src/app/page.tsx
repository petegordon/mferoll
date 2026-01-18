'use client';

import dynamic from 'next/dynamic';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { TouchToStart } from '@/components/motion/TouchToStart';
import { useAccount } from 'wagmi';
import { useState, useCallback, useEffect, useRef } from 'react';
import { TEST_MODE } from '@/lib/testMode';
import { useTestBalance } from '@/hooks/useTestBalance';

// Dynamic import for Three.js components to avoid SSR issues
const DiceScene = dynamic(() => import('@/components/dice/DiceScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="text-white/50">Loading...</div>
    </div>
  ),
});

const ROLL_COOLDOWN_MS = 10000; // 10 second cooldown between rolls

export default function Home() {
  const { isConnected } = useAccount();
  const { balance } = useTestBalance();
  const [isRolling, setIsRolling] = useState(false);
  const [diceResult, setDiceResult] = useState<{ die1: number; die2: number } | null>(null);
  const [targetFaces, setTargetFaces] = useState<{ die1: number; die2: number } | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [canRoll, setCanRoll] = useState(true);
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const [rollCount, setRollCount] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const isRollingRef = useRef(false);
  const cooldownEndRef = useRef(0);

  // Start cooldown timer (called when roll starts)
  const startCooldown = useCallback(() => {
    cooldownEndRef.current = Date.now() + ROLL_COOLDOWN_MS;
    setCooldownRemaining(ROLL_COOLDOWN_MS);
    setCanRoll(false);
  }, []);

  // Called when TouchToStart completes - triggers first roll
  const handleStart = useCallback((motionGranted: boolean) => {
    console.log('Started with motion granted:', motionGranted);
    setShakeEnabled(motionGranted);
    setHasStarted(true);

    // Generate target faces first
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    console.log('Target faces:', die1, die2);

    // Trigger first roll
    isRollingRef.current = true;
    setRollCount(1);
    setTargetFaces({ die1, die2 });
    setIsRolling(true);
    setDiceResult(null);
    startCooldown(); // Start 10s cooldown now
  }, [startCooldown]);

  // Handle roll - only when canRoll is true
  const handleRoll = useCallback(() => {
    if (!canRoll || isRollingRef.current || isRolling) {
      console.log('Cannot roll now');
      return;
    }

    // Generate target faces first
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    console.log('Starting roll, target faces:', die1, die2);

    isRollingRef.current = true;
    setRollCount(c => c + 1);
    setTargetFaces({ die1, die2 });
    setIsRolling(true);
    setDiceResult(null);
    startCooldown(); // Start 10s cooldown now
  }, [canRoll, isRolling, startCooldown]);

  const handleDiceSettled = useCallback(() => {
    console.log('Dice settled with target faces:', targetFaces);
    isRollingRef.current = false;
    setIsRolling(false);
    // Use the pre-generated target faces as the result
    if (targetFaces) {
      setDiceResult(targetFaces);
    }
  }, [targetFaces]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, cooldownEndRef.current - Date.now());
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        setCanRoll(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  // Listen for shake - only when canRoll is true
  useShakeListener(shakeEnabled && hasStarted && canRoll, handleRoll, isRolling);

  // Handler for "Throw Again" button - directly starts roll
  const handleThrowAgain = useCallback(() => {
    if (!canRoll || isRollingRef.current || isRolling) return;

    // Generate target faces first
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    console.log('Throw again, target faces:', die1, die2);

    isRollingRef.current = true;
    setRollCount(c => c + 1);
    setTargetFaces({ die1, die2 });
    setIsRolling(true);
    setDiceResult(null);
    startCooldown(); // Start 10s cooldown now
  }, [canRoll, isRolling, startCooldown]);

  return (
    <main className="h-[100dvh] flex flex-col bg-slate-900 overflow-hidden">
      {/* Touch to Start overlay */}
      {!hasStarted && <TouchToStart onStart={handleStart} />}

      {/* Minimal header */}
      <header className="flex-shrink-0 flex justify-between items-center p-4 bg-black/30 safe-top">
        <h1 className="text-xl font-bold text-white">DiceRoll</h1>
        <div className="flex items-center gap-3">
          {isConnected && TEST_MODE && (
            <div className="text-sm text-yellow-400 font-medium">
              {balance.toLocaleString()} MFER
            </div>
          )}
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, mounted }) => {
              const connected = mounted && account && chain;
              return (
                <button
                  onClick={openConnectModal}
                  className="bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {connected ? (
                    <span>{account.displayName}</span>
                  ) : (
                    <span>Connect</span>
                  )}
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>

      {/* Full screen dice view */}
      <div className="flex-1 relative min-h-0">
        <DiceScene
          key={rollCount}
          isRolling={isRolling}
          targetFaces={targetFaces}
          onDiceSettled={handleDiceSettled}
        />

        {/* Result display and Throw Again button */}
        {diceResult && !isRolling && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 safe-bottom pb-2">
            <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-6 py-3 text-center">
              <div className="text-3xl font-bold text-white">
                {diceResult.die1 + diceResult.die2}
              </div>
              <div className="text-white/50 text-sm">
                {diceResult.die1} + {diceResult.die2}
              </div>
            </div>
            {canRoll ? (
              <button
                onClick={handleThrowAgain}
                className="bg-white/20 hover:bg-white/30 text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm"
              >
                {shakeEnabled ? 'Shake or Tap to Throw Again' : 'Throw Again'}
              </button>
            ) : (
              <div className="text-white/50 text-sm">
                Wait {Math.ceil(cooldownRemaining / 1000)}s...
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// Custom hook for shake detection - uses a lock to prevent multiple triggers
function useShakeListener(enabled: boolean, onShake: () => void, isRolling: boolean) {
  const lockedUntilRef = useRef(0);
  const lastAccRef = useRef({ x: 0, y: 0, z: 0 });
  const onShakeRef = useRef(onShake);

  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();

      // Hard lock - ignore everything for 3 seconds after a shake
      if (now < lockedUntilRef.current) return;

      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      const deltaX = Math.abs(acc.x - lastAccRef.current.x);
      const deltaY = Math.abs(acc.y - lastAccRef.current.y);
      const deltaZ = Math.abs(acc.z - lastAccRef.current.z);
      const acceleration = Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);

      lastAccRef.current = { x: acc.x, y: acc.y, z: acc.z };

      // Shake threshold
      if (acceleration > 20) {
        // Lock immediately for 3 seconds
        lockedUntilRef.current = now + 3000;
        onShakeRef.current();
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [enabled]);
}
