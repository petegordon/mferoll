'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { PredictionSelector } from './PredictionSelector';
import { BetType, PAYOUT_MULTIPLIERS } from '@/lib/contracts';
import { useBetting } from '@/hooks/useBetting';

interface BetPanelProps {
  onRoll: (target?: { die1: number; die2: number }) => void;
  isRolling: boolean;
  result: { die1: number; die2: number } | null;
}

const BET_TYPE_LABELS: Record<BetType, string> = {
  [BetType.Exact]: 'Exact Sum',
  [BetType.Over]: 'Over 7',
  [BetType.Under]: 'Under 7',
  [BetType.Odd]: 'Odd',
  [BetType.Even]: 'Even',
  [BetType.Doubles]: 'Doubles',
  [BetType.Range]: 'Range',
};

export function BetPanel({ onRoll, isRolling, result }: BetPanelProps) {
  const { isConnected } = useAccount();
  const [betType, setBetType] = useState<BetType>(BetType.Over);
  const [prediction, setPrediction] = useState<number>(0);
  const [amount, setAmount] = useState<string>('100');
  const [lastBet, setLastBet] = useState<{
    betType: BetType;
    prediction: number;
    amount: number;
  } | null>(null);

  const {
    placeBet,
    isApproving,
    isPlacingBet,
    needsApproval,
    isTestMode,
    testBalance,
  } = useBetting();

  const multiplier = useMemo(() => {
    const typeMultipliers = PAYOUT_MULTIPLIERS[betType];
    if (betType === BetType.Exact) {
      return typeMultipliers[prediction] || 1;
    }
    return typeMultipliers[0] || 1;
  }, [betType, prediction]);

  const potentialPayout = useMemo(() => {
    const betAmount = parseFloat(amount) || 0;
    return (betAmount * multiplier).toFixed(2);
  }, [amount, multiplier]);

  const handlePlaceBet = useCallback(async () => {
    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) return;

    // Check balance in test mode
    if (isTestMode && testBalance !== null && betAmount > testBalance) {
      alert('Insufficient test balance!');
      return;
    }

    try {
      // Save the bet details for result checking
      setLastBet({ betType, prediction, amount: betAmount });

      // Place the bet and get the result
      const diceResult = await placeBet(betType, prediction, betAmount);

      // Trigger the roll animation with the target result
      if (diceResult) {
        onRoll(diceResult);
      } else {
        // Production mode - VRF will provide result
        onRoll();
      }
    } catch (error) {
      console.error('Bet failed:', error);
      setLastBet(null);
      alert(error instanceof Error ? error.message : 'Failed to place bet');
    }
  }, [amount, betType, prediction, placeBet, onRoll, isTestMode, testBalance]);

  // Check if bet was won based on last bet and current result
  const betResult = useMemo(() => {
    if (!result || !lastBet) return null;
    const sum = result.die1 + result.die2;

    switch (lastBet.betType) {
      case BetType.Exact:
        return sum === lastBet.prediction;
      case BetType.Over:
        return sum > 7;
      case BetType.Under:
        return sum < 7;
      case BetType.Odd:
        return sum % 2 === 1;
      case BetType.Even:
        return sum % 2 === 0;
      case BetType.Doubles:
        return result.die1 === result.die2;
      case BetType.Range:
        if (lastBet.prediction === 0) return sum >= 2 && sum <= 6;
        if (lastBet.prediction === 1) return sum >= 5 && sum <= 9;
        if (lastBet.prediction === 2) return sum >= 8 && sum <= 12;
        return false;
      default:
        return false;
    }
  }, [result, lastBet]);

  // Calculate actual payout for display
  const actualPayout = useMemo(() => {
    if (!lastBet || betResult !== true) return '0';
    const typeMultipliers = PAYOUT_MULTIPLIERS[lastBet.betType];
    let mult: number;
    if (lastBet.betType === BetType.Exact) {
      mult = typeMultipliers[lastBet.prediction] || 1;
    } else {
      mult = typeMultipliers[0] || 1;
    }
    return (lastBet.amount * mult).toFixed(2);
  }, [lastBet, betResult]);

  // Clear last bet when starting new roll
  const isProcessing = isRolling || isApproving || isPlacingBet;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Place Your Bet</h2>
        {isTestMode && (
          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
            TEST MODE
          </span>
        )}
      </div>

      {/* Bet Type Selection */}
      <div className="space-y-2">
        <label className="text-sm text-white/70">Bet Type</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(BET_TYPE_LABELS).map(([type, label]) => (
            <button
              key={type}
              onClick={() => {
                setBetType(parseInt(type) as BetType);
                if (parseInt(type) === BetType.Exact) {
                  setPrediction(7);
                } else {
                  setPrediction(0);
                }
              }}
              disabled={isProcessing}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                betType === parseInt(type)
                  ? 'bg-primary-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Prediction Selector */}
      <PredictionSelector
        betType={betType}
        prediction={prediction}
        onPredictionChange={setPrediction}
        disabled={isProcessing}
      />

      {/* Bet Amount */}
      <div className="space-y-2">
        <label className="text-sm text-white/70">
          Bet Amount {isTestMode ? '(Test MFER)' : '(MFER)'}
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isProcessing}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          placeholder="Enter amount"
          min="0"
        />
        {/* Quick amount buttons */}
        <div className="flex gap-2">
          {[10, 50, 100, 500].map((quickAmount) => (
            <button
              key={quickAmount}
              onClick={() => setAmount(quickAmount.toString())}
              disabled={isProcessing}
              className="flex-1 py-1 text-xs bg-white/5 hover:bg-white/10 text-white/70 rounded transition-colors disabled:opacity-50"
            >
              {quickAmount}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Multiplier: {multiplier.toFixed(2)}x</span>
          <span className="text-white/70">Potential: {potentialPayout} MFER</span>
        </div>
      </div>

      {/* Action Button */}
      {!isConnected ? (
        <div className="text-center text-white/50 py-4 bg-white/5 rounded-lg">
          Connect wallet to place bets
        </div>
      ) : (
        <button
          onClick={handlePlaceBet}
          disabled={isProcessing}
          className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg"
        >
          {isApproving
            ? 'Approving...'
            : isPlacingBet
            ? 'Placing Bet...'
            : isRolling
            ? 'Rolling...'
            : needsApproval
            ? 'Approve & Roll'
            : 'Roll Dice'}
        </button>
      )}

      {/* Result Display */}
      {result && betResult !== null && lastBet && (
        <div
          className={`p-4 rounded-lg text-center ${
            betResult
              ? 'bg-green-500/20 border border-green-500'
              : 'bg-red-500/20 border border-red-500'
          }`}
        >
          <div
            className={`text-2xl font-bold ${
              betResult ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {betResult ? `You Won ${actualPayout} MFER!` : 'Better luck next time!'}
          </div>
          <div className="text-sm text-white/50 mt-1">
            Bet: {lastBet.amount} MFER on {BET_TYPE_LABELS[lastBet.betType]}
          </div>
        </div>
      )}

      {/* Mobile shake hint */}
      <div className="text-center text-white/30 text-sm lg:hidden">
        Shake your phone to roll!
      </div>
    </div>
  );
}
