#!/bin/bash

# Install Foundry dependencies
echo "Installing Foundry dependencies..."

# Install forge-std
forge install foundry-rs/forge-std --no-commit

# Install OpenZeppelin contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# Install Chainlink contracts
forge install smartcontractkit/chainlink --no-commit

echo "Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and fill in your values"
echo "2. Run 'forge build' to compile contracts"
echo "3. Run 'forge test' to run tests"
