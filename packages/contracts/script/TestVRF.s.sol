// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CheckVRFScript
 * @notice Check VRF setup and contract state
 * @dev Run with: forge script script/TestVRF.s.sol:CheckVRFScript --rpc-url $BASE_SEPOLIA_RPC_URL -vvvv
 */
contract CheckVRFScript is Script {
    address constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external view {
        address sevenElevenAddress = vm.envAddress("SEVEN_ELEVEN_ADDRESS");
        SevenEleven game = SevenEleven(payable(sevenElevenAddress));

        console.log("=== VRF Diagnostic Check ===");
        console.log("");

        // 1. Check contract ETH balance (needed for entropy fees)
        uint256 contractBalance = sevenElevenAddress.balance;
        console.log("Contract ETH balance:", contractBalance);

        // 2. Check entropy fee
        uint256 entropyFee = game.getEntropyFee();
        console.log("Pyth Entropy fee:", entropyFee);

        // 3. Check if contract has enough ETH
        if (contractBalance >= entropyFee) {
            console.log("STATUS: Contract has enough ETH for VRF");
        } else {
            console.log("ERROR: Contract needs more ETH for VRF!");
            console.log("  Needed:", entropyFee);
            console.log("  Has:", contractBalance);
            console.log("  Shortfall:", entropyFee - contractBalance);
        }

        // 4. Check house liquidity
        uint256 houseLiquidity = game.houseLiquidity(USDC_SEPOLIA);
        console.log("House USDC liquidity:", houseLiquidity);

        // 5. Check bet amount
        uint256 betAmount = game.getBetAmount(USDC_SEPOLIA);
        console.log("Bet amount (USDC):", betAmount);

        // 6. Check min deposit
        uint256 minDeposit = game.getMinDeposit(USDC_SEPOLIA);
        console.log("Min deposit (USDC):", minDeposit);

        console.log("");
        console.log("=== Pyth Entropy Contract ===");
        console.log("Entropy address:", address(game.entropy()));

        console.log("");
        console.log("=== Summary ===");
        if (contractBalance >= entropyFee && houseLiquidity > 0) {
            console.log("VRF should be working! Contract is ready.");
        } else if (contractBalance < entropyFee) {
            console.log("PROBLEM: Need to deposit ETH for entropy fees");
            console.log("Run: cast send", sevenElevenAddress, "--value 0.01ether");
        } else if (houseLiquidity == 0) {
            console.log("PROBLEM: No house liquidity");
        }
    }
}

/**
 * @title DepositEntropyFunds
 * @notice Deposit ETH for Pyth Entropy fees
 * @dev Run with: forge script script/TestVRF.s.sol:DepositEntropyFunds --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 */
contract DepositEntropyFunds is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address sevenElevenAddress = vm.envAddress("SEVEN_ELEVEN_ADDRESS");

        console.log("=== Depositing ETH for Entropy Fees ===");
        console.log("Contract:", sevenElevenAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Deposit 0.01 ETH for entropy fees
        SevenEleven(payable(sevenElevenAddress)).depositEntropyFunds{value: 0.01 ether}();

        vm.stopBroadcast();

        console.log("Deposited 0.01 ETH for entropy fees");
        console.log("New balance:", sevenElevenAddress.balance);
    }
}

/**
 * @title TestRollScript
 * @notice Test a roll with the VRF
 * @dev Run with: forge script script/TestVRF.s.sol:TestRollScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast -vvvv
 */
contract TestRollScript is Script {
    address constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address sevenElevenAddress = vm.envAddress("SEVEN_ELEVEN_ADDRESS");
        SevenEleven game = SevenEleven(payable(sevenElevenAddress));

        console.log("=== Test Roll ===");
        console.log("Player:", deployer);
        console.log("Contract:", sevenElevenAddress);

        // Check player balance
        uint256 playerBalance = game.playerBalances(deployer, USDC_SEPOLIA);
        console.log("Player game balance:", playerBalance);

        uint256 betAmount = game.getBetAmount(USDC_SEPOLIA);
        console.log("Bet amount:", betAmount);

        if (playerBalance < betAmount) {
            console.log("ERROR: Insufficient game balance. Deposit first!");
            console.log("Need:", betAmount);
            console.log("Have:", playerBalance);
            return;
        }

        // Check contract ETH for entropy
        uint256 entropyFee = game.getEntropyFee();
        if (sevenElevenAddress.balance < entropyFee) {
            console.log("ERROR: Contract needs ETH for entropy fees!");
            return;
        }

        console.log("");
        console.log("Calling roll()...");

        vm.startBroadcast(deployerPrivateKey);

        uint64 sequenceNumber = game.roll(USDC_SEPOLIA);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Roll Submitted ===");
        console.log("Sequence number:", sequenceNumber);
        console.log("");
        console.log("The VRF callback should happen within 30-60 seconds.");
        console.log("Watch for RollSettled event with sequence number:", sequenceNumber);
        console.log("");
        console.log("To check pending roll:");
        console.log("  cast call", sevenElevenAddress, '"pendingRolls(uint64)"', sequenceNumber);
    }
}
