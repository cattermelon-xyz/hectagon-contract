// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface IHectagonNFT {
    function safeMint(
        address to,
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external;

    function redeem(
        uint256 tokenId,
        address to,
        uint256 assetIndex,
        uint256 amount
    ) external;

    function redeemAll(uint256 tokenId, address to) external;
}
