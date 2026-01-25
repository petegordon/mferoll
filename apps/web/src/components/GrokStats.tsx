'use client';

import { useSessionGrokStats } from '@/hooks/useSevenEleven';
import { useAccount } from 'wagmi';
import { useState, useEffect, useRef, useCallback } from 'react';
import { GoldCoinExplosion } from './GoldCoinExplosion';

interface GrokStatsProps {
  darkMode: boolean;
  iconUrl?: string;
  /** Trigger animation immediately on loss (increment to trigger) */
  lossTrigger?: number;
}

// Hook to detect device type based on screen dimensions
function useDeviceType() {
  const [deviceType, setDeviceType] = useState<'small-phone' | 'phone' | 'small-tablet' | 'tablet'>('phone');

  useEffect(() => {
    const updateDeviceType = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (height <= 700 && width < 500) {
        // iPhone SE and similar short phones
        setDeviceType('small-phone');
      } else if (width >= 700 && width < 900 && height < 1200) {
        // iPad Mini (768x1024)
        setDeviceType('small-tablet');
      } else if (width >= 900) {
        // iPad Pro and larger tablets
        setDeviceType('tablet');
      } else {
        // iPhone 12 Pro and similar
        setDeviceType('phone');
      }
    };

    updateDeviceType();
    window.addEventListener('resize', updateDeviceType);
    return () => window.removeEventListener('resize', updateDeviceType);
  }, []);

  return deviceType;
}

export function GrokStats({ darkMode, iconUrl, lossTrigger = 0 }: GrokStatsProps) {
  const { isConnected } = useAccount();
  const { stats } = useSessionGrokStats();
  const deviceType = useDeviceType();

  // Track previous loss trigger to detect new losses
  const prevLossTriggerRef = useRef(lossTrigger);
  const [showExplosion, setShowExplosion] = useState(false);
  const [glowing, setGlowing] = useState(false);

  // Session has MFER sent to Grok if sessionAmount > 0
  const hasSessionStats = stats && stats.sessionAmount > BigInt(0);

  // Trigger animation immediately when lossTrigger changes (loss event from parent)
  useEffect(() => {
    if (lossTrigger > 0 && lossTrigger !== prevLossTriggerRef.current) {
      prevLossTriggerRef.current = lossTrigger;

      // Trigger animation
      setShowExplosion(true);
      setGlowing(true);

      // Stop glowing after animation
      setTimeout(() => {
        setGlowing(false);
      }, 800);
    }
  }, [lossTrigger]);

  const handleExplosionComplete = useCallback(() => {
    setShowExplosion(false);
  }, []);

  // Device-specific positioning and sizing
  // Column layout: icon on top, stats below, all centered
  const getStyles = () => {
    switch (deviceType) {
      case 'small-phone':
        // iPhone SE: smaller, adjusted position
        return {
          container: { bottom: '2vh', left: '2vw' },
          icon: { width: '100px', height: '100px' },
          sizeMultiplier: 2.5,
        };
      case 'small-tablet':
        // iPad Mini: medium size, adjusted position
        return {
          container: { bottom: '2vh', left: '2vw' },
          icon: { width: '150px', height: '150px' },
          sizeMultiplier: 3.5,
        };
      case 'tablet':
        // iPad Pro: larger icons
        return {
          container: { bottom: '5vh', left: '2vw' },
          icon: { width: 'clamp(140px, 30vmin, 220px)', height: 'clamp(140px, 30vmin, 220px)' },
          sizeMultiplier: 4,
        };
      default:
        // iPhone 12 Pro, iPhone 16: standard phone size
        return {
          container: { bottom: '2vh', left: '2vw' },
          icon: { width: 'clamp(100px, 28vmin, 160px)', height: 'clamp(100px, 28vmin, 160px)' },
          sizeMultiplier: 3,
        };
    }
  };

  const styles = getStyles();

  return (
    <div
      className={`fixed flex flex-col items-center ${
        darkMode ? 'text-white' : 'text-gray-900'
      }`}
      style={{ ...styles.container, zIndex: showExplosion ? 50 : 0 }}
    >
      {/* Icon - always show, size scales with viewport */}
      <div className="relative overflow-visible">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt="Grok"
            className={`rounded-xl transition-transform duration-300 ${glowing ? 'scale-110' : ''}`}
            style={{
              ...styles.icon,
              filter: glowing ? 'drop-shadow(0 0 15px #FFD700) drop-shadow(0 0 30px #FFA500)' : 'none',
            }}
          />
        ) : (
          <div
            className={`rounded-xl flex items-center justify-center transition-transform duration-300 ${
              darkMode ? 'bg-purple-600' : 'bg-purple-500'
            } ${glowing ? 'scale-110' : ''}`}
            style={{
              ...styles.icon,
              fontSize: 'clamp(2rem, 5vmin, 4rem)',
              filter: glowing ? 'drop-shadow(0 0 15px #FFD700) drop-shadow(0 0 30px #FFA500)' : 'none',
            }}
          >
            🤖
          </div>
        )}
        <GoldCoinExplosion
          active={showExplosion}
          onComplete={handleExplosionComplete}
          sizeMultiplier={styles.sizeMultiplier}
        />
      </div>

      {/* Stats - below icon */}
      <div className="flex flex-col items-center mt-1">
        {isConnected && hasSessionStats ? (
          // Show session stats when player has sent MFER to Grok this session
          <>
            <div className="flex items-center gap-1">
              <span
                className={`font-bold transition-all duration-300 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}
                style={{
                  fontSize: 'clamp(0.75rem, 2vmin, 1rem)',
                  color: glowing ? '#FFD700' : undefined,
                  textShadow: glowing ? '0 0 10px #FFD700, 0 0 20px #FFA500' : 'none',
                }}
              >
                {stats.sessionAmountFormatted}
              </span>
              <span
                className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                style={{ fontSize: 'clamp(0.65rem, 1.5vmin, 0.875rem)' }}
              >
                MFER
              </span>
            </div>
            <div
              className={`${darkMode ? 'text-gray-500' : 'text-gray-400'}`}
              style={{ fontSize: 'clamp(0.6rem, 1.2vmin, 0.75rem)' }}
            >
              {stats.sessionCount} to Grok
            </div>
          </>
        ) : isConnected ? (
          // Connected but no MFER sent this session yet
          <div
            className={`font-medium text-center ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}
            style={{ fontSize: 'clamp(0.7rem, 1.8vmin, 0.9rem)' }}
          >
            feed me mfer!
          </div>
        ) : null}
      </div>
    </div>
  );
}
