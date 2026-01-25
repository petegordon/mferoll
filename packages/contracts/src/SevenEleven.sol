// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEntropyV2} from "./pyth/IEntropyV2.sol";
import {IEntropyConsumer} from "./pyth/IEntropyConsumer.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

/**
 * @title SevenEleven V2
 * @notice A 7/11 dice game with new economics: bet USDC/WETH, win meme coins
 * @dev V2 changes:
 *      - Bet: $0.40 per roll (USDC or WETH)
 *      - Min deposit: $4.00
 *      - Win 7/11: Bet returned + 0.5x profit in meme coins
 *      - Win Doubles: Bet returned + 2x profit in meme coins
 *      - Loss: House keeps bet, $0.02 MFER sent to Grok wallet
 *      - Winnings: 1/3 MFER, 1/3 BNKR, 1/3 DRB sent directly to wallet
 */
contract SevenEleven is IEntropyConsumer, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum WinType {
        None,       // Loss
        SevenOrEleven,  // 1.5x
        Doubles     // 3x
    }

    // Roll outcome for events (matches WinType values)
    enum RollOutcome {
        Loss,       // 0 - Lost
        Win,        // 1 - Won with 7 or 11
        Doubles     // 2 - Won with doubles
    }

    // ============ Structs ============

    // Token configuration for deposit tokens
    struct TokenConfig {
        address token;
        address uniswapPool;       // Uniswap V3 pool for token/WETH
        uint8 decimals;
        bool enabled;
        bool isToken0;             // Is this token token0 in the Uniswap pool?
    }

    // Player statistics
    struct PlayerStats {
        uint256 totalWins;
        uint256 totalLosses;
        uint256 totalDoublesWon;   // Specifically track doubles wins
        uint256 firstPlayTime;
        uint256 lastPlayTime;
        uint256 totalSessions;
        // Session stats (reset when new session starts after 1hr gap)
        uint256 sessionWins;
        uint256 sessionLosses;
        uint256 sessionDoublesWon;
    }

    // Pending VRF roll request
    struct PendingRoll {
        address player;
        address depositToken;      // Token used for bet (USDC or WETH)
        uint256 betAmount;         // Amount in deposit token
        uint256 betUsdCents;       // Bet value in USD cents for payout calculation
    }

    // ============ Constants ============

    uint256 public constant BET_USD_CENTS = 40;           // $0.40
    uint256 public constant MIN_DEPOSIT_CENTS = 400;      // $4.00
    uint256 public constant LOSS_SKIM_CENTS = 2;          // $0.02
    uint256 public constant WIN_7_11_BPS = 5000;          // 0.5x profit
    uint256 public constant WIN_DOUBLES_BPS = 20000;      // 2x profit
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant SESSION_GAP = 1 hours;
    uint32 public constant TWAP_PERIOD = 1800;            // 30 minutes for TWAP

    // Reserve warning threshold (enough for ~100 max payouts)
    uint256 public constant RESERVE_WARNING_THRESHOLD = 100 * BET_USD_CENTS * 2; // ~$80 worth

    // ============ Immutables ============

    IEntropyV2 public immutable entropy;
    address public immutable WETH;
    address public immutable USDC;
    AggregatorV3Interface public immutable ethUsdPriceFeed;

    // Meme token addresses
    address public immutable MFER;
    address public immutable BNKR;
    address public immutable DRB;

    // Grok AI wallet for loss skim
    address public immutable GROK_WALLET;

    // ============ State Variables ============

    // Token management for deposit tokens
    mapping(address => TokenConfig) public supportedTokens;
    address[] public tokenList;

    // Deposit token whitelist (only USDC and WETH)
    mapping(address => bool) public isDepositToken;

    // Payout reserves: meme token => balance
    mapping(address => uint256) public payoutReserves;

    // Mock token flag for testnet (uses 1:1 pricing)
    mapping(address => bool) public isMockToken;

    // Player balances: player => token => balance (only for deposit tokens)
    mapping(address => mapping(address => uint256)) public playerBalances;

    // House liquidity: token => balance (for deposit tokens)
    mapping(address => uint256) public houseLiquidity;

    // Player statistics
    mapping(address => PlayerStats) public playerStats;

    // Cumulative meme token winnings per player
    mapping(address => uint256) public totalMferWon;
    mapping(address => uint256) public totalBnkrWon;
    mapping(address => uint256) public totalDrbWon;

    // Cumulative skim paid per player (MFER sent to Grok on losses)
    mapping(address => uint256) public totalSkimPaid;

    // Global Grok wallet stats
    uint256 public totalGrokSkimAmount;  // Total MFER sent to Grok
    uint256 public totalGrokSkimCount;   // Number of skim transfers

    // Pending VRF requests: sequenceNumber => PendingRoll
    mapping(uint64 => PendingRoll) public pendingRolls;

    // Authorized rollers: player => authorized roller address (for gasless rolls)
    mapping(address => address) public authorizedRollers;

    // Stablecoin flag (1 token = $1)
    mapping(address => bool) public isStablecoin;

    // ============ Events ============

    event TokenAdded(address indexed token, address uniswapPool);
    event TokenRemoved(address indexed token);
    event Deposited(address indexed player, address indexed token, uint256 amount);
    event Withdrawn(address indexed player, address indexed token, uint256 amount);
    event WithdrawnAll(address indexed player, uint256 usdcAmount, uint256 wethAmount);
    event RollRequested(uint64 indexed sequenceNumber, address indexed player, address indexed token, uint256 betAmount);
    event RollSettled(
        uint64 indexed sequenceNumber,
        address indexed player,
        uint8 die1,
        uint8 die2,
        RollOutcome rollOutcome,
        uint256 mferPayout,
        uint256 bnkrPayout,
        uint256 drbPayout,
        uint256 mferSkimmed,       // MFER sent to Grok (0 on win)
        uint256 playerBalance      // USDC balance after roll
    );
    event SessionEnded(
        address indexed player,
        uint256 sessionNumber,
        uint256 sessionWins,
        uint256 sessionLosses,
        uint256 sessionDoublesWon,
        uint256 lastRollTime
    );
    event NewSession(address indexed player, uint256 sessionNumber);
    event PayoutReservesDeposited(address indexed token, uint256 amount);
    event PayoutReservesWithdrawn(address indexed token, uint256 amount);
    event ReservesLow(address indexed token, uint256 currentAmount, uint256 threshold);
    event RollerAuthorized(address indexed player, address indexed roller);
    event RollerRevoked(address indexed player, address indexed previousRoller);
    event MockTokenSet(address indexed token, bool isMock);

    // ============ Errors ============

    error TokenNotSupported();
    error TokenNotDepositToken();
    error InsufficientBalance();
    error InsufficientDeposit();
    error InsufficientPayoutReserves();
    error InvalidAmount();
    error RollAlreadySettled();
    error PriceStale();
    error InvalidPrice();
    error PoolNotFound();
    error InsufficientFee();
    error NotAuthorized();

    // ============ Constructor ============

    constructor(
        address _entropy,
        address _ethUsdPriceFeed,
        address _weth,
        address _usdc,
        address _mfer,
        address _bnkr,
        address _drb,
        address _grokWallet
    ) Ownable(msg.sender) {
        entropy = IEntropyV2(_entropy);
        ethUsdPriceFeed = AggregatorV3Interface(_ethUsdPriceFeed);
        WETH = _weth;
        USDC = _usdc;
        MFER = _mfer;
        BNKR = _bnkr;
        DRB = _drb;
        GROK_WALLET = _grokWallet;

        // Mark deposit tokens
        isDepositToken[_usdc] = true;
        isDepositToken[_weth] = true;
    }

    // ============ Pyth Entropy Interface ============

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    /**
     * @notice Callback from Pyth Entropy when randomness is ready
     */
    function entropyCallback(
        uint64 sequenceNumber,
        address /* provider */,
        bytes32 randomNumber
    ) internal override {
        PendingRoll storage pendingRoll = pendingRolls[sequenceNumber];

        if (pendingRoll.player == address(0)) {
            return;
        }

        address player = pendingRoll.player;
        address depositToken = pendingRoll.depositToken;
        uint256 betAmount = pendingRoll.betAmount;
        uint256 betUsdCents = pendingRoll.betUsdCents;

        // Generate dice results
        uint256 rand = uint256(randomNumber);
        uint8 die1 = uint8((rand % 6) + 1);
        uint8 die2 = uint8(((rand >> 128) % 6) + 1);
        uint8 sum = die1 + die2;

        // Determine win type
        WinType winType = _determineWinType(die1, die2, sum);

        PlayerStats storage stats = playerStats[player];

        uint256 mferPayout = 0;
        uint256 bnkrPayout = 0;
        uint256 drbPayout = 0;
        uint256 skimAmount = 0;

        if (winType == WinType.Doubles) {
            // Return bet to player + 2x profit in meme coins
            playerBalances[player][depositToken] += betAmount;
            uint256 profitCents = betUsdCents * 2;
            (mferPayout, bnkrPayout, drbPayout) = _sendMemeTokenPayout(player, profitCents);
            stats.totalWins++;
            stats.totalDoublesWon++;
            stats.sessionWins++;
            stats.sessionDoublesWon++;
        } else if (winType == WinType.SevenOrEleven) {
            // Return bet to player + 0.5x profit in meme coins
            playerBalances[player][depositToken] += betAmount;
            uint256 profitCents = betUsdCents / 2;
            (mferPayout, bnkrPayout, drbPayout) = _sendMemeTokenPayout(player, profitCents);
            stats.totalWins++;
            stats.sessionWins++;
        } else {
            // Loss: house takes bet, send MFER skim to Grok
            skimAmount = _handleLoss(player, depositToken, betAmount);
            stats.totalLosses++;
            stats.sessionLosses++;
        }

        delete pendingRolls[sequenceNumber];

        // Convert WinType to RollOutcome for event
        RollOutcome rollOutcome = winType == WinType.Doubles ? RollOutcome.Doubles :
                                  winType == WinType.SevenOrEleven ? RollOutcome.Win :
                                  RollOutcome.Loss;

        emit RollSettled(
            sequenceNumber,
            player,
            die1,
            die2,
            rollOutcome,
            mferPayout,
            bnkrPayout,
            drbPayout,
            skimAmount,
            playerBalances[player][depositToken]
        );
    }

    // ============ Player Functions ============

    /**
     * @notice Deposit tokens to play (USDC or WETH only)
     */
    function deposit(address token, uint256 amount) external nonReentrant {
        if (!isDepositToken[token]) revert TokenNotDepositToken();
        TokenConfig storage config = supportedTokens[token];
        if (!config.enabled) revert TokenNotSupported();
        if (amount == 0) revert InvalidAmount();

        uint256 usdCents = getTokenValueInCents(token, amount);
        if (usdCents < MIN_DEPOSIT_CENTS) revert InsufficientDeposit();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        playerBalances[msg.sender][token] += amount;

        emit Deposited(msg.sender, token, amount);
    }

    /**
     * @notice Deposit and authorize a roller in one transaction
     */
    function depositAndAuthorize(address token, uint256 amount, address roller) external nonReentrant {
        if (!isDepositToken[token]) revert TokenNotDepositToken();
        TokenConfig storage config = supportedTokens[token];
        if (!config.enabled) revert TokenNotSupported();
        if (amount == 0) revert InvalidAmount();

        uint256 usdCents = getTokenValueInCents(token, amount);
        if (usdCents < MIN_DEPOSIT_CENTS) revert InsufficientDeposit();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        playerBalances[msg.sender][token] += amount;

        address previousRoller = authorizedRollers[msg.sender];
        authorizedRollers[msg.sender] = roller;

        emit Deposited(msg.sender, token, amount);
        if (previousRoller != address(0) && previousRoller != roller) {
            emit RollerRevoked(msg.sender, previousRoller);
        }
        emit RollerAuthorized(msg.sender, roller);
    }

    /**
     * @notice Deposit with permit and authorize
     */
    function depositAndAuthorizeWithPermit(
        address token,
        uint256 amount,
        address roller,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        if (!isDepositToken[token]) revert TokenNotDepositToken();
        TokenConfig storage config = supportedTokens[token];
        if (!config.enabled) revert TokenNotSupported();
        if (amount == 0) revert InvalidAmount();

        uint256 usdCents = getTokenValueInCents(token, amount);
        if (usdCents < MIN_DEPOSIT_CENTS) revert InsufficientDeposit();

        IERC20Permit(token).permit(msg.sender, address(this), amount, deadline, v, r, s);
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        playerBalances[msg.sender][token] += amount;

        address previousRoller = authorizedRollers[msg.sender];
        authorizedRollers[msg.sender] = roller;

        emit Deposited(msg.sender, token, amount);
        if (previousRoller != address(0) && previousRoller != roller) {
            emit RollerRevoked(msg.sender, previousRoller);
        }
        emit RollerAuthorized(msg.sender, roller);
    }

    /**
     * @notice Withdraw specific token from game balance
     */
    function withdraw(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (playerBalances[msg.sender][token] < amount) revert InsufficientBalance();

        playerBalances[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw all deposit tokens (USDC and WETH)
     */
    function withdrawAll() external nonReentrant {
        uint256 usdcBal = playerBalances[msg.sender][USDC];
        uint256 wethBal = playerBalances[msg.sender][WETH];

        if (usdcBal > 0) {
            playerBalances[msg.sender][USDC] = 0;
            IERC20(USDC).safeTransfer(msg.sender, usdcBal);
        }
        if (wethBal > 0) {
            playerBalances[msg.sender][WETH] = 0;
            IERC20(WETH).safeTransfer(msg.sender, wethBal);
        }

        emit WithdrawnAll(msg.sender, usdcBal, wethBal);
    }

    /**
     * @notice Get the current Pyth Entropy fee
     */
    function getEntropyFee() public view returns (uint256 fee) {
        return entropy.getFeeV2();
    }

    /**
     * @notice Roll the dice
     */
    function roll(address token) external nonReentrant returns (uint64 sequenceNumber) {
        return _roll(msg.sender, token);
    }

    /**
     * @notice Roll on behalf of another player (requires authorization)
     */
    function rollFor(address player, address token) external nonReentrant returns (uint64 sequenceNumber) {
        if (authorizedRollers[player] != msg.sender) revert NotAuthorized();
        return _roll(player, token);
    }

    /**
     * @notice Authorize a roller for gasless rolls
     */
    function authorizeRoller(address roller) external {
        address previousRoller = authorizedRollers[msg.sender];
        authorizedRollers[msg.sender] = roller;

        if (previousRoller != address(0)) {
            emit RollerRevoked(msg.sender, previousRoller);
        }
        emit RollerAuthorized(msg.sender, roller);
    }

    /**
     * @notice Revoke roller authorization
     */
    function revokeRoller() external {
        address previousRoller = authorizedRollers[msg.sender];
        if (previousRoller != address(0)) {
            delete authorizedRollers[msg.sender];
            emit RollerRevoked(msg.sender, previousRoller);
        }
    }

    // ============ Internal Game Logic ============

    function _roll(address player, address token) internal returns (uint64 sequenceNumber) {
        if (!isDepositToken[token]) revert TokenNotDepositToken();
        TokenConfig storage config = supportedTokens[token];
        if (!config.enabled) revert TokenNotSupported();

        uint256 entropyFee = entropy.getFeeV2();
        if (address(this).balance < entropyFee) revert InsufficientFee();

        uint256 betAmount = getBetAmount(token);
        if (playerBalances[player][token] < betAmount) revert InsufficientBalance();

        // Check payout reserves can cover max win (2x profit for doubles)
        uint256 maxPayoutCents = BET_USD_CENTS * 2;
        _checkPayoutReserves(maxPayoutCents);

        // Deduct bet from player
        playerBalances[player][token] -= betAmount;

        // Update session
        _updateSession(player);

        // Request randomness
        sequenceNumber = entropy.requestV2{value: entropyFee}();

        pendingRolls[sequenceNumber] = PendingRoll({
            player: player,
            depositToken: token,
            betAmount: betAmount,
            betUsdCents: BET_USD_CENTS
        });

        emit RollRequested(sequenceNumber, player, token, betAmount);
    }

    /**
     * @notice Determine win type from dice results
     * @dev Doubles are checked first (higher payout)
     */
    function _determineWinType(uint8 die1, uint8 die2, uint8 sum) internal pure returns (WinType) {
        // Check doubles first (higher payout)
        if (die1 == die2) {
            return WinType.Doubles;
        }
        // Then check 7 or 11
        if (sum == 7 || sum == 11) {
            return WinType.SevenOrEleven;
        }
        return WinType.None;
    }

    /**
     * @notice Send meme token payout directly to player's wallet
     * @param player The player's wallet address
     * @param totalUsdCents Total payout value in USD cents
     */
    function _sendMemeTokenPayout(address player, uint256 totalUsdCents)
        internal
        returns (uint256 mferAmount, uint256 bnkrAmount, uint256 drbAmount)
    {
        // Split into thirds (1/3 each)
        uint256 thirdCents = totalUsdCents / 3;

        // Convert USD cents to token amounts
        mferAmount = _centsToTokenAmount(MFER, thirdCents);
        bnkrAmount = _centsToTokenAmount(BNKR, thirdCents);
        // DRB gets remainder to ensure exact total
        drbAmount = _centsToTokenAmount(DRB, totalUsdCents - (thirdCents * 2));

        // Deduct from reserves
        payoutReserves[MFER] -= mferAmount;
        payoutReserves[BNKR] -= bnkrAmount;
        payoutReserves[DRB] -= drbAmount;

        // Transfer directly to player's wallet
        IERC20(MFER).safeTransfer(player, mferAmount);
        IERC20(BNKR).safeTransfer(player, bnkrAmount);
        IERC20(DRB).safeTransfer(player, drbAmount);

        // Track cumulative winnings
        totalMferWon[player] += mferAmount;
        totalBnkrWon[player] += bnkrAmount;
        totalDrbWon[player] += drbAmount;
    }

    /**
     * @notice Handle a loss: house takes bet, send MFER skim to Grok
     * @return skimAmount The amount of MFER sent to Grok (0 if insufficient reserves)
     */
    function _handleLoss(address player, address depositToken, uint256 betAmount) internal returns (uint256 skimAmount) {
        // House takes the bet
        houseLiquidity[depositToken] += betAmount;

        // Send $0.02 MFER to Grok wallet
        skimAmount = _centsToTokenAmount(MFER, LOSS_SKIM_CENTS);

        if (payoutReserves[MFER] >= skimAmount) {
            payoutReserves[MFER] -= skimAmount;
            totalSkimPaid[player] += skimAmount;
            totalGrokSkimAmount += skimAmount;
            totalGrokSkimCount++;
            IERC20(MFER).safeTransfer(GROK_WALLET, skimAmount);
        } else {
            skimAmount = 0;
        }
    }

    /**
     * @notice Convert USD cents to token amount
     */
    function _centsToTokenAmount(address token, uint256 cents) internal view returns (uint256 amount) {
        // For mock tokens on testnet, use 1:1 pricing ($0.01 per token)
        if (isMockToken[token]) {
            // 1 cent = 0.01 tokens with 18 decimals
            // Actually, let's make mock tokens $0.001 each so amounts are reasonable
            // 1 cent = 10 tokens
            return cents * 10 * 1e18;
        }

        // Get token price in ETH
        uint256 tokenEthPriceX96 = getTokenEthPrice(token);
        uint256 ethUsdPrice = getEthUsdPrice();
        uint8 decimals = IERC20Metadata(token).decimals();

        // cents * tokenDecimals * ethPriceUnit * Q96
        // divided by (100 * tokenEthPrice * ethUsdPrice)
        uint256 numerator = cents * (10 ** decimals) * 1e8 * (uint256(1) << 96);
        uint256 denominator = 100 * tokenEthPriceX96 * ethUsdPrice;

        amount = numerator / denominator;
    }

    /**
     * @notice Check if payout reserves can cover the maximum payout
     */
    function _checkPayoutReserves(uint256 maxPayoutCents) internal view {
        uint256 thirdCents = maxPayoutCents / 3;

        uint256 mferNeeded = _centsToTokenAmount(MFER, thirdCents);
        uint256 bnkrNeeded = _centsToTokenAmount(BNKR, thirdCents);
        uint256 drbNeeded = _centsToTokenAmount(DRB, maxPayoutCents - (thirdCents * 2));

        if (payoutReserves[MFER] < mferNeeded) revert InsufficientPayoutReserves();
        if (payoutReserves[BNKR] < bnkrNeeded) revert InsufficientPayoutReserves();
        if (payoutReserves[DRB] < drbNeeded) revert InsufficientPayoutReserves();
    }

    function _updateSession(address player) internal {
        PlayerStats storage stats = playerStats[player];

        if (stats.firstPlayTime == 0) {
            stats.firstPlayTime = block.timestamp;
            stats.totalSessions = 1;
            stats.sessionWins = 0;
            stats.sessionLosses = 0;
            stats.sessionDoublesWon = 0;
            emit NewSession(player, 1);
        } else if (block.timestamp - stats.lastPlayTime > SESSION_GAP) {
            // Emit previous session data BEFORE resetting
            emit SessionEnded(
                player,
                stats.totalSessions,
                stats.sessionWins,
                stats.sessionLosses,
                stats.sessionDoublesWon,
                stats.lastPlayTime
            );

            // Start new session
            stats.totalSessions++;
            stats.sessionWins = 0;
            stats.sessionLosses = 0;
            stats.sessionDoublesWon = 0;
            emit NewSession(player, stats.totalSessions);
        }

        stats.lastPlayTime = block.timestamp;
    }

    // ============ Price Oracle Functions ============

    function getEthUsdPrice() public view returns (uint256 price) {
        (, int256 answer, , uint256 updatedAt, ) = ethUsdPriceFeed.latestRoundData();

        if (answer <= 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > 3600) revert PriceStale();

        return uint256(answer);
    }

    function getTokenEthPrice(address token) public view returns (uint256 priceX96) {
        if (token == WETH) {
            return uint256(1) << 96;
        }

        TokenConfig storage config = supportedTokens[token];
        if (config.uniswapPool == address(0)) revert PoolNotFound();

        IUniswapV3Pool pool = IUniswapV3Pool(config.uniswapPool);

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = TWAP_PERIOD;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives, ) = pool.observe(secondsAgos);

        int56 tickCumulativeDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 arithmeticMeanTick = int24(tickCumulativeDelta / int56(uint56(TWAP_PERIOD)));

        uint160 sqrtPriceX96 = getSqrtRatioAtTick(arithmeticMeanTick);
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);

        if (config.isToken0) {
            priceX96 = (uint256(1) << 192) / priceX192;
        } else {
            priceX96 = priceX192 >> 96;
        }
    }

    function getTokenValueInCents(address token, uint256 amount) public view returns (uint256 cents) {
        TokenConfig storage config = supportedTokens[token];
        if (!config.enabled) revert TokenNotSupported();

        if (isStablecoin[token]) {
            return (amount * 100) / (10 ** config.decimals);
        }

        uint256 tokenEthPriceX96 = getTokenEthPrice(token);
        uint256 ethUsdPrice = getEthUsdPrice();
        uint256 tokenDecimals = config.decimals;

        uint256 numerator = amount * tokenEthPriceX96 * ethUsdPrice * 100;
        uint256 denominator = (uint256(1) << 96) * 1e8 * (10 ** tokenDecimals);

        cents = numerator / denominator;
    }

    function getBetAmount(address token) public view returns (uint256 amount) {
        TokenConfig storage config = supportedTokens[token];
        if (!config.enabled) revert TokenNotSupported();

        if (isStablecoin[token]) {
            return (BET_USD_CENTS * (10 ** config.decimals)) / 100;
        }

        uint256 tokenEthPriceX96 = getTokenEthPrice(token);
        uint256 ethUsdPrice = getEthUsdPrice();
        uint256 tokenDecimals = config.decimals;

        uint256 numerator = BET_USD_CENTS * (10 ** tokenDecimals) * 1e8 * (uint256(1) << 96);
        uint256 denominator = 100 * tokenEthPriceX96 * ethUsdPrice;

        amount = numerator / denominator;
    }

    function getMinDeposit(address token) public view returns (uint256 amount) {
        return (getBetAmount(token) * MIN_DEPOSIT_CENTS) / BET_USD_CENTS;
    }

    // ============ View Functions ============

    function getBalance(address player, address token) external view returns (uint256) {
        return playerBalances[player][token];
    }

    function getPlayerStats(address player) external view returns (
        uint256 totalWins,
        uint256 totalLosses,
        uint256 totalDoublesWon,
        uint256 firstPlayTime,
        uint256 lastPlayTime,
        uint256 totalSessions,
        uint256 sessionWins,
        uint256 sessionLosses,
        uint256 sessionDoublesWon
    ) {
        PlayerStats storage stats = playerStats[player];
        return (
            stats.totalWins,
            stats.totalLosses,
            stats.totalDoublesWon,
            stats.firstPlayTime,
            stats.lastPlayTime,
            stats.totalSessions,
            stats.sessionWins,
            stats.sessionLosses,
            stats.sessionDoublesWon
        );
    }

    function getPlayerMemeWinnings(address player) external view returns (uint256 mfer, uint256 bnkr, uint256 drb) {
        return (totalMferWon[player], totalBnkrWon[player], totalDrbWon[player]);
    }

    function getPlayerSkimPaid(address player) external view returns (uint256) {
        return totalSkimPaid[player];
    }

    function getGrokStats() external view returns (uint256 totalAmount, uint256 totalCount) {
        return (totalGrokSkimAmount, totalGrokSkimCount);
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }

    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token].enabled;
    }

    function getAuthorizedRoller(address player) external view returns (address) {
        return authorizedRollers[player];
    }

    function canRollFor(address roller, address player) external view returns (bool) {
        return authorizedRollers[player] == roller;
    }

    function getPayoutReserves() external view returns (uint256 mfer, uint256 bnkr, uint256 drb) {
        return (payoutReserves[MFER], payoutReserves[BNKR], payoutReserves[DRB]);
    }

    // ============ Admin Functions ============

    function addWeth() external onlyOwner {
        require(!supportedTokens[WETH].enabled, "WETH already added");

        supportedTokens[WETH] = TokenConfig({
            token: WETH,
            uniswapPool: address(0),
            decimals: 18,
            enabled: true,
            isToken0: false
        });

        tokenList.push(WETH);
        emit TokenAdded(WETH, address(0));
    }

    function addStablecoin(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(!supportedTokens[token].enabled, "Token already added");

        uint8 decimals = IERC20Metadata(token).decimals();

        supportedTokens[token] = TokenConfig({
            token: token,
            uniswapPool: address(0),
            decimals: decimals,
            enabled: true,
            isToken0: false
        });

        isStablecoin[token] = true;
        tokenList.push(token);
        emit TokenAdded(token, address(0));
    }

    function addToken(address token, address uniswapPool) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(token != WETH, "Use addWeth() for WETH");
        require(uniswapPool != address(0), "Invalid pool");
        require(!supportedTokens[token].enabled, "Token already added");

        IUniswapV3Pool pool = IUniswapV3Pool(uniswapPool);
        address token0 = pool.token0();
        address token1 = pool.token1();

        bool _isToken0 = (token == token0);
        require(_isToken0 || token == token1, "Token not in pool");
        require((_isToken0 ? token1 : token0) == WETH, "Pool must be token/WETH");

        uint8 decimals = IERC20Metadata(token).decimals();

        supportedTokens[token] = TokenConfig({
            token: token,
            uniswapPool: uniswapPool,
            decimals: decimals,
            enabled: true,
            isToken0: _isToken0
        });

        tokenList.push(token);
        emit TokenAdded(token, uniswapPool);
    }

    function removeToken(address token) external onlyOwner {
        require(supportedTokens[token].enabled, "Token not supported");

        supportedTokens[token].enabled = false;

        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i] == token) {
                tokenList[i] = tokenList[tokenList.length - 1];
                tokenList.pop();
                break;
            }
        }

        emit TokenRemoved(token);
    }

    /**
     * @notice Set mock token flag for testnet pricing
     */
    function setMockToken(address token, bool _isMock) external onlyOwner {
        isMockToken[token] = _isMock;
        emit MockTokenSet(token, _isMock);
    }

    /**
     * @notice Deposit payout reserves (meme coins for winning payouts)
     */
    function depositPayoutReserves(address token, uint256 amount) external {
        require(token == MFER || token == BNKR || token == DRB, "Invalid payout token");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        payoutReserves[token] += amount;

        emit PayoutReservesDeposited(token, amount);
    }

    /**
     * @notice Withdraw payout reserves (owner only)
     */
    function withdrawPayoutReserves(address token, uint256 amount) external onlyOwner {
        require(token == MFER || token == BNKR || token == DRB, "Invalid payout token");
        require(payoutReserves[token] >= amount, "Insufficient reserves");

        payoutReserves[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit PayoutReservesWithdrawn(token, amount);
    }

    function depositHouseLiquidity(address token, uint256 amount) external {
        TokenConfig storage config = supportedTokens[token];
        if (!config.enabled) revert TokenNotSupported();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        houseLiquidity[token] += amount;
    }

    function withdrawHouseLiquidity(address token, uint256 amount) external onlyOwner {
        require(houseLiquidity[token] >= amount, "Insufficient house liquidity");

        houseLiquidity[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    // ============ Math Helpers ============

    function getSqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
        require(absTick <= uint256(int256(type(int24).max)), "T");

        uint256 ratio = absTick & 0x1 != 0 ? 0xfffcb933bd6fad37aa2d162d1a594001 : 0x100000000000000000000000000000000;
        if (absTick & 0x2 != 0) ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
        if (absTick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
        if (absTick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
        if (absTick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
        if (absTick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
        if (absTick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
        if (absTick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
        if (absTick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
        if (absTick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
        if (absTick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
        if (absTick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
        if (absTick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
        if (absTick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
        if (absTick & 0x4000 != 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
        if (absTick & 0x8000 != 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
        if (absTick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
        if (absTick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
        if (absTick & 0x40000 != 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
        if (absTick & 0x80000 != 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;

        if (tick > 0) ratio = type(uint256).max / ratio;

        sqrtPriceX96 = uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
    }

    function depositEntropyFunds() external payable {}

    function withdrawEntropyFunds(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient ETH balance");
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    function getEntropyBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}
