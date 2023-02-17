pragma solidity ^0.8.3;
import "./KyberNetwork.sol";

// SPDX-License-Identifier: GPL-3.0-only
contract KyberNetworkTest is KyberNetwork {
    // Mock token address for ETH
    address internal constant ETH_TOKEN_ADDRESS =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    struct Token {
        bool exists;
        uint256 rate;
        uint256 decimals;
    }

    mapping(address => Token) public tokens;
    address owner;

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {}

    /**
     * @notice Adds a tradable token to the Kyber instance
     * @param _token The token
     * @param _rate The rate for the token as 1 TOKN = (rate/10**18) ETH
     * @param _decimals The number of decimals for the token
     */
    function addToken(
        IERC20 _token,
        uint256 _rate,
        uint256 _decimals
    ) public {
        require(msg.sender == owner, "KyberNetwork: unauthorized");
        tokens[address(_token)] = Token({
            exists: true,
            rate: _rate,
            decimals: _decimals
        });
    }

    function getExpectedRate(
        IERC20 _src,
        IERC20 _dest,
        uint /* _srcQty */
    ) public view override returns (uint expectedRate, uint slippageRate) {
        if (address(_src) == ETH_TOKEN_ADDRESS) {
            expectedRate = 10**36 / tokens[address(_dest)].rate;
            slippageRate = expectedRate;
        } else if (address(_dest) == ETH_TOKEN_ADDRESS) {
            expectedRate = tokens[address(_src)].rate;
            slippageRate = expectedRate;
        } else {
            revert("KyberNetwork: Unknown token pair");
        }
    }

    function trade(
        IERC20 _src,
        uint _srcAmount,
        IERC20 _dest,
        address payable _destAddress,
        uint _maxDestAmount,
        uint, /* _minConversionRate */
        address /* _walletId */
    ) public payable override returns (uint destAmount) {
        uint expectedRate;
        uint srcAmount;
        if (address(_src) == ETH_TOKEN_ADDRESS) {
            expectedRate = 10**36 / tokens[address(_dest)].rate;
            destAmount =
                (expectedRate * _srcAmount) /
                10**(36 - tokens[address(_dest)].decimals);
            if (destAmount > _maxDestAmount) {
                destAmount = _maxDestAmount;
                srcAmount =
                    (_maxDestAmount *
                        10**(36 - tokens[address(_dest)].decimals)) /
                    expectedRate;
            } else {
                srcAmount = _srcAmount;
            }
            require(
                msg.value >= srcAmount,
                "KyberNetwork: not enough ETH provided"
            );
            if (msg.value > srcAmount) {
                // refund
                (bool success, ) = msg.sender.call{
                    value: msg.value - srcAmount
                }("");
                require(success, "KyberNetwork: ETH refund failed");
            }
            require(
                IERC20(_dest).transfer(_destAddress, destAmount),
                "KyberNetwork: ERC20 transfer failed"
            );
        } else if (address(_dest) == ETH_TOKEN_ADDRESS) {
            expectedRate = tokens[address(_src)].rate;
            destAmount =
                (expectedRate * _srcAmount) /
                10**tokens[address(_src)].decimals;
            if (destAmount > _maxDestAmount) {
                destAmount = _maxDestAmount;
                srcAmount =
                    (_maxDestAmount * 10**tokens[address(_src)].decimals) /
                    expectedRate;
            } else {
                srcAmount = _srcAmount;
            }
            require(
                _src.transferFrom(msg.sender, address(this), srcAmount),
                "KyberNetwork: not enough ERC20 provided"
            );
            require(
                address(this).balance >= destAmount,
                "KyberNetwork: not enough ETH in reserve"
            );
            (bool success, ) = _destAddress.call{value: destAmount}("");
            require(success, "KyberNetwork: Sending ETH back failed");
        } else {
            revert("KyberNetwork: Unknown token pair");
        }
    }
}
