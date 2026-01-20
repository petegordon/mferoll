// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";

contract DeployScript is Script {
    // Pyth Entropy addresses
    address constant PYTH_ENTROPY_BASE_MAINNET = 0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb;
    address constant PYTH_ENTROPY_BASE_SEPOLIA = 0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c;

    // Chainlink ETH/USD Price Feeds
    address constant ETH_USD_PRICE_FEED_SEPOLIA = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;
    address constant ETH_USD_PRICE_FEED_BASE = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;

    // WETH address (same on both networks)
    address constant WETH = 0x4200000000000000000000000000000000000006;

    // Fee recipient (drb.eth)
    address constant FEE_RECIPIENT = 0x1F7e5e3AEb8eCD23631799Ed58C0e24d76A2A534;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        bool isMainnet = vm.envBool("IS_MAINNET");

        address pythEntropy = isMainnet ? PYTH_ENTROPY_BASE_MAINNET : PYTH_ENTROPY_BASE_SEPOLIA;
        address ethUsdPriceFeed = isMainnet ? ETH_USD_PRICE_FEED_BASE : ETH_USD_PRICE_FEED_SEPOLIA;

        vm.startBroadcast(deployerPrivateKey);

        SevenEleven sevenEleven = new SevenEleven(
            pythEntropy,
            FEE_RECIPIENT,
            ethUsdPriceFeed,
            WETH
        );

        console.log("SevenEleven deployed at:", address(sevenEleven));
        console.log("Network:", isMainnet ? "Base Mainnet" : "Base Sepolia");
        console.log("Pyth Entropy:", pythEntropy);

        vm.stopBroadcast();
    }
}
