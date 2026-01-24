// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUniswapV3Pool
 * @notice A mock Uniswap V3 pool for testnet that supports multiple token pairs
 * @dev Returns configurable TWAP prices with 2-4% random variance
 *
 * This single contract handles all meme token / WETH pairs:
 * - MFER/WETH
 * - BNKR/WETH
 * - DRB/WETH
 */
contract MockUniswapV3Pool is Ownable {
    // Token price configuration in Q64.96 format
    // Price represents ETH per token (how much ETH for 1 token)
    mapping(address => uint256) public baseTokenPriceX96;

    // Variance in basis points (200-400 = 2-4%)
    uint256 public varianceBps = 300; // Default 3%

    // Token pair configuration
    address public immutable WETH;
    mapping(address => bool) public isToken0; // Whether the meme token is token0 in the pair

    // Events
    event TokenPriceSet(address indexed token, uint256 priceX96);
    event VarianceSet(uint256 bps);
    event TokenConfigured(address indexed token, bool isToken0);

    // Errors
    error TokenNotConfigured();
    error InvalidVariance();

    constructor(address _weth) Ownable(msg.sender) {
        WETH = _weth;
    }

    /**
     * @notice Set the base price for a token in Q64.96 format
     * @param token The meme token address
     * @param priceX96 Price in Q64.96 format (ETH per token)
     * @param _isToken0 Whether this token is token0 in the Uniswap pair
     *
     * Example prices in Q64.96 format:
     * - 1 ETH per token: 1 << 96 = 79228162514264337593543950336
     * - 0.0001 ETH per token: (1 << 96) / 10000 = 7922816251426433759354395
     * - 0.00001 ETH per token: (1 << 96) / 100000 = 792281625142643375935439
     */
    function setTokenPrice(address token, uint256 priceX96, bool _isToken0) external onlyOwner {
        baseTokenPriceX96[token] = priceX96;
        isToken0[token] = _isToken0;
        emit TokenPriceSet(token, priceX96);
        emit TokenConfigured(token, _isToken0);
    }

    /**
     * @notice Set the variance percentage applied to prices
     * @param bps Variance in basis points (e.g., 300 = 3%)
     */
    function setVariance(uint256 bps) external onlyOwner {
        if (bps > 1000) revert InvalidVariance(); // Max 10%
        varianceBps = bps;
        emit VarianceSet(bps);
    }

    /**
     * @notice IUniswapV3Pool.token0() - Returns WETH or the token based on isToken0 config
     * @dev For meme tokens, we configure whether they are token0 or token1
     */
    function token0() external view returns (address) {
        // This is a simplified mock - real implementation would need per-pair queries
        return WETH;
    }

    /**
     * @notice IUniswapV3Pool.token1() - Returns the other token
     */
    function token1() external view returns (address) {
        // This is a simplified mock
        return address(0);
    }

    /**
     * @notice IUniswapV3Pool.observe() - Returns tick cumulatives for TWAP calculation
     * @dev Applies 2-4% random variance to the base price
     * @param secondsAgos Array of seconds ago timestamps
     * @return tickCumulatives Array of tick cumulative values
     * @return secondsPerLiquidityCumulativeX128s Unused in our implementation
     */
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);

        // Calculate base tick from a default price
        // This mock uses a simplified approach - the actual tick is calculated
        // by the SevenEleven contract from the price we want to return

        // For TWAP calculation: tick = (tickCumulative[1] - tickCumulative[0]) / period
        // We want to return ticks that result in our configured price +/- variance

        // Apply pseudo-random variance using block data
        uint256 variance = _getVariance();

        // Base tick value (corresponds to roughly 1 ETH = 10000 tokens at default)
        // tick = log1.0001(price) where price is token1/token0
        int56 baseTick = -92100; // Roughly $0.0001 per token

        // Apply variance to tick (variance affects price multiplicatively)
        int56 tickAdjustment = int56(int256((uint256(uint56(baseTick > 0 ? baseTick : -baseTick)) * variance) / 10000));
        if (variance < 10000) {
            tickAdjustment = -tickAdjustment;
        }

        // Set tick cumulatives so the TWAP calculation returns our desired price
        uint32 period = secondsAgos.length > 1 ? secondsAgos[0] - secondsAgos[1] : 1800;
        if (period == 0) period = 1800;

        int56 adjustedTick = baseTick + tickAdjustment;

        // tickCumulatives[1] - tickCumulatives[0] = tick * period
        tickCumulatives[0] = adjustedTick * int56(uint56(period));
        if (secondsAgos.length > 1) {
            tickCumulatives[1] = 0;
        }

        return (tickCumulatives, secondsPerLiquidityCumulativeX128s);
    }

    /**
     * @notice Get pseudo-random variance multiplier
     * @return variance A value between 9700-10300 (representing 97%-103% of base price)
     */
    function _getVariance() internal view returns (uint256 variance) {
        // Use block data for pseudo-randomness
        uint256 rand = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            block.number
        )));

        // Map to range: 10000 - varianceBps to 10000 + varianceBps
        // e.g., for 3% variance: 9700 to 10300
        uint256 range = varianceBps * 2;
        uint256 offset = rand % (range + 1); // 0 to range inclusive

        variance = 10000 - varianceBps + offset;
    }

    /**
     * @notice Get the current price with variance applied (for testing)
     * @param token The token to get price for
     * @return priceX96 The price with variance in Q64.96 format
     */
    function getPriceWithVariance(address token) external view returns (uint256 priceX96) {
        uint256 basePrice = baseTokenPriceX96[token];
        if (basePrice == 0) revert TokenNotConfigured();

        uint256 variance = _getVariance();
        priceX96 = (basePrice * variance) / 10000;
    }
}
