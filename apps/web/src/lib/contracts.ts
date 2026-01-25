// Chain IDs
export const CHAIN_ID = {
  BASE_MAINNET: 8453,
  BASE_SEPOLIA: 84532,
} as const;

// ERC20 ABI for token interactions
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

// SevenEleven V2 contract ABI
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
    inputs: [],
    name: 'withdrawAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'roll',
    outputs: [{ name: 'sequenceNumber', type: 'uint64' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Session key / delegation functions
  {
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    name: 'rollFor',
    outputs: [{ name: 'sequenceNumber', type: 'uint64' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'roller', type: 'address' }],
    name: 'authorizeRoller',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'revokeRoller',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'getAuthorizedRoller',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'roller', type: 'address' },
      { name: 'player', type: 'address' },
    ],
    name: 'canRollFor',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Optimized deposit functions
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'roller', type: 'address' },
    ],
    name: 'depositAndAuthorize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'roller', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    name: 'depositAndAuthorizeWithPermit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getEntropyFee',
    outputs: [{ name: 'fee', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getEntropyBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
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
          { name: 'totalDoublesWon', type: 'uint256' },
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
      { name: 'totalDoublesWon', type: 'uint256' },
      { name: 'firstPlayTime', type: 'uint256' },
      { name: 'lastPlayTime', type: 'uint256' },
      { name: 'totalSessions', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Meme token winnings
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'getPlayerMemeWinnings',
    outputs: [
      { name: 'mfer', type: 'uint256' },
      { name: 'bnkr', type: 'uint256' },
      { name: 'drb', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'totalMferWon',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'totalBnkrWon',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'totalDrbWon',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Payout reserves
  {
    inputs: [],
    name: 'getPayoutReserves',
    outputs: [
      { name: 'mfer', type: 'uint256' },
      { name: 'bnkr', type: 'uint256' },
      { name: 'drb', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'payoutReserves',
    outputs: [{ name: '', type: 'uint256' }],
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
    name: 'isDepositToken',
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
    inputs: [{ name: 'sequenceNumber', type: 'uint64' }],
    name: 'pendingRolls',
    outputs: [
      { name: 'player', type: 'address' },
      { name: 'depositToken', type: 'address' },
      { name: 'betAmount', type: 'uint256' },
      { name: 'betUsdCents', type: 'uint256' },
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
    name: 'LOSS_SKIM_CENTS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'WIN_7_11_BPS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'WIN_DOUBLES_BPS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Immutable addresses
  {
    inputs: [],
    name: 'MFER',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'BNKR',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'DRB',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'GROK_WALLET',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'USDC',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'WETH',
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
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'usdcAmount', type: 'uint256' },
      { indexed: false, name: 'wethAmount', type: 'uint256' },
    ],
    name: 'WithdrawnAll',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'sequenceNumber', type: 'uint64' },
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
      { indexed: true, name: 'sequenceNumber', type: 'uint64' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'die1', type: 'uint8' },
      { indexed: false, name: 'die2', type: 'uint8' },
      { indexed: false, name: 'winType', type: 'uint8' },
      { indexed: false, name: 'mferPayout', type: 'uint256' },
      { indexed: false, name: 'bnkrPayout', type: 'uint256' },
      { indexed: false, name: 'drbPayout', type: 'uint256' },
    ],
    name: 'RollSettled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'drbAmount', type: 'uint256' },
      { indexed: true, name: 'grokWallet', type: 'address' },
    ],
    name: 'LossSkim',
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
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'player', type: 'address' },
      { indexed: true, name: 'roller', type: 'address' },
    ],
    name: 'RollerAuthorized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'player', type: 'address' },
      { indexed: true, name: 'previousRoller', type: 'address' },
    ],
    name: 'RollerRevoked',
    type: 'event',
  },
  // Price oracle functions
  {
    inputs: [],
    name: 'getEthUsdPrice',
    outputs: [{ name: 'price', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'getTokenEthPrice',
    outputs: [{ name: 'priceX96', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'getTokenValueInCents',
    outputs: [{ name: 'cents', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Token addresses by network
export const TOKEN_ADDRESSES_BY_CHAIN = {
  [CHAIN_ID.BASE_MAINNET]: {
    // Deposit tokens
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
    WETH: '0x4200000000000000000000000000000000000006' as `0x${string}`,
    // Payout tokens (meme coins)
    MFERCOIN: '0xE3086852A4B125803C815a158249ae468A3254Ca' as `0x${string}`,
    DRB: '0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2' as `0x${string}`,
    BANKR: '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b' as `0x${string}`,
  },
  [CHAIN_ID.BASE_SEPOLIA]: {
    // Deposit tokens
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
    WETH: '0x4200000000000000000000000000000000000006' as `0x${string}`,
    // Payout tokens (mock meme coins) - Deployed by script
    MFERCOIN: '0x2D8956e3Fd63505DF56e619Ae6A59d3110716Ef8' as `0x${string}`,
    DRB: '0x90130EcEF79282030537204124aAf71BA0c25854' as `0x${string}`,
    BANKR: '0xDD51fBE09280E108d728e15046506bB859114357' as `0x${string}`,
  },
} as const;

// Uniswap V3 pool addresses for meme tokens (used for TWAP pricing)
export const POOL_ADDRESSES_BY_CHAIN = {
  [CHAIN_ID.BASE_MAINNET]: {
    MFERCOIN_WETH: '0x7EC18ABf80E865c6799069df91073335935C4185' as `0x${string}`,
    DRB_WETH: '0x5116773e18A9C7bB03EBB961b38678E45E238923' as `0x${string}`,
    BANKR_WETH: '0xAEC085E5A5CE8d96A7bDd3eB3A62445d4f6CE703' as `0x${string}`,
  },
  [CHAIN_ID.BASE_SEPOLIA]: {
    // Testnet uses mock tokens with fixed pricing, no real pools
    MFERCOIN_WETH: null,
    DRB_WETH: null,
    BANKR_WETH: null,
  },
} as const;

// Grok wallet addresses
export const GROK_WALLET_BY_CHAIN = {
  [CHAIN_ID.BASE_MAINNET]: '0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9' as `0x${string}`,
  [CHAIN_ID.BASE_SEPOLIA]: '0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9' as `0x${string}`, // Using drb.eth for testnet
} as const;

// Legacy export for backwards compatibility
export const TOKEN_ADDRESSES = TOKEN_ADDRESSES_BY_CHAIN[CHAIN_ID.BASE_MAINNET];

// SevenEleven contract addresses by network
export const SEVEN_ELEVEN_ADDRESS_BY_CHAIN = {
  [CHAIN_ID.BASE_MAINNET]: '0x0000000000000000000000000000000000000000' as `0x${string}`, // TODO: Deploy to mainnet
  [CHAIN_ID.BASE_SEPOLIA]: '0xc13078980fE702E1fb02A747096d5b395F9376C4' as `0x${string}`, // Deployed by script
} as const;

// Helper to get contract address for current chain
export function getSevenElevenAddress(chainId: number): `0x${string}` {
  return SEVEN_ELEVEN_ADDRESS_BY_CHAIN[chainId as keyof typeof SEVEN_ELEVEN_ADDRESS_BY_CHAIN]
    ?? '0x0000000000000000000000000000000000000000';
}

// Helper to get token icon URL from Trust Wallet assets
export function getTokenIconUrl(address: string): string {
  return `https://assets-cdn.trustwallet.com/blockchains/base/assets/${address}/logo.png`;
}

// Legacy export - will be deprecated
export const SEVEN_ELEVEN_ADDRESS = '0xc13078980fE702E1fb02A747096d5b395F9376C4' as `0x${string}`;

// SevenEleven V2 game constants
export const SEVEN_ELEVEN_CONSTANTS = {
  BET_USD: 0.40,
  MIN_DEPOSIT_USD: 4.00,
  WIN_7_11_MULTIPLIER: 0.5,  // Profit multiplier (0.5x = 50% profit on bet)
  WIN_DOUBLES_MULTIPLIER: 2,  // Profit multiplier (2x = 200% profit on bet)
  LOSS_SKIM_USD: 0.02,
  WINNING_SUMS: [7, 11] as const,
} as const;

// Win types enum matching contract
export enum WinType {
  None = 0,       // Loss
  SevenOrEleven = 1,  // 1.5x
  Doubles = 2,    // 3x
}

// Player stats type (V2)
export interface PlayerStats {
  totalWins: bigint;
  totalLosses: bigint;
  totalDoublesWon: bigint;
  firstPlayTime: bigint;
  lastPlayTime: bigint;
  totalSessions: bigint;
}

// Meme token winnings
export interface MemeWinnings {
  mfer: bigint;
  bnkr: bigint;
  drb: bigint;
}

// Token info type
export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
}
