// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;

import "../interfaces/IERC20.sol";
import "../types/Ownable.sol";

contract HectaFaucet is Ownable {
    IERC20 public hecta;

    constructor(address _hecta) {
        hecta = IERC20(_hecta);
    }

    function setOhm(address _hecta) external onlyOwner {
        hecta = IERC20(_hecta);
    }

    function dispense() external {
        hecta.transfer(msg.sender, 1e9);
    }
}
