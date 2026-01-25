'use client';

import { useMemeWalletBalances } from '@/hooks/useSevenEleven';
import { useAccount } from 'wagmi';

interface MemeWalletBalancesProps {
  darkMode: boolean;
}

export function MemeWalletBalances({ darkMode }: MemeWalletBalancesProps) {
  const { isConnected } = useAccount();
  const { balances } = useMemeWalletBalances();

  // Only show when connected
  if (!isConnected) return null;

  return (
    <div
      className={`fixed z-0 flex flex-col items-end gap-1 ${
        darkMode ? 'text-white' : 'text-gray-900'
      }`}
      style={{ bottom: '2vh', right: '2vw' }}
    >
      {balances.map((item) => (
        <div key={item.token.symbol} className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span
              className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-800'}`}
            >
              {item.balanceFormatted}
            </span>
          </div>
          <img
            src={item.token.icon}
            alt={item.token.symbol}
            className="w-8 h-8 rounded-full"
          />
        </div>
      ))}
    </div>
  );
}
