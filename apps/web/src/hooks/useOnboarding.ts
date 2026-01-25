'use client';

import { useState, useEffect, useCallback } from 'react';

const ONBOARDING_STORAGE_KEY = 'mferroll_onboarding_v1';

interface OnboardingState {
  dontShowAgain: boolean;
}

const defaultState: OnboardingState = {
  dontShowAgain: false,
};

function loadOnboardingState(): OnboardingState {
  if (typeof window === 'undefined') return defaultState;

  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load onboarding state:', e);
  }
  return defaultState;
}

function saveOnboardingState(state: OnboardingState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save onboarding state:', e);
  }
}

interface UseOnboardingReturn {
  shouldShowOnboarding: boolean;
  dontShowAgainValue: boolean;
  completeOnboarding: (dontShowAgain: boolean) => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;
  showOnboarding: () => void;
}

export function useOnboarding(
  isConnected: boolean,
  hasDeposited: boolean
): UseOnboardingReturn {
  const [state, setState] = useState<OnboardingState>(defaultState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    setState(loadOnboardingState());
    setIsHydrated(true);
  }, []);

  // Track if dismissed this session (not persisted)
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  // Track if manually triggered (e.g., from help button)
  const [manuallyTriggered, setManuallyTriggered] = useState(false);

  // Determine if we should show onboarding
  // Show if: manually triggered OR (not permanently hidden AND not dismissed this session AND (not connected OR connected but no deposit history))
  const shouldShowOnboarding = isHydrated && (
    manuallyTriggered ||
    (!state.dontShowAgain && !dismissedThisSession && (!isConnected || !hasDeposited))
  );

  const completeOnboarding = useCallback((dontShowAgain: boolean) => {
    setManuallyTriggered(false);
    const newState: OnboardingState = { dontShowAgain };
    setState(newState);
    saveOnboardingState(newState);
    // Also dismiss for this session if they want to see it again
    if (!dontShowAgain) {
      setDismissedThisSession(true);
    }
  }, []);

  const skipOnboarding = useCallback(() => {
    // Skip just dismisses for this session, doesn't persist
    setManuallyTriggered(false);
    setDismissedThisSession(true);
  }, []);

  const resetOnboarding = useCallback(() => {
    setState(defaultState);
    saveOnboardingState(defaultState);
    setDismissedThisSession(false);
    setManuallyTriggered(false);
  }, []);

  const showOnboarding = useCallback(() => {
    setManuallyTriggered(true);
    setDismissedThisSession(false);
  }, []);

  return {
    shouldShowOnboarding,
    dontShowAgainValue: state.dontShowAgain,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding,
    showOnboarding,
  };
}
