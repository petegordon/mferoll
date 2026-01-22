'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import {
  useSevenEleven,
  useSupportedTokens,
  parseTokenAmount,
  type SupportedToken,
} from '@/hooks/useSevenEleven';
import { SEVEN_ELEVEN_CONSTANTS } from '@/lib/contracts';
import { isZeroDevConfigured } from '@/lib/zerodev';

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
  const supportedTokens = useSupportedTokens();
  const [selectedToken, setSelectedToken] = useState<SupportedToken | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [showStats, setShowStats] = useState(false);

  // Set default token when tokens change (network switch)
  const currentToken = selectedToken && supportedTokens.find(t => t.address === selectedToken.address)
    ? selectedToken
    : supportedTokens[0];

  const {
    balance,
    balanceFormatted,
    walletBalance,
    walletBalanceFormatted,
    playerStats,
    betAmountFormatted,
    minDepositFormatted,
    entropyFee,
    entropyFeeFormatted,
    allowance,
    needsApproval,
    approve,
    deposit,
    withdraw,
    authorizeRoller,
    authorizedRoller,
    isApproving,
    isDepositing,
    isWithdrawing,
    isAuthorizing,
    error,
  } = useSevenEleven(currentToken);

  // Session key for gasless rolls (passed from parent to share state)
  const {
    hasValidSessionKey,
    hasSessionKeyStored,
    isSessionKeyExpired,
    isCreatingSessionKey,
    createSessionKey,
    clearSessionKey,
    sessionKeyAddress,
    error: sessionKeyError,
  } = sessionKey;

  // Check if session key is fully ready (both created AND authorized on contract)
  const isSessionKeyAuthorized = hasValidSessionKey &&
    sessionKeyAddress &&
    authorizedRoller &&
    authorizedRoller.toLowerCase() === sessionKeyAddress.toLowerCase();

  // Need to authorize if we have a session key but it's not authorized on contract
  const needsAuthorization = hasValidSessionKey && sessionKeyAddress && !isSessionKeyAuthorized;

  // Show Enable button when no session key exists or when expired
  const showEnableButton = !hasSessionKeyStored || isSessionKeyExpired;

  const isZeroDevEnabled = isZeroDevConfigured();

  // Handle deposit
  const handleDeposit = useCallback(async () => {
    const amount = parseTokenAmount(depositAmount, currentToken.decimals);
    if (amount <= BigInt(0)) return;

    // Check if approval needed
    if (needsApproval || (allowance !== undefined && allowance < amount)) {
      await approve(amount);
    } else {
      await deposit(amount);
      setDepositAmount('');
      setShowDepositModal(false);

      // After successful deposit, offer to create session key if ZeroDev is enabled
      // Note: Session keys require the user to use a smart wallet for the player address
      // This is a known limitation - full implementation requires smart wallet integration
      if (isZeroDevEnabled && !hasValidSessionKey) {
        console.log('ZeroDev enabled - session key creation available after deposit');
      }
    }
  }, [depositAmount, currentToken.decimals, needsApproval, allowance, approve, deposit, isZeroDevEnabled, hasValidSessionKey]);

  // Handle session key creation and authorization
  // 1. Create a ZeroDev session key (local, no wallet prompt)
  // 2. Authorize the session key's wallet on the contract (one wallet prompt)
  // After this, rolls will be gasless via rollFor()
  const handleCreateSessionKey = useCallback(async () => {
    try {
      // Create the session key and get the kernel wallet address
      const kernelAddress = await createSessionKey();
      console.log('Session key created, kernel address:', kernelAddress);

      // Authorize the kernel wallet to call rollFor on behalf of the player
      // This requires one wallet signature from the user
      await authorizeRoller(kernelAddress);
      console.log('Session key authorized on contract');
    } catch (err) {
      console.error('Failed to create/authorize session key:', err);
    }
  }, [createSessionKey, authorizeRoller]);

  // Handle withdraw all
  const handleWithdrawAll = useCallback(async () => {
    if (balance && balance > BigInt(0)) {
      await withdraw(balance);
    }
  }, [balance, withdraw]);

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
      <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
        {supportedTokens.map((token) => (
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
                // Fallback to text if image fails to load
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
            {Number(balanceFormatted).toFixed(2)}
            <img src={currentToken.icon} alt={currentToken.symbol} className="w-5 h-5 rounded-full" />
          </span>
        </div>
        <div className="flex justify-between items-center mb-3">
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Bet per roll
          </span>
          <span className={`text-sm flex items-center gap-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            ${SEVEN_ELEVEN_CONSTANTS.BET_USD} ({Number(betAmountFormatted).toFixed(4)}
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
            {/* Show Enable button when no session key exists or expired */}
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
            {/* Show Authorize button when session key exists but not authorized on contract */}
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
              No transaction prompts on rolls
            </div>
          )}
          {needsAuthorization && (
            <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              One-time authorization needed
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
                className={`text-xs mt-1 flex items-center gap-1 ${
                  darkMode ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                Wallet: {Number(walletBalanceFormatted).toFixed(2)}
                <img src={currentToken.icon} alt={currentToken.symbol} className="w-3.5 h-3.5 rounded-full" />
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
