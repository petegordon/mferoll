// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

/**
 * @title SevenEleven
 * @notice A 7/11 dice game with multi-token support using Chainlink VRF
 * @dev Win on 7 or 11, lose on any other sum. 3x payout on wins, 10% fee.
 */
contract SevenEleven is VRFConsumerBaseV2Plus, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Token configuration
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
        uint256 totalFeePaid;      // Total USD cents paid as fees
        uint256 firstPlayTime;
        uint256 lastPlayTime;
        uint256 totalSessions;
    }

    // Pending VRF roll request
    struct PendingRoll {
        address player;
        address token;
        uint256 betAmount;
        uint256 feeAmount;
    }

    // Constants
    uint256 public constant BET_USD_CENTS = 25;      // $0.25
    uint256 public constant MIN_DEPOSIT_CENTS = 200; // $2.00
    uint256 public constant FEE_BPS = 1000;          // 10%
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant WIN_MULTIPLIER = 3;      // 3x payout
    uint256 public constant SESSION_GAP = 1 hours;
    uint32 public constant TWAP_PERIOD = 1800;       // 30 minutes for TWAP

    // Chainlink VRF configuration
    uint256 public immutable subscriptionId;
    bytes32 public immutable keyHash;
    uint32 public constant CALLBACK_GAS_LIMIT = 250000;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant NUM_WORDS = 2;

    // Addresses
    address public immutable FEE_RECIPIENT;          // drb.eth
    address public immutable WETH;
    AggregatorV3Interface public immutable ethUsdPriceFeed;

    // Token management
    mapping(address => TokenConfig) public supportedTokens;
    address[] public tokenList;

    // Player balances: player => token => balance
    mapping(address => mapping(address => uint256)) public playerBalances;

    // House liquidity: token => balance
    mapping(address => uint256) public houseLiquidity;

    // Player statistics
    mapping(address => PlayerStats) public playerStats;

    // Pending VRF requests
    mapping(uint256 => PendingRoll) public pendingRolls;

    // Events
    event TokenAdded(address indexed token, address uniswapPool);
    event TokenRemoved(address indexed token);
    event Deposited(address indexed player, address indexed token, uint256 amount);
    event Withdrawn(address indexed player, address indexed token, uint256 amount);
    event RollRequested(uint256 indexed requestId, address indexed player, address indexed token, uint256 betAmount);
    event RollSettled(uint256 indexed requestId, address indexed player, uint8 die1, uint8 die2, bool won, uint256 payout);
    event FeePaid(address indexed player, address indexed token, uint256 amount);
    event NewSession(address indexed player, uint256 sessionNumber);
    event HouseLiquidityDeposited(address indexed token, uint256 amount);
    event HouseLiquidityWithdrawn(address indexed token, uint256 amount);

    // Errors
    error TokenNotSupported();
    error InsufficientBalance();
    error InsufficientDeposit();
    error InsufficientHouseLiquidity();
    error InvalidAmount();
    error RollAlreadySettled();
    error PriceStale();
    error InvalidPrice();
    error PoolNotFound();

    constructor(
        address _vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash,
        address _feeRecipient,
        address _ethUsdPriceFeed,
        address _weth
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        FEE_RECIPIENT = _feeRecipient;
        ethUsdPriceFeed = AggregatorV3Interface(_ethUsdPriceFeed);
        WETH = _weth;
    }

    // ============ Player Functions ============

    /**
     * @notice Deposit tokens to play
     * @param token The token address to deposit
     * @param amount The amount to deposit
     */
    function deposit(address token, uint256 amount) external nonReentrant {
        TokenConfig storage config = supportedTokens[token];
        if (!config.enabled) revert TokenNotSupported();
        if (amount == 0) revert InvalidAmount();

        // Check minimum deposit in USD
        uint256 usdCents = getTokenValueInCents(token, amount);
        if (usdCents < MIN_DEPOSIT_CENTS) revert InsufficientDeposit();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        playerBalances[msg.sender][token] += amount;

        emit Deposited(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw tokens from balance
     * @param token The token address to withdraw
     * @param amount The amount to withdraw
     */
    function withdraw(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (playerBalances[msg.sender][token] < amount) revert InsufficientBalance();

        playerBalances[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, token, amount);
    }

    /**
     * @notice Roll the dice - costs $0.25 worth of tokens
     * @param token The token to bet with
     * @return requestId The VRF request ID
     */
    function roll(address token) external nonReentrant returns (uint256 requestId) {
        TokenConfig storage config = supportedTokens[token];
        if (!config.enabled) revert TokenNotSupported();

        uint256 betAmount = getBetAmount(token);
        uint256 feeAmount = (betAmount * FEE_BPS) / BPS_DENOMINATOR;
        uint256 totalRequired = betAmount;

        if (playerBalances[msg.sender][token] < totalRequired) revert InsufficientBalance();

        // Calculate potential payout (3x bet minus fee)
        uint256 netBet = betAmount - feeAmount;
        uint256 potentialPayout = netBet * WIN_MULTIPLIER;
        uint256 houseRisk = potentialPayout - netBet; // House pays 2x net bet on win

        if (houseLiquidity[token] < houseRisk) revert InsufficientHouseLiquidity();

        // Deduct bet from player balance
        playerBalances[msg.sender][token] -= totalRequired;

        // Transfer fee to recipient immediately
        IERC20(token).safeTransfer(FEE_RECIPIENT, feeAmount);

        // Update session tracking
        _updateSession(msg.sender);

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

        pendingRolls[requestId] = PendingRoll({
            player: msg.sender,
            token: token,
            betAmount: netBet, // Store net bet after fee
            feeAmount: feeAmount
        });

        // Update stats
        PlayerStats storage stats = playerStats[msg.sender];
        stats.totalFeePaid += getTokenValueInCents(token, feeAmount);

        emit RollRequested(requestId, msg.sender, token, betAmount);
        emit FeePaid(msg.sender, token, feeAmount);
    }

    /**
     * @notice VRF callback - settle the roll
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        PendingRoll storage pendingRoll = pendingRolls[requestId];
        if (pendingRoll.player == address(0)) revert RollAlreadySettled();

        address player = pendingRoll.player;
        address token = pendingRoll.token;
        uint256 netBet = pendingRoll.betAmount;

        // Generate dice results (1-6 for each die)
        uint8 die1 = uint8((randomWords[0] % 6) + 1);
        uint8 die2 = uint8((randomWords[1] % 6) + 1);
        uint8 sum = die1 + die2;

        // Check win condition: 7 or 11
        bool won = (sum == 7 || sum == 11);

        PlayerStats storage stats = playerStats[player];
        uint256 payout = 0;

        if (won) {
            // 3x payout on the net bet
            payout = netBet * WIN_MULTIPLIER;

            // House pays the extra 2x
            uint256 housePay = payout - netBet;
            houseLiquidity[token] -= housePay;

            // Credit player balance
            playerBalances[player][token] += payout;

            stats.totalWins++;
        } else {
            // House takes the net bet
            houseLiquidity[token] += netBet;
            stats.totalLosses++;
        }

        // Clear pending roll
        delete pendingRolls[requestId];

        emit RollSettled(requestId, player, die1, die2, won, payout);
    }

    // ============ Session Tracking ============

    function _updateSession(address player) internal {
        PlayerStats storage stats = playerStats[player];

        if (stats.firstPlayTime == 0) {
            stats.firstPlayTime = block.timestamp;
            stats.totalSessions = 1;
            emit NewSession(player, 1);
        } else if (block.timestamp - stats.lastPlayTime > SESSION_GAP) {
            stats.totalSessions++;
            emit NewSession(player, stats.totalSessions);
        }

        stats.lastPlayTime = block.timestamp;
    }

    // ============ Price Oracle Functions ============

    /**
     * @notice Get the current ETH/USD price from Chainlink
     * @return price ETH price in USD with 8 decimals
     */
    function getEthUsdPrice() public view returns (uint256 price) {
        (, int256 answer, , uint256 updatedAt, ) = ethUsdPriceFeed.latestRoundData();

        if (answer <= 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > 3600) revert PriceStale(); // 1 hour staleness

        return uint256(answer);
    }

    /**
     * @notice Get token price in ETH using Uniswap V3 TWAP
     * @param token The token address
     * @return priceX96 Token price in ETH (Q64.96 format)
     */
    function getTokenEthPrice(address token) public view returns (uint256 priceX96) {
        TokenConfig storage config = supportedTokens[token];
        if (config.uniswapPool == address(0)) revert PoolNotFound();

        IUniswapV3Pool pool = IUniswapV3Pool(config.uniswapPool);

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = TWAP_PERIOD;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives, ) = pool.observe(secondsAgos);

        int56 tickCumulativeDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 arithmeticMeanTick = int24(tickCumulativeDelta / int56(uint56(TWAP_PERIOD)));

        // Convert tick to sqrtPriceX96
        // price = 1.0001^tick
        // sqrtPriceX96 = sqrt(price) * 2^96
        uint160 sqrtPriceX96 = getSqrtRatioAtTick(arithmeticMeanTick);

        // price = sqrtPriceX96^2 / 2^192
        // For token0/token1, this gives price of token0 in terms of token1
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);

        if (config.isToken0) {
            // Token is token0, price is token0/token1 (token per WETH)
            // We want WETH per token, so invert
            priceX96 = (uint256(1) << 192) / priceX192;
        } else {
            // Token is token1, price is already token1/token0 = token per WETH
            // Invert to get WETH per token
            priceX96 = priceX192 >> 96;
        }
    }

    /**
     * @notice Get token value in USD cents
     * @param token The token address
     * @param amount The token amount
     * @return cents Value in USD cents
     */
    function getTokenValueInCents(address token, uint256 amount) public view returns (uint256 cents) {
        TokenConfig storage config = supportedTokens[token];
        if (!config.enabled) revert TokenNotSupported();

        // Get token price in ETH (Q64.96)
        uint256 tokenEthPriceX96 = getTokenEthPrice(token);

        // Get ETH/USD price (8 decimals)
        uint256 ethUsdPrice = getEthUsdPrice();

        // Calculate: amount * tokenEthPrice * ethUsdPrice / (10^tokenDecimals * 10^8) * 100 cents
        // Rearranging for precision: amount * tokenEthPrice * ethUsdPrice * 100 / (10^tokenDecimals * 10^8 * 2^96)

        uint256 tokenDecimals = config.decimals;

        // value in cents = amount * (tokenEthPriceX96 / 2^96) * (ethUsdPrice / 10^8) * 100 / 10^tokenDecimals
        // = amount * tokenEthPriceX96 * ethUsdPrice * 100 / (2^96 * 10^8 * 10^tokenDecimals)

        uint256 numerator = amount * tokenEthPriceX96 * ethUsdPrice * 100;
        uint256 denominator = (uint256(1) << 96) * 1e8 * (10 ** tokenDecimals);

        cents = numerator / denominator;
    }

    /**
     * @notice Get the amount of tokens needed for the bet ($0.25)
     * @param token The token address
     * @return amount The token amount for $0.25 bet
     */
    function getBetAmount(address token) public view returns (uint256 amount) {
        TokenConfig storage config = supportedTokens[token];
        if (!config.enabled) revert TokenNotSupported();

        // Get token price in ETH (Q64.96)
        uint256 tokenEthPriceX96 = getTokenEthPrice(token);

        // Get ETH/USD price (8 decimals)
        uint256 ethUsdPrice = getEthUsdPrice();

        uint256 tokenDecimals = config.decimals;

        // We want: amount * tokenEthPrice * ethUsdPrice = BET_USD_CENTS * 10^tokenDecimals * 10^8 / 100
        // amount = BET_USD_CENTS * 10^tokenDecimals * 10^8 * 2^96 / (100 * tokenEthPriceX96 * ethUsdPrice)

        uint256 numerator = BET_USD_CENTS * (10 ** tokenDecimals) * 1e8 * (uint256(1) << 96);
        uint256 denominator = 100 * tokenEthPriceX96 * ethUsdPrice;

        amount = numerator / denominator;
    }

    /**
     * @notice Get the minimum deposit amount for a token ($2.00)
     * @param token The token address
     * @return amount The minimum deposit amount
     */
    function getMinDeposit(address token) public view returns (uint256 amount) {
        // MIN_DEPOSIT_CENTS / BET_USD_CENTS * getBetAmount(token)
        return (getBetAmount(token) * MIN_DEPOSIT_CENTS) / BET_USD_CENTS;
    }

    // ============ View Functions ============

    /**
     * @notice Get player balance for a token
     */
    function getBalance(address player, address token) external view returns (uint256) {
        return playerBalances[player][token];
    }

    /**
     * @notice Get player statistics
     */
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }

    /**
     * @notice Get all supported tokens
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }

    /**
     * @notice Check if token is supported
     */
    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token].enabled;
    }

    // ============ Admin Functions ============

    /**
     * @notice Add a supported token
     * @param token The token address
     * @param uniswapPool The Uniswap V3 pool for token/WETH
     */
    function addToken(address token, address uniswapPool) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(uniswapPool != address(0), "Invalid pool");
        require(!supportedTokens[token].enabled, "Token already added");

        IUniswapV3Pool pool = IUniswapV3Pool(uniswapPool);
        address token0 = pool.token0();
        address token1 = pool.token1();

        bool isToken0 = (token == token0);
        require(isToken0 || token == token1, "Token not in pool");
        require((isToken0 ? token1 : token0) == WETH, "Pool must be token/WETH");

        uint8 decimals = IERC20Metadata(token).decimals();

        supportedTokens[token] = TokenConfig({
            token: token,
            uniswapPool: uniswapPool,
            decimals: decimals,
            enabled: true,
            isToken0: isToken0
        });

        tokenList.push(token);

        emit TokenAdded(token, uniswapPool);
    }

    /**
     * @notice Remove a supported token
     * @param token The token address
     */
    function removeToken(address token) external onlyOwner {
        require(supportedTokens[token].enabled, "Token not supported");

        supportedTokens[token].enabled = false;

        // Remove from tokenList
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
     * @notice Deposit house liquidity for a token
     * @param token The token address
     * @param amount The amount to deposit
     */
    function depositHouseLiquidity(address token, uint256 amount) external {
        TokenConfig storage config = supportedTokens[token];
        if (!config.enabled) revert TokenNotSupported();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        houseLiquidity[token] += amount;

        emit HouseLiquidityDeposited(token, amount);
    }

    /**
     * @notice Withdraw house liquidity (owner only)
     * @param token The token address
     * @param amount The amount to withdraw
     */
    function withdrawHouseLiquidity(address token, uint256 amount) external onlyOwner {
        if (houseLiquidity[token] < amount) revert InsufficientHouseLiquidity();

        houseLiquidity[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit HouseLiquidityWithdrawn(token, amount);
    }

    // ============ Math Helpers ============

    /**
     * @notice Compute sqrt price from tick
     * @dev From Uniswap V3 TickMath library (simplified)
     */
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
}
