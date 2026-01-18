'use client';

import { TEST_MODE } from '@/lib/testMode';

export function TestModeIndicator() {
  if (!TEST_MODE) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center py-1 text-sm font-medium z-50">
      Test Mode - No real tokens are used
    </div>
  );
}
