// Copyright (C) 2021  Echooo Labs Ltd. <https://echooo.xyz>

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.3;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

contract SimpleOracle {

    address internal immutable weth;
    address internal immutable uniswapV2Factory;

    constructor(address _uniswapRouter) {
        weth = IUniswapV2Router01(_uniswapRouter).WETH();
        uniswapV2Factory = IUniswapV2Router01(_uniswapRouter).factory();
    }

    function inToken(address _token, uint256 _ethAmount) internal view returns (uint256) {
        (uint256 wethReserve, uint256 tokenReserve) = getReservesForTokenPool(_token);
        return _ethAmount * tokenReserve / wethReserve;
    }

    function getReservesForTokenPool(address _token) internal view returns (uint256 wethReserve, uint256 tokenReserve) {
        if (weth < _token) {
            address pair = getPairForSorted(weth, _token);
            (wethReserve, tokenReserve,) = IUniswapV2Pair(pair).getReserves();
        } else {
            address pair = getPairForSorted(_token, weth);
            (tokenReserve, wethReserve,) = IUniswapV2Pair(pair).getReserves();
        }
        require(wethReserve != 0 && tokenReserve != 0, "SO: no liquidity");
    }

    function getPairForSorted(address tokenA, address tokenB) internal virtual view returns (address pair) {    
        pair = IUniswapV2Factory(uniswapV2Factory).getPair(tokenA, tokenB);
    }
}
