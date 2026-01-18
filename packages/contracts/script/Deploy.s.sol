// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {DiceBetting} from "../src/DiceBetting.sol";

contract DeployScript is Script {
    // Base Sepolia configuration
    address constant VRF_COORDINATOR_BASE_SEPOLIA = 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE;
    bytes32 constant KEY_HASH_BASE_SEPOLIA = 0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71;

    // Base Mainnet configuration
    address constant VRF_COORDINATOR_BASE = 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634;
    bytes32 constant KEY_HASH_BASE = 0x00b81b5a9c3955d5dc54e7424165caaa91e20df387a3d019a8c9fd43f8ec09bc;

    // mfercoin address (same on both networks)
    address constant MFERCOIN = 0xe3086852a4b125803c815a158249ae468a3254ca;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint256 subscriptionId = vm.envUint("VRF_SUBSCRIPTION_ID");
        bool isMainnet = vm.envBool("IS_MAINNET");

        address vrfCoordinator = isMainnet ? VRF_COORDINATOR_BASE : VRF_COORDINATOR_BASE_SEPOLIA;
        bytes32 keyHash = isMainnet ? KEY_HASH_BASE : KEY_HASH_BASE_SEPOLIA;

        vm.startBroadcast(deployerPrivateKey);

        DiceBetting diceBetting = new DiceBetting(
            vrfCoordinator,
            subscriptionId,
            keyHash,
            MFERCOIN
        );

        console.log("DiceBetting deployed at:", address(diceBetting));
        console.log("Network:", isMainnet ? "Base Mainnet" : "Base Sepolia");

        vm.stopBroadcast();
    }
}
