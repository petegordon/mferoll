# SevenEleven Smart Contracts

Solidity smart contracts for the mferROLL dice game, using Pyth Entropy for verifiable randomness.

## Overview

- **SevenEleven.sol** - Main game contract supporting multiple ERC20 tokens
- Uses [Pyth Entropy](https://docs.pyth.network/entropy) for provably fair VRF (Verifiable Random Function)
- Chainlink price feeds for ETH/USD conversion
- Session key support for gasless rolls via ERC-4337

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- A funded wallet for deployment
- Basescan API key (for verification)

## Environment Setup

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Deployment
PRIVATE_KEY=0x...                    # Deployer wallet private key
IS_MAINNET=false                     # true for Base Mainnet, false for Base Sepolia

# RPC URLs
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Verification
BASESCAN_API_KEY=your_api_key        # Get from https://basescan.org/myapikey

# Post-deployment (updated after deploy)
SEVEN_ELEVEN_ADDRESS=0x...           # Contract address after deployment

# Token configuration (for adding tokens post-deployment)
USDC_ADDRESS=0x...
USDC_WETH_POOL=0x...
```

## Deployment

### 1. Install Dependencies

```bash
forge install
```

### 2. Build Contracts

```bash
forge build
```

### 3. Run Tests

```bash
forge test
```

### 4. Deploy to Base Sepolia (Testnet)

```bash
# Ensure IS_MAINNET=false in .env
forge script script/DeploySevenEleven.s.sol:DeploySevenElevenScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  -vvvv
```

### 5. Deploy to Base Mainnet

```bash
# Ensure IS_MAINNET=true in .env
forge script script/DeploySevenEleven.s.sol:DeploySevenElevenScript \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  -vvvv
```

Save the deployed contract address to your `.env` file as `SEVEN_ELEVEN_ADDRESS`.

## Contract Verification

Verify your contract on Basescan so wallets can display transaction details.

### Base Sepolia

```bash
forge verify-contract <CONTRACT_ADDRESS> \
  src/SevenEleven.sol:SevenEleven \
  --chain base-sepolia \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address)" \
    0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c \
    0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9 \
    0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1 \
    0x4200000000000000000000000000000000000006) \
  --etherscan-api-key $BASESCAN_API_KEY
```

### Base Mainnet

```bash
forge verify-contract <CONTRACT_ADDRESS> \
  src/SevenEleven.sol:SevenEleven \
  --chain base \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address)" \
    0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb \
    0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9 \
    0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70 \
    0x4200000000000000000000000000000000000006) \
  --etherscan-api-key $BASESCAN_API_KEY
```

### Check Verification Status

```bash
forge verify-check <GUID> --chain base-sepolia --etherscan-api-key $BASESCAN_API_KEY
```

### Constructor Arguments Reference

| Network | Param | Address |
|---------|-------|---------|
| Sepolia | Pyth Entropy | `0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c` |
| Sepolia | ETH/USD Feed | `0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1` |
| Mainnet | Pyth Entropy | `0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb` |
| Mainnet | ETH/USD Feed | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` |
| Both | Fee Recipient | `0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9` |
| Both | WETH | `0x4200000000000000000000000000000000000006` |

## Post-Deployment Configuration

### Add Supported Tokens

After deployment, add tokens the game should support:

```bash
# Using cast
cast send $SEVEN_ELEVEN_ADDRESS \
  "addToken(address,address)" \
  <TOKEN_ADDRESS> <UNISWAP_V3_POOL_ADDRESS> \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### Fund Contract for Entropy Fees

The contract needs ETH to pay Pyth Entropy fees:

```bash
cast send $SEVEN_ELEVEN_ADDRESS \
  "depositEntropyFunds()" \
  --value 0.01ether \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### Add House Liquidity

Deposit tokens as house liquidity for payouts:

```bash
# First approve the contract
cast send <TOKEN_ADDRESS> \
  "approve(address,uint256)" \
  $SEVEN_ELEVEN_ADDRESS <AMOUNT> \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Then deposit as house
cast send $SEVEN_ELEVEN_ADDRESS \
  "depositHouse(address,uint256)" \
  <TOKEN_ADDRESS> <AMOUNT> \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

## Diagnostic Scripts

### Check VRF Status

```bash
forge script script/TestVRF.s.sol:CheckVRFScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  -vvvv
```

### Deposit Entropy Funds

```bash
forge script script/TestVRF.s.sol:DepositEntropyFunds \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast
```

## Deployed Contracts

| Network | Address | Status |
|---------|---------|--------|
| Base Sepolia | `0xDb6A00B3EcA4a12f52B67DA121bA11ce8D5e07Df` | [Verified](https://sepolia.basescan.org/address/0xDb6A00B3EcA4a12f52B67DA121bA11ce8D5e07Df#code) |

## Architecture

```
Player                    SevenEleven Contract              Pyth Entropy
   │                            │                               │
   │─── roll(token) ───────────>│                               │
   │                            │─── requestRandomness() ──────>│
   │                            │<── sequenceNumber ────────────│
   │                            │                               │
   │                            │    (off-chain VRF callback)   │
   │                            │<── entropyCallback() ─────────│
   │                            │                               │
   │<── RollSettled event ──────│                               │
   │    (die1, die2, won)       │                               │
```

## License

MIT
