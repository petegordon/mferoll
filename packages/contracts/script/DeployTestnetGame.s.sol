// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";
import {MockMemeToken} from "../src/mocks/MockMemeToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployTestnetGameScript
 * @notice Deploy SevenEleven V2 game contract to Base Sepolia (uses existing meme tokens)
 * @dev Run with: forge script script/DeployTestnetGame.s.sol:DeployTestnetGameScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 *
 * Requires .env:
 *   - MOCK_MFER_ADDRESS
 *   - MOCK_BNKR_ADDRESS
 *   - MOCK_DRB_ADDRESS
 *
 * V2 Economics:
 * - Bet: $0.40 (USDC or WETH only)
 * - Min deposit: $4.00
 * - Win 7/11: Bet returned + 0.5x profit in meme coins
 * - Win Doubles: Bet returned + 2x profit in meme coins
 * - Loss: House keeps bet, $0.02 MFER to Grok wallet
 * - Payouts: 1/3 MFER, 1/3 BNKR, 1/3 DRB
 */
contract DeployTestnetGameScript is Script {
    // Base Sepolia addresses
    address constant PYTH_ENTROPY_BASE_SEPOLIA = 0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c;
    address constant ETH_USD_FEED_SEPOLIA = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;
    address constant WETH_SEPOLIA = 0x4200000000000000000000000000000000000006;
    address constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // Testnet Grok wallet
    address constant GROK_WALLET_TESTNET = 0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9;

    // Initial payout reserve amounts (1 million tokens each)
    uint256 constant INITIAL_RESERVE = 1_000_000 * 1e18;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Get meme token addresses from environment
        address mockMferAddress = vm.envAddress("MOCK_MFER_ADDRESS");
        address mockBnkrAddress = vm.envAddress("MOCK_BNKR_ADDRESS");
        address mockDrbAddress = vm.envAddress("MOCK_DRB_ADDRESS");

        console.log("=== SevenEleven V2 Game Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);
        console.log("");
        console.log("Using existing meme tokens:");
        console.log("  MFER:", mockMferAddress);
        console.log("  BNKR:", mockBnkrAddress);
        console.log("  DRB:", mockDrbAddress);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy SevenEleven V2
        console.log("");
        console.log("Deploying SevenEleven V2...");

        SevenEleven sevenEleven = new SevenEleven(
            PYTH_ENTROPY_BASE_SEPOLIA,
            ETH_USD_FEED_SEPOLIA,
            WETH_SEPOLIA,
            USDC_SEPOLIA,
            mockMferAddress,
            mockBnkrAddress,
            mockDrbAddress,
            GROK_WALLET_TESTNET
        );

        console.log("SevenEleven V2 deployed:", address(sevenEleven));

        // 2. Configure deposit tokens
        console.log("");
        console.log("Configuring deposit tokens...");

        sevenEleven.addWeth();
        console.log("Added WETH:", WETH_SEPOLIA);

        sevenEleven.addStablecoin(USDC_SEPOLIA);
        console.log("Added USDC:", USDC_SEPOLIA);

        // 3. Mark mock tokens for 1:1 pricing
        console.log("");
        console.log("Setting mock token pricing...");

        sevenEleven.setMockToken(mockMferAddress, true);
        sevenEleven.setMockToken(mockBnkrAddress, true);
        sevenEleven.setMockToken(mockDrbAddress, true);
        console.log("Mock tokens marked for simplified pricing");

        // 4. Mint and deposit payout reserves
        console.log("");
        console.log("Setting up payout reserves...");

        // Mint tokens
        MockMemeToken(mockMferAddress).mint(deployer, INITIAL_RESERVE);
        MockMemeToken(mockBnkrAddress).mint(deployer, INITIAL_RESERVE);
        MockMemeToken(mockDrbAddress).mint(deployer, INITIAL_RESERVE);
        console.log("Minted 1M of each mock token");

        // Approve and deposit to payout reserves
        IERC20(mockMferAddress).approve(address(sevenEleven), INITIAL_RESERVE);
        IERC20(mockBnkrAddress).approve(address(sevenEleven), INITIAL_RESERVE);
        IERC20(mockDrbAddress).approve(address(sevenEleven), INITIAL_RESERVE);

        sevenEleven.depositPayoutReserves(mockMferAddress, INITIAL_RESERVE);
        sevenEleven.depositPayoutReserves(mockBnkrAddress, INITIAL_RESERVE);
        sevenEleven.depositPayoutReserves(mockDrbAddress, INITIAL_RESERVE);
        console.log("Deposited 1M of each token to payout reserves");

        vm.stopBroadcast();

        // Print deployment summary
        console.log("");
        console.log("=== Game Deployment Complete ===");
        console.log("");
        console.log("Contract Address:");
        console.log("  SevenEleven V2:", address(sevenEleven));
        console.log("");
        console.log("Configuration:");
        console.log("  Deposit tokens: USDC, WETH");
        console.log("  Payout tokens: mMFER, mBNKR, mDRB");
        console.log("  Grok wallet:", GROK_WALLET_TESTNET);
        console.log("");
        console.log("Game Rules:");
        console.log("  Bet: $0.40 per roll");
        console.log("  Min deposit: $4.00");
        console.log("  Win 7/11: Bet returned + 0.5x profit");
        console.log("  Win Doubles: Bet returned + 2x profit");
        console.log("  Loss: House takes bet, $0.02 MFER to Grok");
        console.log("");
        console.log("Next steps:");
        console.log("1. Update contracts.ts with new SevenEleven address");
        console.log("2. Fund contract with ETH: FundEntropyScript");
        console.log("3. Get testnet USDC from https://faucet.circle.com/");
        console.log("4. Test the game!");
    }
}
