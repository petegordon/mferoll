'use client';

import dynamic from 'next/dynamic';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { TouchToStart } from '@/components/motion/TouchToStart';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { SEVEN_ELEVEN_ABI, getSevenElevenAddress } from '@/lib/contracts';
import { parseAbiItem } from 'viem';
import { SevenElevenGame } from '@/components/SevenElevenGame';
import { useSevenEleven, useSupportedTokens } from '@/hooks/useSevenEleven';
import { useSessionKey } from '@/hooks/useSessionKey';
import { useSmartWallet } from '@/hooks/useSmartWallet';
import { DebugConsole, debugLog } from '@/components/DebugConsole';
import { GrokStats } from '@/components/GrokStats';
import { MemeWalletBalances } from '@/components/MemeWalletBalances';
import { useOnboarding } from '@/hooks/useOnboarding';
import { Onboarding } from '@/components/Onboarding';

import { DiceErrorBoundary } from '@/components/dice/DiceErrorBoundary';

// Dynamic import for Three.js components to avoid SSR issues
const DiceScene = dynamic(() => import('@/components/dice/DiceScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="text-white/50">Loading...</div>
    </div>
  ),
});


// Check if iOS requires motion permission (iOS 13+)
function needsMotionPermission(): boolean {
  if (typeof window === 'undefined') return false;
  // @ts-ignore
  return typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
}

export default function Home() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const [darkMode, setDarkMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [diceResult, setDiceResult] = useState<{ die1: number; die2: number; won?: boolean } | null>(null);
  const [targetFaces, setTargetFaces] = useState<{ die1: number; die2: number } | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [needsPermission, setNeedsPermission] = useState<boolean | null>(null); // null = checking
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const [rollCount, setRollCount] = useState(0);
  const [awaitingBlockchainResult, setAwaitingBlockchainResult] = useState(false);
  const [waitingTooLong, setWaitingTooLong] = useState(false);
  const [winTrigger, setWinTrigger] = useState(0);
  const [lossTrigger, setLossTrigger] = useState(0);
  // Optimistic update state
  const [optimisticPayouts, setOptimisticPayouts] = useState<{ mfer: bigint; bnkr: bigint; drb: bigint } | null>(null);
  const [optimisticSkim, setOptimisticSkim] = useState<bigint | null>(null);
  const isRollingRef = useRef(false);
  const rollStartTimeRef = useRef(0);

  // Get contract address and public client for event polling
  const contractAddress = getSevenElevenAddress(chainId);
  const publicClient = usePublicClient();

  // Blockchain integration
  const supportedTokens = useSupportedTokens();
  const currentToken = supportedTokens[0] || {
    address: '0x0' as `0x${string}`,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: '',
  }; // Default to first token (USDC on testnet)

  // Smart wallet and session key for gasless rolls
  const { smartWalletAddress, isSmartWalletReady, isZeroDevAvailable } = useSmartWallet();
  const {
    hasValidSessionKey,
    hasSessionKeyStored,
    isSessionKeyExpired,
    sessionKeyClient,
    sessionKeyAddress,
    isCreatingSessionKey,
    isLoadingSessionKey,
    createSessionKey,
    clearSessionKey,
    error: sessionKeyError,
  } = useSessionKey();

  // Use session key client for rolls if available
  const {
    balance,
    balanceFormatted,
    betAmount,
    minDeposit,
    roll: contractRoll,
    rollWithSessionKey,
    isRolling: isContractRolling,
    isRollingWithSessionKey,
    hasSessionKey,
    authorizedRoller,
    playerStats,
    error: contractError,
  } = useSevenEleven(currentToken, {
    // Pass session key client for gasless rolls
    sessionKeyClient: hasValidSessionKey ? sessionKeyClient : undefined,
  });

  // Determine if user has deposited (has play history)
  const hasDeposited = useMemo(() => {
    if (!playerStats) return false;
    // If firstPlayTime > 0, user has played before (and thus deposited)
    return playerStats.firstPlayTime > BigInt(0);
  }, [playerStats]);

  // Onboarding state
  const { shouldShowOnboarding, dontShowAgainValue, completeOnboarding, skipOnboarding, showOnboarding } = useOnboarding(
    isConnected,
    hasDeposited
  );

  // State to store openConnectModal for onboarding
  const connectModalOpenerRef = useRef<(() => void) | undefined>(undefined);

  // Calculate balance status for color coding
  // Light green: balance > $2 (minDeposit)
  // Light gray: balance >= $1 (minDeposit/2)
  // Light yellow: balance < $1
  // Red: balance < 2 rolls
  // Critical (flashing): balance < 1 roll
  const getBalanceColor = useCallback(() => {
    if (!balance || !minDeposit || !betAmount) return 'gray';
    const halfMinDeposit = minDeposit / BigInt(2);
    const twoRolls = betAmount * BigInt(2);

    if (balance < betAmount) return 'critical'; // Can't even roll once - flash!
    if (balance < twoRolls) return 'red';
    if (balance < halfMinDeposit) return 'yellow';
    if (balance < minDeposit) return 'gray';
    return 'green';
  }, [balance, minDeposit, betAmount]);

  // Check if session key is fully authorized on the contract
  const isSessionKeyAuthorized = hasValidSessionKey &&
    sessionKeyAddress &&
    authorizedRoller &&
    authorizedRoller.toLowerCase() === sessionKeyAddress.toLowerCase();

  // Poll for RollSettled events when awaiting result
  const lastCheckedBlockRef = useRef<bigint>(BigInt(0));

  useEffect(() => {
    if (!awaitingBlockchainResult || !publicClient || !address) {
      return;
    }

    debugLog.debug('Starting RollSettled event polling...');

    const pollForEvents = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = lastCheckedBlockRef.current > BigInt(0)
          ? lastCheckedBlockRef.current
          : currentBlock - BigInt(10);

        debugLog.debug(`Polling blocks ${fromBlock} to ${currentBlock}`);

        const logs = await publicClient.getLogs({
          address: contractAddress,
          event: parseAbiItem('event RollSettled(uint64 indexed sequenceNumber, address indexed player, uint8 die1, uint8 die2, uint8 rollOutcome, uint256 mferPayout, uint256 bnkrPayout, uint256 drbPayout, uint256 mferSkimmed, uint256 playerBalance)'),
          args: {
            player: address,
          },
          fromBlock,
          toBlock: currentBlock,
        });

        lastCheckedBlockRef.current = currentBlock;

        if (logs.length > 0) {
          debugLog.info(`Found ${logs.length} RollSettled events!`);
          const latestLog = logs[logs.length - 1];
          const args = latestLog.args;

          debugLog.debug(`die1=${args.die1} die2=${args.die2} rollOutcome=${args.rollOutcome}`);

          if (args.die1 !== undefined && args.die2 !== undefined) {
            const die1 = Number(args.die1);
            const die2 = Number(args.die2);
            const won = Number(args.rollOutcome) > 0; // 0=Loss, 1=Win, 2=Doubles

            const vrfTime = rollStartTimeRef.current > 0 ? Date.now() - rollStartTimeRef.current : 0;
            debugLog.info(`Result: ${die1}+${die2}=${die1 + die2} ${won ? 'WIN!' : 'LOSS'} (VRF: ${vrfTime}ms)`);

            // Set optimistic state for instant UI updates
            if (won && args.mferPayout !== undefined) {
              setOptimisticPayouts({
                mfer: args.mferPayout,
                bnkr: args.bnkrPayout || BigInt(0),
                drb: args.drbPayout || BigInt(0),
              });
            } else if (!won && args.mferSkimmed !== undefined) {
              setOptimisticSkim(args.mferSkimmed);
            }

            // Inject target faces into ongoing animation - D6 will transition from shake to throw
            // No need to increment rollCount - the animation is continuous
            setTargetFaces({ die1, die2 });
            setDiceResult({ die1, die2, won });
            setAwaitingBlockchainResult(false);
            // Keep isRolling true - let animation settle naturally
            // Win/loss animations will trigger in handleDiceSettled
          }
        }
      } catch (err) {
        debugLog.error(`Poll error: ${err}`);
      }
    };

    // Poll immediately and then every 2 seconds
    pollForEvents();
    const interval = setInterval(pollForEvents, 2000);

    return () => clearInterval(interval);
  }, [awaitingBlockchainResult, publicClient, address, contractAddress]);

  // Timeout fallback: if awaiting result for too long, show dismiss option
  useEffect(() => {
    if (!awaitingBlockchainResult) {
      setWaitingTooLong(false);
      return;
    }

    const timeout = setTimeout(() => {
      if (awaitingBlockchainResult) {
        debugLog.warn('Blockchain result timeout - VRF may be delayed');
        setWaitingTooLong(true);
      }
    }, 15000); // 15 seconds before showing dismiss option

    return () => clearTimeout(timeout);
  }, [awaitingBlockchainResult]);

  // Function to dismiss waiting state
  const handleDismissWaiting = useCallback(() => {
    setAwaitingBlockchainResult(false);
    setWaitingTooLong(false);
    isRollingRef.current = false;
    setIsRolling(false);
    debugLog.info('User dismissed waiting state');
  }, []);

  // Log session key state changes (not every render)
  useEffect(() => {
    if (sessionKeyAddress || authorizedRoller) {
      debugLog.debug(`SK addr: ${sessionKeyAddress?.slice(0,10) || 'none'}`);
      debugLog.debug(`Auth roller: ${authorizedRoller?.slice(0,10) || 'none'}`);
      debugLog.debug(`Valid: ${hasValidSessionKey}, Auth: ${isSessionKeyAuthorized}`);
    }
  }, [hasValidSessionKey, isSessionKeyAuthorized, sessionKeyAddress, authorizedRoller]);

  // Check on mount if we need to show TouchToStart (iOS only)
  useEffect(() => {
    const needs = needsMotionPermission();
    setNeedsPermission(needs);

    // If no permission needed, auto-start with motion enabled
    if (!needs && !hasStarted) {
      // Small delay to let the scene load
      const timer = setTimeout(() => {
        handleStart(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Called when TouchToStart completes (or auto-start on non-iOS)
  const handleStart = useCallback((motionGranted: boolean) => {
    console.log('Started with motion granted:', motionGranted);
    setShakeEnabled(motionGranted);
    setHasStarted(true);
    // Don't auto-roll - wait for user to tap/shake
  }, []);

  // Handle roll
  const handleRoll = useCallback(async () => {
    if (isRollingRef.current || isRolling || isContractRolling || isRollingWithSessionKey) {
      return;
    }

    // If connected, check balance and call contract
    if (isConnected) {
      if (!balance || !betAmount || balance < betAmount) {
        debugLog.warn('Insufficient balance');
        setMenuOpen(true);
        return;
      }

      // Try to use session key for gasless roll (only if authorized on contract)
      debugLog.debug(`Roll: hasSK=${hasSessionKey} auth=${isSessionKeyAuthorized}`);
      if (hasSessionKey && isSessionKeyAuthorized) {
        debugLog.info('GASLESS roll');
        try {
          await rollWithSessionKey();
        } catch (err) {
          debugLog.error(`Session key roll failed: ${err}`);
          // Fall back to regular roll
          try {
            await contractRoll();
            debugLog.info('Fallback to contract roll');
          } catch (err2) {
            debugLog.error(`Contract roll also failed: ${err2}`);
            return;
          }
        }
      } else {
        // Regular roll with wallet signature
        debugLog.info('WALLET roll');
        try {
          await contractRoll();
        } catch (err) {
          debugLog.error(`Contract roll failed: ${err}`);
          return;
        }
      }
    }

    // When connected, don't set target faces yet - wait for VRF result
    // When not connected (demo mode), use random targets
    if (isConnected) {
      isRollingRef.current = true;
      rollStartTimeRef.current = Date.now();
      setRollCount(c => c + 1);
      setTargetFaces(null); // Will be set when VRF result arrives
      setIsRolling(true);
      setDiceResult(null);
      setAwaitingBlockchainResult(true);
    } else {
      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      isRollingRef.current = true;
      setRollCount(c => c + 1);
      setTargetFaces({ die1, die2 });
      setIsRolling(true);
      setDiceResult(null);
    }
  }, [isRolling, isContractRolling, isRollingWithSessionKey, isConnected, balance, betAmount, contractRoll, hasSessionKey, isSessionKeyAuthorized, rollWithSessionKey]);

  const handleDiceSettled = useCallback(() => {
    console.log('Dice animation settled with target faces:', targetFaces);
    isRollingRef.current = false;
    setIsRolling(false);
    // When not connected (demo mode), use the local random result
    if (!isConnected && targetFaces) {
      setDiceResult(targetFaces);
    }
    // If connected, diceResult is already set by VRF polling
    // Trigger win/loss animations now that dice have settled
    if (isConnected && diceResult && diceResult.won !== undefined) {
      if (diceResult.won) {
        setWinTrigger(prev => prev + 1);
      } else {
        setLossTrigger(prev => prev + 1);
      }
    }
  }, [targetFaces, isConnected, diceResult]);

  // Listen for shake
  useShakeListener(shakeEnabled && hasStarted && !isRolling, handleRoll, isRolling);

  // Handler for "Throw Again" button - directly starts roll
  const handleThrowAgain = useCallback(async () => {
    if (isRollingRef.current || isRolling || isContractRolling || isRollingWithSessionKey) {
      return;
    }

    // If connected, check balance and call contract
    if (isConnected) {
      if (!balance || !betAmount || balance < betAmount) {
        debugLog.warn('Insufficient balance');
        setMenuOpen(true);
        return;
      }

      // Try to use session key for gasless roll (only if authorized on contract)
      debugLog.debug(`Roll: hasSK=${hasSessionKey} auth=${isSessionKeyAuthorized}`);
      if (hasSessionKey && isSessionKeyAuthorized) {
        debugLog.info('GASLESS roll');
        try {
          await rollWithSessionKey();
        } catch (err) {
          debugLog.error(`Session key roll failed: ${err}`);
          // Fall back to regular roll
          try {
            await contractRoll();
            debugLog.info('Fallback to contract roll');
          } catch (err2) {
            debugLog.error(`Contract roll also failed: ${err2}`);
            return;
          }
        }
      } else {
        // Regular roll with wallet signature
        debugLog.info('WALLET roll');
        try {
          await contractRoll();
        } catch (err) {
          debugLog.error(`Contract roll failed: ${err}`);
          return;
        }
      }
    }

    // When connected, don't set target faces yet - wait for VRF result
    // When not connected (demo mode), use random targets
    if (isConnected) {
      isRollingRef.current = true;
      rollStartTimeRef.current = Date.now();
      setRollCount(c => c + 1);
      setTargetFaces(null); // Will be set when VRF result arrives
      setIsRolling(true);
      setDiceResult(null);
      setAwaitingBlockchainResult(true);
    } else {
      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      isRollingRef.current = true;
      setRollCount(c => c + 1);
      setTargetFaces({ die1, die2 });
      setIsRolling(true);
      setDiceResult(null);
    }
  }, [isRolling, isContractRolling, isRollingWithSessionKey, isConnected, balance, betAmount, contractRoll, hasSessionKey, isSessionKeyAuthorized, rollWithSessionKey]);

  return (
    <main className="h-[100dvh] flex flex-col overflow-hidden relative">
      {/* Background */}
      <div className={`absolute inset-0 overflow-hidden pointer-events-none pt-4 ${darkMode ? 'bg-gray-700' : 'bg-white'}`}>
        <img
          src="/logo-transparent.png"
          alt=""
          className="w-full h-auto"
        />
      </div>

      {/* Touch to Start overlay - only for iOS that needs motion permission */}
      {!hasStarted && needsPermission === true && <TouchToStart onStart={handleStart} />}

      {/* Onboarding overlay for first-time visitors */}
      {shouldShowOnboarding && (
        <Onboarding
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onComplete={completeOnboarding}
          onSkip={skipOnboarding}
          isConnected={isConnected}
          onConnect={connectModalOpenerRef.current}
          initialDontShowAgain={dontShowAgainValue}
        />
      )}

      {/* Minimal header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 pb-3 safe-top relative z-20">
        {/* Left side: Connect + Game Balance */}
        <div className="flex items-center gap-2">
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              const connected = mounted && account && chain;
              // Store openConnectModal for onboarding use
              // Store openConnectModal in ref for onboarding use (no state update needed)
              if (openConnectModal) {
                connectModalOpenerRef.current = openConnectModal;
              }
              return (
                <button
                  onClick={connected ? openAccountModal : openConnectModal}
                  className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-lg ${
                    darkMode
                      ? 'bg-gray-500 hover:bg-gray-400 text-white'
                      : 'bg-gray-600 hover:bg-gray-500 text-white'
                  }`}
                >
                  {connected ? (
                    <span>{account.displayName}</span>
                  ) : (
                    <span>Connect</span>
                  )}
                </button>
              );
            }}
          </ConnectButton.Custom>
          {/* Game Balance button - only show when connected */}
          {isConnected && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`px-3 py-2 rounded-lg transition-colors shadow-lg font-medium text-sm flex items-center gap-1.5 ${
                (() => {
                  const color = getBalanceColor();
                  if (color === 'critical') return `${darkMode ? 'bg-red-600 text-white' : 'bg-red-500 text-white'} animate-pulse`;
                  if (color === 'green') return darkMode ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-green-500 hover:bg-green-400 text-white';
                  if (color === 'gray') return darkMode ? 'bg-gray-500 hover:bg-gray-400 text-white' : 'bg-gray-400 hover:bg-gray-300 text-white';
                  if (color === 'yellow') return darkMode ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-white';
                  if (color === 'red') return darkMode ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-500 hover:bg-red-400 text-white';
                  return darkMode ? 'bg-gray-500 hover:bg-gray-400 text-white' : 'bg-gray-400 hover:bg-gray-300 text-white';
                })()
              }`}
              aria-label="Open game menu"
            >
              <span>{Number(balanceFormatted).toFixed(2)}</span>
              <img src={currentToken.icon} alt={currentToken.symbol} className="w-4 h-4 rounded-full" />
            </button>
          )}
        </div>
        {/* Right side: Help button */}
        <button
          onClick={showOnboarding}
          className={`p-2 rounded-lg transition-colors shadow-lg ${
            darkMode
              ? 'bg-gray-500 hover:bg-gray-400 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
          aria-label="Help"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </button>
      </header>

      {/* Full screen dice view */}
      <div className="flex-1 relative min-h-0 z-10">
        <DiceErrorBoundary
          onError={(error) => {
            debugLog.error(`DiceScene crashed: ${error.message}`);
          }}
        >
          <DiceScene
            key={rollCount}
            isRolling={isRolling}
            targetFaces={targetFaces}
            onDiceSettled={handleDiceSettled}
            darkMode={darkMode}
          />
        </DiceErrorBoundary>

        {/* Initial roll button - before first roll (when not connected) */}
        {hasStarted && !diceResult && !isRolling && !isConnected && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 safe-bottom pb-2">
            <button
              onClick={handleThrowAgain}
              className={`font-medium px-6 py-3 rounded-xl transition-colors shadow-lg ${
                darkMode
                  ? 'bg-gray-500 hover:bg-gray-400 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-white'
              }`}
            >
              {shakeEnabled ? 'Shake or Tap to Roll' : 'Tap to Roll'}
            </button>
          </div>
        )}

        {/* Result display and Throw Again button (when not connected) */}
        {diceResult && !isRolling && !isConnected && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 safe-bottom pb-2">
            <div className={`rounded-xl px-6 py-3 text-center shadow-lg min-w-[120px] ${
              darkMode ? 'bg-gray-500' : 'bg-gray-600'
            }`}>
              <div className="text-3xl font-bold text-white">
                {diceResult.die1 + diceResult.die2}
              </div>
            </div>
            <button
              onClick={handleThrowAgain}
              className={`font-medium px-5 py-2.5 rounded-xl transition-colors text-sm shadow-lg ${
                darkMode
                  ? 'bg-gray-500 hover:bg-gray-400 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-white'
              }`}
            >
              {shakeEnabled ? 'Shake or Tap to Roll' : 'Tap to Roll'}
            </button>
          </div>
        )}

        {/* Simple roll button and result (when connected) */}
        {hasStarted && isConnected && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 safe-bottom pb-2">
            {/* Waiting for blockchain result */}
            {awaitingBlockchainResult && (
              <div className="flex flex-col items-center gap-2">
                <div className={`rounded-xl px-6 py-3 text-center shadow-lg min-w-[120px] ${
                  darkMode ? 'bg-blue-700' : 'bg-blue-500'
                }`}>
                  <div className="text-lg font-bold text-white animate-pulse">
                    Rolling...
                  </div>
                  <div className="text-xs text-white/80 mt-1">
                    {waitingTooLong ? 'VRF callback delayed' : 'Waiting for result'}
                  </div>
                </div>
                {waitingTooLong && (
                  <button
                    onClick={handleDismissWaiting}
                    className={`text-sm px-4 py-2 rounded-lg ${
                      darkMode ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-500 hover:bg-gray-400 text-white'
                    }`}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}
            {/* Result display - uses blockchain won property */}
            {diceResult && !isRolling && !awaitingBlockchainResult && (
              <div className={`rounded-xl px-6 py-3 text-center shadow-lg min-w-[120px] ${
                diceResult.won
                  ? darkMode ? 'bg-green-700' : 'bg-green-500'
                  : darkMode ? 'bg-red-700' : 'bg-red-500'
              }`}>
                <div className="text-3xl font-bold text-white">
                  {diceResult.die1 + diceResult.die2}
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {diceResult.won ? 'WIN!' : 'Try Again'}
                </div>
              </div>
            )}
            {/* Roll button */}
            {!awaitingBlockchainResult && (
              <button
                onClick={handleThrowAgain}
                disabled={isRolling || awaitingBlockchainResult}
                className={`font-medium px-6 py-3 rounded-xl transition-colors shadow-lg disabled:opacity-50 ${
                  darkMode
                    ? 'bg-gray-500 hover:bg-gray-400 text-white'
                    : 'bg-gray-600 hover:bg-gray-500 text-white'
                }`}
              >
                {shakeEnabled ? 'Shake or Tap to Roll' : 'Tap to Roll'}
              </button>
            )}
          </div>
        )}

        {/* Game Menu Overlay */}
        {menuOpen && isConnected && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center"
            onClick={() => setMenuOpen(false)}
          >
            {/* Backdrop */}
            <div className={`absolute inset-0 ${darkMode ? 'bg-black/70' : 'bg-black/50'}`} />
            {/* Menu content */}
            <div
              className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden ${
                darkMode ? 'bg-gray-800' : 'bg-white'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
                className={`absolute top-3 right-3 z-10 p-2 rounded-lg transition-colors ${
                  darkMode
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              {/* Game UI */}
              <div className="p-4 pt-12 max-h-[80vh] overflow-y-auto">
                <SevenElevenGame
                  darkMode={darkMode}
                  sessionKey={{
                    hasValidSessionKey,
                    hasSessionKeyStored,
                    isSessionKeyExpired,
                    isCreatingSessionKey,
                    sessionKeyAddress,
                    error: sessionKeyError,
                    createSessionKey,
                    clearSessionKey,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grok donation stats - lower left */}
      <GrokStats
        darkMode={darkMode}
        iconUrl="/grokai_mfer.png"
        lossTrigger={lossTrigger}
        optimisticSkim={optimisticSkim}
        onOptimisticSkimCleared={() => setOptimisticSkim(null)}
      />

      {/* Meme token wallet balances - lower right */}
      <MemeWalletBalances
        darkMode={darkMode}
        winTrigger={winTrigger}
        optimisticPayouts={optimisticPayouts}
        onOptimisticPayoutsCleared={() => setOptimisticPayouts(null)}
      />

      {/* Debug console for mobile testing */}
      <DebugConsole />
    </main>
  );
}

// Custom hook for shake detection - uses a lock to prevent multiple triggers
function useShakeListener(enabled: boolean, onShake: () => void, isRolling: boolean) {
  const lockedUntilRef = useRef(0);
  const lastAccRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const onShakeRef = useRef(onShake);
  const enabledAtRef = useRef(0);

  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled) {
      // Reset when disabled so we don't get false triggers on re-enable
      lastAccRef.current = null;
      return;
    }

    // Track when we were enabled to ignore events for a short warmup period
    enabledAtRef.current = Date.now();

    const handleMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();

      // Ignore events for 500ms after enabling (warmup period)
      if (now - enabledAtRef.current < 500) return;

      // Hard lock - ignore everything for 3 seconds after a shake
      if (now < lockedUntilRef.current) return;

      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      // First event after enable - just capture baseline, don't detect
      if (lastAccRef.current === null) {
        lastAccRef.current = { x: acc.x, y: acc.y, z: acc.z };
        return;
      }

      const deltaX = Math.abs(acc.x - lastAccRef.current.x);
      const deltaY = Math.abs(acc.y - lastAccRef.current.y);
      const deltaZ = Math.abs(acc.z - lastAccRef.current.z);
      const acceleration = Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);

      lastAccRef.current = { x: acc.x, y: acc.y, z: acc.z };

      // Shake threshold
      if (acceleration > 20) {
        // Lock immediately for 3 seconds
        lockedUntilRef.current = now + 3000;
        try {
          onShakeRef.current();
        } catch (err) {
          console.error('Error during shake handler:', err);
        }
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [enabled]);
}
