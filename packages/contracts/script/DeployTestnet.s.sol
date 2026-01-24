// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";
import {MockMemeToken} from "../src/mocks/MockMemeToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployTestnetScript
 * @notice Deploy SevenEleven V2 to Base Sepolia testnet with mock meme tokens
 * @dev This is a simplified version - for full deployment, use DeployTestnetV2.s.sol
 */
contract DeployTestnetScript is Script {
    // Base Sepolia addresses
    address constant PYTH_ENTROPY_BASE_SEPOLIA = 0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c;
    address constant ETH_USD_FEED_SEPOLIA = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;
    address constant WETH_SEPOLIA = 0x4200000000000000000000000000000000000006;
    address constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // Grok wallet for testnet (drb.eth)
    address constant GROK_WALLET_TESTNET = 0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9;

    // Initial reserve amount
    uint256 constant INITIAL_RESERVE = 1_000_000 * 1e18;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Base Sepolia Testnet Deployment (V2) ===");
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy mock meme tokens
        MockMemeToken mockMFER = new MockMemeToken("Mock MFER", "mMFER", 18);
        MockMemeToken mockBNKR = new MockMemeToken("Mock BNKR", "mBNKR", 18);
        MockMemeToken mockDRB = new MockMemeToken("Mock DRB", "mDRB", 18);

        console.log("MockMFER:", address(mockMFER));
        console.log("MockBNKR:", address(mockBNKR));
        console.log("MockDRB:", address(mockDRB));

        // 2. Deploy SevenEleven V2
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

        console.log("");
        console.log("SevenEleven V2 deployed at:", address(sevenEleven));

        // 3. Configure deposit tokens
        sevenEleven.addWeth();
        sevenEleven.addStablecoin(USDC_SEPOLIA);
        console.log("Added WETH and USDC as deposit tokens");

        // 4. Mark mock tokens for simplified pricing
        sevenEleven.setMockToken(address(mockMFER), true);
        sevenEleven.setMockToken(address(mockBNKR), true);
        sevenEleven.setMockToken(address(mockDRB), true);
        console.log("Mock tokens configured for 1:1 pricing");

        // 5. Mint and deposit payout reserves
        mockMFER.mint(deployer, INITIAL_RESERVE);
        mockBNKR.mint(deployer, INITIAL_RESERVE);
        mockDRB.mint(deployer, INITIAL_RESERVE);

        mockMFER.approve(address(sevenEleven), INITIAL_RESERVE);
        mockBNKR.approve(address(sevenEleven), INITIAL_RESERVE);
        mockDRB.approve(address(sevenEleven), INITIAL_RESERVE);

        sevenEleven.depositPayoutReserves(address(mockMFER), INITIAL_RESERVE);
        sevenEleven.depositPayoutReserves(address(mockBNKR), INITIAL_RESERVE);
        sevenEleven.depositPayoutReserves(address(mockDRB), INITIAL_RESERVE);
        console.log("Deposited 1M of each mock token to reserves");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Contract address:", address(sevenEleven));
        console.log("");
        console.log("Next steps:");
        console.log("1. Update SEVEN_ELEVEN_ADDRESS_BY_CHAIN[84532] in apps/web/src/lib/contracts.ts");
        console.log("2. Update mock token addresses in TOKEN_ADDRESSES_BY_CHAIN");
        console.log("3. Fund contract with ETH: FundEntropyScript");
        console.log("4. Get testnet USDC from https://faucet.circle.com/");
        console.log("5. Start the web app and test!");
    }
}

/**
 * @title AddHouseLiquidityScript
 * @notice Deposit house liquidity for USDC on testnet
 * @dev Run with: forge script script/DeployTestnet.s.sol:AddHouseLiquidityScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 */
contract AddHouseLiquidityScript is Script {
    address constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address sevenElevenAddress = vm.envAddress("SEVEN_ELEVEN_ADDRESS");

        // Amount to deposit (1000 USDC = 1000 * 10^6)
        uint256 amount = 1000 * 1e6;

        console.log("=== Adding House Liquidity ===");
        console.log("SevenEleven:", sevenElevenAddress);
        console.log("USDC:", USDC_SEPOLIA);
        console.log("Amount: 1000 USDC");

        vm.startBroadcast(deployerPrivateKey);

        // Approve USDC
        IERC20(USDC_SEPOLIA).approve(sevenElevenAddress, amount);
        console.log("Approved USDC");

        // Deposit house liquidity
        SevenEleven(payable(sevenElevenAddress)).depositHouseLiquidity(USDC_SEPOLIA, amount);
        console.log("Deposited house liquidity");

        vm.stopBroadcast();

        console.log("");
        console.log("=== House Liquidity Added ===");
        console.log("The game is ready to accept bets!");
    }
}
