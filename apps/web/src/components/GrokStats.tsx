'use client';

import { useGrokStats } from '@/hooks/useSevenEleven';

interface GrokStatsProps {
  darkMode: boolean;
  iconUrl?: string;
}

export function GrokStats({ darkMode, iconUrl }: GrokStatsProps) {
  const { stats } = useGrokStats();

  const hasStats = stats && stats.totalCount > BigInt(0);

  return (
    <div
      className={`fixed bottom-48 left-4 z-30 flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg backdrop-blur-sm ${
        darkMode
          ? 'bg-gray-800/90 text-white'
          : 'bg-white/90 text-gray-900'
      }`}
    >
      {/* Icon - always show */}
      {iconUrl ? (
        <img
          src={iconUrl}
          alt="Grok"
          className="w-16 h-16 rounded-xl"
        />
      ) : (
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl ${
          darkMode ? 'bg-purple-600' : 'bg-purple-500'
        }`}>
          🤖
        </div>
      )}

      {/* Stats - only show when there's data */}
      {hasStats && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span className={`text-base font-bold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
              {stats.totalAmountFormatted}
            </span>
            <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              MFER
            </span>
          </div>
          <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {stats.totalCount.toString()} to Grok
          </div>
        </div>
      )}
    </div>
  );
}
