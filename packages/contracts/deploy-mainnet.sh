#!/bin/bash
# Deploy SevenEleven V2 to Base Mainnet
# Usage: ./deploy-mainnet.sh
#
# IMPORTANT: Review all addresses before running!
# This script deploys to MAINNET with REAL funds.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo ""
    echo -e "${MAGENTA}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  $1${NC}"
    echo -e "${MAGENTA}══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}▶ Step $1: $2${NC}"
}

print_success() {
    echo -e "${GREEN}  ✓ $1${NC}"
}

print_info() {
    echo -e "  $1"
}

print_warn() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}  ✗ Error: $1${NC}"
}

print_divider() {
    echo -e "${BLUE}──────────────────────────────────────────────────────────────${NC}"
}

# Load environment variables
set -a
source .env
set +a

print_header "SevenEleven V2 MAINNET Deployment"

echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  WARNING: This deploys to BASE MAINNET with REAL funds!     ║${NC}"
echo -e "${RED}║  Review all addresses and amounts before proceeding.        ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check required env vars
if [ -z "$PRIVATE_KEY" ]; then
    print_error "PRIVATE_KEY not set in .env"
    exit 1
fi

if [ -z "$BASE_RPC_URL" ]; then
    print_error "BASE_RPC_URL not set in .env"
    exit 1
fi

# Get deployer address and balance
DEPLOYER=$(cast wallet address "$PRIVATE_KEY" 2>/dev/null || echo "unknown")
DEPLOYER_BALANCE=$(cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL" --ether 2>/dev/null || echo "0")

print_info "Network:  ${MAGENTA}BASE MAINNET${NC}"
print_info "Chain ID: 8453"
print_info "Deployer: $DEPLOYER"
print_info "Balance:  $DEPLOYER_BALANCE ETH"
echo ""

# Display key addresses
print_divider
echo -e "${BLUE}Key Addresses:${NC}"
print_info "Grok Wallet:  0xb1058c959987e3513600eb5b4fd82aeee2a0e4f9"
print_info "MFER Token:   0xE3086852A4B125803C815a158249ae468A3254Ca"
print_info "BNKR Token:   0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b"
print_info "DRB Token:    0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2"
print_divider
echo ""

# Confirmation prompt
echo -e "${YELLOW}Are you sure you want to deploy to MAINNET? (type 'yes' to confirm)${NC}"
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    print_error "Deployment cancelled"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════
# Step 1: Deploy Contract
# ═══════════════════════════════════════════════════════════════
echo ""
print_divider
print_step "1" "Deploy SevenEleven contract"

# Run the deployment
DEPLOY_OUTPUT=$(forge script script/DeployMainnet.s.sol:DeployMainnetScript \
    --rpc-url "$BASE_RPC_URL" \
    --broadcast \
    --slow \
    2>&1)

echo "$DEPLOY_OUTPUT"

# Extract the contract address from broadcast
BROADCAST_FILE="broadcast/DeployMainnet.s.sol/8453/run-latest.json"
if [ -f "$BROADCAST_FILE" ]; then
    SEVEN_ELEVEN_ADDR=$(jq -r '.transactions[0].contractAddress // empty' "$BROADCAST_FILE")
    if [ -z "$SEVEN_ELEVEN_ADDR" ]; then
        print_error "Could not extract contract address from broadcast"
        exit 1
    fi
    print_success "Contract deployed: $SEVEN_ELEVEN_ADDR"
else
    print_error "Broadcast file not found"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════
# Step 2: Update .env
# ═══════════════════════════════════════════════════════════════
echo ""
print_divider
print_step "2" "Update .env with mainnet address"

if grep -q "^SEVEN_ELEVEN_MAINNET_ADDRESS=" .env; then
    sed -i.bak "s|^SEVEN_ELEVEN_MAINNET_ADDRESS=.*|SEVEN_ELEVEN_MAINNET_ADDRESS=$SEVEN_ELEVEN_ADDR|" .env
else
    echo "SEVEN_ELEVEN_MAINNET_ADDRESS=$SEVEN_ELEVEN_ADDR" >> .env
fi
print_success "SEVEN_ELEVEN_MAINNET_ADDRESS=$SEVEN_ELEVEN_ADDR"

# ═══════════════════════════════════════════════════════════════
# Step 3: Update frontend contracts.ts
# ═══════════════════════════════════════════════════════════════
echo ""
print_divider
print_step "3" "Update frontend contracts.ts"

CONTRACTS_TS="../../apps/web/src/lib/contracts.ts"

if [ -f "$CONTRACTS_TS" ]; then
    # Update SEVEN_ELEVEN_ADDRESS_BY_CHAIN for Base Mainnet (8453)
    sed -i.bak "s|\[CHAIN_ID.BASE_MAINNET\]: '0x[a-fA-F0-9]\{40\}' as \`0x\${string}\`,.*// TODO: Deploy to mainnet|\[CHAIN_ID.BASE_MAINNET\]: '$SEVEN_ELEVEN_ADDR' as \`0x\${string}\`, // Deployed|" "$CONTRACTS_TS"
    sed -i.bak "s|\[CHAIN_ID.BASE_MAINNET\]: '0x[a-fA-F0-9]\{40\}' as \`0x\${string}\`,.*// Deployed|\[CHAIN_ID.BASE_MAINNET\]: '$SEVEN_ELEVEN_ADDR' as \`0x\${string}\`, // Deployed|" "$CONTRACTS_TS"

    rm -f "$CONTRACTS_TS.bak"
    print_success "Updated SEVEN_ELEVEN_ADDRESS_BY_CHAIN[BASE_MAINNET]"
else
    print_warn "contracts.ts not found at $CONTRACTS_TS"
fi

# ═══════════════════════════════════════════════════════════════
# Step 4: Verify Contract (optional)
# ═══════════════════════════════════════════════════════════════
echo ""
print_divider
print_step "4" "Verify contract on Basescan"

if [ -n "$BASESCAN_API_KEY" ]; then
    print_info "Verifying contract..."
    forge verify-contract \
        --chain-id 8453 \
        --compiler-version v0.8.20 \
        "$SEVEN_ELEVEN_ADDR" \
        src/SevenEleven.sol:SevenEleven \
        --etherscan-api-key "$BASESCAN_API_KEY" \
        --constructor-args $(cast abi-encode "constructor(address,address,address,address,address,address,address,address)" \
            0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb \
            0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70 \
            0x4200000000000000000000000000000000000006 \
            0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
            0xE3086852A4B125803C815a158249ae468A3254Ca \
            0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b \
            0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2 \
            0xb1058c959987e3513600eb5b4fd82aeee2a0e4f9) \
        2>&1 || print_warn "Verification failed - try manually on Basescan"
else
    print_warn "BASESCAN_API_KEY not set - skipping verification"
    print_info "Verify manually at: https://basescan.org/verifyContract"
fi

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════
echo ""
print_header "Deployment Complete!"

echo -e "${GREEN}Contract Address: $SEVEN_ELEVEN_ADDR${NC}"
echo ""
echo "Basescan: https://basescan.org/address/$SEVEN_ELEVEN_ADDR"
echo ""

print_divider
echo -e "${YELLOW}NEXT STEPS (Required before going live):${NC}"
echo ""
echo "1. Fund entropy (for VRF fees):"
echo "   cast send $SEVEN_ELEVEN_ADDR \"depositEntropyFunds()\" --value 0.1ether --rpc-url \$BASE_RPC_URL --private-key \$PRIVATE_KEY"
echo ""
echo "2. Fund payout reserves (MFER, BNKR, DRB):"
echo "   - Acquire tokens via DEX"
echo "   - Approve each token to contract"
echo "   - Call depositPayoutReserves(token, amount)"
echo ""
echo "   Example for MFER:"
echo "   cast send 0xE3086852A4B125803C815a158249ae468A3254Ca \"approve(address,uint256)\" $SEVEN_ELEVEN_ADDR 1000000000000000000000000 --rpc-url \$BASE_RPC_URL --private-key \$PRIVATE_KEY"
echo "   cast send $SEVEN_ELEVEN_ADDR \"depositPayoutReserves(address,uint256)\" 0xE3086852A4B125803C815a158249ae468A3254Ca 1000000000000000000000000 --rpc-url \$BASE_RPC_URL --private-key \$PRIVATE_KEY"
echo ""
echo "3. Commit and deploy frontend with new contract address"
echo ""
echo "4. Test with small deposit before announcing!"
print_divider
