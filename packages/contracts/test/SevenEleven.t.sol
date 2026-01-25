// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {SevenEleven} from "../src/SevenEleven.sol";
import {ERC20Mock} from "./mocks/ERC20Mock.sol";
import {ERC20PermitMock} from "./mocks/ERC20PermitMock.sol";
import {MockUniswapV3Pool} from "./mocks/MockUniswapV3Pool.sol";
import {MockChainlinkAggregator} from "./mocks/MockChainlinkAggregator.sol";
import {MockEntropy} from "./mocks/MockEntropy.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

contract SevenElevenTest is Test {
    SevenEleven public sevenEleven;
    ERC20Mock public mferToken;
    ERC20Mock public bnkrToken;
    ERC20Mock public drbToken;
    ERC20Mock public usdcToken;
    ERC20Mock public weth;
    MockUniswapV3Pool public mferPool;
    MockChainlinkAggregator public ethUsdFeed;
    MockEntropy public entropy;

    address public owner = address(1);
    address public player = address(2);
    address public grokWallet = address(3);

    uint256 public constant INITIAL_BALANCE = 100000e6; // USDC (6 decimals)
    uint256 public constant PAYOUT_RESERVES = 1000000e18;
    uint256 public constant ENTROPY_FEE = 0.001 ether;

    // ETH price: $2000 (8 decimals)
    int256 public constant ETH_USD_PRICE = 2000e8;

    function setUp() public {
        // Deploy mock Entropy
        entropy = new MockEntropy();

        // Deploy mock tokens
        weth = new ERC20Mock("Wrapped Ether", "WETH", 18);
        usdcToken = new ERC20Mock("USD Coin", "USDC", 6);
        mferToken = new ERC20Mock("Mock MFER", "MFER", 18);
        bnkrToken = new ERC20Mock("Mock BNKR", "BNKR", 18);
        drbToken = new ERC20Mock("Mock DRB", "DRB", 18);

        // Deploy mock Chainlink ETH/USD feed
        ethUsdFeed = new MockChainlinkAggregator(ETH_USD_PRICE, 8);

        // Deploy mock Uniswap V3 pool (WETH is token0, MFER is token1)
        mferPool = new MockUniswapV3Pool(address(weth), address(mferToken));

        // Set tick cumulatives to simulate a price of ~0.0001 ETH per MFER ($0.20 at $2000 ETH)
        int56 tickCumulative0 = 0;
        int56 tickCumulative1 = -165785400;
        mferPool.setTickCumulatives(tickCumulative0, tickCumulative1);

        // Deploy SevenEleven V2 contract
        vm.prank(owner);
        sevenEleven = new SevenEleven(
            address(entropy),
            address(ethUsdFeed),
            address(weth),
            address(usdcToken),
            address(mferToken),
            address(bnkrToken),
            address(drbToken),
            grokWallet
        );

        // Add deposit tokens
        vm.startPrank(owner);
        sevenEleven.addWeth();
        sevenEleven.addStablecoin(address(usdcToken));

        // Mark meme tokens as mock for simplified pricing
        sevenEleven.setMockToken(address(mferToken), true);
        sevenEleven.setMockToken(address(bnkrToken), true);
        sevenEleven.setMockToken(address(drbToken), true);
        vm.stopPrank();

        // Mint payout reserve tokens
        mferToken.mint(owner, PAYOUT_RESERVES);
        bnkrToken.mint(owner, PAYOUT_RESERVES);
        drbToken.mint(owner, PAYOUT_RESERVES);

        // Deposit payout reserves
        vm.startPrank(owner);
        mferToken.approve(address(sevenEleven), PAYOUT_RESERVES);
        bnkrToken.approve(address(sevenEleven), PAYOUT_RESERVES);
        drbToken.approve(address(sevenEleven), PAYOUT_RESERVES);
        sevenEleven.depositPayoutReserves(address(mferToken), PAYOUT_RESERVES);
        sevenEleven.depositPayoutReserves(address(bnkrToken), PAYOUT_RESERVES);
        sevenEleven.depositPayoutReserves(address(drbToken), PAYOUT_RESERVES);
        vm.stopPrank();

        // Setup initial USDC balance for player
        usdcToken.mint(player, INITIAL_BALANCE);

        // Approve tokens for player
        vm.prank(player);
        usdcToken.approve(address(sevenEleven), type(uint256).max);

        // Fund the contract with ETH for entropy fees (house pays)
        vm.deal(address(sevenEleven), 10 ether);
    }

    // ============ Helper Functions ============

    function _fulfillPythEntropy(uint64 sequenceNumber, bytes32 randomness) internal {
        entropy.fulfillRandomness(sequenceNumber, randomness);
    }

    function _createRandomnessForDice(uint8 die1, uint8 die2) internal pure returns (bytes32) {
        // The contract calculates:
        // die1 = (rand % 6) + 1
        // die2 = ((rand >> 128) % 6) + 1
        //
        // Since 2^128 % 6 = 4, the high bits contribute (high * 4) to (rand % 6).
        // So we need: (low + high * 4) % 6 = die1 - 1
        // Given: high = die2 - 1
        // Solve: low = (die1 - 1 - (die2 - 1) * 4) mod 6
        uint256 die1Target = uint256(die1 - 1);
        uint256 die2Target = uint256(die2 - 1);

        // Calculate the contribution from high bits to the low modulo
        uint256 highContribution = (die2Target * 4) % 6;

        // Calculate the low value needed to get die1Target after considering high contribution
        // We need: (low + highContribution) % 6 = die1Target
        // So: low = (die1Target + 6 - highContribution) % 6
        uint256 low = (die1Target + 6 - highContribution) % 6;
        uint256 high = die2Target << 128;

        return bytes32(low | high);
    }

    // ============ Deposit Tests ============

    function test_Deposit() public {
        uint256 depositAmount = 10e6; // $10 USDC

        vm.prank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);

        assertEq(sevenEleven.getBalance(player, address(usdcToken)), depositAmount);
        assertEq(usdcToken.balanceOf(player), INITIAL_BALANCE - depositAmount);
    }

    function test_RevertWhen_DepositBelowMinimum() public {
        uint256 tooSmall = 1e6; // $1 USDC (min is $4)

        vm.prank(player);
        vm.expectRevert(SevenEleven.InsufficientDeposit.selector);
        sevenEleven.deposit(address(usdcToken), tooSmall);
    }

    function test_RevertWhen_DepositNonDepositToken() public {
        // Try to deposit a payout token (should fail)
        mferToken.mint(player, 1000e18);
        vm.prank(player);
        mferToken.approve(address(sevenEleven), 1000e18);

        vm.prank(player);
        vm.expectRevert(SevenEleven.TokenNotDepositToken.selector);
        sevenEleven.deposit(address(mferToken), 1000e18);
    }

    function test_RevertWhen_DepositZero() public {
        vm.prank(player);
        vm.expectRevert(SevenEleven.InvalidAmount.selector);
        sevenEleven.deposit(address(usdcToken), 0);
    }

    // ============ Withdraw Tests ============

    function test_Withdraw() public {
        uint256 depositAmount = 10e6;
        uint256 withdrawAmount = 5e6;

        vm.startPrank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);
        sevenEleven.withdraw(address(usdcToken), withdrawAmount);
        vm.stopPrank();

        assertEq(sevenEleven.getBalance(player, address(usdcToken)), depositAmount - withdrawAmount);
        assertEq(usdcToken.balanceOf(player), INITIAL_BALANCE - depositAmount + withdrawAmount);
    }

    function test_WithdrawAll() public {
        uint256 depositAmount = 10e6;

        vm.startPrank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);
        sevenEleven.withdrawAll();
        vm.stopPrank();

        assertEq(sevenEleven.getBalance(player, address(usdcToken)), 0);
        assertEq(usdcToken.balanceOf(player), INITIAL_BALANCE);
    }

    function test_RevertWhen_WithdrawMoreThanBalance() public {
        uint256 depositAmount = 10e6;

        vm.startPrank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);

        vm.expectRevert(SevenEleven.InsufficientBalance.selector);
        sevenEleven.withdraw(address(usdcToken), depositAmount + 1);
        vm.stopPrank();
    }

    function test_RevertWhen_WithdrawZero() public {
        vm.prank(player);
        vm.expectRevert(SevenEleven.InvalidAmount.selector);
        sevenEleven.withdraw(address(usdcToken), 0);
    }

    // ============ Roll Tests ============

    function test_Roll() public {
        uint256 depositAmount = 10e6; // $10 USDC

        vm.startPrank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);

        uint256 balanceBefore = sevenEleven.getBalance(player, address(usdcToken));
        uint64 sequenceNumber = sevenEleven.roll(address(usdcToken));
        uint256 balanceAfter = sevenEleven.getBalance(player, address(usdcToken));
        vm.stopPrank();

        assertTrue(balanceAfter < balanceBefore, "Balance should decrease after roll");

        // Check pending roll stored
        (address pendingPlayer, address token, uint256 betAmount, uint256 betUsdCents) = sevenEleven.pendingRolls(sequenceNumber);
        assertEq(pendingPlayer, player);
        assertEq(token, address(usdcToken));
        assertTrue(betAmount > 0);
        assertEq(betUsdCents, 40); // $0.40 = 40 cents
    }

    function test_RevertWhen_RollInsufficientBalance() public {
        vm.prank(player);
        vm.expectRevert(SevenEleven.InsufficientBalance.selector);
        sevenEleven.roll(address(usdcToken));
    }

    function test_RevertWhen_RollNonDepositToken() public {
        vm.prank(player);
        vm.expectRevert(SevenEleven.TokenNotDepositToken.selector);
        sevenEleven.roll(address(mferToken));
    }

    function test_RevertWhen_RollInsufficientEntropyFee() public {
        uint256 depositAmount = 10e6;

        // Deploy a new contract without funding it with ETH
        SevenEleven unfundedContract = new SevenEleven(
            address(entropy),
            address(ethUsdFeed),
            address(weth),
            address(usdcToken),
            address(mferToken),
            address(bnkrToken),
            address(drbToken),
            grokWallet
        );

        // Configure the contract
        unfundedContract.addStablecoin(address(usdcToken));
        unfundedContract.setMockToken(address(mferToken), true);
        unfundedContract.setMockToken(address(bnkrToken), true);
        unfundedContract.setMockToken(address(drbToken), true);

        // Add payout reserves
        mferToken.mint(address(this), PAYOUT_RESERVES);
        bnkrToken.mint(address(this), PAYOUT_RESERVES);
        drbToken.mint(address(this), PAYOUT_RESERVES);
        mferToken.approve(address(unfundedContract), PAYOUT_RESERVES);
        bnkrToken.approve(address(unfundedContract), PAYOUT_RESERVES);
        drbToken.approve(address(unfundedContract), PAYOUT_RESERVES);
        unfundedContract.depositPayoutReserves(address(mferToken), PAYOUT_RESERVES);
        unfundedContract.depositPayoutReserves(address(bnkrToken), PAYOUT_RESERVES);
        unfundedContract.depositPayoutReserves(address(drbToken), PAYOUT_RESERVES);

        // Player deposits
        usdcToken.mint(player, depositAmount);
        vm.startPrank(player);
        usdcToken.approve(address(unfundedContract), depositAmount);
        unfundedContract.deposit(address(usdcToken), depositAmount);

        // Roll should fail because contract has no ETH for entropy fee
        vm.expectRevert(SevenEleven.InsufficientFee.selector);
        unfundedContract.roll(address(usdcToken));
        vm.stopPrank();
    }

    // ============ Settlement Tests ============

    function test_Settlement_WinOn7() public {
        uint256 depositAmount = 10e6;

        vm.startPrank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);
        uint64 sequenceNumber = sevenEleven.roll(address(usdcToken));
        vm.stopPrank();

        uint256 mferBefore = mferToken.balanceOf(player);
        uint256 bnkrBefore = bnkrToken.balanceOf(player);
        uint256 drbBefore = drbToken.balanceOf(player);

        // Create randomness that produces dice sum of 7 (3 + 4)
        bytes32 randomness = _createRandomnessForDice(3, 4);
        _fulfillPythEntropy(sequenceNumber, randomness);

        uint256 mferAfter = mferToken.balanceOf(player);
        uint256 bnkrAfter = bnkrToken.balanceOf(player);
        uint256 drbAfter = drbToken.balanceOf(player);

        // Player should receive meme tokens (1.5x payout)
        assertTrue(mferAfter > mferBefore, "Should receive MFER");
        assertTrue(bnkrAfter > bnkrBefore, "Should receive BNKR");
        assertTrue(drbAfter > drbBefore, "Should receive DRB");

        // Check player stats
        (uint256 totalWins, uint256 totalLosses,,,,,,, ) = sevenEleven.getPlayerStats(player);
        assertEq(totalWins, 1);
        assertEq(totalLosses, 0);
    }

    function test_Settlement_WinDoubles() public {
        uint256 depositAmount = 10e6;

        vm.startPrank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);
        uint64 sequenceNumber = sevenEleven.roll(address(usdcToken));
        vm.stopPrank();

        // Create randomness that produces doubles (3 + 3)
        bytes32 randomness = _createRandomnessForDice(3, 3);
        _fulfillPythEntropy(sequenceNumber, randomness);

        // Check player stats
        (uint256 totalWins,, uint256 totalDoublesWon,,,,,, ) = sevenEleven.getPlayerStats(player);
        assertEq(totalWins, 1);
        assertEq(totalDoublesWon, 1);
    }

    function test_Settlement_LoseOnOtherSum() public {
        uint256 depositAmount = 10e6;

        vm.startPrank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);
        uint64 sequenceNumber = sevenEleven.roll(address(usdcToken));
        vm.stopPrank();

        uint256 grokMferBefore = mferToken.balanceOf(grokWallet);

        // Create randomness that produces dice sum of 6 (2 + 4) - not doubles, not 7/11
        bytes32 randomness = _createRandomnessForDice(2, 4);
        _fulfillPythEntropy(sequenceNumber, randomness);

        uint256 grokMferAfter = mferToken.balanceOf(grokWallet);

        // Grok should receive MFER skim ($0.02 worth of MFER)
        assertTrue(grokMferAfter > grokMferBefore, "Grok should receive MFER skim");

        (uint256 totalWins, uint256 totalLosses,,,,,,,) = sevenEleven.getPlayerStats(player);
        assertEq(totalWins, 0);
        assertEq(totalLosses, 1);
    }

    // ============ Session Tracking Tests ============

    function test_SessionTracking_FirstRoll() public {
        uint256 depositAmount = 10e6;

        vm.startPrank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);
        sevenEleven.roll(address(usdcToken));
        vm.stopPrank();

        (,,,uint256 firstPlayTime, uint256 lastPlayTime, uint256 totalSessions,,,) = sevenEleven.getPlayerStats(player);
        assertEq(totalSessions, 1);
        assertTrue(firstPlayTime > 0);
        assertTrue(lastPlayTime > 0);
    }

    function test_SessionTracking_NewSessionAfterGap() public {
        uint256 depositAmount = 10e6;

        vm.startPrank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);
        sevenEleven.roll(address(usdcToken));
        vm.stopPrank();

        // Wait more than SESSION_GAP (1 hour)
        vm.warp(block.timestamp + 2 hours);

        // Update price feed timestamp to avoid staleness
        ethUsdFeed.setPrice(ETH_USD_PRICE);

        vm.startPrank(player);
        sevenEleven.roll(address(usdcToken));
        vm.stopPrank();

        (,,,,, uint256 totalSessions,,,) = sevenEleven.getPlayerStats(player);
        assertEq(totalSessions, 2);
    }

    // ============ Authorization Tests ============

    function test_AuthorizeRoller() public {
        address roller = address(4);

        vm.prank(player);
        sevenEleven.authorizeRoller(roller);

        assertEq(sevenEleven.getAuthorizedRoller(player), roller);
        assertTrue(sevenEleven.canRollFor(roller, player));
    }

    function test_RollFor() public {
        uint256 depositAmount = 10e6;
        address roller = address(4);

        vm.startPrank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);
        sevenEleven.authorizeRoller(roller);
        vm.stopPrank();

        uint256 balanceBefore = sevenEleven.getBalance(player, address(usdcToken));

        // Roller rolls on behalf of player
        vm.prank(roller);
        uint64 sequenceNumber = sevenEleven.rollFor(player, address(usdcToken));

        uint256 balanceAfter = sevenEleven.getBalance(player, address(usdcToken));
        assertTrue(balanceAfter < balanceBefore, "Player balance should decrease");

        // Check pending roll stored with player address
        (address pendingPlayer, address token, uint256 betAmount, ) = sevenEleven.pendingRolls(sequenceNumber);
        assertEq(pendingPlayer, player);
        assertEq(token, address(usdcToken));
        assertTrue(betAmount > 0);
    }

    function test_RevertWhen_RollFor_NotAuthorized() public {
        uint256 depositAmount = 10e6;
        address roller = address(4);
        address unauthorizedRoller = address(5);

        vm.startPrank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);
        sevenEleven.authorizeRoller(roller);
        vm.stopPrank();

        // Unauthorized address tries to roll
        vm.prank(unauthorizedRoller);
        vm.expectRevert(SevenEleven.NotAuthorized.selector);
        sevenEleven.rollFor(player, address(usdcToken));
    }

    // ============ View Functions Tests ============

    function test_GetBetAmount() public view {
        uint256 betAmount = sevenEleven.getBetAmount(address(usdcToken));
        // $0.40 with 6 decimals = 400000
        assertEq(betAmount, 400000, "Bet amount should be $0.40 in USDC");
    }

    function test_GetMinDeposit() public view {
        uint256 minDeposit = sevenEleven.getMinDeposit(address(usdcToken));
        // $4.00 with 6 decimals = 4000000
        assertEq(minDeposit, 4000000, "Min deposit should be $4.00 in USDC");
    }

    function test_GetPayoutReserves() public view {
        (uint256 mfer, uint256 bnkr, uint256 drb) = sevenEleven.getPayoutReserves();
        assertEq(mfer, PAYOUT_RESERVES);
        assertEq(bnkr, PAYOUT_RESERVES);
        assertEq(drb, PAYOUT_RESERVES);
    }

    function test_GetPlayerMemeWinnings() public {
        uint256 depositAmount = 10e6;

        vm.startPrank(player);
        sevenEleven.deposit(address(usdcToken), depositAmount);
        uint64 sequenceNumber = sevenEleven.roll(address(usdcToken));
        vm.stopPrank();

        // Win on 7
        bytes32 randomness = _createRandomnessForDice(3, 4);
        _fulfillPythEntropy(sequenceNumber, randomness);

        (uint256 mfer, uint256 bnkr, uint256 drb) = sevenEleven.getPlayerMemeWinnings(player);
        assertTrue(mfer > 0, "Should have MFER winnings");
        assertTrue(bnkr > 0, "Should have BNKR winnings");
        assertTrue(drb > 0, "Should have DRB winnings");
    }

    // ============ Fuzz Tests ============

    function testFuzz_DiceResultsFromBytes32(bytes32 randomness) public pure {
        uint256 rand = uint256(randomness);
        uint8 die1 = uint8((rand % 6) + 1);
        uint8 die2 = uint8(((rand >> 128) % 6) + 1);

        assertTrue(die1 >= 1 && die1 <= 6, "Die 1 out of range");
        assertTrue(die2 >= 1 && die2 <= 6, "Die 2 out of range");

        uint8 sum = die1 + die2;
        assertTrue(sum >= 2 && sum <= 12, "Sum out of range");
    }
}
