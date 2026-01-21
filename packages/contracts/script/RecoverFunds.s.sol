// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title RecoverFundsScript
 * @notice Recover USDC from old contract deployments and deposit to new v4 contract
 * @dev Run with: forge script script/RecoverFunds.s.sol:RecoverFundsScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 */
contract RecoverFundsScript is Script {
    // Old contract addresses
    address constant V1 = 0x47B4D16952f8ebF6D853fe323Cd0159134F073c4;
    address constant V3 = 0x0e61CFAB40F4e687DDCf67c973bBF091b3fCcBc5;
    address constant V4 = 0x28517224C8F57E971F43BC4cdFa57539F90EC83A;

    // New v5 contract
    address constant V5 = 0x7a20F264Db2b998F228C95aB81eEB99642fA642B;

    // USDC on Base Sepolia
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Recovering Funds from Old Contracts ===");
        console.log("Deployer:", deployer);

        // Check house liquidity (not token balance - some might be player deposits)
        uint256 v1Liquidity = SevenEleven(payable(V1)).houseLiquidity(USDC);
        uint256 v3Liquidity = SevenEleven(payable(V3)).houseLiquidity(USDC);
        uint256 v4Liquidity = SevenEleven(payable(V4)).houseLiquidity(USDC);
        uint256 deployerBalanceBefore = IERC20(USDC).balanceOf(deployer);

        console.log("");
        console.log("V1 house liquidity:", v1Liquidity);
        console.log("V3 house liquidity:", v3Liquidity);
        console.log("V4 house liquidity:", v4Liquidity);
        console.log("Deployer USDC balance:", deployerBalanceBefore);

        vm.startBroadcast(deployerPrivateKey);

        // Withdraw from V1 if it has house liquidity
        if (v1Liquidity > 0) {
            console.log("");
            console.log("Withdrawing from V1...");
            SevenEleven(payable(V1)).withdrawHouseLiquidity(USDC, v1Liquidity);
            console.log("Withdrew", v1Liquidity, "from V1");
        }

        // Withdraw from V3 if it has house liquidity
        if (v3Liquidity > 0) {
            console.log("");
            console.log("Withdrawing from V3...");
            SevenEleven(payable(V3)).withdrawHouseLiquidity(USDC, v3Liquidity);
            console.log("Withdrew", v3Liquidity, "from V3");
        }

        // Withdraw from V4 if it has house liquidity
        if (v4Liquidity > 0) {
            console.log("");
            console.log("Withdrawing from V4...");
            SevenEleven(payable(V4)).withdrawHouseLiquidity(USDC, v4Liquidity);
            console.log("Withdrew", v4Liquidity, "from V4");
        }

        // Calculate total recovered
        uint256 totalRecovered = v1Liquidity + v3Liquidity + v4Liquidity;
        console.log("");
        console.log("Total recovered:", totalRecovered);

        // Deposit to V5 if we recovered anything
        if (totalRecovered > 0) {
            console.log("");
            console.log("Depositing to V5...");
            IERC20(USDC).approve(V5, totalRecovered);
            SevenEleven(payable(V5)).depositHouseLiquidity(USDC, totalRecovered);
            console.log("Deposited", totalRecovered, "to V5");
        }

        vm.stopBroadcast();

        // Verify final balance
        uint256 v5Balance = IERC20(USDC).balanceOf(V5);
        console.log("");
        console.log("=== Recovery Complete ===");
        console.log("V5 USDC balance:", v5Balance);
    }
}

/**
 * @title FundEntropyScript
 * @notice Deposit ETH to v4 contract for Pyth Entropy fees
 * @dev Run with: forge script script/RecoverFunds.s.sol:FundEntropyScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 */
contract FundEntropyScript is Script {
    address constant V5 = 0x7a20F264Db2b998F228C95aB81eEB99642fA642B;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Amount to deposit (0.01 ETH should cover many rolls)
        uint256 amount = 0.01 ether;

        console.log("=== Funding Entropy Balance ===");
        console.log("Deployer:", deployer);
        console.log("Deployer ETH balance:", deployer.balance);
        console.log("Amount to deposit:", amount);

        vm.startBroadcast(deployerPrivateKey);

        // Deposit ETH to contract for entropy fees
        SevenEleven(payable(V5)).depositEntropyFunds{value: amount}();

        vm.stopBroadcast();

        console.log("");
        console.log("=== Funding Complete ===");
        console.log("V5 entropy balance:", V5.balance);
    }
}
