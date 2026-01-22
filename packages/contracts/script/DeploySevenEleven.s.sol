// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";

contract DeploySevenElevenScript is Script {
    // Pyth Entropy addresses
    address constant PYTH_ENTROPY_BASE_MAINNET = 0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb;
    address constant PYTH_ENTROPY_BASE_SEPOLIA = 0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c;

    // Chainlink ETH/USD Price Feeds
    address constant ETH_USD_FEED_SEPOLIA = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1; // Base Sepolia ETH/USD
    address constant ETH_USD_FEED_BASE = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70; // Base Mainnet ETH/USD

    // Token addresses (Base Mainnet)
    address constant MFERCOIN = 0xE3086852A4B125803C815a158249ae468A3254Ca;
    address constant DRB_TOKEN = 0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2;
    address constant BANKR_TOKEN = 0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b;

    // Fee recipient (drb.eth)
    address constant FEE_RECIPIENT = 0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9;

    // WETH addresses
    address constant WETH_BASE = 0x4200000000000000000000000000000000000006;
    address constant WETH_SEPOLIA = 0x4200000000000000000000000000000000000006;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        bool isMainnet = vm.envBool("IS_MAINNET");

        address pythEntropy = isMainnet ? PYTH_ENTROPY_BASE_MAINNET : PYTH_ENTROPY_BASE_SEPOLIA;
        address ethUsdFeed = isMainnet ? ETH_USD_FEED_BASE : ETH_USD_FEED_SEPOLIA;
        address weth = isMainnet ? WETH_BASE : WETH_SEPOLIA;

        vm.startBroadcast(deployerPrivateKey);

        SevenEleven sevenEleven = new SevenEleven(
            pythEntropy,
            FEE_RECIPIENT,
            ethUsdFeed,
            weth
        );

        console.log("SevenEleven deployed at:", address(sevenEleven));
        console.log("Network:", isMainnet ? "Base Mainnet" : "Base Sepolia");
        console.log("Pyth Entropy:", pythEntropy);
        console.log("Fee Recipient (drb.eth):", FEE_RECIPIENT);

        // Note: After deployment, call addToken() for each supported token with their Uniswap V3 pool addresses
        // sevenEleven.addToken(MFERCOIN, MFER_WETH_POOL);
        // sevenEleven.addToken(DRB_TOKEN, DRB_WETH_POOL);
        // sevenEleven.addToken(BANKR_TOKEN, BANKR_WETH_POOL);

        vm.stopBroadcast();
    }

    /**
     * @notice Helper script to add tokens after deployment
     * @dev Run with: forge script script/DeploySevenEleven.s.sol:AddTokensScript --rpc-url $RPC_URL --broadcast
     */
    function addTokens(address sevenElevenAddress) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Get pool addresses from environment
        address mferPool = vm.envAddress("MFER_WETH_POOL");
        address drbPool = vm.envAddress("DRB_WETH_POOL");
        address bankrPool = vm.envAddress("BANKR_WETH_POOL");

        vm.startBroadcast(deployerPrivateKey);

        SevenEleven sevenEleven = SevenEleven(payable(sevenElevenAddress));

        if (mferPool != address(0)) {
            sevenEleven.addToken(MFERCOIN, mferPool);
            console.log("Added MFERCOIN with pool:", mferPool);
        }

        if (drbPool != address(0)) {
            sevenEleven.addToken(DRB_TOKEN, drbPool);
            console.log("Added DRB with pool:", drbPool);
        }

        if (bankrPool != address(0)) {
            sevenEleven.addToken(BANKR_TOKEN, bankrPool);
            console.log("Added BANKR with pool:", bankrPool);
        }

        vm.stopBroadcast();
    }
}

/**
 * @notice Separate script for adding tokens post-deployment
 */
contract AddTokensScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address sevenElevenAddress = vm.envAddress("SEVEN_ELEVEN_ADDRESS");

        address mfercoin = vm.envAddress("MFERCOIN_ADDRESS");
        address mferPool = vm.envAddress("MFER_WETH_POOL");

        vm.startBroadcast(deployerPrivateKey);

        SevenEleven sevenEleven = SevenEleven(payable(sevenElevenAddress));

        if (mferPool != address(0) && mfercoin != address(0)) {
            sevenEleven.addToken(mfercoin, mferPool);
            console.log("Added token:", mfercoin);
            console.log("With pool:", mferPool);
        }

        vm.stopBroadcast();
    }
}
