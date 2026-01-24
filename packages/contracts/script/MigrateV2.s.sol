// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title WithdrawFromOldContractScript
 * @notice Withdraw all funds from the old SevenEleven contract before migration
 * @dev Run with: OLD_SEVEN_ELEVEN_ADDRESS=0x... forge script script/MigrateV2.s.sol:WithdrawFromOldContractScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 */
contract WithdrawFromOldContractScript is Script {
    address constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH_SEPOLIA = 0x4200000000000000000000000000000000000006;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address oldContractAddress = vm.envAddress("OLD_SEVEN_ELEVEN_ADDRESS");
        address deployer = vm.addr(deployerPrivateKey);

        SevenEleven oldContract = SevenEleven(payable(oldContractAddress));

        console.log("=== Withdrawing from Old Contract ===");
        console.log("Old contract:", oldContractAddress);
        console.log("Deployer:", deployer);

        // Check balances before
        uint256 usdcLiquidity = oldContract.houseLiquidity(USDC_SEPOLIA);
        uint256 wethLiquidity = oldContract.houseLiquidity(WETH_SEPOLIA);
        uint256 ethBalance = oldContractAddress.balance;

        console.log("");
        console.log("House Liquidity:");
        console.log("  USDC:", usdcLiquidity);
        console.log("  WETH:", wethLiquidity);
        console.log("  ETH (entropy):", ethBalance);

        vm.startBroadcast(deployerPrivateKey);

        // Withdraw USDC house liquidity
        if (usdcLiquidity > 0) {
            oldContract.withdrawHouseLiquidity(USDC_SEPOLIA, usdcLiquidity);
            console.log("Withdrew USDC:", usdcLiquidity);
        }

        // Withdraw WETH house liquidity
        if (wethLiquidity > 0) {
            oldContract.withdrawHouseLiquidity(WETH_SEPOLIA, wethLiquidity);
            console.log("Withdrew WETH:", wethLiquidity);
        }

        // Withdraw ETH (entropy funds)
        if (ethBalance > 0) {
            oldContract.withdrawEntropyFunds(ethBalance);
            console.log("Withdrew ETH:", ethBalance);
        }

        vm.stopBroadcast();

        // Log final balances
        console.log("");
        console.log("Deployer balances after withdrawal:");
        console.log("  USDC:", IERC20(USDC_SEPOLIA).balanceOf(deployer));
        console.log("  WETH:", IERC20(WETH_SEPOLIA).balanceOf(deployer));
        console.log("  ETH:", deployer.balance);
    }
}

/**
 * @title DepositToNewContractScript
 * @notice Deposit funds to the new SevenEleven contract after deployment
 * @dev Run with: forge script script/MigrateV2.s.sol:DepositToNewContractScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 */
contract DepositToNewContractScript is Script {
    address constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH_SEPOLIA = 0x4200000000000000000000000000000000000006;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address newContractAddress = vm.envAddress("SEVEN_ELEVEN_ADDRESS");
        address deployer = vm.addr(deployerPrivateKey);

        // Get amounts to deposit from env (set by bash script)
        uint256 usdcAmount = vm.envOr("MIGRATE_USDC_AMOUNT", uint256(0));
        uint256 wethAmount = vm.envOr("MIGRATE_WETH_AMOUNT", uint256(0));
        uint256 ethAmount = vm.envOr("MIGRATE_ETH_AMOUNT", uint256(0));

        SevenEleven newContract = SevenEleven(payable(newContractAddress));

        console.log("=== Depositing to New Contract ===");
        console.log("New contract:", newContractAddress);
        console.log("Deployer:", deployer);
        console.log("");
        console.log("Amounts to deposit:");
        console.log("  USDC:", usdcAmount);
        console.log("  WETH:", wethAmount);
        console.log("  ETH:", ethAmount);

        vm.startBroadcast(deployerPrivateKey);

        // Deposit USDC as house liquidity
        if (usdcAmount > 0) {
            IERC20(USDC_SEPOLIA).approve(newContractAddress, usdcAmount);
            newContract.depositHouseLiquidity(USDC_SEPOLIA, usdcAmount);
            console.log("Deposited USDC:", usdcAmount);
        }

        // Deposit WETH as house liquidity
        if (wethAmount > 0) {
            IERC20(WETH_SEPOLIA).approve(newContractAddress, wethAmount);
            newContract.depositHouseLiquidity(WETH_SEPOLIA, wethAmount);
            console.log("Deposited WETH:", wethAmount);
        }

        // Deposit ETH for entropy fees
        if (ethAmount > 0) {
            newContract.depositEntropyFunds{value: ethAmount}();
            console.log("Deposited ETH:", ethAmount);
        }

        vm.stopBroadcast();

        // Log new contract balances
        console.log("");
        console.log("New contract balances:");
        console.log("  USDC liquidity:", newContract.houseLiquidity(USDC_SEPOLIA));
        console.log("  WETH liquidity:", newContract.houseLiquidity(WETH_SEPOLIA));
        console.log("  ETH balance:", newContractAddress.balance);
    }
}

/**
 * @title CheckBalancesScript
 * @notice Check balances of a SevenEleven contract
 * @dev Run with: SEVEN_ELEVEN_ADDRESS=0x... forge script script/MigrateV2.s.sol:CheckBalancesScript --rpc-url $BASE_SEPOLIA_RPC_URL
 */
contract CheckBalancesScript is Script {
    address constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH_SEPOLIA = 0x4200000000000000000000000000000000000006;

    function run() external view {
        address contractAddress = vm.envAddress("SEVEN_ELEVEN_ADDRESS");
        SevenEleven sevenEleven = SevenEleven(payable(contractAddress));

        console.log("=== Contract Balances ===");
        console.log("Contract:", contractAddress);
        console.log("");
        console.log("House Liquidity:");
        console.log("  USDC:", sevenEleven.houseLiquidity(USDC_SEPOLIA));
        console.log("  WETH:", sevenEleven.houseLiquidity(WETH_SEPOLIA));
        console.log("");
        console.log("ETH Balance:", contractAddress.balance);
    }
}
