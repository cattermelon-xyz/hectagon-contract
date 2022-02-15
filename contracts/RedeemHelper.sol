// SPDX-License-Identifier: MIT
pragma solidity ^0.7.5;

import "./interfaces/IHectagonAuthority.sol";
import "./types/HectagonAccessControlled.sol";

interface IBond {
    function principle() external returns (address);

    function bondPrice() external view returns (uint256 price_);

    function deposit(
        uint256 _amount,
        uint256 _maxPrice,
        address _depositor
    ) external returns (uint256);

    function redeem(address _recipient, bool _stake) external returns (uint256);

    function pendingPayoutFor(address _depositor) external view returns (uint256 pendingPayout_);
}

contract RedeemHelper is HectagonAccessControlled {
    address[] public bonds;

    /* ====== CONSTRUCTOR ====== */

    constructor(address _authority) HectagonAccessControlled(IHectagonAuthority(_authority)) {}

    function redeemAll(address _recipient, bool _stake) external {
        for (uint256 i = 0; i < bonds.length; i++) {
            if (bonds[i] != address(0)) {
                if (IBond(bonds[i]).pendingPayoutFor(_recipient) > 0) {
                    IBond(bonds[i]).redeem(_recipient, _stake);
                }
            }
        }
    }

    function addBondContract(address _bond) external onlyGovernor {
        require(_bond != address(0));
        bonds.push(_bond);
    }

    function removeBondContract(uint256 _index) external onlyGovernor {
        bonds[_index] = address(0);
    }
}
