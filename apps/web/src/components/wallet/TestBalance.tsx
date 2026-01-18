'use client';

import { useState } from 'react';
import { useBetting } from '@/hooks/useBetting';

export function TestBalance() {
  const { isTestMode, testBalance, resetTestBalance, addTestBonus } = useBetting();
  const [showMenu, setShowMenu] = useState(false);

  if (!isTestMode || testBalance === null) return null;

  const formattedBalance = testBalance.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg px-3 py-2 hover:bg-yellow-500/30 transition-colors"
      >
        <span className="text-sm text-yellow-500/70">Test MFER:</span>
        <span className="text-sm font-medium text-yellow-400">{formattedBalance}</span>
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 py-1">
            <button
              onClick={() => {
                addTestBonus?.(1000);
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              Add 1,000 MFER
            </button>
            <button
              onClick={() => {
                addTestBonus?.(10000);
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              Add 10,000 MFER
            </button>
            <hr className="my-1 border-gray-700" />
            <button
              onClick={() => {
                resetTestBalance?.();
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
            >
              Reset Balance
            </button>
          </div>
        </>
      )}
    </div>
  );
}
