// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";

contract DeployScript is Script {
    // Base Sepolia configuration
    address constant VRF_COORDINATOR_BASE_SEPOLIA = 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE;
    bytes32 constant KEY_HASH_BASE_SEPOLIA = 0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71;
    address constant ETH_USD_PRICE_FEED_SEPOLIA = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;

    // Base Mainnet configuration
    address constant VRF_COORDINATOR_BASE = 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634;
    bytes32 constant KEY_HASH_BASE = 0x00b81b5a9c3955d5dc54e7424165caaa91e20df387a3d019a8c9fd43f8ec09bc;
    address constant ETH_USD_PRICE_FEED_BASE = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;

    // WETH address (same on both networks)
    address constant WETH = 0x4200000000000000000000000000000000000006;

    // Fee recipient (drb.eth)
    address constant FEE_RECIPIENT = 0x1F7e5e3AEb8eCD23631799Ed58C0e24d76A2A534;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint256 subscriptionId = vm.envUint("VRF_SUBSCRIPTION_ID");
        bool isMainnet = vm.envBool("IS_MAINNET");

        address vrfCoordinator = isMainnet ? VRF_COORDINATOR_BASE : VRF_COORDINATOR_BASE_SEPOLIA;
        bytes32 keyHash = isMainnet ? KEY_HASH_BASE : KEY_HASH_BASE_SEPOLIA;
        address ethUsdPriceFeed = isMainnet ? ETH_USD_PRICE_FEED_BASE : ETH_USD_PRICE_FEED_SEPOLIA;

        vm.startBroadcast(deployerPrivateKey);

        SevenEleven sevenEleven = new SevenEleven(
            vrfCoordinator,
            subscriptionId,
            keyHash,
            FEE_RECIPIENT,
            ethUsdPriceFeed,
            WETH
        );

        console.log("SevenEleven deployed at:", address(sevenEleven));
        console.log("Network:", isMainnet ? "Base Mainnet" : "Base Sepolia");

        vm.stopBroadcast();
    }
}
