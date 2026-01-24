// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";

/**
 * @title DeploySevenElevenScript
 * @notice Deploy SevenEleven V2 to Base Mainnet
 * @dev For testnet deployment, use DeployTestnetV2.s.sol instead
 */
contract DeploySevenElevenScript is Script {
    // Pyth Entropy addresses
    address constant PYTH_ENTROPY_BASE_MAINNET = 0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb;

    // Chainlink ETH/USD Price Feed (Base Mainnet)
    address constant ETH_USD_FEED_BASE = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;

    // Token addresses (Base Mainnet)
    address constant WETH_BASE = 0x4200000000000000000000000000000000000006;
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant MFERCOIN = 0xE3086852A4B125803C815a158249ae468A3254Ca;
    address constant DRB_TOKEN = 0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2;
    address constant BANKR_TOKEN = 0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b;

    // Grok wallet (drb.eth)
    address constant GROK_WALLET = 0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        SevenEleven sevenEleven = new SevenEleven(
            PYTH_ENTROPY_BASE_MAINNET,
            ETH_USD_FEED_BASE,
            WETH_BASE,
            USDC_BASE,
            MFERCOIN,
            BANKR_TOKEN,
            DRB_TOKEN,
            GROK_WALLET
        );

        console.log("SevenEleven V2 deployed at:", address(sevenEleven));
        console.log("Network: Base Mainnet");
        console.log("Pyth Entropy:", PYTH_ENTROPY_BASE_MAINNET);
        console.log("Grok Wallet:", GROK_WALLET);

        // Configure deposit tokens
        sevenEleven.addWeth();
        console.log("Added WETH:", WETH_BASE);

        sevenEleven.addStablecoin(USDC_BASE);
        console.log("Added USDC:", USDC_BASE);

        vm.stopBroadcast();

        console.log("");
        console.log("Next steps:");
        console.log("1. Add meme token Uniswap pools for pricing (addToken)");
        console.log("2. Deposit payout reserves (depositPayoutReserves)");
        console.log("3. Fund contract with ETH for entropy fees");
    }
}

/**
 * @notice Script to configure meme token pools for pricing
 */
contract ConfigureMemeTokensScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address sevenElevenAddress = vm.envAddress("SEVEN_ELEVEN_ADDRESS");

        // Get pool addresses from environment
        address mferPool = vm.envAddress("MFER_WETH_POOL");
        address drbPool = vm.envAddress("DRB_WETH_POOL");
        address bankrPool = vm.envAddress("BANKR_WETH_POOL");

        address mfercoin = 0xE3086852A4B125803C815a158249ae468A3254Ca;
        address drbToken = 0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2;
        address bankrToken = 0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b;

        vm.startBroadcast(deployerPrivateKey);

        SevenEleven sevenEleven = SevenEleven(payable(sevenElevenAddress));

        if (mferPool != address(0)) {
            sevenEleven.addToken(mfercoin, mferPool);
            console.log("Added MFERCOIN with pool:", mferPool);
        }

        if (drbPool != address(0)) {
            sevenEleven.addToken(drbToken, drbPool);
            console.log("Added DRB with pool:", drbPool);
        }

        if (bankrPool != address(0)) {
            sevenEleven.addToken(bankrToken, bankrPool);
            console.log("Added BANKR with pool:", bankrPool);
        }

        vm.stopBroadcast();
    }
}
