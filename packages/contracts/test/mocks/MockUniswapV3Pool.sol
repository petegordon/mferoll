// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockUniswapV3Pool {
    address public token0;
    address public token1;
    int56 public tickCumulative0;
    int56 public tickCumulative1;

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
        // Default tick cumulative that represents a reasonable price
        tickCumulative0 = 0;
        tickCumulative1 = 0;
    }

    function setTickCumulatives(int56 _tick0, int56 _tick1) external {
        tickCumulative0 = _tick0;
        tickCumulative1 = _tick1;
    }

    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);

        for (uint256 i = 0; i < secondsAgos.length; i++) {
            if (secondsAgos[i] == 0) {
                tickCumulatives[i] = tickCumulative1;
            } else {
                tickCumulatives[i] = tickCumulative0;
            }
            secondsPerLiquidityCumulativeX128s[i] = 0;
        }
    }
}
