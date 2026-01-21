// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployTestnetScript
 * @notice Deploy SevenEleven to Base Sepolia testnet with USDC support
 * @dev Run with: forge script script/DeployTestnet.s.sol:DeployTestnetScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 */
contract DeployTestnetScript is Script {
    // Base Sepolia addresses
    address constant PYTH_ENTROPY_BASE_SEPOLIA = 0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c;
    address constant ETH_USD_FEED_SEPOLIA = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;
    address constant WETH_SEPOLIA = 0x4200000000000000000000000000000000000006;

    // Circle USDC on Base Sepolia
    address constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    // Uniswap V3 USDC/WETH pool (0.3% fee)
    address constant USDC_WETH_POOL_SEPOLIA = 0x46880b404CD35c165EDdefF7421019F8dD25F4Ad;

    // Fee recipient (your address for testnet)
    address constant FEE_RECIPIENT = 0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9; // drb.eth

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Base Sepolia Testnet Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy SevenEleven contract
        SevenEleven sevenEleven = new SevenEleven(
            PYTH_ENTROPY_BASE_SEPOLIA,
            FEE_RECIPIENT,
            ETH_USD_FEED_SEPOLIA,
            WETH_SEPOLIA
        );

        console.log("");
        console.log("SevenEleven deployed at:", address(sevenEleven));
        console.log("");

        // 2. Add WETH as supported token (works without pool, 1:1 with ETH)
        sevenEleven.addWeth();
        console.log("Added WETH token:", WETH_SEPOLIA);

        // 3. Add USDC as stablecoin (1 USDC = $1, no oracle needed)
        sevenEleven.addStablecoin(USDC_SEPOLIA);
        console.log("Added USDC stablecoin:", USDC_SEPOLIA);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("");
        console.log("Contract address:");
        console.log(address(sevenEleven));
        console.log("");
        console.log("Next steps:");
        console.log("1. Update SEVEN_ELEVEN_ADDRESS_BY_CHAIN[84532] in apps/web/src/lib/contracts.ts");
        console.log("2. Get testnet USDC from https://faucet.circle.com/");
        console.log("3. Run AddHouseLiquidityScript to deposit house liquidity");
        console.log("4. Start the web app and test!");
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
