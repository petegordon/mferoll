// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";

contract DeploySevenElevenScript is Script {
    // Base Sepolia configuration
    address constant VRF_COORDINATOR_BASE_SEPOLIA = 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE;
    bytes32 constant KEY_HASH_BASE_SEPOLIA = 0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71;
    address constant ETH_USD_FEED_SEPOLIA = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1; // Base Sepolia ETH/USD

    // Base Mainnet configuration
    address constant VRF_COORDINATOR_BASE = 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634;
    bytes32 constant KEY_HASH_BASE = 0x00b81b5a9c3955d5dc54e7424165caaa91e20df387a3d019a8c9fd43f8ec09bc;
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

    // Uniswap V3 pools on Base Mainnet (need to be verified/updated)
    // These are placeholder addresses - actual pool addresses need to be found on Base
    address constant MFER_WETH_POOL = address(0); // TODO: Find actual pool
    address constant DRB_WETH_POOL = address(0);  // TODO: Find actual pool
    address constant BANKR_WETH_POOL = address(0); // TODO: Find actual pool

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint256 subscriptionId = vm.envUint("VRF_SUBSCRIPTION_ID");
        bool isMainnet = vm.envBool("IS_MAINNET");

        address vrfCoordinator = isMainnet ? VRF_COORDINATOR_BASE : VRF_COORDINATOR_BASE_SEPOLIA;
        bytes32 keyHash = isMainnet ? KEY_HASH_BASE : KEY_HASH_BASE_SEPOLIA;
        address ethUsdFeed = isMainnet ? ETH_USD_FEED_BASE : ETH_USD_FEED_SEPOLIA;
        address weth = isMainnet ? WETH_BASE : WETH_SEPOLIA;

        vm.startBroadcast(deployerPrivateKey);

        SevenEleven sevenEleven = new SevenEleven(
            vrfCoordinator,
            subscriptionId,
            keyHash,
            FEE_RECIPIENT,
            ethUsdFeed,
            weth
        );

        console.log("SevenEleven deployed at:", address(sevenEleven));
        console.log("Network:", isMainnet ? "Base Mainnet" : "Base Sepolia");
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

        SevenEleven sevenEleven = SevenEleven(sevenElevenAddress);

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

        SevenEleven sevenEleven = SevenEleven(sevenElevenAddress);

        if (mferPool != address(0) && mfercoin != address(0)) {
            sevenEleven.addToken(mfercoin, mferPool);
            console.log("Added token:", mfercoin);
            console.log("With pool:", mferPool);
        }

        vm.stopBroadcast();
    }
}
