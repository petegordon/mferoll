'use client';

import { useGrokStats } from '@/hooks/useSevenEleven';
import { useState, useEffect } from 'react';

interface GrokStatsProps {
  darkMode: boolean;
  iconUrl?: string;
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

export function GrokStats({ darkMode, iconUrl }: GrokStatsProps) {
  const { stats } = useGrokStats();
  const deviceType = useDeviceType();

  const hasStats = stats && stats.totalCount > BigInt(0);

  // Device-specific positioning and sizing
  const getStyles = () => {
    switch (deviceType) {
      case 'small-phone':
        // iPhone SE: smaller, adjusted position
        return {
          container: { bottom: '2vh', left: '-1vw' },
          icon: { width: '120px', height: '120px' },
        };
      case 'small-tablet':
        // iPad Mini: medium size, adjusted position
        return {
          container: { bottom: '2vh', left: '1vw' },
          icon: { width: '170px', height: '170px' },
        };
      case 'tablet':
        // iPad Pro: current settings
        return {
          container: { bottom: '5vh', left: '-2vw' },
          icon: { width: 'clamp(160px, 38vmin, 280px)', height: 'clamp(160px, 38vmin, 280px)' },
        };
      default:
        // iPhone 12 Pro: current settings
        return {
          container: { bottom: '5vh', left: '-2vw' },
          icon: { width: 'clamp(160px, 38vmin, 280px)', height: 'clamp(160px, 38vmin, 280px)' },
        };
    }
  };

  const styles = getStyles();

  return (
    <div
      className={`fixed z-0 flex items-center gap-[1vw] ${
        darkMode ? 'text-white' : 'text-gray-900'
      }`}
      style={styles.container}
    >
      {/* Icon - always show, size scales with viewport */}
      {iconUrl ? (
        <img
          src={iconUrl}
          alt="Grok"
          className="rounded-xl"
          style={styles.icon}
        />
      ) : (
        <div
          className={`rounded-xl flex items-center justify-center ${
            darkMode ? 'bg-purple-600' : 'bg-purple-500'
          }`}
          style={{
            ...styles.icon,
            fontSize: 'clamp(2rem, 5vmin, 4rem)',
          }}
        >
          🤖
        </div>
      )}

      {/* Stats - only show when there's data */}
      {hasStats && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span
              className={`font-bold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}
              style={{ fontSize: 'clamp(0.75rem, 2vmin, 1rem)' }}
            >
              {stats.totalAmountFormatted}
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
            {stats.totalCount.toString()} to Grok
          </div>
        </div>
      )}
    </div>
  );
}
