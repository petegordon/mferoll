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

// SevenEleven contract ABI
export const SEVEN_ELEVEN_ABI = [
  // Player functions
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'roll',
    outputs: [{ name: 'requestId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // View functions
  {
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    name: 'getBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    name: 'playerBalances',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'getPlayerStats',
    outputs: [
      {
        components: [
          { name: 'totalWins', type: 'uint256' },
          { name: 'totalLosses', type: 'uint256' },
          { name: 'totalFeePaid', type: 'uint256' },
          { name: 'firstPlayTime', type: 'uint256' },
          { name: 'lastPlayTime', type: 'uint256' },
          { name: 'totalSessions', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'playerStats',
    outputs: [
      { name: 'totalWins', type: 'uint256' },
      { name: 'totalLosses', type: 'uint256' },
      { name: 'totalFeePaid', type: 'uint256' },
      { name: 'firstPlayTime', type: 'uint256' },
      { name: 'lastPlayTime', type: 'uint256' },
      { name: 'totalSessions', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'getBetAmount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'getMinDeposit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getSupportedTokens',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'isTokenSupported',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'houseLiquidity',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'requestId', type: 'uint256' }],
    name: 'pendingRolls',
    outputs: [
      { name: 'player', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'betAmount', type: 'uint256' },
      { name: 'feeAmount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Constants
  {
    inputs: [],
    name: 'BET_USD_CENTS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MIN_DEPOSIT_CENTS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'WIN_MULTIPLIER',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'FEE_BPS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'FEE_RECIPIENT',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'player', type: 'address' },
      { indexed: true, name: 'token', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'Deposited',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'player', type: 'address' },
      { indexed: true, name: 'token', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'Withdrawn',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: true, name: 'token', type: 'address' },
      { indexed: false, name: 'betAmount', type: 'uint256' },
    ],
    name: 'RollRequested',
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
    name: 'RollSettled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'player', type: 'address' },
      { indexed: true, name: 'token', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'FeePaid',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'sessionNumber', type: 'uint256' },
    ],
    name: 'NewSession',
    type: 'event',
  },
] as const;

// Token addresses (Base Mainnet)
export const TOKEN_ADDRESSES = {
  MFERCOIN: '0xE3086852A4B125803C815a158249ae468A3254Ca' as `0x${string}`,
  DRB: '0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2' as `0x${string}`,
  BANKR: '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b' as `0x${string}`,
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  WETH: '0x4200000000000000000000000000000000000006' as `0x${string}`,
} as const;

// Helper to get token icon URL from Trust Wallet assets
export function getTokenIconUrl(address: string): string {
  return `https://assets-cdn.trustwallet.com/blockchains/base/assets/${address}/logo.png`;
}

// SevenEleven contract address (to be updated after deployment)
export const SEVEN_ELEVEN_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;

// SevenEleven game constants
export const SEVEN_ELEVEN_CONSTANTS = {
  BET_USD: 0.25,
  MIN_DEPOSIT_USD: 2.00,
  WIN_MULTIPLIER: 3,
  FEE_PERCENTAGE: 10,
  WINNING_SUMS: [7, 11] as const,
} as const;

// Player stats type
export interface PlayerStats {
  totalWins: bigint;
  totalLosses: bigint;
  totalFeePaid: bigint;
  firstPlayTime: bigint;
  lastPlayTime: bigint;
  totalSessions: bigint;
}

// Token info type
export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
}
