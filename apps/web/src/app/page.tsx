'use client';

import dynamic from 'next/dynamic';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { TouchToStart } from '@/components/motion/TouchToStart';
import { useAccount } from 'wagmi';
import { useState, useCallback, useEffect, useRef } from 'react';

// Dynamic import for Three.js components to avoid SSR issues
const DiceScene = dynamic(() => import('@/components/dice/DiceScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="text-white/50">Loading...</div>
    </div>
  ),
});

const ROLL_COOLDOWN_MS = 8000; // 8 second cooldown between rolls

// Check if iOS requires motion permission (iOS 13+)
function needsMotionPermission(): boolean {
  if (typeof window === 'undefined') return false;
  // @ts-ignore
  return typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
}

export default function Home() {
  useAccount();
  const [isRolling, setIsRolling] = useState(false);
  const [diceResult, setDiceResult] = useState<{ die1: number; die2: number } | null>(null);
  const [targetFaces, setTargetFaces] = useState<{ die1: number; die2: number } | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [needsPermission, setNeedsPermission] = useState<boolean | null>(null); // null = checking
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

  // Check on mount if we need to show TouchToStart (iOS only)
  useEffect(() => {
    const needs = needsMotionPermission();
    setNeedsPermission(needs);

    // If no permission needed, auto-start with motion enabled
    if (!needs && !hasStarted) {
      // Small delay to let the scene load
      const timer = setTimeout(() => {
        handleStart(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Called when TouchToStart completes (or auto-start on non-iOS)
  const handleStart = useCallback((motionGranted: boolean) => {
    console.log('Started with motion granted:', motionGranted);
    setShakeEnabled(motionGranted);
    setHasStarted(true);
    // Don't auto-roll - wait for user to tap/shake
  }, []);

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
    <main className="h-[100dvh] flex flex-col overflow-hidden relative">
      {/* Background logo - full screen white bg with logo at top */}
      <div className="absolute inset-0 bg-white pointer-events-none pt-4">
        <img
          src="/logo.png"
          alt=""
          className="w-full h-auto"
        />
      </div>

      {/* Touch to Start overlay - only for iOS that needs motion permission */}
      {!hasStarted && needsPermission === true && <TouchToStart onStart={handleStart} />}

      {/* Minimal header */}
      <header className="flex-shrink-0 px-4 py-3 safe-top relative z-20">
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
            const connected = mounted && account && chain;
            return (
              <button
                onClick={connected ? openAccountModal : openConnectModal}
                className="bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-lg"
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
      </header>

      {/* Full screen dice view */}
      <div className="flex-1 relative min-h-0 z-10">
        <DiceScene
          key={rollCount}
          isRolling={isRolling}
          targetFaces={targetFaces}
          onDiceSettled={handleDiceSettled}
        />

        {/* Initial roll button - before first roll */}
        {hasStarted && !diceResult && !isRolling && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 safe-bottom pb-2">
            <button
              onClick={handleThrowAgain}
              className="bg-gray-600 hover:bg-gray-500 text-white font-medium px-6 py-3 rounded-xl transition-colors shadow-lg"
            >
              {shakeEnabled ? 'Shake or Tap to Roll' : 'Tap to Roll'}
            </button>
          </div>
        )}

        {/* Result display and Throw Again button */}
        {diceResult && !isRolling && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 safe-bottom pb-2">
            <div className="bg-gray-600 rounded-xl px-6 py-3 text-center shadow-lg">
              <div className="text-3xl font-bold text-white">
                {diceResult.die1 + diceResult.die2}
              </div>
              <div className="text-gray-400 text-sm">
                {diceResult.die1} + {diceResult.die2}
              </div>
            </div>
            {canRoll ? (
              <button
                onClick={handleThrowAgain}
                className="bg-gray-600 hover:bg-gray-500 text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm shadow-lg"
              >
                {shakeEnabled ? 'Shake or Tap to Roll' : 'Tap to Roll'}
              </button>
            ) : (
              <div className="bg-gray-600 text-white font-medium px-5 py-2.5 rounded-xl text-sm shadow-lg">
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
  const lastAccRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const onShakeRef = useRef(onShake);
  const enabledAtRef = useRef(0);

  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled) {
      // Reset when disabled so we don't get false triggers on re-enable
      lastAccRef.current = null;
      return;
    }

    // Track when we were enabled to ignore events for a short warmup period
    enabledAtRef.current = Date.now();

    const handleMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();

      // Ignore events for 500ms after enabling (warmup period)
      if (now - enabledAtRef.current < 500) return;

      // Hard lock - ignore everything for 3 seconds after a shake
      if (now < lockedUntilRef.current) return;

      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      // First event after enable - just capture baseline, don't detect
      if (lastAccRef.current === null) {
        lastAccRef.current = { x: acc.x, y: acc.y, z: acc.z };
        return;
      }

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
