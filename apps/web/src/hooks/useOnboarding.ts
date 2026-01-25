'use client';

import { useState, useEffect, useCallback } from 'react';

const ONBOARDING_STORAGE_KEY = 'mferroll_onboarding_v1';

interface OnboardingState {
  hasCompleted: boolean;
  completedAt: number | null;
  skipped: boolean;
  dontShowAgain: boolean;
}

const defaultState: OnboardingState = {
  hasCompleted: false,
  completedAt: null,
  skipped: false,
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
  completeOnboarding: (dontShowAgain: boolean) => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;
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

  // Determine if we should show onboarding
  // Show if: not completed AND (not connected OR connected but no deposit history)
  const shouldShowOnboarding = isHydrated &&
    !state.hasCompleted &&
    !state.dontShowAgain &&
    (!isConnected || !hasDeposited);

  const completeOnboarding = useCallback((dontShowAgain: boolean) => {
    const newState: OnboardingState = {
      hasCompleted: true,
      completedAt: Date.now(),
      skipped: false,
      dontShowAgain,
    };
    setState(newState);
    saveOnboardingState(newState);
  }, []);

  const skipOnboarding = useCallback(() => {
    const newState: OnboardingState = {
      hasCompleted: true,
      completedAt: Date.now(),
      skipped: true,
      dontShowAgain: false,
    };
    setState(newState);
    saveOnboardingState(newState);
  }, []);

  const resetOnboarding = useCallback(() => {
    setState(defaultState);
    saveOnboardingState(defaultState);
  }, []);

  return {
    shouldShowOnboarding,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding,
  };
}
