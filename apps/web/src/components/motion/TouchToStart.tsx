'use client';

import { useState } from 'react';

interface TouchToStartProps {
  onStart: (motionGranted: boolean) => void;
}

export function TouchToStart({ onStart }: TouchToStartProps) {
  const [status, setStatus] = useState<'idle' | 'requesting'>('idle');

  const handleTouch = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();

    if (status !== 'idle') return;
    setStatus('requesting');

    // Check if motion permission is needed (iOS 13+)
    // @ts-ignore
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      // @ts-ignore
      DeviceMotionEvent.requestPermission()
        .then((result: string) => {
          onStart(result === 'granted');
        })
        .catch(() => {
          onStart(false);
        });
    } else {
      // No permission needed - motion available by default
      onStart(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 select-none touch-none"
      onTouchEnd={handleTouch}
      onClick={handleTouch}
    >
      <div className="text-center">
        <div
          className="text-4xl font-bold text-white"
          style={{
            animation: status === 'idle' ? 'pulse-scale 2s ease-in-out infinite' : 'none',
          }}
        >
          {status === 'idle' ? 'Touch to Enable Motion' : 'Enabling...'}
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse-scale {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
