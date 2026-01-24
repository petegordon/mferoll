#!/bin/bash
# Deploy SevenEleven V2 to Base Sepolia testnet with fund migration
# Usage: ./deploy-testnet.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Lock file to prevent concurrent runs
LOCK_FILE=".deploy-testnet.lock"

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

print_warn() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}  ✗ Error: $1${NC}"
}

print_divider() {
    echo -e "${BLUE}──────────────────────────────────────────────────────────────${NC}"
}

cleanup() {
    rm -f "$LOCK_FILE"
}

# Set up cleanup on exit
trap cleanup EXIT

# Check for concurrent runs
if [ -f "$LOCK_FILE" ]; then
    LOCK_PID=$(cat "$LOCK_FILE")
    if ps -p "$LOCK_PID" > /dev/null 2>&1; then
        print_error "Another deployment is already running (PID: $LOCK_PID)"
        print_info "If this is incorrect, delete $LOCK_FILE and try again"
        exit 1
    else
        print_warn "Stale lock file found, removing..."
        rm -f "$LOCK_FILE"
    fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"

# Load environment variables fresh (not cached)
set -a
source .env
set +a

print_header "SevenEleven V2 Testnet Deployment"

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
# Step 1: Scan for ALL contracts with funds (not just .env)
# ═══════════════════════════════════════════════════════════════
print_divider
print_step "1" "Scan for contracts with funds"

USDC_ADDR="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
WETH_ADDR="0x4200000000000000000000000000000000000006"

# Collect all SevenEleven addresses from broadcasts
print_info "Scanning broadcast history for SevenEleven contracts..."

CONTRACTS_WITH_FUNDS=""
TOTAL_USDC=0
TOTAL_WETH=0
TOTAL_ETH=0

# Get unique SevenEleven addresses from all broadcast files
ALL_CONTRACTS=$(grep -rh '"contractName": "SevenEleven"' broadcast/ 2>/dev/null | \
    grep -A1 "SevenEleven" | grep "contractAddress" | \
    grep -o '0x[a-fA-F0-9]\{40\}' | sort -u || echo "")

# Also add current .env contract if set
if [ -n "$SEVEN_ELEVEN_ADDRESS" ]; then
    ALL_CONTRACTS="$SEVEN_ELEVEN_ADDRESS
$ALL_CONTRACTS"
fi

# Remove duplicates
ALL_CONTRACTS=$(echo "$ALL_CONTRACTS" | sort -u | grep -v '^$')

CONTRACT_COUNT=$(echo "$ALL_CONTRACTS" | grep -c '0x' || echo "0")
print_info "Found $CONTRACT_COUNT SevenEleven contracts in history"
echo ""

# Check each contract for funds
for CONTRACT in $ALL_CONTRACTS; do
    # Skip if empty
    [ -z "$CONTRACT" ] && continue

    # Get balances (handle both checksummed and non-checksummed addresses)
    USDC_BAL=$(cast call "$CONTRACT" "houseLiquidity(address)(uint256)" "$USDC_ADDR" --rpc-url "$BASE_SEPOLIA_RPC_URL" 2>/dev/null || echo "0")
    WETH_BAL=$(cast call "$CONTRACT" "houseLiquidity(address)(uint256)" "$WETH_ADDR" --rpc-url "$BASE_SEPOLIA_RPC_URL" 2>/dev/null || echo "0")
    ETH_BAL=$(cast balance "$CONTRACT" --rpc-url "$BASE_SEPOLIA_RPC_URL" 2>/dev/null || echo "0")

    # Check if any balance is non-zero
    HAS_BALANCE=false
    if [ "$USDC_BAL" != "0" ] && [ -n "$USDC_BAL" ]; then
        HAS_BALANCE=true
        TOTAL_USDC=$((TOTAL_USDC + USDC_BAL))
    fi
    if [ "$WETH_BAL" != "0" ] && [ -n "$WETH_BAL" ]; then
        HAS_BALANCE=true
        TOTAL_WETH=$((TOTAL_WETH + WETH_BAL))
    fi
    if [ "$ETH_BAL" != "0" ] && [ -n "$ETH_BAL" ]; then
        HAS_BALANCE=true
        TOTAL_ETH=$((TOTAL_ETH + ETH_BAL))
    fi

    if [ "$HAS_BALANCE" = true ]; then
        CONTRACTS_WITH_FUNDS="$CONTRACTS_WITH_FUNDS $CONTRACT"

        # Format for display
        USDC_DISP=$(echo "scale=6; $USDC_BAL / 1000000" | bc 2>/dev/null || echo "$USDC_BAL")
        WETH_DISP=$(cast --from-wei "$WETH_BAL" 18 2>/dev/null || echo "$WETH_BAL")
        ETH_DISP=$(cast --from-wei "$ETH_BAL" 18 2>/dev/null || echo "$ETH_BAL")

        print_warn "Found funds in: $CONTRACT"
        print_info "    USDC: $USDC_DISP | WETH: $WETH_DISP | ETH: $ETH_DISP"
    fi
done

# Show summary
echo ""
if [ -n "$CONTRACTS_WITH_FUNDS" ]; then
    TOTAL_USDC_DISP=$(echo "scale=6; $TOTAL_USDC / 1000000" | bc 2>/dev/null || echo "$TOTAL_USDC")
    TOTAL_WETH_DISP=$(cast --from-wei "$TOTAL_WETH" 18 2>/dev/null || echo "$TOTAL_WETH")
    TOTAL_ETH_DISP=$(cast --from-wei "$TOTAL_ETH" 18 2>/dev/null || echo "$TOTAL_ETH")

    print_info "Total funds to migrate:"
    print_info "  USDC: $TOTAL_USDC_DISP"
    print_info "  WETH: $TOTAL_WETH_DISP"
    print_info "  ETH:  $TOTAL_ETH_DISP"

    # Store for migration
    export MIGRATE_CONTRACTS="$CONTRACTS_WITH_FUNDS"
    export MIGRATE_USDC_AMOUNT="$TOTAL_USDC"
    export MIGRATE_WETH_AMOUNT="$TOTAL_WETH"
    export MIGRATE_ETH_AMOUNT="$TOTAL_ETH"
else
    print_success "No funds found in any previous contracts"
    export MIGRATE_CONTRACTS=""
    export MIGRATE_USDC_AMOUNT="0"
    export MIGRATE_WETH_AMOUNT="0"
    export MIGRATE_ETH_AMOUNT="0"
fi

# ═══════════════════════════════════════════════════════════════
# Step 2: Withdraw funds from ALL old contracts
# ═══════════════════════════════════════════════════════════════
echo ""
print_divider
print_step "2" "Withdraw funds from old contracts"

if [ -n "$CONTRACTS_WITH_FUNDS" ]; then
    for CONTRACT in $CONTRACTS_WITH_FUNDS; do
        print_info "Withdrawing from $CONTRACT..."

        export OLD_SEVEN_ELEVEN_ADDRESS="$CONTRACT"

        WITHDRAW_OUTPUT=$(forge script script/MigrateV2.s.sol:WithdrawFromOldContractScript \
            --rpc-url "$BASE_SEPOLIA_RPC_URL" \
            --broadcast \
            2>&1)

        if echo "$WITHDRAW_OUTPUT" | grep -q "ONCHAIN EXECUTION COMPLETE"; then
            print_success "Withdrawn from $CONTRACT"
        else
            # Check if it was just empty (not an error)
            if echo "$WITHDRAW_OUTPUT" | grep -q "No funds"; then
                print_info "No funds in $CONTRACT (already empty)"
            else
                echo "$WITHDRAW_OUTPUT"
                print_error "Failed to withdraw from $CONTRACT"
                # Continue anyway - don't fail the whole deployment
            fi
        fi
    done
else
    print_success "No funds to withdraw"
fi

# ═══════════════════════════════════════════════════════════════
# Step 3: Deploy new contracts
# ═══════════════════════════════════════════════════════════════
echo ""
print_divider
print_step "3" "Deploy SevenEleven V2 + Mock Tokens"
print_info "Deploying contracts to Base Sepolia..."
echo ""

DEPLOY_OUTPUT=$(forge script script/DeployTestnetV2.s.sol:DeployTestnetV2Script \
    --rpc-url "$BASE_SEPOLIA_RPC_URL" \
    --broadcast \
    2>&1)

# Extract addresses from output
SEVEN_ELEVEN_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "SevenEleven V2 deployed:" | awk '{print $NF}')
MOCK_MFER_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "MockMFER deployed:" | awk '{print $NF}')
MOCK_BNKR_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "MockBNKR deployed:" | awk '{print $NF}')
MOCK_DRB_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "MockDRB deployed:" | awk '{print $NF}')

if [ -z "$SEVEN_ELEVEN_ADDR" ]; then
    echo "$DEPLOY_OUTPUT"
    print_error "Could not extract SevenEleven address from deployment"
    exit 1
fi

print_success "MockMFER deployed:     $MOCK_MFER_ADDR"
print_success "MockBNKR deployed:     $MOCK_BNKR_ADDR"
print_success "MockDRB deployed:      $MOCK_DRB_ADDR"
print_success "SevenEleven deployed:  $SEVEN_ELEVEN_ADDR"

# ═══════════════════════════════════════════════════════════════
# Step 4: Update .env file
# ═══════════════════════════════════════════════════════════════
echo ""
print_divider
print_step "4" "Update .env configuration"

# Update or add SEVEN_ELEVEN_ADDRESS
if grep -q "^SEVEN_ELEVEN_ADDRESS=" .env; then
    sed -i.bak "s|^SEVEN_ELEVEN_ADDRESS=.*|SEVEN_ELEVEN_ADDRESS=$SEVEN_ELEVEN_ADDR|" .env
else
    echo "SEVEN_ELEVEN_ADDRESS=$SEVEN_ELEVEN_ADDR" >> .env
fi
print_success "SEVEN_ELEVEN_ADDRESS=$SEVEN_ELEVEN_ADDR"

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
# Step 5: Update frontend contracts.ts
# ═══════════════════════════════════════════════════════════════
echo ""
print_divider
print_step "5" "Update frontend contracts.ts"

CONTRACTS_TS="../../apps/web/src/lib/contracts.ts"

if [ -f "$CONTRACTS_TS" ]; then
    # Update SEVEN_ELEVEN_ADDRESS_BY_CHAIN for Base Sepolia (84532)
    sed -i.bak "s|\[CHAIN_ID.BASE_SEPOLIA\]: '0x[a-fA-F0-9]\{40\}' as \`0x\${string}\`,.*// TODO: Deploy V2|\[CHAIN_ID.BASE_SEPOLIA\]: '$SEVEN_ELEVEN_ADDR' as \`0x\${string}\`, // Deployed by script|" "$CONTRACTS_TS"
    sed -i.bak "s|\[CHAIN_ID.BASE_SEPOLIA\]: '0x[a-fA-F0-9]\{40\}' as \`0x\${string}\`,.*// Deployed by script|\[CHAIN_ID.BASE_SEPOLIA\]: '$SEVEN_ELEVEN_ADDR' as \`0x\${string}\`, // Deployed by script|" "$CONTRACTS_TS"

    # Update legacy SEVEN_ELEVEN_ADDRESS export
    sed -i.bak "s|export const SEVEN_ELEVEN_ADDRESS = '0x[a-fA-F0-9]\{40\}' as \`0x\${string}\`;|export const SEVEN_ELEVEN_ADDRESS = '$SEVEN_ELEVEN_ADDR' as \`0x\${string}\`;|" "$CONTRACTS_TS"

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

    # Clean up backup files
    rm -f "$CONTRACTS_TS.bak"

    print_success "Updated SEVEN_ELEVEN_ADDRESS_BY_CHAIN[BASE_SEPOLIA]"
    print_success "Updated TOKEN_ADDRESSES_BY_CHAIN[BASE_SEPOLIA]"
else
    print_warn "contracts.ts not found at $CONTRACTS_TS"
    print_info "Manual update required for frontend"
fi

# ═══════════════════════════════════════════════════════════════
# Step 6: Deposit funds to new contract
# ═══════════════════════════════════════════════════════════════
echo ""
print_divider
print_step "6" "Fund new contract"

export SEVEN_ELEVEN_ADDRESS="$SEVEN_ELEVEN_ADDR"

# Check deployer balances for what we can deposit
DEPLOYER_USDC=$(cast call "$USDC_ADDR" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL" 2>/dev/null || echo "0")
DEPLOYER_WETH=$(cast call "$WETH_ADDR" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL" 2>/dev/null || echo "0")
DEPLOYER_ETH=$(cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL" 2>/dev/null || echo "0")

# Calculate amounts to deposit (use min of migrated amount and available balance)
# For simplicity, just deposit what was migrated (should be in deployer wallet now)
if [ "$MIGRATE_USDC_AMOUNT" != "0" ] || [ "$MIGRATE_WETH_AMOUNT" != "0" ] || [ "$MIGRATE_ETH_AMOUNT" != "0" ]; then
    print_info "Depositing migrated funds to new contract..."
    echo ""

    DEPOSIT_OUTPUT=$(forge script script/MigrateV2.s.sol:DepositToNewContractScript \
        --rpc-url "$BASE_SEPOLIA_RPC_URL" \
        --broadcast \
        2>&1)

    if echo "$DEPOSIT_OUTPUT" | grep -q "ONCHAIN EXECUTION COMPLETE"; then
        TOTAL_USDC_DISP=$(echo "scale=6; $MIGRATE_USDC_AMOUNT / 1000000" | bc 2>/dev/null || echo "$MIGRATE_USDC_AMOUNT")
        TOTAL_WETH_DISP=$(cast --from-wei "$MIGRATE_WETH_AMOUNT" 18 2>/dev/null || echo "$MIGRATE_WETH_AMOUNT")
        TOTAL_ETH_DISP=$(cast --from-wei "$MIGRATE_ETH_AMOUNT" 18 2>/dev/null || echo "$MIGRATE_ETH_AMOUNT")

        [ "$MIGRATE_USDC_AMOUNT" != "0" ] && print_success "Deposited USDC: $TOTAL_USDC_DISP"
        [ "$MIGRATE_WETH_AMOUNT" != "0" ] && print_success "Deposited WETH: $TOTAL_WETH_DISP"
        [ "$MIGRATE_ETH_AMOUNT" != "0" ] && print_success "Deposited ETH:  $TOTAL_ETH_DISP"
    else
        echo "$DEPOSIT_OUTPUT"
        print_warn "Deposit may have partially failed - check balances"
    fi
else
    print_info "No migrated funds, funding entropy with 0.01 ETH..."

    FUND_OUTPUT=$(forge script script/DeployTestnetV2.s.sol:FundEntropyScript \
        --rpc-url "$BASE_SEPOLIA_RPC_URL" \
        --broadcast \
        2>&1)

    if echo "$FUND_OUTPUT" | grep -q "ONCHAIN EXECUTION COMPLETE"; then
        print_success "Funded entropy with 0.01 ETH"
    else
        echo "$FUND_OUTPUT"
        print_error "Failed to fund entropy"
        exit 1
    fi
fi

# ═══════════════════════════════════════════════════════════════
# Step 7: Verify final state
# ═══════════════════════════════════════════════════════════════
echo ""
print_divider
print_step "7" "Verify deployment"

# Check new contract balances
NEW_USDC=$(cast call "$SEVEN_ELEVEN_ADDR" "houseLiquidity(address)(uint256)" "$USDC_ADDR" --rpc-url "$BASE_SEPOLIA_RPC_URL" 2>/dev/null || echo "0")
NEW_WETH=$(cast call "$SEVEN_ELEVEN_ADDR" "houseLiquidity(address)(uint256)" "$WETH_ADDR" --rpc-url "$BASE_SEPOLIA_RPC_URL" 2>/dev/null || echo "0")
NEW_ETH=$(cast balance "$SEVEN_ELEVEN_ADDR" --rpc-url "$BASE_SEPOLIA_RPC_URL" 2>/dev/null || echo "0")

NEW_USDC_DISP=$(echo "scale=6; $NEW_USDC / 1000000" | bc 2>/dev/null || echo "$NEW_USDC")
NEW_WETH_DISP=$(cast --from-wei "$NEW_WETH" 18 2>/dev/null || echo "$NEW_WETH")
NEW_ETH_DISP=$(cast --from-wei "$NEW_ETH" 18 2>/dev/null || echo "$NEW_ETH")

print_info "New contract balances:"
print_info "  USDC liquidity: $NEW_USDC_DISP"
print_info "  WETH liquidity: $NEW_WETH_DISP"
print_info "  ETH (entropy):  $NEW_ETH_DISP"

if [ "$NEW_ETH" = "0" ]; then
    print_warn "Contract has no ETH for entropy fees!"
    print_info "Run: forge script script/DeployTestnetV2.s.sol:FundEntropyScript --rpc-url \$BASE_SEPOLIA_RPC_URL --broadcast"
fi

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════
print_header "Deployment Complete!"

echo -e "${GREEN}Deployed Contracts:${NC}"
print_info "  SevenEleven V2:  $SEVEN_ELEVEN_ADDR"
print_info "  MockMFER:        $MOCK_MFER_ADDR"
print_info "  MockBNKR:        $MOCK_BNKR_ADDR"
print_info "  MockDRB:         $MOCK_DRB_ADDR"
echo ""

if [ -n "$CONTRACTS_WITH_FUNDS" ]; then
    echo -e "${GREEN}Migrated Funds From:${NC}"
    for CONTRACT in $CONTRACTS_WITH_FUNDS; do
        print_info "  $CONTRACT"
    done
    echo ""
fi

echo -e "${YELLOW}Next Steps:${NC}"
print_info "  1. Get testnet USDC: https://faucet.circle.com/"
print_info "  2. Start web app and test!"
echo ""

echo -e "${GREEN}View on BaseScan:${NC}"
print_info "  https://sepolia.basescan.org/address/$SEVEN_ELEVEN_ADDR"
echo ""
