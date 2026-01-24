// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";
import {MockMemeToken} from "../src/mocks/MockMemeToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployTestnetV2Script
 * @notice Deploy SevenEleven V2 to Base Sepolia with mock meme tokens
 * @dev Run with: forge script script/DeployTestnetV2.s.sol:DeployTestnetV2Script --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 *
 * V2 Economics:
 * - Bet: $0.40 (USDC or WETH only)
 * - Min deposit: $4.00
 * - Win 7/11: 1.5x payout
 * - Win Doubles: 3x payout
 * - Loss: $0.02 DRB to Grok wallet
 * - Payouts: 1/3 MFER, 1/3 BNKR, 1/3 DRB
 */
contract DeployTestnetV2Script is Script {
    // Base Sepolia addresses
    address constant PYTH_ENTROPY_BASE_SEPOLIA = 0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c;
    address constant ETH_USD_FEED_SEPOLIA = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;
    address constant WETH_SEPOLIA = 0x4200000000000000000000000000000000000006;
    address constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // Testnet Grok wallet (set this to your desired testnet address)
    // For testing, you can use any address you control
    address constant GROK_WALLET_TESTNET = 0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9; // Using drb.eth for testnet

    // Initial payout reserve amounts (1 million tokens each)
    uint256 constant INITIAL_RESERVE = 1_000_000 * 1e18;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== SevenEleven V2 Base Sepolia Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy mock meme tokens
        console.log("");
        console.log("Deploying mock meme tokens...");

        MockMemeToken mockMFER = new MockMemeToken("Mock MFER", "mMFER", 18);
        console.log("MockMFER deployed:", address(mockMFER));

        MockMemeToken mockBNKR = new MockMemeToken("Mock BNKR", "mBNKR", 18);
        console.log("MockBNKR deployed:", address(mockBNKR));

        MockMemeToken mockDRB = new MockMemeToken("Mock DRB", "mDRB", 18);
        console.log("MockDRB deployed:", address(mockDRB));

        // 2. Deploy SevenEleven V2
        console.log("");
        console.log("Deploying SevenEleven V2...");

        SevenEleven sevenEleven = new SevenEleven(
            PYTH_ENTROPY_BASE_SEPOLIA,
            ETH_USD_FEED_SEPOLIA,
            WETH_SEPOLIA,
            USDC_SEPOLIA,
            address(mockMFER),
            address(mockBNKR),
            address(mockDRB),
            GROK_WALLET_TESTNET
        );

        console.log("SevenEleven V2 deployed:", address(sevenEleven));

        // 3. Configure deposit tokens
        console.log("");
        console.log("Configuring deposit tokens...");

        sevenEleven.addWeth();
        console.log("Added WETH:", WETH_SEPOLIA);

        sevenEleven.addStablecoin(USDC_SEPOLIA);
        console.log("Added USDC:", USDC_SEPOLIA);

        // 4. Mark mock tokens for 1:1 pricing
        console.log("");
        console.log("Setting mock token pricing...");

        sevenEleven.setMockToken(address(mockMFER), true);
        sevenEleven.setMockToken(address(mockBNKR), true);
        sevenEleven.setMockToken(address(mockDRB), true);
        console.log("Mock tokens marked for simplified pricing");

        // 5. Mint and deposit payout reserves
        console.log("");
        console.log("Setting up payout reserves...");

        // Mint tokens
        mockMFER.mint(deployer, INITIAL_RESERVE);
        mockBNKR.mint(deployer, INITIAL_RESERVE);
        mockDRB.mint(deployer, INITIAL_RESERVE);
        console.log("Minted 1M of each mock token");

        // Approve and deposit to payout reserves
        mockMFER.approve(address(sevenEleven), INITIAL_RESERVE);
        mockBNKR.approve(address(sevenEleven), INITIAL_RESERVE);
        mockDRB.approve(address(sevenEleven), INITIAL_RESERVE);

        sevenEleven.depositPayoutReserves(address(mockMFER), INITIAL_RESERVE);
        sevenEleven.depositPayoutReserves(address(mockBNKR), INITIAL_RESERVE);
        sevenEleven.depositPayoutReserves(address(mockDRB), INITIAL_RESERVE);
        console.log("Deposited 1M of each token to payout reserves");

        vm.stopBroadcast();

        // Print deployment summary
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  SevenEleven V2:", address(sevenEleven));
        console.log("  MockMFER:", address(mockMFER));
        console.log("  MockBNKR:", address(mockBNKR));
        console.log("  MockDRB:", address(mockDRB));
        console.log("");
        console.log("Configuration:");
        console.log("  Deposit tokens: USDC, WETH");
        console.log("  Payout tokens: mMFER, mBNKR, mDRB");
        console.log("  Grok wallet:", GROK_WALLET_TESTNET);
        console.log("");
        console.log("Game Rules:");
        console.log("  Bet: $0.40 per roll");
        console.log("  Min deposit: $4.00");
        console.log("  Win 7/11: 1.5x payout");
        console.log("  Win Doubles: 3x payout");
        console.log("  Loss: House takes bet, $0.02 DRB to Grok");
        console.log("");
        console.log("Next steps:");
        console.log("1. Update contracts.ts with new addresses");
        console.log("2. Fund contract with ETH: FundEntropyScript");
        console.log("3. Get testnet USDC from https://faucet.circle.com/");
        console.log("4. Test the game!");
    }
}

/**
 * @title FundEntropyScript
 * @notice Fund the SevenEleven contract with ETH for Pyth entropy fees
 * @dev Run with: SEVEN_ELEVEN_ADDRESS=0x... forge script script/DeployTestnetV2.s.sol:FundEntropyScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 */
contract FundEntropyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address sevenElevenAddress = vm.envAddress("SEVEN_ELEVEN_ADDRESS");

        // Fund with 0.01 ETH for entropy fees
        uint256 amount = 0.01 ether;

        console.log("=== Funding Entropy Fees ===");
        console.log("SevenEleven:", sevenElevenAddress);
        console.log("Amount: 0.01 ETH");

        vm.startBroadcast(deployerPrivateKey);

        SevenEleven(payable(sevenElevenAddress)).depositEntropyFunds{value: amount}();
        console.log("Funded with ETH");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Funding Complete ===");
        console.log("Contract ETH balance:", sevenElevenAddress.balance);
    }
}

/**
 * @title AddMoreReservesScript
 * @notice Mint and add more payout reserves for testing
 * @dev Run with: forge script script/DeployTestnetV2.s.sol:AddMoreReservesScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 */
contract AddMoreReservesScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address sevenElevenAddress = vm.envAddress("SEVEN_ELEVEN_ADDRESS");
        address mockMferAddress = vm.envAddress("MOCK_MFER_ADDRESS");
        address mockBnkrAddress = vm.envAddress("MOCK_BNKR_ADDRESS");
        address mockDrbAddress = vm.envAddress("MOCK_DRB_ADDRESS");

        uint256 amount = 1_000_000 * 1e18;

        console.log("=== Adding More Reserves ===");

        vm.startBroadcast(deployerPrivateKey);

        MockMemeToken(mockMferAddress).mint(msg.sender, amount);
        MockMemeToken(mockBnkrAddress).mint(msg.sender, amount);
        MockMemeToken(mockDrbAddress).mint(msg.sender, amount);

        IERC20(mockMferAddress).approve(sevenElevenAddress, amount);
        IERC20(mockBnkrAddress).approve(sevenElevenAddress, amount);
        IERC20(mockDrbAddress).approve(sevenElevenAddress, amount);

        SevenEleven(payable(sevenElevenAddress)).depositPayoutReserves(mockMferAddress, amount);
        SevenEleven(payable(sevenElevenAddress)).depositPayoutReserves(mockBnkrAddress, amount);
        SevenEleven(payable(sevenElevenAddress)).depositPayoutReserves(mockDrbAddress, amount);

        vm.stopBroadcast();

        console.log("Added 1M more of each token to reserves");
    }
}
