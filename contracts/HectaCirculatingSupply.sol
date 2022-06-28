// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IHectaCirculatingSupply.sol";

contract HectaCirculatingSupply is Ownable, IHectaCirculatingSupply {
    IERC20 public hecta;
    address[] public nonCirculatingAddresses;

    constructor(IERC20 _hecta) {
        hecta = _hecta;
    }

    function circulatingSupply() external view returns (uint256) {
        uint256 _totalSupply = IERC20(hecta).totalSupply();

        uint256 _circulatingSupply = _totalSupply - getNonCirculating();

        return _circulatingSupply;
    }

    function getNonCirculating() public view returns (uint256) {
        uint256 _nonCirculatingHecta;

        for (uint256 i = 0; i < nonCirculatingAddresses.length; i++) {
            _nonCirculatingHecta = _nonCirculatingHecta + IERC20(hecta).balanceOf(nonCirculatingAddresses[i]);
        }

        return _nonCirculatingHecta;
    }

    function setNonCirculatingAddresses(address[] calldata _nonCirculatingAddresses) external onlyOwner {
        nonCirculatingAddresses = _nonCirculatingAddresses;
    }
}
