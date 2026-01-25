// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SevenEleven} from "../src/SevenEleven.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployMainnetScript
 * @notice Deploy SevenEleven V2 to Base Mainnet
 * @dev Run with: forge script script/DeployMainnet.s.sol:DeployMainnetScript --rpc-url $BASE_RPC_URL --broadcast --verify
 */
contract DeployMainnetScript is Script {
    // ============ Infrastructure ============
    address constant PYTH_ENTROPY = 0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb;
    address constant ETH_USD_FEED = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;

    // ============ Base Mainnet Tokens ============
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    // ============ Meme Tokens ============
    address constant MFER = 0xE3086852A4B125803C815a158249ae468A3254Ca;
    address constant BNKR = 0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b;
    address constant DRB = 0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2;

    // ============ Uniswap V3 Pools (1% fee tier) ============
    address constant MFER_WETH_POOL = 0x7EC18ABf80E865c6799069df91073335935C4185;
    address constant BNKR_WETH_POOL = 0xAEC085E5A5CE8d96A7bDd3eB3A62445d4f6CE703;
    address constant DRB_WETH_POOL = 0x5116773e18A9C7bB03EBB961b38678E45E238923;

    // ============ Grok Wallet (receives loss skim) ============
    address constant GROK_WALLET = 0xB1058c959987E3513600EB5b4fD82Aeee2a0E4F9;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== SevenEleven V2 Mainnet Deployment ===");
        console.log("");
        console.log("Network:  Base Mainnet");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance / 1e18, "ETH");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy SevenEleven
        console.log("Deploying SevenEleven...");
        SevenEleven sevenEleven = new SevenEleven(
            PYTH_ENTROPY,
            ETH_USD_FEED,
            WETH,
            USDC,
            MFER,
            BNKR,
            DRB,
            GROK_WALLET
        );
        console.log("SevenEleven deployed:", address(sevenEleven));

        // Add USDC as stablecoin (deposit token)
        console.log("");
        console.log("Adding USDC as stablecoin...");
        sevenEleven.addStablecoin(USDC);

        // Add WETH (kept for contract compatibility)
        console.log("Adding WETH...");
        sevenEleven.addWeth();

        // Add meme tokens with their Uniswap pools
        console.log("");
        console.log("Adding meme tokens with Uniswap V3 pools...");

        console.log("  MFER pool:", MFER_WETH_POOL);
        sevenEleven.addToken(MFER, MFER_WETH_POOL);

        console.log("  BNKR pool:", BNKR_WETH_POOL);
        sevenEleven.addToken(BNKR, BNKR_WETH_POOL);

        console.log("  DRB pool:", DRB_WETH_POOL);
        sevenEleven.addToken(DRB, DRB_WETH_POOL);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("");
        console.log("Contract Address:", address(sevenEleven));
        console.log("Grok Wallet:", GROK_WALLET);
        console.log("");
        console.log("=== Next Steps ===");
        console.log("1. Fund entropy: sevenEleven.depositEntropyFunds{value: X}()");
        console.log("2. Fund payout reserves:");
        console.log("   - Approve MFER, BNKR, DRB to contract");
        console.log("   - Call depositPayoutReserves(token, amount) for each");
        console.log("3. Verify contract on Basescan");
        console.log("4. Update frontend contracts.ts with address");
        console.log("5. Test with small amounts first!");
    }
}

/**
 * @title FundMainnetScript
 * @notice Fund the SevenEleven contract with entropy and payout reserves
 * @dev Run with: forge script script/DeployMainnet.s.sol:FundMainnetScript --rpc-url $BASE_RPC_URL --broadcast
 */
contract FundMainnetScript is Script {
    address constant MFER = 0xE3086852A4B125803C815a158249ae468A3254Ca;
    address constant BNKR = 0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b;
    address constant DRB = 0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address contractAddress = vm.envAddress("SEVEN_ELEVEN_MAINNET_ADDRESS");

        // Funding amounts (adjust as needed)
        uint256 entropyFunding = vm.envOr("ENTROPY_FUNDING", uint256(0.1 ether));
        uint256 mferAmount = vm.envOr("MFER_AMOUNT", uint256(0)); // Set in env
        uint256 bnkrAmount = vm.envOr("BNKR_AMOUNT", uint256(0));
        uint256 drbAmount = vm.envOr("DRB_AMOUNT", uint256(0));

        SevenEleven sevenEleven = SevenEleven(payable(contractAddress));

        console.log("=== Funding SevenEleven Mainnet ===");
        console.log("Contract:", contractAddress);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Fund entropy
        if (entropyFunding > 0) {
            console.log("Funding entropy with", entropyFunding / 1e18, "ETH");
            sevenEleven.depositEntropyFunds{value: entropyFunding}();
        }

        // Fund payout reserves
        if (mferAmount > 0) {
            console.log("Depositing MFER:", mferAmount / 1e18);
            IERC20(MFER).approve(contractAddress, mferAmount);
            sevenEleven.depositPayoutReserves(MFER, mferAmount);
        }

        if (bnkrAmount > 0) {
            console.log("Depositing BNKR:", bnkrAmount / 1e18);
            IERC20(BNKR).approve(contractAddress, bnkrAmount);
            sevenEleven.depositPayoutReserves(BNKR, bnkrAmount);
        }

        if (drbAmount > 0) {
            console.log("Depositing DRB:", drbAmount / 1e18);
            IERC20(DRB).approve(contractAddress, drbAmount);
            sevenEleven.depositPayoutReserves(DRB, drbAmount);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== Funding Complete ===");
        console.log("Entropy balance:", contractAddress.balance / 1e18, "ETH");
        console.log("MFER reserves:", sevenEleven.payoutReserves(MFER) / 1e18);
        console.log("BNKR reserves:", sevenEleven.payoutReserves(BNKR) / 1e18);
        console.log("DRB reserves:", sevenEleven.payoutReserves(DRB) / 1e18);
    }
}
