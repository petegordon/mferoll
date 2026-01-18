// ERC20 ABI for mfercoin interactions
export const ERC20_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// DiceBetting contract ABI - will be updated after contract deployment
export const DICE_BETTING_ABI = [
  {
    inputs: [
      { name: 'betType', type: 'uint8' },
      { name: 'prediction', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'placeBet',
    outputs: [{ name: 'requestId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'requestId', type: 'uint256' }],
    name: 'getBet',
    outputs: [
      { name: 'player', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'betType', type: 'uint8' },
      { name: 'prediction', type: 'uint8' },
      { name: 'die1', type: 'uint8' },
      { name: 'die2', type: 'uint8' },
      { name: 'settled', type: 'bool' },
      { name: 'won', type: 'bool' },
      { name: 'payout', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'betType', type: 'uint8' },
      { indexed: false, name: 'prediction', type: 'uint8' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'BetPlaced',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'die1', type: 'uint8' },
      { indexed: false, name: 'die2', type: 'uint8' },
      { indexed: false, name: 'won', type: 'bool' },
      { indexed: false, name: 'payout', type: 'uint256' },
    ],
    name: 'BetSettled',
    type: 'event',
  },
] as const;

// Bet types enum matching contract
export enum BetType {
  Exact = 0,
  Over = 1,
  Under = 2,
  Odd = 3,
  Even = 4,
  Doubles = 5,
  Range = 6,
}

// Payout multipliers (house edge: 3%)
export const PAYOUT_MULTIPLIERS: Record<BetType, Record<number, number>> = {
  [BetType.Exact]: {
    2: 33.95,  // 1/36 chance
    3: 16.98,  // 2/36 chance
    4: 11.32,  // 3/36 chance
    5: 8.49,   // 4/36 chance
    6: 6.79,   // 5/36 chance
    7: 5.66,   // 6/36 chance
    8: 6.79,   // 5/36 chance
    9: 8.49,   // 4/36 chance
    10: 11.32, // 3/36 chance
    11: 16.98, // 2/36 chance
    12: 33.95, // 1/36 chance
  },
  [BetType.Over]: { 0: 1.94 },    // Over 7: 15/36 chance
  [BetType.Under]: { 0: 1.94 },   // Under 7: 15/36 chance
  [BetType.Odd]: { 0: 1.94 },     // 18/36 chance
  [BetType.Even]: { 0: 1.94 },    // 18/36 chance
  [BetType.Doubles]: { 0: 5.82 }, // 6/36 chance
  [BetType.Range]: {
    // Low (2-6): 10/36
    0: 3.49,
    // Mid (5-9): 20/36
    1: 1.75,
    // High (8-12): 10/36
    2: 3.49,
  },
};
