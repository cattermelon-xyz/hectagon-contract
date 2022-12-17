// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HectaFaucet is Ownable {
    IERC20 public hecta;

    constructor(address _hecta) {
        hecta = IERC20(_hecta);
    }

    function setHecta(address _hecta) external onlyOwner {
        hecta = IERC20(_hecta);
    }

    function dispense() external {
        hecta.transfer(msg.sender, 1e9);
    }
}
