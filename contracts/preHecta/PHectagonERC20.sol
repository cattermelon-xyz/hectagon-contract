// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.7.5;
import "./PreHectagonERC20.sol";

contract PHectagonERC20 is PreHectagonERC20 {

  /**
  * Pre-mint 50M token
   */
  constructor() ERC20("Private Hectagon", "pHECTA", 9) {
    allowMinting = true;
    uint256 initialSupply_ = 50000000 * 1e9;
    _mint( owner(), initialSupply_ );
  }
}
