'use client';

import { BetType } from '@/lib/contracts';

interface PredictionSelectorProps {
  betType: BetType;
  prediction: number;
  onPredictionChange: (prediction: number) => void;
  disabled?: boolean;
}

export function PredictionSelector({ betType, prediction, onPredictionChange, disabled }: PredictionSelectorProps) {
  // No prediction needed for Over/Under/Odd/Even/Doubles
  if ([BetType.Over, BetType.Under, BetType.Odd, BetType.Even, BetType.Doubles].includes(betType)) {
    return null;
  }

  // Exact sum prediction (2-12)
  if (betType === BetType.Exact) {
    return (
      <div className="space-y-2">
        <label className="text-sm text-white/70">Predict Exact Sum</label>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 11 }, (_, i) => i + 2).map((sum) => (
            <button
              key={sum}
              onClick={() => onPredictionChange(sum)}
              disabled={disabled}
              className={`w-10 h-10 rounded-lg font-bold transition-colors disabled:opacity-50 ${
                prediction === sum
                  ? 'bg-primary-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {sum}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Range prediction
  if (betType === BetType.Range) {
    const ranges = [
      { value: 0, label: 'Low (2-6)' },
      { value: 1, label: 'Mid (5-9)' },
      { value: 2, label: 'High (8-12)' },
    ];

    return (
      <div className="space-y-2">
        <label className="text-sm text-white/70">Select Range</label>
        <div className="grid grid-cols-3 gap-2">
          {ranges.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onPredictionChange(value)}
              disabled={disabled}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                prediction === value
                  ? 'bg-primary-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
