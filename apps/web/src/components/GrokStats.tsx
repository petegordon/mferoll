'use client';

import { useGrokStats } from '@/hooks/useSevenEleven';

interface GrokStatsProps {
  darkMode: boolean;
  iconUrl?: string;
}

export function GrokStats({ darkMode, iconUrl }: GrokStatsProps) {
  const { stats, isLoading } = useGrokStats();

  // Don't show if no stats yet
  if (isLoading || !stats || stats.totalCount === BigInt(0)) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-4 left-4 z-30 flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg backdrop-blur-sm ${
        darkMode
          ? 'bg-gray-800/90 text-white'
          : 'bg-white/90 text-gray-900'
      }`}
    >
      {/* Icon */}
      {iconUrl ? (
        <img
          src={iconUrl}
          alt="Grok"
          className="w-8 h-8 rounded-full"
        />
      ) : (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
          darkMode ? 'bg-purple-600' : 'bg-purple-500'
        }`}>
          🤖
        </div>
      )}

      {/* Stats */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className={`text-sm font-bold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
            {stats.totalAmountFormatted}
          </span>
          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            MFER
          </span>
        </div>
        <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {stats.totalCount.toString()} donations to Grok
        </div>
      </div>
    </div>
  );
}
