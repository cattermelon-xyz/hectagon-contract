// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./HectagonInvestment.sol";

contract HectagonInvestmentTeam is HectagonInvestment {
    constructor(address _authority)
        HectagonInvestment(_authority, "Hectagon Investment Team", "HIT")
    {
        _mint(authority.governor(), 7);
    }
}
