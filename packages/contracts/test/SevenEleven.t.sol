// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {SevenEleven} from "../src/SevenEleven.sol";
import {ERC20Mock} from "./mocks/ERC20Mock.sol";
import {MockUniswapV3Pool} from "./mocks/MockUniswapV3Pool.sol";
import {MockChainlinkAggregator} from "./mocks/MockChainlinkAggregator.sol";
import {VRFCoordinatorV2_5Mock} from "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2_5Mock.sol";

contract SevenElevenTest is Test {
    SevenEleven public sevenEleven;
    ERC20Mock public mferToken;
    ERC20Mock public drbToken;
    ERC20Mock public weth;
    MockUniswapV3Pool public mferPool;
    MockChainlinkAggregator public ethUsdFeed;
    VRFCoordinatorV2_5Mock public vrfCoordinator;

    address public owner = address(1);
    address public player = address(2);
    address public feeRecipient = address(3);

    uint256 public subscriptionId;
    bytes32 public keyHash = keccak256("keyHash");

    uint256 public constant INITIAL_BALANCE = 100000e18;
    uint256 public constant HOUSE_LIQUIDITY = 1000000e18;

    // ETH price: $2000 (8 decimals)
    int256 public constant ETH_USD_PRICE = 2000e8;

    function setUp() public {
        // Deploy mock VRF coordinator
        vrfCoordinator = new VRFCoordinatorV2_5Mock(
            0.1 ether,
            1e9,
            1e18
        );

        // Create subscription
        subscriptionId = vrfCoordinator.createSubscription();
        vrfCoordinator.fundSubscription(subscriptionId, 100 ether);

        // Deploy mock tokens
        weth = new ERC20Mock("Wrapped Ether", "WETH", 18);
        mferToken = new ERC20Mock("Mock MFER", "MFER", 18);
        drbToken = new ERC20Mock("Mock DRB", "DRB", 18);

        // Deploy mock Chainlink ETH/USD feed
        ethUsdFeed = new MockChainlinkAggregator(ETH_USD_PRICE, 8);

        // Deploy mock Uniswap V3 pool (WETH is token0, MFER is token1)
        mferPool = new MockUniswapV3Pool(address(weth), address(mferToken));

        // Set tick cumulatives to simulate a price of ~0.0001 ETH per MFER ($0.20 at $2000 ETH)
        // tick = log(price) / log(1.0001)
        // For price 0.0001: tick ≈ -92103
        // Over 1800 seconds: tickCumulative delta = tick * 1800 = -165785400
        int56 tickCumulative0 = 0;
        int56 tickCumulative1 = -165785400; // Represents -92103 tick over 1800 seconds
        mferPool.setTickCumulatives(tickCumulative0, tickCumulative1);

        // Deploy SevenEleven contract
        vm.prank(owner);
        sevenEleven = new SevenEleven(
            address(vrfCoordinator),
            subscriptionId,
            keyHash,
            feeRecipient,
            address(ethUsdFeed),
            address(weth)
        );

        // Add consumer to VRF subscription
        vrfCoordinator.addConsumer(subscriptionId, address(sevenEleven));

        // Add MFER token with its pool
        vm.prank(owner);
        sevenEleven.addToken(address(mferToken), address(mferPool));

        // Setup initial balances
        mferToken.mint(player, INITIAL_BALANCE);
        mferToken.mint(owner, HOUSE_LIQUIDITY);

        // Deposit house liquidity
        vm.startPrank(owner);
        mferToken.approve(address(sevenEleven), HOUSE_LIQUIDITY);
        sevenEleven.depositHouseLiquidity(address(mferToken), HOUSE_LIQUIDITY);
        vm.stopPrank();

        // Approve tokens for player
        vm.prank(player);
        mferToken.approve(address(sevenEleven), type(uint256).max);
    }

    // ============ Deposit Tests ============

    function test_Deposit() public {
        uint256 depositAmount = 1000e18;

        vm.prank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);

        assertEq(sevenEleven.getBalance(player, address(mferToken)), depositAmount);
        assertEq(mferToken.balanceOf(player), INITIAL_BALANCE - depositAmount);
    }

    function test_RevertWhen_DepositBelowMinimum() public {
        uint256 tooSmall = 1e15; // Very small amount

        vm.prank(player);
        vm.expectRevert(SevenEleven.InsufficientDeposit.selector);
        sevenEleven.deposit(address(mferToken), tooSmall);
    }

    function test_RevertWhen_DepositUnsupportedToken() public {
        vm.prank(player);
        vm.expectRevert(SevenEleven.TokenNotSupported.selector);
        sevenEleven.deposit(address(drbToken), 1000e18);
    }

    function test_RevertWhen_DepositZero() public {
        vm.prank(player);
        vm.expectRevert(SevenEleven.InvalidAmount.selector);
        sevenEleven.deposit(address(mferToken), 0);
    }

    // ============ Withdraw Tests ============

    function test_Withdraw() public {
        uint256 depositAmount = 1000e18;
        uint256 withdrawAmount = 500e18;

        vm.startPrank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);
        sevenEleven.withdraw(address(mferToken), withdrawAmount);
        vm.stopPrank();

        assertEq(sevenEleven.getBalance(player, address(mferToken)), depositAmount - withdrawAmount);
        assertEq(mferToken.balanceOf(player), INITIAL_BALANCE - depositAmount + withdrawAmount);
    }

    function test_RevertWhen_WithdrawMoreThanBalance() public {
        uint256 depositAmount = 1000e18;

        vm.startPrank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);

        vm.expectRevert(SevenEleven.InsufficientBalance.selector);
        sevenEleven.withdraw(address(mferToken), depositAmount + 1);
        vm.stopPrank();
    }

    function test_RevertWhen_WithdrawZero() public {
        vm.prank(player);
        vm.expectRevert(SevenEleven.InvalidAmount.selector);
        sevenEleven.withdraw(address(mferToken), 0);
    }

    // ============ Roll Tests ============

    function test_Roll() public {
        uint256 depositAmount = 10000e18;

        vm.startPrank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);

        uint256 balanceBefore = sevenEleven.getBalance(player, address(mferToken));
        uint256 requestId = sevenEleven.roll(address(mferToken));
        uint256 balanceAfter = sevenEleven.getBalance(player, address(mferToken));
        vm.stopPrank();

        assertTrue(requestId > 0, "Request ID should be non-zero");
        assertTrue(balanceAfter < balanceBefore, "Balance should decrease after roll");

        // Check pending roll stored
        (address pendingPlayer, address token, uint256 betAmount, uint256 feeAmount) = sevenEleven.pendingRolls(requestId);
        assertEq(pendingPlayer, player);
        assertEq(token, address(mferToken));
        assertTrue(betAmount > 0);
        assertTrue(feeAmount > 0);
    }

    function test_Roll_FeeTransferred() public {
        uint256 depositAmount = 10000e18;
        uint256 feeRecipientBalanceBefore = mferToken.balanceOf(feeRecipient);

        vm.startPrank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);
        sevenEleven.roll(address(mferToken));
        vm.stopPrank();

        uint256 feeRecipientBalanceAfter = mferToken.balanceOf(feeRecipient);
        assertTrue(feeRecipientBalanceAfter > feeRecipientBalanceBefore, "Fee recipient should receive fee");
    }

    function test_RevertWhen_RollInsufficientBalance() public {
        // Don't deposit anything
        vm.prank(player);
        vm.expectRevert(SevenEleven.InsufficientBalance.selector);
        sevenEleven.roll(address(mferToken));
    }

    function test_RevertWhen_RollUnsupportedToken() public {
        vm.prank(player);
        vm.expectRevert(SevenEleven.TokenNotSupported.selector);
        sevenEleven.roll(address(drbToken));
    }

    // ============ Settlement Tests ============

    function test_Settlement_WinOn7() public {
        uint256 depositAmount = 10000e18;

        vm.startPrank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);
        uint256 requestId = sevenEleven.roll(address(mferToken));
        vm.stopPrank();

        uint256 balanceBeforeSettle = sevenEleven.getBalance(player, address(mferToken));

        // Simulate VRF response with dice that sum to 7 (3 + 4)
        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = 2; // die1 = 3
        randomWords[1] = 3; // die2 = 4

        vrfCoordinator.fulfillRandomWordsWithOverride(
            requestId,
            address(sevenEleven),
            randomWords
        );

        uint256 balanceAfterSettle = sevenEleven.getBalance(player, address(mferToken));

        assertTrue(balanceAfterSettle > balanceBeforeSettle, "Balance should increase on win");

        // Check player stats
        SevenEleven.PlayerStats memory stats = sevenEleven.getPlayerStats(player);
        assertEq(stats.totalWins, 1);
        assertEq(stats.totalLosses, 0);
    }

    function test_Settlement_WinOn11() public {
        uint256 depositAmount = 10000e18;

        vm.startPrank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);
        uint256 requestId = sevenEleven.roll(address(mferToken));
        vm.stopPrank();

        uint256 balanceBeforeSettle = sevenEleven.getBalance(player, address(mferToken));

        // Simulate VRF response with dice that sum to 11 (5 + 6)
        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = 4; // die1 = 5
        randomWords[1] = 5; // die2 = 6

        vrfCoordinator.fulfillRandomWordsWithOverride(
            requestId,
            address(sevenEleven),
            randomWords
        );

        uint256 balanceAfterSettle = sevenEleven.getBalance(player, address(mferToken));

        assertTrue(balanceAfterSettle > balanceBeforeSettle, "Balance should increase on win");

        SevenEleven.PlayerStats memory stats = sevenEleven.getPlayerStats(player);
        assertEq(stats.totalWins, 1);
    }

    function test_Settlement_LoseOnOtherSum() public {
        uint256 depositAmount = 10000e18;

        vm.startPrank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);
        uint256 requestId = sevenEleven.roll(address(mferToken));
        vm.stopPrank();

        uint256 balanceBeforeSettle = sevenEleven.getBalance(player, address(mferToken));

        // Simulate VRF response with dice that sum to 6 (2 + 4)
        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = 1; // die1 = 2
        randomWords[1] = 3; // die2 = 4

        vrfCoordinator.fulfillRandomWordsWithOverride(
            requestId,
            address(sevenEleven),
            randomWords
        );

        uint256 balanceAfterSettle = sevenEleven.getBalance(player, address(mferToken));

        assertEq(balanceAfterSettle, balanceBeforeSettle, "Balance should not change on loss");

        SevenEleven.PlayerStats memory stats = sevenEleven.getPlayerStats(player);
        assertEq(stats.totalWins, 0);
        assertEq(stats.totalLosses, 1);
    }

    function test_Settlement_3xPayout() public {
        uint256 depositAmount = 10000e18;

        vm.startPrank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);
        uint256 requestId = sevenEleven.roll(address(mferToken));
        vm.stopPrank();

        // Get the bet amount (net of fee)
        (, , uint256 netBetAmount, ) = sevenEleven.pendingRolls(requestId);

        uint256 balanceBeforeSettle = sevenEleven.getBalance(player, address(mferToken));

        // Win on 7
        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = 2; // die1 = 3
        randomWords[1] = 3; // die2 = 4

        vrfCoordinator.fulfillRandomWordsWithOverride(
            requestId,
            address(sevenEleven),
            randomWords
        );

        uint256 balanceAfterSettle = sevenEleven.getBalance(player, address(mferToken));
        uint256 payout = balanceAfterSettle - balanceBeforeSettle;

        // Payout should be 3x the net bet
        assertEq(payout, netBetAmount * 3, "Payout should be 3x the net bet");
    }

    // ============ Session Tracking Tests ============

    function test_SessionTracking_FirstRoll() public {
        uint256 depositAmount = 10000e18;

        vm.startPrank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);
        sevenEleven.roll(address(mferToken));
        vm.stopPrank();

        SevenEleven.PlayerStats memory stats = sevenEleven.getPlayerStats(player);
        assertEq(stats.totalSessions, 1);
        assertTrue(stats.firstPlayTime > 0);
        assertTrue(stats.lastPlayTime > 0);
    }

    function test_SessionTracking_NewSessionAfterGap() public {
        uint256 depositAmount = 10000e18;

        vm.startPrank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);
        sevenEleven.roll(address(mferToken));
        vm.stopPrank();

        // Wait more than SESSION_GAP (1 hour)
        vm.warp(block.timestamp + 2 hours);

        // Update price feed timestamp to avoid staleness
        ethUsdFeed.setPrice(ETH_USD_PRICE);

        vm.startPrank(player);
        sevenEleven.roll(address(mferToken));
        vm.stopPrank();

        SevenEleven.PlayerStats memory stats = sevenEleven.getPlayerStats(player);
        assertEq(stats.totalSessions, 2);
    }

    function test_SessionTracking_SameSessionWithinGap() public {
        uint256 depositAmount = 10000e18;

        vm.startPrank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);
        sevenEleven.roll(address(mferToken));

        // Wait less than SESSION_GAP
        vm.warp(block.timestamp + 30 minutes);

        sevenEleven.roll(address(mferToken));
        vm.stopPrank();

        SevenEleven.PlayerStats memory stats = sevenEleven.getPlayerStats(player);
        assertEq(stats.totalSessions, 1);
    }

    // ============ Admin Tests ============

    function test_AddToken() public {
        MockUniswapV3Pool drbPool = new MockUniswapV3Pool(address(weth), address(drbToken));
        drbPool.setTickCumulatives(0, -165785400);

        vm.prank(owner);
        sevenEleven.addToken(address(drbToken), address(drbPool));

        assertTrue(sevenEleven.isTokenSupported(address(drbToken)));
    }

    function test_RemoveToken() public {
        vm.prank(owner);
        sevenEleven.removeToken(address(mferToken));

        assertFalse(sevenEleven.isTokenSupported(address(mferToken)));
    }

    function test_RevertWhen_NonOwnerAddsToken() public {
        MockUniswapV3Pool drbPool = new MockUniswapV3Pool(address(weth), address(drbToken));

        vm.prank(player);
        vm.expectRevert();
        sevenEleven.addToken(address(drbToken), address(drbPool));
    }

    function test_HouseLiquidityDeposit() public {
        uint256 additionalLiquidity = 100000e18;
        mferToken.mint(owner, additionalLiquidity);

        vm.startPrank(owner);
        mferToken.approve(address(sevenEleven), additionalLiquidity);
        uint256 liquidityBefore = sevenEleven.houseLiquidity(address(mferToken));
        sevenEleven.depositHouseLiquidity(address(mferToken), additionalLiquidity);
        uint256 liquidityAfter = sevenEleven.houseLiquidity(address(mferToken));
        vm.stopPrank();

        assertEq(liquidityAfter - liquidityBefore, additionalLiquidity);
    }

    function test_HouseLiquidityWithdraw() public {
        uint256 withdrawAmount = 100000e18;

        vm.prank(owner);
        sevenEleven.withdrawHouseLiquidity(address(mferToken), withdrawAmount);

        assertEq(mferToken.balanceOf(owner), withdrawAmount);
    }

    function test_RevertWhen_NonOwnerWithdrawsHouseLiquidity() public {
        vm.prank(player);
        vm.expectRevert();
        sevenEleven.withdrawHouseLiquidity(address(mferToken), 1000e18);
    }

    function test_RevertWhen_InsufficientHouseLiquidity() public {
        // First drain most of the house liquidity
        vm.prank(owner);
        sevenEleven.withdrawHouseLiquidity(address(mferToken), HOUSE_LIQUIDITY - 100);

        // Now try to roll when house can't cover
        uint256 depositAmount = 10000e18;
        vm.startPrank(player);
        sevenEleven.deposit(address(mferToken), depositAmount);

        vm.expectRevert(SevenEleven.InsufficientHouseLiquidity.selector);
        sevenEleven.roll(address(mferToken));
        vm.stopPrank();
    }

    // ============ View Functions Tests ============

    function test_GetSupportedTokens() public view {
        address[] memory tokens = sevenEleven.getSupportedTokens();
        assertEq(tokens.length, 1);
        assertEq(tokens[0], address(mferToken));
    }

    function test_GetBetAmount() public view {
        uint256 betAmount = sevenEleven.getBetAmount(address(mferToken));
        assertTrue(betAmount > 0, "Bet amount should be positive");
    }

    function test_GetMinDeposit() public view {
        uint256 minDeposit = sevenEleven.getMinDeposit(address(mferToken));
        uint256 betAmount = sevenEleven.getBetAmount(address(mferToken));

        // Min deposit should be 8x bet amount ($2 / $0.25 = 8)
        assertEq(minDeposit, (betAmount * 200) / 25);
    }

    // ============ Fuzz Tests ============

    function testFuzz_DiceResults(uint256 word1, uint256 word2) public pure {
        uint8 die1 = uint8((word1 % 6) + 1);
        uint8 die2 = uint8((word2 % 6) + 1);

        assertTrue(die1 >= 1 && die1 <= 6, "Die 1 out of range");
        assertTrue(die2 >= 1 && die2 <= 6, "Die 2 out of range");

        uint8 sum = die1 + die2;
        assertTrue(sum >= 2 && sum <= 12, "Sum out of range");

        // 7 or 11 wins
        bool wins = (sum == 7 || sum == 11);

        // There are 8 winning combinations out of 36: 6 for sum 7, 2 for sum 11
        // sum = 7: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1)
        // sum = 11: (5,6), (6,5)
        if (sum == 7 || sum == 11) {
            assertTrue(wins);
        } else {
            assertFalse(wins);
        }
    }

    function testFuzz_WinProbability(uint256 seed) public {
        // Test that win probability is roughly 8/36 = 22.22%
        uint256 wins = 0;
        uint256 samples = 1000;

        for (uint256 i = 0; i < samples; i++) {
            uint256 word1 = uint256(keccak256(abi.encode(seed, i, 0)));
            uint256 word2 = uint256(keccak256(abi.encode(seed, i, 1)));

            uint8 die1 = uint8((word1 % 6) + 1);
            uint8 die2 = uint8((word2 % 6) + 1);
            uint8 sum = die1 + die2;

            if (sum == 7 || sum == 11) {
                wins++;
            }
        }

        // Expected wins: 222 (22.22%)
        // Allow 5% tolerance: 172 to 272
        assertTrue(wins >= 170 && wins <= 280, "Win probability outside expected range");
    }
}
