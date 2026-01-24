// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title RecoverStuckFundsScript
 * @notice Recover ETH and USDC from old SevenEleven contracts that weren't migrated
 * @dev Run with: forge script script/RecoverStuckFunds.s.sol:RecoverStuckFundsScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 */
contract RecoverStuckFundsScript is Script {
    // Old contracts with stuck funds (found from on-chain analysis)
    address constant OLD_CONTRACT_1 = 0x30E2718308e762aa3Dc408842d8ae6fdA038892D;
    address constant OLD_CONTRACT_2 = 0x9cc0EE4EAfCAA825c52353CDF8C96C51d772e20a; // Has USDC

    // USDC on Base Sepolia
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address currentContract = vm.envAddress("SEVEN_ELEVEN_ADDRESS");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Recovering Stuck Funds ===");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        uint256 totalEth = 0;
        uint256 totalUsdc = 0;

        // Recover ETH from OLD_CONTRACT_1
        uint256 ethBal1 = OLD_CONTRACT_1.balance;
        if (ethBal1 > 0) {
            console.log("Recovering ETH from:", OLD_CONTRACT_1);
            console.log("  ETH:", ethBal1);
            SevenEleven(payable(OLD_CONTRACT_1)).withdrawEntropyFunds(ethBal1);
            totalEth += ethBal1;
        }

        // Recover ETH and USDC from OLD_CONTRACT_2
        uint256 ethBal2 = OLD_CONTRACT_2.balance;
        if (ethBal2 > 0) {
            console.log("Recovering ETH from:", OLD_CONTRACT_2);
            console.log("  ETH:", ethBal2);
            SevenEleven(payable(OLD_CONTRACT_2)).withdrawEntropyFunds(ethBal2);
            totalEth += ethBal2;
        }

        uint256 usdcBal2 = SevenEleven(payable(OLD_CONTRACT_2)).houseLiquidity(USDC);
        if (usdcBal2 > 0) {
            console.log("Recovering USDC from:", OLD_CONTRACT_2);
            console.log("  USDC:", usdcBal2);
            SevenEleven(payable(OLD_CONTRACT_2)).withdrawHouseLiquidity(USDC, usdcBal2);
            totalUsdc += usdcBal2;
        }

        // Deposit ETH to current contract
        if (totalEth > 0) {
            console.log("");
            console.log("Depositing ETH to current contract:", currentContract);
            console.log("  ETH:", totalEth);
            SevenEleven(payable(currentContract)).depositEntropyFunds{value: totalEth}();
        }

        // Deposit USDC to current contract as house liquidity
        if (totalUsdc > 0) {
            console.log("");
            console.log("Depositing USDC to current contract:", currentContract);
            console.log("  USDC:", totalUsdc);
            IERC20(USDC).approve(currentContract, totalUsdc);
            SevenEleven(payable(currentContract)).depositHouseLiquidity(USDC, totalUsdc);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== Recovery Complete ===");
        console.log("Current contract ETH:", currentContract.balance);
        console.log("Current contract USDC liquidity:", SevenEleven(payable(currentContract)).houseLiquidity(USDC));
    }
}
