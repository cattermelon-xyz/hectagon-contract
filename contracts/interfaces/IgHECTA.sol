// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IgHECTA is IERC20 {
    function mint(address _to, uint256 _amount) external;

    function burn(address _from, uint256 _amount) external;

    function index() external view returns (uint256);

    function balanceFrom(uint256 _amount) external view returns (uint256);

    function balanceTo(uint256 _amount) external view returns (uint256);
}
