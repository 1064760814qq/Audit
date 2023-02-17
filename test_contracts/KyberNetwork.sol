pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface KyberNetwork {

    function getExpectedRate(
        IERC20 src,
        IERC20 dest,
        uint srcQty
    )
        external
        view
        returns (uint expectedRate, uint slippageRate);

    function trade(
        IERC20 src,
        uint srcAmount,
        IERC20 dest,
        address payable destAddress,
        uint maxDestAmount,
        uint minConversionRate,
        address walletId
    )
        external
        payable
        returns(uint);
}
