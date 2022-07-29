// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockHecta is ERC20 {
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

    function decimals() public view virtual override returns (uint8) {
        return 9;
    }

    function mint(address to, uint256 value) public virtual {
        _mint(to, value);
    }

    function burn(address from, uint256 value) public virtual {
        _burn(from, value);
    }
}
