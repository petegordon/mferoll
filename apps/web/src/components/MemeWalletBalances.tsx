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

  // Reorder to MFER, DRB, BNKR
  const orderedBalances = [
    balances.find(b => b.token.symbol.includes('MFER')),
    balances.find(b => b.token.symbol.includes('DRB')),
    balances.find(b => b.token.symbol.includes('BNKR')),
  ].filter(Boolean);

  return (
    <div
      className={`fixed z-0 flex flex-col items-center gap-3 ${
        darkMode ? 'text-white' : 'text-gray-900'
      }`}
      style={{ bottom: '12vh', right: '2vw' }}
    >
      {orderedBalances.map((item) => item && (
        <div key={item.token.symbol} className="flex flex-col items-center">
          <img
            src={item.token.icon}
            alt={item.token.symbol}
            className="w-7 h-7 rounded-full"
          />
          <span
            className={`font-medium text-xs ${darkMode ? 'text-white' : 'text-gray-800'}`}
          >
            {item.balanceFormatted}
          </span>
        </div>
      ))}
    </div>
  );
}
