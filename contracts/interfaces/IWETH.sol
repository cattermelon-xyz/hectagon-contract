// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWETH {
    function deposit() external payable;

    function withdraw(uint256 wad) external;

    function totalSupply() external;

    function approve(address guy, uint256 wad) external;

    function transfer(address dst, uint256 wad) external;

    function transferFrom(
        address src,
        address dst,
        uint256 wad
    ) external;

    function balanceOf(address user) external view returns (uint256);

    function allowance(address owner, address spender) external view returns (uint256);
}
