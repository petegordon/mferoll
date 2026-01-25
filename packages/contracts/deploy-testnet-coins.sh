#!/bin/bash
# Deploy mock meme tokens to Base Sepolia testnet
# Usage: ./deploy-testnet-coins.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
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

print_header "Mock Meme Tokens Deployment"

# Check required env vars
if [ -z "$PRIVATE_KEY" ]; then
    print_error "PRIVATE_KEY not set in .env"
    exit 1
fi

if [ -z "$BASE_SEPOLIA_RPC_URL" ]; then
    print_error "BASE_SEPOLIA_RPC_URL not set in .env"
    exit 1
fi

# Get deployer address
DEPLOYER=$(cast wallet address "$PRIVATE_KEY" 2>/dev/null || echo "unknown")
DEPLOYER_BALANCE=$(cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL" --ether 2>/dev/null || echo "0")

print_info "Network:  Base Sepolia"
print_info "Deployer: $DEPLOYER"
print_info "Balance:  $DEPLOYER_BALANCE ETH"
echo ""

# ═══════════════════════════════════════════════════════════════
# Step 1: Deploy mock tokens
# ═══════════════════════════════════════════════════════════════
print_divider
print_step "1" "Deploy Mock Meme Tokens"
print_info "Deploying MFER, BNKR, DRB tokens..."
echo ""

DEPLOY_OUTPUT=$(forge script script/DeployTestnetCoins.s.sol:DeployTestnetCoinsScript \
    --rpc-url "$BASE_SEPOLIA_RPC_URL" \
    --broadcast \
    2>&1)

# Extract addresses from output
MOCK_MFER_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "MockMFER deployed:" | awk '{print $NF}')
MOCK_BNKR_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "MockBNKR deployed:" | awk '{print $NF}')
MOCK_DRB_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "MockDRB deployed:" | awk '{print $NF}')

if [ -z "$MOCK_MFER_ADDR" ]; then
    echo "$DEPLOY_OUTPUT"
    print_error "Could not extract token addresses from deployment"
    exit 1
fi

print_success "MockMFER deployed: $MOCK_MFER_ADDR"
print_success "MockBNKR deployed: $MOCK_BNKR_ADDR"
print_success "MockDRB deployed:  $MOCK_DRB_ADDR"

# ═══════════════════════════════════════════════════════════════
# Step 2: Update .env file
# ═══════════════════════════════════════════════════════════════
echo ""
print_divider
print_step "2" "Update .env configuration"

# Update or add mock token addresses
if grep -q "^MOCK_MFER_ADDRESS=" .env; then
    sed -i.bak "s|^MOCK_MFER_ADDRESS=.*|MOCK_MFER_ADDRESS=$MOCK_MFER_ADDR|" .env
else
    echo "MOCK_MFER_ADDRESS=$MOCK_MFER_ADDR" >> .env
fi
print_success "MOCK_MFER_ADDRESS=$MOCK_MFER_ADDR"

if grep -q "^MOCK_BNKR_ADDRESS=" .env; then
    sed -i.bak "s|^MOCK_BNKR_ADDRESS=.*|MOCK_BNKR_ADDRESS=$MOCK_BNKR_ADDR|" .env
else
    echo "MOCK_BNKR_ADDRESS=$MOCK_BNKR_ADDR" >> .env
fi
print_success "MOCK_BNKR_ADDRESS=$MOCK_BNKR_ADDR"

if grep -q "^MOCK_DRB_ADDRESS=" .env; then
    sed -i.bak "s|^MOCK_DRB_ADDRESS=.*|MOCK_DRB_ADDRESS=$MOCK_DRB_ADDR|" .env
else
    echo "MOCK_DRB_ADDRESS=$MOCK_DRB_ADDR" >> .env
fi
print_success "MOCK_DRB_ADDRESS=$MOCK_DRB_ADDR"

# Clean up backup file
rm -f .env.bak

# ═══════════════════════════════════════════════════════════════
# Step 3: Update frontend contracts.ts
# ═══════════════════════════════════════════════════════════════
echo ""
print_divider
print_step "3" "Update frontend contracts.ts"

CONTRACTS_TS="../../apps/web/src/lib/contracts.ts"

if [ -f "$CONTRACTS_TS" ]; then
    # Use awk to update token addresses in BASE_SEPOLIA section
    awk -v mfer="$MOCK_MFER_ADDR" -v drb="$MOCK_DRB_ADDR" -v bnkr="$MOCK_BNKR_ADDR" '
    /\[CHAIN_ID.BASE_SEPOLIA\]: \{/ { in_sepolia=1 }
    in_sepolia && /MFERCOIN:/ {
        gsub(/0x[a-fA-F0-9]{40}/, mfer)
    }
    in_sepolia && /DRB:/ {
        gsub(/0x[a-fA-F0-9]{40}/, drb)
    }
    in_sepolia && /BANKR:/ {
        gsub(/0x[a-fA-F0-9]{40}/, bnkr)
    }
    in_sepolia && /^\s*\},\s*$/ { in_sepolia=0 }
    { print }
    ' "$CONTRACTS_TS" > "$CONTRACTS_TS.tmp" && mv "$CONTRACTS_TS.tmp" "$CONTRACTS_TS"

    print_success "Updated TOKEN_ADDRESSES_BY_CHAIN[BASE_SEPOLIA]"
else
    print_info "contracts.ts not found at $CONTRACTS_TS"
    print_info "Manual update required for frontend"
fi

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════
print_header "Coins Deployment Complete!"

echo -e "${GREEN}Deployed Tokens:${NC}"
print_info "  MockMFER: $MOCK_MFER_ADDR"
print_info "  MockBNKR: $MOCK_BNKR_ADDR"
print_info "  MockDRB:  $MOCK_DRB_ADDR"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
print_info "  1. Run ./deploy-testnet-game.sh to deploy the game contract"
echo ""

echo -e "${GREEN}View on BaseScan:${NC}"
print_info "  https://sepolia.basescan.org/address/$MOCK_MFER_ADDR"
print_info "  https://sepolia.basescan.org/address/$MOCK_BNKR_ADDR"
print_info "  https://sepolia.basescan.org/address/$MOCK_DRB_ADDR"
echo ""
