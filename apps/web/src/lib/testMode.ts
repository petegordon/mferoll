// Test mode configuration
export const TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE === 'true';

// Initial virtual balance for test mode (10,000 MFER)
export const INITIAL_TEST_BALANCE = 10000;

// Storage key for virtual balance
export const TEST_BALANCE_KEY = 'dice-roll-test-balance';

// Generate random dice result (simulates VRF)
export function generateDiceResult(): { die1: number; die2: number } {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return { die1, die2 };
}

// Simulate a delay like waiting for VRF callback
export function simulateVRFDelay(): Promise<void> {
  const delay = 1500 + Math.random() * 1000; // 1.5-2.5 seconds
  return new Promise((resolve) => setTimeout(resolve, delay));
}
