// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface ITreasury {
    function mint(address _recipient, uint256 _amount) external;

    function withdraw(address _token, uint256 _amount) external;
}
