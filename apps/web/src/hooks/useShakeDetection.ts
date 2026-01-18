'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseShakeDetectionOptions {
  onShake: () => void;
  disabled?: boolean;
  threshold?: number;
  debounceMs?: number;
}

interface DeviceMotionEventWithPermission extends DeviceMotionEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export function useShakeDetection({
  onShake,
  disabled = false,
  threshold = 15,
  debounceMs = 500,
}: UseShakeDetectionOptions) {
  const [isSupported, setIsSupported] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const lastShakeRef = useRef<number>(0);
  const lastAccelerationRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  // Check if DeviceMotion is supported
  useEffect(() => {
    setIsSupported('DeviceMotionEvent' in window);
  }, []);

  // Request permission for iOS 13+
  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;

    const DeviceMotionEventTyped = DeviceMotionEvent as unknown as DeviceMotionEventWithPermission & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    // iOS 13+ requires permission request
    if (typeof DeviceMotionEventTyped.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEventTyped.requestPermission();
        setHasPermission(permission === 'granted');
        return permission === 'granted';
      } catch {
        setHasPermission(false);
        return false;
      }
    }

    // Non-iOS devices don't need permission
    setHasPermission(true);
    return true;
  }, [isSupported]);

  // Handle device motion
  const handleMotion = useCallback(
    (event: DeviceMotionEvent) => {
      if (disabled) return;

      const { accelerationIncludingGravity } = event;
      if (!accelerationIncludingGravity) return;

      const { x, y, z } = accelerationIncludingGravity;
      if (x === null || y === null || z === null) return;

      const lastAcc = lastAccelerationRef.current;
      const deltaX = Math.abs(x - lastAcc.x);
      const deltaY = Math.abs(y - lastAcc.y);
      const deltaZ = Math.abs(z - lastAcc.z);
      const acceleration = Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);

      lastAccelerationRef.current = { x, y, z };

      // Check if shake threshold is exceeded
      if (acceleration > threshold) {
        const now = Date.now();
        if (now - lastShakeRef.current > debounceMs) {
          lastShakeRef.current = now;
          onShake();
        }
      }
    },
    [disabled, threshold, debounceMs, onShake]
  );

  // Add event listener when permission is granted
  useEffect(() => {
    if (!isSupported || !hasPermission || disabled) return;

    window.addEventListener('devicemotion', handleMotion);
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [isSupported, hasPermission, disabled, handleMotion]);

  return {
    isSupported,
    hasPermission,
    requestPermission,
  };
}
