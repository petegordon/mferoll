'use client';

import { useRef, useEffect } from 'react';
import { D6 } from './D6';

interface DicePairProps {
  isRolling: boolean;
  targetFaces: { die1: number; die2: number } | null;
  onSettled: () => void;
  darkMode?: boolean;
}

export function DicePair({ isRolling, targetFaces, onSettled, darkMode = false }: DicePairProps) {
  const die1SettledRef = useRef(false);
  const die2SettledRef = useRef(false);
  const hasCalledSettledRef = useRef(false);
  const lastRollingRef = useRef(false);

  // Reset when a new roll starts
  useEffect(() => {
    if (isRolling && !lastRollingRef.current) {
      console.log('DicePair: New roll starting');
      die1SettledRef.current = false;
      die2SettledRef.current = false;
      hasCalledSettledRef.current = false;
    }
    lastRollingRef.current = isRolling;
  }, [isRolling]);

  const checkSettled = () => {
    if (die1SettledRef.current && die2SettledRef.current && !hasCalledSettledRef.current) {
      hasCalledSettledRef.current = true;
      console.log('DicePair: Both dice settled, calling onSettled');
      onSettled();
    }
  };

  const handleDie1Settled = () => {
    console.log('DicePair: Die 1 settled');
    die1SettledRef.current = true;
    checkSettled();
  };

  const handleDie2Settled = () => {
    console.log('DicePair: Die 2 settled');
    die2SettledRef.current = true;
    checkSettled();
  };

  return (
    <group>
      <D6
        position={[-0.95, 0, 0]}
        isRolling={isRolling}
        targetFace={targetFaces?.die1}
        onSettled={handleDie1Settled}
        darkMode={darkMode}
      />
      <D6
        position={[0.95, 0, 0]}
        isRolling={isRolling}
        targetFace={targetFaces?.die2}
        onSettled={handleDie2Settled}
        darkMode={darkMode}
      />
    </group>
  );
}
