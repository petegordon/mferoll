'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import {
  useSevenEleven,
  useDepositTokens,
  usePayoutTokens,
  parseTokenAmount,
  type SupportedToken,
} from '@/hooks/useSevenEleven';
import { SEVEN_ELEVEN_CONSTANTS } from '@/lib/contracts';
import { isZeroDevConfigured } from '@/lib/zerodev';

// Format a token amount consistently
function formatTokenAmount(amount: string): string {
  const num = Number(amount);
  if (num === 0) return '0.00';

  if (num >= 0.01) {
    return num.toFixed(2);
  }

  const firstNonZeroPos = Math.floor(-Math.log10(num));
  const decimalsNeeded = firstNonZeroPos + 1;

  return num.toFixed(Math.max(2, Math.min(decimalsNeeded, 8)));
}

// Format large meme token amounts
function formatMemeAmount(amount: bigint, decimals: number = 18): string {
  const value = Number(formatUnits(amount, decimals));
  if (value === 0) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return value.toFixed(2);
}

interface SessionKeyState {
  hasValidSessionKey: boolean;
  hasSessionKeyStored: boolean;
  isSessionKeyExpired: boolean;
  isCreatingSessionKey: boolean;
  sessionKeyAddress: `0x${string}` | undefined;
  error: Error | null;
  createSessionKey: () => Promise<`0x${string}`>;
  clearSessionKey: () => void;
}

interface SevenElevenGameProps {
  darkMode: boolean;
  sessionKey: SessionKeyState;
}

export function SevenElevenGame({
  darkMode,
  sessionKey,
}: SevenElevenGameProps) {
  const { isConnected } = useAccount();
  const depositTokens = useDepositTokens();
  const payoutTokens = usePayoutTokens();
  const [selectedToken, setSelectedToken] = useState<SupportedToken | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [showWinnings, setShowWinnings] = useState(false);

  // Use first deposit token as default
  const currentToken = selectedToken && depositTokens.find(t => t.address === selectedToken.address)
    ? selectedToken
    : depositTokens[0];

  const {
    balance,
    balanceFormatted,
    walletBalance,
    walletBalanceFormatted,
    playerStats,
    memeWinnings,
    betAmountFormatted,
    minDeposit,
    minDepositFormatted,
    allowance,
    needsApproval,
    approve,
    deposit,
    withdrawAll,
    authorizeRoller,
    authorizedRoller,
    isApproving,
    isDepositing,
    isWithdrawing,
    isAuthorizing,
    error,
  } = useSevenEleven(currentToken);

  const {
    hasValidSessionKey,
    hasSessionKeyStored,
    isSessionKeyExpired,
    isCreatingSessionKey,
    createSessionKey,
    sessionKeyAddress,
    error: sessionKeyError,
  } = sessionKey;

  const isSessionKeyAuthorized = hasValidSessionKey &&
    sessionKeyAddress &&
    authorizedRoller &&
    authorizedRoller.toLowerCase() === sessionKeyAddress.toLowerCase();

  const needsAuthorization = hasValidSessionKey && sessionKeyAddress && !isSessionKeyAuthorized;
  const showEnableButton = !hasSessionKeyStored || isSessionKeyExpired;
  const isZeroDevEnabled = isZeroDevConfigured();

  const [depositError, setDepositError] = useState<string | null>(null);

  type DepositStep = 'idle' | 'approving' | 'depositing' | 'authorizing' | 'done';
  const [depositStep, setDepositStep] = useState<DepositStep>('idle');

  const minAmountNeeded = minDeposit && balance !== undefined
    ? (balance >= minDeposit ? BigInt(0) : minDeposit - balance)
    : undefined;

  const handleDeposit = useCallback(async () => {
    setDepositError(null);
    const amount = parseTokenAmount(depositAmount, currentToken.decimals);
    if (amount <= BigInt(0)) return;

    const currentBalance = balance || BigInt(0);
    const balanceAfterDeposit = currentBalance + amount;
    if (minDeposit && balanceAfterDeposit < minDeposit) {
      const neededAmount = minDeposit - currentBalance;
      const neededFormatted = formatUnits(neededAmount, currentToken.decimals);
      setDepositError(`Deposit at least ${Number(neededFormatted).toFixed(2)} ${currentToken.symbol} to reach $${SEVEN_ELEVEN_CONSTANTS.MIN_DEPOSIT_USD.toFixed(2)} game balance`);
      return;
    }

    try {
      if (needsApproval || (allowance !== undefined && allowance < amount)) {
        setDepositStep('approving');
        await approve(amount);
      }

      setDepositStep('depositing');
      await deposit(amount);

      if (isZeroDevEnabled && sessionKeyAddress && !isSessionKeyAuthorized) {
        setDepositStep('authorizing');
        await authorizeRoller(sessionKeyAddress);
      }

      setDepositStep('done');
      setDepositAmount('');
      setShowDepositModal(false);
    } catch (err) {
      console.error('Deposit flow failed:', err);
    } finally {
      setDepositStep('idle');
    }
  }, [depositAmount, currentToken.decimals, currentToken.symbol, balance, minDeposit, needsApproval, allowance, approve, deposit, isZeroDevEnabled, sessionKeyAddress, isSessionKeyAuthorized, authorizeRoller]);

  const handleCreateSessionKey = useCallback(async () => {
    try {
      const kernelAddress = await createSessionKey();
      console.log('Session key created, kernel address:', kernelAddress);
      await authorizeRoller(kernelAddress);
      console.log('Session key authorized on contract');
    } catch (err) {
      console.error('Failed to create/authorize session key:', err);
    }
  }, [createSessionKey, authorizeRoller]);

  const handleWithdrawAll = useCallback(async () => {
    if (balance && balance > BigInt(0)) {
      await withdrawAll();
    }
  }, [balance, withdrawAll]);

  const winRate =
    playerStats && (playerStats.totalWins + playerStats.totalLosses) > BigInt(0)
      ? Number(playerStats.totalWins * BigInt(100)) /
        Number(playerStats.totalWins + playerStats.totalLosses)
      : 0;

  // Check if player has any meme winnings
  const hasMemeWinnings = memeWinnings &&
    (memeWinnings.mfer > BigInt(0) || memeWinnings.bnkr > BigInt(0) || memeWinnings.drb > BigInt(0));

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
      {/* Token selector - Deposit tokens only */}
      <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
        {depositTokens.map((token) => (
          <button
            key={token.symbol}
            onClick={() => setSelectedToken(token)}
            title={token.symbol}
            className={`p-2 rounded-lg transition-colors ${
              currentToken.symbol === token.symbol
                ? darkMode
                  ? 'bg-green-600 ring-2 ring-green-400'
                  : 'bg-green-500 ring-2 ring-green-300'
                : darkMode
                ? 'bg-gray-600 hover:bg-gray-500'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            <img
              src={token.icon}
              alt={token.symbol}
              className="w-7 h-7 rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = `<span class="text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-700'}">${token.symbol}</span>`;
              }}
            />
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
          <span className={`font-bold flex items-center gap-1.5 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {formatTokenAmount(balanceFormatted)}
            <img src={currentToken.icon} alt={currentToken.symbol} className="w-5 h-5 rounded-full" />
          </span>
        </div>
        <div className="flex justify-between items-center mb-3">
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Bet per roll
          </span>
          <span className={`text-sm flex items-center gap-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            ${SEVEN_ELEVEN_CONSTANTS.BET_USD.toFixed(2)} ({formatTokenAmount(betAmountFormatted)}
            <img src={currentToken.icon} alt={currentToken.symbol} className="w-4 h-4 rounded-full" />)
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

      {/* V2: Cumulative Meme Token Winnings */}
      {hasMemeWinnings && (
        <div
          className={`rounded-xl p-4 mb-4 ${
            darkMode ? 'bg-gradient-to-r from-purple-900/50 to-pink-900/50' : 'bg-gradient-to-r from-purple-100 to-pink-100'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className={`text-sm font-medium ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
              Total Meme Winnings
            </span>
            <button
              onClick={() => setShowWinnings(!showWinnings)}
              className={`text-xs ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}
            >
              {showWinnings ? 'Hide' : 'Show'}
            </button>
          </div>
          {showWinnings && memeWinnings && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {payoutTokens.map((token) => {
                const amount = token.symbol.includes('MFER') ? memeWinnings.mfer :
                              token.symbol.includes('BNKR') ? memeWinnings.bnkr :
                              memeWinnings.drb;
                return (
                  <div key={token.symbol} className="text-center">
                    <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full mx-auto mb-1" />
                    <div className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formatMemeAmount(amount)}
                    </div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {token.symbol}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className={`text-xs mt-2 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
            Winnings sent directly to your wallet
          </div>
        </div>
      )}

      {/* Session Key Status (when ZeroDev is enabled) */}
      {isZeroDevEnabled && (
        <div
          className={`rounded-xl p-3 mb-4 ${
            darkMode ? 'bg-gray-700/80' : 'bg-gray-100'
          }`}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isSessionKeyAuthorized
                    ? 'bg-green-500'
                    : needsAuthorization
                    ? 'bg-yellow-500'
                    : isSessionKeyExpired
                    ? 'bg-yellow-500'
                    : 'bg-gray-400'
                }`}
              />
              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {isSessionKeyAuthorized
                  ? 'Gasless Rolls Active'
                  : needsAuthorization
                  ? 'Needs Authorization'
                  : isSessionKeyExpired
                  ? 'Session Expired'
                  : 'Gasless Rolls Available'}
              </span>
            </div>
            {showEnableButton && (
              <button
                onClick={handleCreateSessionKey}
                disabled={isCreatingSessionKey || isAuthorizing}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  darkMode
                    ? 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50'
                    : 'bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50'
                }`}
              >
                {isCreatingSessionKey ? 'Creating...' : isAuthorizing ? 'Authorizing...' : 'Enable'}
              </button>
            )}
            {needsAuthorization && sessionKeyAddress && (
              <button
                onClick={() => authorizeRoller(sessionKeyAddress)}
                disabled={isAuthorizing}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  darkMode
                    ? 'bg-yellow-600 hover:bg-yellow-500 text-white disabled:opacity-50'
                    : 'bg-yellow-500 hover:bg-yellow-400 text-white disabled:opacity-50'
                }`}
              >
                {isAuthorizing ? 'Authorizing...' : 'Authorize'}
              </button>
            )}
          </div>
          {isSessionKeyAuthorized && (
            <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              No wallet prompts when rolling
            </div>
          )}
          {needsAuthorization && (
            <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Wallet will ask to authorize this device for gasless rolls
            </div>
          )}
          {showEnableButton && !needsAuthorization && (
            <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Creates a session key for this device (1 wallet prompt)
            </div>
          )}
          {sessionKeyError && (
            <div className="text-xs mt-1 text-red-500">
              {sessionKeyError.message}
            </div>
          )}
        </div>
      )}

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
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Doubles Won</span>
              <div className={`font-bold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                {playerStats.totalDoublesWon.toString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* V2 Game rules */}
      <div
        className={`text-center text-xs mt-4 space-y-1 ${
          darkMode ? 'text-gray-500' : 'text-gray-400'
        }`}
      >
        <div>Win 7/11: {SEVEN_ELEVEN_CONSTANTS.WIN_7_11_MULTIPLIER}x | Win Doubles: {SEVEN_ELEVEN_CONSTANTS.WIN_DOUBLES_MULTIPLIER}x</div>
        <div>Winnings: MFER + BNKR + DRB to wallet</div>
        <div>${SEVEN_ELEVEN_CONSTANTS.LOSS_SKIM_USD.toFixed(2)} DRB to Grok on loss</div>
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
              className={`text-lg font-bold mb-4 flex items-center gap-2 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}
            >
              Deposit
              <img src={currentToken.icon} alt={currentToken.symbol} className="w-6 h-6 rounded-full" />
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
                  onChange={(e) => {
                    setDepositAmount(e.target.value);
                    setDepositError(null);
                  }}
                  placeholder={minAmountNeeded && minAmountNeeded > BigInt(0)
                    ? `Need ${Number(formatUnits(minAmountNeeded, currentToken.decimals)).toFixed(2)} for $${SEVEN_ELEVEN_CONSTANTS.MIN_DEPOSIT_USD} balance`
                    : 'Enter amount'
                  }
                  className={`flex-1 px-3 py-2 rounded-lg border ${
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                <button
                  onClick={() => {
                    if (minAmountNeeded && minAmountNeeded > BigInt(0)) {
                      setDepositAmount(formatUnits(minAmountNeeded, currentToken.decimals));
                    }
                  }}
                  disabled={!minAmountNeeded || minAmountNeeded <= BigInt(0)}
                  className={`px-3 py-2 rounded-lg text-sm disabled:opacity-50 ${
                    darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Min
                </button>
                <button
                  onClick={() =>
                    walletBalance &&
                    setDepositAmount(formatUnits(walletBalance, currentToken.decimals))
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
                className={`text-xs mt-1 flex flex-col gap-0.5 ${
                  darkMode ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                <div className="flex items-center gap-1">
                  Wallet: {formatTokenAmount(walletBalanceFormatted)}
                  <img src={currentToken.icon} alt={currentToken.symbol} className="w-3.5 h-3.5 rounded-full" />
                </div>
                <div className="flex items-center gap-1">
                  Game Balance: {formatTokenAmount(balanceFormatted)}
                  <img src={currentToken.icon} alt={currentToken.symbol} className="w-3.5 h-3.5 rounded-full" />
                  {minAmountNeeded && minAmountNeeded > BigInt(0) && (
                    <span className={darkMode ? 'text-yellow-400' : 'text-yellow-600'}>
                      (need {formatTokenAmount(formatUnits(minAmountNeeded, currentToken.decimals))} more for ${SEVEN_ELEVEN_CONSTANTS.MIN_DEPOSIT_USD})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDepositModal(false);
                  setDepositError(null);
                }}
                disabled={depositStep !== 'idle'}
                className={`flex-1 py-2 px-4 rounded-lg font-medium disabled:opacity-50 ${
                  darkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                disabled={depositStep !== 'idle' || !depositAmount}
                className={`flex-1 py-2 px-4 rounded-lg font-medium disabled:opacity-50 ${
                  darkMode
                    ? 'bg-green-600 text-white hover:bg-green-500'
                    : 'bg-green-500 text-white hover:bg-green-400'
                }`}
              >
                {depositStep === 'approving'
                  ? 'Approving...'
                  : depositStep === 'depositing'
                  ? 'Depositing...'
                  : depositStep === 'authorizing'
                  ? 'Authorizing...'
                  : 'Deposit'}
              </button>
            </div>

            {depositStep === 'idle' && depositAmount && (
              <div className={`mt-3 text-xs text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {needsApproval && !isSessionKeyAuthorized && 'Wallet will prompt: Approve → Deposit → Authorize device'}
                {needsApproval && isSessionKeyAuthorized && 'Wallet will prompt: Approve → Deposit'}
                {!needsApproval && !isSessionKeyAuthorized && 'Wallet will prompt: Deposit → Authorize device'}
                {!needsApproval && isSessionKeyAuthorized && 'Wallet will prompt: Deposit'}
              </div>
            )}

            {(error || depositError) && (
              <div className="mt-3 text-red-500 text-sm text-center">
                {depositError || error?.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
