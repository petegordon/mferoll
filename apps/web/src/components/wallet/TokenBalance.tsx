'use client';

import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { MFERCOIN_ADDRESS } from '@/lib/wagmi';
import { ERC20_ABI } from '@/lib/contracts';

export function TokenBalance() {
  const { address } = useAccount();

  const { data: balance } = useReadContract({
    address: MFERCOIN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const { data: decimals } = useReadContract({
    address: MFERCOIN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: !!address,
    },
  });

  if (!address || balance === undefined) {
    return null;
  }

  const formattedBalance = formatUnits(balance, decimals || 18);
  const displayBalance = parseFloat(formattedBalance).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

  return (
    <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
      <span className="text-sm text-white/70">MFER:</span>
      <span className="text-sm font-medium text-white">{displayBalance}</span>
    </div>
  );
}
