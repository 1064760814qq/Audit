// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.3;

import "../BaseFilter.sol";

contract JetonFilter is BaseFilter {

  bytes4 private constant INVOKE = bytes4(keccak256("invoke(bytes)"));
  bytes4 private constant PAYBACK_INVOKE = bytes4(keccak256("payback_invoke(bytes,uint64,address,bytes)"));
  bytes4 private constant MULTI_CALL = bytes4(keccak256("multicall(bytes[])"));

  function isValid(address /*_wallet*/, address _spender, address _to, bytes calldata _data) external pure override returns (bool valid) {
    bytes4 methodId = getMethod(_data);
    return (_spender == _to && _data.length >= 4 && (methodId == INVOKE || methodId == PAYBACK_INVOKE || methodId == MULTI_CALL));
  }
}
