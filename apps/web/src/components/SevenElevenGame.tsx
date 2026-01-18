'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import {
  useSevenEleven,
  SUPPORTED_TOKENS,
  parseTokenAmount,
  type SupportedToken,
} from '@/hooks/useSevenEleven';
import { SEVEN_ELEVEN_CONSTANTS } from '@/lib/contracts';

interface SevenElevenGameProps {
  diceResult: { die1: number; die2: number } | null;
  darkMode: boolean;
  onRoll: () => void;
  isRolling: boolean;
  canRoll: boolean;
  cooldownRemaining: number;
}

export function SevenElevenGame({
  diceResult,
  darkMode,
  onRoll,
  isRolling,
  canRoll,
  cooldownRemaining,
}: SevenElevenGameProps) {
  const { isConnected, address } = useAccount();
  const [selectedToken, setSelectedToken] = useState<SupportedToken>(SUPPORTED_TOKENS[0]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [showStats, setShowStats] = useState(false);

  const {
    balance,
    balanceFormatted,
    walletBalance,
    walletBalanceFormatted,
    playerStats,
    betAmount,
    betAmountFormatted,
    minDeposit,
    minDepositFormatted,
    allowance,
    needsApproval,
    approve,
    deposit,
    withdraw,
    roll,
    isApproving,
    isDepositing,
    isWithdrawing,
    isRolling: isContractRolling,
    isPending,
    error,
  } = useSevenEleven(selectedToken);

  // Calculate if win (7 or 11)
  const isWin = diceResult
    ? diceResult.die1 + diceResult.die2 === 7 || diceResult.die1 + diceResult.die2 === 11
    : null;

  // Handle deposit
  const handleDeposit = useCallback(async () => {
    const amount = parseTokenAmount(depositAmount, selectedToken.decimals);
    if (amount <= BigInt(0)) return;

    // Check if approval needed
    if (needsApproval || (allowance !== undefined && allowance < amount)) {
      await approve(amount);
    } else {
      await deposit(amount);
      setDepositAmount('');
      setShowDepositModal(false);
    }
  }, [depositAmount, selectedToken.decimals, needsApproval, allowance, approve, deposit]);

  // Handle withdraw all
  const handleWithdrawAll = useCallback(async () => {
    if (balance && balance > BigInt(0)) {
      await withdraw(balance);
    }
  }, [balance, withdraw]);

  // Handle roll with contract integration
  const handleContractRoll = useCallback(async () => {
    if (!canRoll || isContractRolling) return;

    // For now, just trigger the visual roll
    // TODO: Connect to contract roll when deployed
    onRoll();

    // When contract is deployed, uncomment:
    // await roll();
  }, [canRoll, isContractRolling, onRoll]);

  // Calculate win rate
  const winRate =
    playerStats && (playerStats.totalWins + playerStats.totalLosses) > BigInt(0)
      ? Number(playerStats.totalWins * BigInt(100)) /
        Number(playerStats.totalWins + playerStats.totalLosses)
      : 0;

  if (!isConnected) {
    return (
      <div className="text-center py-4">
        <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
          Connect wallet to play 7/11
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4">
      {/* Token selector */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {SUPPORTED_TOKENS.map((token) => (
          <button
            key={token.symbol}
            onClick={() => setSelectedToken(token)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedToken.symbol === token.symbol
                ? darkMode
                  ? 'bg-green-600 text-white'
                  : 'bg-green-500 text-white'
                : darkMode
                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {token.symbol}
          </button>
        ))}
      </div>

      {/* Balance display */}
      <div
        className={`rounded-xl p-4 mb-4 ${
          darkMode ? 'bg-gray-700/80' : 'bg-gray-100'
        }`}
      >
        <div className="flex justify-between items-center mb-2">
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Game Balance
          </span>
          <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {Number(balanceFormatted).toFixed(2)} {selectedToken.symbol}
          </span>
        </div>
        <div className="flex justify-between items-center mb-3">
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Bet per roll
          </span>
          <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            ${SEVEN_ELEVEN_CONSTANTS.BET_USD} ({Number(betAmountFormatted).toFixed(4)} {selectedToken.symbol})
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDepositModal(true)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              darkMode
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-green-500 hover:bg-green-400 text-white'
            }`}
          >
            Deposit
          </button>
          <button
            onClick={handleWithdrawAll}
            disabled={!balance || balance === BigInt(0) || isWithdrawing}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              darkMode
                ? 'bg-gray-600 hover:bg-gray-500 text-white disabled:opacity-50'
                : 'bg-gray-300 hover:bg-gray-200 text-gray-700 disabled:opacity-50'
            }`}
          >
            {isWithdrawing ? 'Withdrawing...' : 'Withdraw All'}
          </button>
        </div>
      </div>

      {/* Result display */}
      {diceResult && !isRolling && (
        <div
          className={`rounded-xl p-4 mb-4 text-center ${
            isWin
              ? darkMode
                ? 'bg-green-800/80'
                : 'bg-green-100'
              : darkMode
              ? 'bg-red-800/80'
              : 'bg-red-100'
          }`}
        >
          <div
            className={`text-4xl font-bold mb-1 ${
              isWin
                ? darkMode
                  ? 'text-green-300'
                  : 'text-green-600'
                : darkMode
                ? 'text-red-300'
                : 'text-red-600'
            }`}
          >
            {diceResult.die1 + diceResult.die2}
          </div>
          <div
            className={`text-sm mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-600'
            }`}
          >
            {diceResult.die1} + {diceResult.die2}
          </div>
          <div
            className={`text-lg font-bold ${
              isWin
                ? darkMode
                  ? 'text-green-300'
                  : 'text-green-600'
                : darkMode
                ? 'text-red-300'
                : 'text-red-600'
            }`}
          >
            {isWin ? `WIN! 3x Payout` : 'Better luck next time'}
          </div>
        </div>
      )}

      {/* Roll button */}
      <div className="text-center mb-4">
        {canRoll ? (
          <button
            onClick={handleContractRoll}
            disabled={
              isRolling ||
              isContractRolling ||
              !balance ||
              (betAmount !== undefined && balance < betAmount)
            }
            className={`px-8 py-3 rounded-xl font-bold text-lg transition-colors disabled:opacity-50 ${
              darkMode
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white'
            }`}
          >
            Roll for 7 or 11
          </button>
        ) : (
          <div
            className={`px-8 py-3 rounded-xl font-medium ${
              darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-500'
            }`}
          >
            Wait {Math.ceil(cooldownRemaining / 1000)}s...
          </div>
        )}
        {balance !== undefined && betAmount !== undefined && balance < betAmount && (
          <p className={`text-sm mt-2 ${darkMode ? 'text-red-400' : 'text-red-500'}`}>
            Insufficient balance. Deposit more to play.
          </p>
        )}
      </div>

      {/* Stats toggle */}
      <button
        onClick={() => setShowStats(!showStats)}
        className={`w-full text-center text-sm py-2 ${
          darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'
        }`}
      >
        {showStats ? 'Hide Stats' : 'Show Stats'}
      </button>

      {/* Player stats */}
      {showStats && playerStats && (
        <div
          className={`rounded-xl p-4 mt-2 ${
            darkMode ? 'bg-gray-700/80' : 'bg-gray-100'
          }`}
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Wins</span>
              <div className={`font-bold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                {playerStats.totalWins.toString()}
              </div>
            </div>
            <div>
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Losses</span>
              <div className={`font-bold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                {playerStats.totalLosses.toString()}
              </div>
            </div>
            <div>
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Win Rate</span>
              <div className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {winRate.toFixed(1)}%
              </div>
            </div>
            <div>
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Sessions</span>
              <div className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {playerStats.totalSessions.toString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game rules */}
      <div
        className={`text-center text-xs mt-4 ${
          darkMode ? 'text-gray-500' : 'text-gray-400'
        }`}
      >
        Roll 7 or 11 to win 3x | 10% fee goes to drb.eth
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`rounded-2xl p-6 max-w-sm w-full ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <h3
              className={`text-lg font-bold mb-4 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}
            >
              Deposit {selectedToken.symbol}
            </h3>

            <div className="mb-4">
              <label
                className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Amount
              </label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder={`Min: ${Number(minDepositFormatted).toFixed(2)}`}
                  className={`flex-1 px-3 py-2 rounded-lg border ${
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                <button
                  onClick={() =>
                    walletBalance &&
                    setDepositAmount(formatUnits(walletBalance, selectedToken.decimals))
                  }
                  className={`px-3 py-2 rounded-lg text-sm ${
                    darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Max
                </button>
              </div>
              <div
                className={`text-xs mt-1 ${
                  darkMode ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                Wallet: {Number(walletBalanceFormatted).toFixed(2)} {selectedToken.symbol}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDepositModal(false)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                  darkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                disabled={isApproving || isDepositing || !depositAmount}
                className={`flex-1 py-2 px-4 rounded-lg font-medium disabled:opacity-50 ${
                  darkMode
                    ? 'bg-green-600 text-white hover:bg-green-500'
                    : 'bg-green-500 text-white hover:bg-green-400'
                }`}
              >
                {isApproving
                  ? 'Approving...'
                  : isDepositing
                  ? 'Depositing...'
                  : needsApproval
                  ? 'Approve'
                  : 'Deposit'}
              </button>
            </div>

            {error && (
              <div className="mt-3 text-red-500 text-sm text-center">
                {error.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
