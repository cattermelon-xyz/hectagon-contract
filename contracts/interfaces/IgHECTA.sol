// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IgHECTA is IERC4626 {
    function nextEpoch() external returns (uint256);

    function index() external view returns (uint256);

    function setDistributor(address _distributor) external;

    function bountyHunter() external;
}
