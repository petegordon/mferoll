// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {DiceBetting} from "../src/DiceBetting.sol";
import {ERC20Mock} from "./mocks/ERC20Mock.sol";
import {VRFCoordinatorV2_5Mock} from "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2_5Mock.sol";

contract DiceBettingTest is Test {
    DiceBetting public diceBetting;
    ERC20Mock public token;
    VRFCoordinatorV2_5Mock public vrfCoordinator;

    address public owner = address(1);
    address public player = address(2);

    uint256 public subscriptionId;
    bytes32 public keyHash = keccak256("keyHash");

    uint256 public constant INITIAL_BALANCE = 10000e18;
    uint256 public constant HOUSE_BALANCE = 100000e18;

    function setUp() public {
        // Deploy mock VRF coordinator
        vrfCoordinator = new VRFCoordinatorV2_5Mock(
            0.1 ether, // base fee
            1e9, // gas price link
            1e18 // wei per unit link
        );

        // Create subscription
        subscriptionId = vrfCoordinator.createSubscription();
        vrfCoordinator.fundSubscription(subscriptionId, 100 ether);

        // Deploy mock token
        token = new ERC20Mock("Mock MFER", "MFER", 18);

        // Deploy DiceBetting contract
        vm.prank(owner);
        diceBetting = new DiceBetting(
            address(vrfCoordinator),
            subscriptionId,
            keyHash,
            address(token)
        );

        // Add consumer to VRF subscription
        vrfCoordinator.addConsumer(subscriptionId, address(diceBetting));

        // Setup initial balances
        token.mint(player, INITIAL_BALANCE);
        token.mint(owner, HOUSE_BALANCE);

        // Deposit house balance
        vm.startPrank(owner);
        token.approve(address(diceBetting), HOUSE_BALANCE);
        diceBetting.depositHouse(HOUSE_BALANCE);
        vm.stopPrank();

        // Approve tokens for player
        vm.prank(player);
        token.approve(address(diceBetting), type(uint256).max);
    }

    function test_PlaceBet_ExactSum() public {
        uint256 betAmount = 100e18;

        vm.prank(player);
        uint256 requestId = diceBetting.placeBet(
            DiceBetting.BetType.Exact,
            7,
            betAmount
        );

        (
            address betPlayer,
            uint256 amount,
            DiceBetting.BetType betType,
            uint8 prediction,
            ,
            ,
            bool settled,
            ,

        ) = diceBetting.getBet(requestId);

        assertEq(betPlayer, player);
        assertEq(amount, betAmount);
        assertEq(uint8(betType), uint8(DiceBetting.BetType.Exact));
        assertEq(prediction, 7);
        assertFalse(settled);
    }

    function test_PlaceBet_OverSeven() public {
        uint256 betAmount = 100e18;

        vm.prank(player);
        uint256 requestId = diceBetting.placeBet(
            DiceBetting.BetType.Over,
            0,
            betAmount
        );

        (, , DiceBetting.BetType betType, , , , , , ) = diceBetting.getBet(requestId);
        assertEq(uint8(betType), uint8(DiceBetting.BetType.Over));
    }

    function test_SettleBet_WinExactSum() public {
        uint256 betAmount = 100e18;

        vm.prank(player);
        uint256 requestId = diceBetting.placeBet(
            DiceBetting.BetType.Exact,
            7,
            betAmount
        );

        // Simulate VRF response with dice that sum to 7 (e.g., 3 + 4)
        // die1 = (word1 % 6) + 1 = 3, so word1 % 6 = 2, word1 = 2
        // die2 = (word2 % 6) + 1 = 4, so word2 % 6 = 3, word2 = 3
        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = 2; // Results in die1 = 3
        randomWords[1] = 3; // Results in die2 = 4

        vrfCoordinator.fulfillRandomWordsWithOverride(
            requestId,
            address(diceBetting),
            randomWords
        );

        (
            ,
            ,
            ,
            ,
            uint8 die1,
            uint8 die2,
            bool settled,
            bool won,
            uint256 payout
        ) = diceBetting.getBet(requestId);

        assertEq(die1, 3);
        assertEq(die2, 4);
        assertTrue(settled);
        assertTrue(won);
        assertTrue(payout > 0);
    }

    function test_SettleBet_LoseExactSum() public {
        uint256 betAmount = 100e18;

        vm.prank(player);
        uint256 requestId = diceBetting.placeBet(
            DiceBetting.BetType.Exact,
            7,
            betAmount
        );

        // Simulate VRF response with dice that sum to 8 (e.g., 2 + 6)
        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = 1; // Results in die1 = 2
        randomWords[1] = 5; // Results in die2 = 6

        vrfCoordinator.fulfillRandomWordsWithOverride(
            requestId,
            address(diceBetting),
            randomWords
        );

        (
            ,
            ,
            ,
            ,
            uint8 die1,
            uint8 die2,
            bool settled,
            bool won,
            uint256 payout
        ) = diceBetting.getBet(requestId);

        assertEq(die1, 2);
        assertEq(die2, 6);
        assertTrue(settled);
        assertFalse(won);
        assertEq(payout, 0);
    }

    function test_SettleBet_WinDoubles() public {
        uint256 betAmount = 100e18;

        vm.prank(player);
        uint256 requestId = diceBetting.placeBet(
            DiceBetting.BetType.Doubles,
            0,
            betAmount
        );

        // Simulate VRF response with doubles (e.g., 4 + 4)
        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = 3; // Results in die1 = 4
        randomWords[1] = 3; // Results in die2 = 4

        vrfCoordinator.fulfillRandomWordsWithOverride(
            requestId,
            address(diceBetting),
            randomWords
        );

        (
            ,
            ,
            ,
            ,
            uint8 die1,
            uint8 die2,
            bool settled,
            bool won,

        ) = diceBetting.getBet(requestId);

        assertEq(die1, 4);
        assertEq(die2, 4);
        assertTrue(settled);
        assertTrue(won);
    }

    function test_SettleBet_WinOverSeven() public {
        uint256 betAmount = 100e18;

        vm.prank(player);
        uint256 requestId = diceBetting.placeBet(
            DiceBetting.BetType.Over,
            0,
            betAmount
        );

        // Simulate VRF response with sum > 7 (e.g., 5 + 6 = 11)
        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = 4; // Results in die1 = 5
        randomWords[1] = 5; // Results in die2 = 6

        vrfCoordinator.fulfillRandomWordsWithOverride(
            requestId,
            address(diceBetting),
            randomWords
        );

        (, , , , , , bool settled, bool won, ) = diceBetting.getBet(requestId);

        assertTrue(settled);
        assertTrue(won);
    }

    function test_RevertWhen_BetTooLow() public {
        uint256 betAmount = 0.5e18; // Below minimum

        vm.prank(player);
        vm.expectRevert(DiceBetting.BetAmountTooLow.selector);
        diceBetting.placeBet(DiceBetting.BetType.Exact, 7, betAmount);
    }

    function test_RevertWhen_InvalidPrediction() public {
        uint256 betAmount = 100e18;

        vm.prank(player);
        vm.expectRevert(DiceBetting.InvalidPrediction.selector);
        diceBetting.placeBet(DiceBetting.BetType.Exact, 13, betAmount); // 13 is invalid
    }

    function test_HouseDeposit() public {
        uint256 depositAmount = 1000e18;

        vm.startPrank(owner);
        token.mint(owner, depositAmount);
        token.approve(address(diceBetting), depositAmount);

        uint256 balanceBefore = diceBetting.houseBalance();
        diceBetting.depositHouse(depositAmount);
        uint256 balanceAfter = diceBetting.houseBalance();

        assertEq(balanceAfter - balanceBefore, depositAmount);
        vm.stopPrank();
    }

    function test_HouseWithdraw() public {
        uint256 withdrawAmount = 1000e18;

        vm.prank(owner);
        diceBetting.withdrawHouse(withdrawAmount);

        assertEq(token.balanceOf(owner), withdrawAmount);
    }

    function test_RevertWhen_NonOwnerWithdraws() public {
        vm.prank(player);
        vm.expectRevert();
        diceBetting.withdrawHouse(1000e18);
    }

    function testFuzz_DiceResults(uint256 word1, uint256 word2) public {
        uint8 die1 = uint8((word1 % 6) + 1);
        uint8 die2 = uint8((word2 % 6) + 1);

        assertTrue(die1 >= 1 && die1 <= 6, "Die 1 out of range");
        assertTrue(die2 >= 1 && die2 <= 6, "Die 2 out of range");

        uint8 sum = die1 + die2;
        assertTrue(sum >= 2 && sum <= 12, "Sum out of range");
    }
}
