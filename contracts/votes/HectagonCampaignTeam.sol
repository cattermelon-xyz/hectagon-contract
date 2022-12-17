// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./HectagonInvestment.sol";

contract HectagonCampaignTeam is HectagonInvestment {
    constructor(address _authority)
        HectagonInvestment(_authority, "Hectagon Campaign Team", "HCT")
    {
        _mint(authority.governor(), 7);
    }
}
