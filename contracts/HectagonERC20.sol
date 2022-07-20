// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "./interfaces/IHECTA.sol";
import "./types/HectagonAccessControlled.sol";

contract HectagonERC20Token is ERC20Permit, IHECTA, HectagonAccessControlled {
    constructor(address _authority)
        ERC20("Hectagon", "HECTA")
        ERC20Permit("Hectagon")
        HectagonAccessControlled(IHectagonAuthority(_authority))
    {}

    function decimals() public view virtual override returns (uint8) {
        return 9;
    }

    function mint(address account_, uint256 amount_) external override onlyVault {
        _mint(account_, amount_);
    }

    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account_, uint256 amount_) external override {
        _burnFrom(account_, amount_);
    }

    function _burnFrom(address account_, uint256 amount_) internal {
        require(allowance(account_, msg.sender) >= amount_, "ERC20: burn amount exceeds allowance");
        uint256 decreasedAllowance_ = allowance(account_, msg.sender) - amount_;

        _approve(account_, msg.sender, decreasedAllowance_);
        _burn(account_, amount_);
    }
}
