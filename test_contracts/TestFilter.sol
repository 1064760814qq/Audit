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

import "../contracts/trustlists_contracts/interfaces/IFilter.sol";
import "../contracts/trustlists_contracts/DappRegistry.sol";
import "../contracts/trustlists_contracts/TokenRegistry.sol";
import "../contracts/trustlists_contracts/filters/yearn/YearnV2Filter.sol";
import "../contracts/trustlists_contracts/filters/yearn/YearnFilter.sol";
import "../contracts/trustlists_contracts/filters/uniswap/UniswapV2UniZapFilter.sol";
import "../contracts/trustlists_contracts/filters/lido/LidoFilter.sol";
import "../contracts/trustlists_contracts/filters/erc20/OnlyApproveFilter.sol";
import "../contracts/trustlists_contracts/filters/curve/CurveFilter.sol";
import "../contracts/trustlists_contracts/filters/BaseFilter.sol";
import "../contracts/trustlists_contracts/filters/aave/AaveV1Filter.sol";
import "../contracts/trustlists_contracts/filters/aave/AaveV1ATokenFilter.sol";
import "../contracts/trustlists_contracts/filters/aave/AaveV2Filter.sol";
import "../contracts/trustlists_contracts/filters/balancer/BalancerFilter.sol";
import "../contracts/trustlists_contracts/filters/maker/PotFilter.sol";
import "../contracts/trustlists_contracts/filters/maker/VatFilter.sol";
import "../contracts/trustlists_contracts/filters/maker/DaiJoinFilter.sol";
import "../contracts/trustlists_contracts/filters/compound/CompoundCTokenFilter.sol";
import "../contracts/trustlists_contracts/filters/weth/WethFilter.sol";
import "../contracts/trustlists_contracts/filters/paraswap/ParaswapUniV2RouterFilter.sol";
import "../contracts/trustlists_contracts/filters/paraswap/ParaswapFilter.sol";
import "../contracts/trustlists_contracts/filters/paraswap/ParaswapUtils.sol";
import "../contracts/trustlists_contracts/filters/paraswap/UniswapV3RouterFilter.sol";
import "../contracts/trustlists_contracts/filters/paraswap/WhitelistedZeroExV4Filter.sol";
import "../contracts/trustlists_contracts/filters/paraswap/WhitelistedZeroExV2Filter.sol";

contract TestFilter is IFilter {
    function isValid(
        address, /*_wallet*/
        address, /*_spender*/
        address, /*_to*/
        bytes calldata _data
    ) external pure override returns (bool valid) {
        uint256 state = abi.decode(_data[4:], (uint256));
        return state != 5;
    }
}
