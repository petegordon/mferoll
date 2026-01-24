// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";

/**
 * @title DeployScript
 * @notice Deploy SevenEleven V2 to Base mainnet or testnet
 * @dev V2 constructor requires all token addresses upfront
 */
contract DeployScript is Script {
    // Pyth Entropy addresses
    address constant PYTH_ENTROPY_BASE_MAINNET = 0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb;
    address constant PYTH_ENTROPY_BASE_SEPOLIA = 0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c;

    // Chainlink ETH/USD Price Feeds
    address constant ETH_USD_PRICE_FEED_SEPOLIA = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;
    address constant ETH_USD_PRICE_FEED_BASE = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;

    // WETH address (same on both networks)
    address constant WETH = 0x4200000000000000000000000000000000000006;

    // USDC addresses
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // Mainnet meme token addresses
    address constant MFER_MAINNET = 0xE3086852A4B125803C815a158249ae468A3254Ca;
    address constant BNKR_MAINNET = 0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b;
    address constant DRB_MAINNET = 0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2;

    // Grok wallet
    address constant GROK_WALLET = 0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        bool isMainnet = vm.envBool("IS_MAINNET");

        address pythEntropy = isMainnet ? PYTH_ENTROPY_BASE_MAINNET : PYTH_ENTROPY_BASE_SEPOLIA;
        address ethUsdPriceFeed = isMainnet ? ETH_USD_PRICE_FEED_BASE : ETH_USD_PRICE_FEED_SEPOLIA;
        address usdc = isMainnet ? USDC_BASE : USDC_SEPOLIA;

        // For testnet, use placeholder addresses (deploy mock tokens separately)
        address mfer = isMainnet ? MFER_MAINNET : address(0);
        address bnkr = isMainnet ? BNKR_MAINNET : address(0);
        address drb = isMainnet ? DRB_MAINNET : address(0);

        require(isMainnet, "For testnet, use DeployTestnetV2.s.sol instead");

        vm.startBroadcast(deployerPrivateKey);

        SevenEleven sevenEleven = new SevenEleven(
            pythEntropy,
            ethUsdPriceFeed,
            WETH,
            usdc,
            mfer,
            bnkr,
            drb,
            GROK_WALLET
        );

        console.log("SevenEleven V2 deployed at:", address(sevenEleven));
        console.log("Network:", isMainnet ? "Base Mainnet" : "Base Sepolia");
        console.log("Pyth Entropy:", pythEntropy);

        vm.stopBroadcast();
    }
}
