// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockMemeToken} from "../src/mocks/MockMemeToken.sol";

/**
 * @title DeployTestnetCoinsScript
 * @notice Deploy mock meme tokens to Base Sepolia
 * @dev Run with: forge script script/DeployTestnetCoins.s.sol:DeployTestnetCoinsScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
 */
contract DeployTestnetCoinsScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Mock Meme Tokens Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock meme tokens
        console.log("");
        console.log("Deploying mock meme tokens...");

        MockMemeToken mockMFER = new MockMemeToken("Mock MFER", "mMFER", 18);
        console.log("MockMFER deployed:", address(mockMFER));

        MockMemeToken mockBNKR = new MockMemeToken("Mock BNKR", "mBNKR", 18);
        console.log("MockBNKR deployed:", address(mockBNKR));

        MockMemeToken mockDRB = new MockMemeToken("Mock DRB", "mDRB", 18);
        console.log("MockDRB deployed:", address(mockDRB));

        vm.stopBroadcast();

        // Print deployment summary
        console.log("");
        console.log("=== Coins Deployment Complete ===");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  MockMFER:", address(mockMFER));
        console.log("  MockBNKR:", address(mockBNKR));
        console.log("  MockDRB:", address(mockDRB));
        console.log("");
        console.log("Next steps:");
        console.log("1. Update .env with MOCK_MFER_ADDRESS, MOCK_BNKR_ADDRESS, MOCK_DRB_ADDRESS");
        console.log("2. Run deploy-testnet-game.sh to deploy the game contract");
    }
}
