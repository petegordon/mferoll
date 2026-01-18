'use client';

import { useEffect } from 'react';
import { useShakeDetection } from '@/hooks/useShakeDetection';

interface ShakeDetectorProps {
  onShake: () => void;
  disabled?: boolean;
}

export function ShakeDetector({ onShake, disabled }: ShakeDetectorProps) {
  const { isSupported, requestPermission, hasPermission } = useShakeDetection({
    onShake,
    disabled,
    threshold: 15,
    debounceMs: 500,
  });

  // Request permission on first interaction for iOS
  useEffect(() => {
    const handleInteraction = () => {
      if (isSupported && !hasPermission) {
        requestPermission();
      }
    };

    window.addEventListener('touchstart', handleInteraction, { once: true });
    window.addEventListener('click', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [isSupported, hasPermission, requestPermission]);

  // This component is invisible - it just handles the shake detection
  return null;
}
