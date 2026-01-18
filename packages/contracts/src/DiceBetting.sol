// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DiceBetting
 * @notice A provably fair dice betting game using Chainlink VRF v2.5
 * @dev Uses two random words from VRF to generate independent die results
 */
contract DiceBetting is VRFConsumerBaseV2Plus, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Bet types
    enum BetType {
        Exact,      // Predict exact sum (2-12)
        Over,       // Sum > 7
        Under,      // Sum < 7
        Odd,        // Sum is odd
        Even,       // Sum is even
        Doubles,    // Both dice show same number
        Range       // Sum falls within a range
    }

    // Range options for Range bet type
    enum RangeOption {
        Low,    // 2-6
        Mid,    // 5-9
        High    // 8-12
    }

    struct Bet {
        address player;
        uint256 amount;
        BetType betType;
        uint8 prediction;
        uint8 die1;
        uint8 die2;
        bool settled;
        bool won;
        uint256 payout;
    }

    // Constants
    uint256 public constant HOUSE_EDGE_BPS = 300; // 3% house edge
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MIN_BET = 1e18; // 1 token minimum

    // Chainlink VRF configuration
    uint256 public immutable subscriptionId;
    bytes32 public immutable keyHash;
    uint32 public constant CALLBACK_GAS_LIMIT = 200000;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant NUM_WORDS = 2; // Two random words for two dice

    // Token for betting
    IERC20 public immutable bettingToken;

    // House balance
    uint256 public houseBalance;

    // Bet storage
    mapping(uint256 => Bet) public bets;

    // Payout multipliers (scaled by 100 for precision)
    // Exact sum payouts based on probability
    mapping(uint8 => uint256) public exactPayouts;
    uint256 public overUnderPayout;
    uint256 public oddEvenPayout;
    uint256 public doublesPayout;
    mapping(uint8 => uint256) public rangePayouts;

    // Events
    event BetPlaced(
        uint256 indexed requestId,
        address indexed player,
        BetType betType,
        uint8 prediction,
        uint256 amount
    );

    event BetSettled(
        uint256 indexed requestId,
        address indexed player,
        uint8 die1,
        uint8 die2,
        bool won,
        uint256 payout
    );

    event HouseDeposit(address indexed depositor, uint256 amount);
    event HouseWithdraw(address indexed recipient, uint256 amount);

    // Errors
    error BetAmountTooLow();
    error InvalidPrediction();
    error InsufficientHouseBalance();
    error BetAlreadySettled();
    error TransferFailed();

    constructor(
        address _vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash,
        address _bettingToken
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) Ownable(msg.sender) {
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        bettingToken = IERC20(_bettingToken);

        // Initialize payout multipliers (with 3% house edge applied)
        // Formula: (36 / probability) * (1 - house_edge) * 100
        exactPayouts[2] = 3395;   // 1/36 chance -> 33.95x
        exactPayouts[3] = 1698;   // 2/36 chance -> 16.98x
        exactPayouts[4] = 1132;   // 3/36 chance -> 11.32x
        exactPayouts[5] = 849;    // 4/36 chance -> 8.49x
        exactPayouts[6] = 679;    // 5/36 chance -> 6.79x
        exactPayouts[7] = 566;    // 6/36 chance -> 5.66x
        exactPayouts[8] = 679;    // 5/36 chance -> 6.79x
        exactPayouts[9] = 849;    // 4/36 chance -> 8.49x
        exactPayouts[10] = 1132;  // 3/36 chance -> 11.32x
        exactPayouts[11] = 1698;  // 2/36 chance -> 16.98x
        exactPayouts[12] = 3395;  // 1/36 chance -> 33.95x

        overUnderPayout = 194;    // 15/36 chance -> 1.94x
        oddEvenPayout = 194;      // 18/36 chance -> 1.94x
        doublesPayout = 582;      // 6/36 chance -> 5.82x

        rangePayouts[uint8(RangeOption.Low)] = 349;   // 10/36 chance -> 3.49x
        rangePayouts[uint8(RangeOption.Mid)] = 175;   // 20/36 chance -> 1.75x
        rangePayouts[uint8(RangeOption.High)] = 349;  // 10/36 chance -> 3.49x
    }

    /**
     * @notice Place a bet
     * @param betType Type of bet
     * @param prediction Prediction value (depends on bet type)
     * @param amount Amount to bet
     * @return requestId VRF request ID
     */
    function placeBet(
        BetType betType,
        uint8 prediction,
        uint256 amount
    ) external nonReentrant returns (uint256 requestId) {
        if (amount < MIN_BET) revert BetAmountTooLow();

        // Validate prediction based on bet type
        _validatePrediction(betType, prediction);

        // Calculate max payout and ensure house can cover
        uint256 maxPayout = _calculatePayout(betType, prediction, amount);
        if (maxPayout > houseBalance + amount) revert InsufficientHouseBalance();

        // Transfer tokens from player
        bettingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Request randomness
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );

        // Store bet
        bets[requestId] = Bet({
            player: msg.sender,
            amount: amount,
            betType: betType,
            prediction: prediction,
            die1: 0,
            die2: 0,
            settled: false,
            won: false,
            payout: 0
        });

        emit BetPlaced(requestId, msg.sender, betType, prediction, amount);
    }

    /**
     * @notice VRF callback - settle the bet
     * @param requestId VRF request ID
     * @param randomWords Array of random words
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        Bet storage bet = bets[requestId];
        if (bet.settled) revert BetAlreadySettled();

        // Generate dice results (1-6 for each die)
        uint8 die1 = uint8((randomWords[0] % 6) + 1);
        uint8 die2 = uint8((randomWords[1] % 6) + 1);
        uint8 sum = die1 + die2;

        bet.die1 = die1;
        bet.die2 = die2;
        bet.settled = true;

        // Check if bet won
        bool won = _checkWin(bet.betType, bet.prediction, die1, die2, sum);
        bet.won = won;

        if (won) {
            uint256 payout = _calculatePayout(bet.betType, bet.prediction, bet.amount);
            bet.payout = payout;

            // Deduct from house balance (the bet amount was added to contract)
            houseBalance -= (payout - bet.amount);

            // Transfer winnings to player
            bettingToken.safeTransfer(bet.player, payout);
        } else {
            // Add lost bet to house balance
            houseBalance += bet.amount;
        }

        emit BetSettled(requestId, bet.player, die1, die2, won, bet.payout);
    }

    /**
     * @notice Validate prediction based on bet type
     */
    function _validatePrediction(BetType betType, uint8 prediction) internal pure {
        if (betType == BetType.Exact) {
            if (prediction < 2 || prediction > 12) revert InvalidPrediction();
        } else if (betType == BetType.Range) {
            if (prediction > 2) revert InvalidPrediction();
        }
        // Other bet types don't use prediction value
    }

    /**
     * @notice Check if a bet won
     */
    function _checkWin(
        BetType betType,
        uint8 prediction,
        uint8 die1,
        uint8 die2,
        uint8 sum
    ) internal pure returns (bool) {
        if (betType == BetType.Exact) {
            return sum == prediction;
        } else if (betType == BetType.Over) {
            return sum > 7;
        } else if (betType == BetType.Under) {
            return sum < 7;
        } else if (betType == BetType.Odd) {
            return sum % 2 == 1;
        } else if (betType == BetType.Even) {
            return sum % 2 == 0;
        } else if (betType == BetType.Doubles) {
            return die1 == die2;
        } else if (betType == BetType.Range) {
            if (prediction == uint8(RangeOption.Low)) {
                return sum >= 2 && sum <= 6;
            } else if (prediction == uint8(RangeOption.Mid)) {
                return sum >= 5 && sum <= 9;
            } else {
                return sum >= 8 && sum <= 12;
            }
        }
        return false;
    }

    /**
     * @notice Calculate payout for a bet
     */
    function _calculatePayout(
        BetType betType,
        uint8 prediction,
        uint256 amount
    ) internal view returns (uint256) {
        uint256 multiplier;

        if (betType == BetType.Exact) {
            multiplier = exactPayouts[prediction];
        } else if (betType == BetType.Over || betType == BetType.Under) {
            multiplier = overUnderPayout;
        } else if (betType == BetType.Odd || betType == BetType.Even) {
            multiplier = oddEvenPayout;
        } else if (betType == BetType.Doubles) {
            multiplier = doublesPayout;
        } else if (betType == BetType.Range) {
            multiplier = rangePayouts[prediction];
        }

        return (amount * multiplier) / 100;
    }

    /**
     * @notice Deposit tokens to house balance
     * @param amount Amount to deposit
     */
    function depositHouse(uint256 amount) external {
        bettingToken.safeTransferFrom(msg.sender, address(this), amount);
        houseBalance += amount;
        emit HouseDeposit(msg.sender, amount);
    }

    /**
     * @notice Withdraw tokens from house balance (owner only)
     * @param amount Amount to withdraw
     */
    function withdrawHouse(uint256 amount) external onlyOwner {
        if (amount > houseBalance) revert InsufficientHouseBalance();
        houseBalance -= amount;
        bettingToken.safeTransfer(msg.sender, amount);
        emit HouseWithdraw(msg.sender, amount);
    }

    /**
     * @notice Get bet details
     * @param requestId VRF request ID
     */
    function getBet(uint256 requestId) external view returns (
        address player,
        uint256 amount,
        BetType betType,
        uint8 prediction,
        uint8 die1,
        uint8 die2,
        bool settled,
        bool won,
        uint256 payout
    ) {
        Bet storage bet = bets[requestId];
        return (
            bet.player,
            bet.amount,
            bet.betType,
            bet.prediction,
            bet.die1,
            bet.die2,
            bet.settled,
            bet.won,
            bet.payout
        );
    }
}
