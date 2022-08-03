// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IHectaCirculatingSupply.sol";
import "./interfaces/IgHECTA.sol";

contract Snapshot is Ownable {
    IHectaCirculatingSupply public hectaCirculatingSupply;
    IERC20 public pHecta;
    IERC20 public tHecta;
    IgHECTA public gHecta;

    uint256 public constant TOTAL_POINT = 100 * 10**9;

    constructor(
        address _hectaCirculatingSupply,
        address _pHecta,
        address _tHecta,
        address _gHecta
    ) {
        require(_hectaCirculatingSupply != address(0), "Zero address: HECTA");
        hectaCirculatingSupply = IHectaCirculatingSupply(_hectaCirculatingSupply);
        require(_pHecta != address(0), "Zero address: pHECTA");
        pHecta = IERC20(_pHecta);
        require(_tHecta != address(0), "Zero address: tHECTA");
        tHecta = IERC20(_tHecta);
        require(_gHecta != address(0), "Zero address: gHecta");
        gHecta = IgHECTA(_gHecta);
    }

    function gHectaWeight() public view returns (uint256) {
        return (caclulateHectaWeight() * gHecta.index()) / 10**9;
    }

    function pHectaWeight() public pure returns (uint256) {
        return 500;
    }

    function tHectaWeight() public pure returns (uint256) {
        return 500;
    }

    function caclulateHectaWeight() public view returns (uint256) {
        uint256 pHectaPoint = pHectaWeight() * pHecta.totalSupply();
        uint256 tHectaPoint = tHectaWeight() * tHecta.totalSupply();
        uint256 circulatingSupply = hectaCirculatingSupply.circulatingSupply();
        if (circulatingSupply == 0) return 0;
        if (TOTAL_POINT * 10**9 < pHectaPoint + tHectaPoint) return 0;
        return (TOTAL_POINT * 10**9 - pHectaPoint - tHectaPoint) / circulatingSupply;
    }

    function setAddresses(
        address _hectaCirculatingSupply,
        address _pHecta,
        address _tHecta,
        address _gHecta
    ) public onlyOwner {
        require(_hectaCirculatingSupply != address(0), "Zero address: HECTA");
        hectaCirculatingSupply = IHectaCirculatingSupply(_hectaCirculatingSupply);
        require(_pHecta != address(0), "Zero address: pHECTA");
        pHecta = IERC20(_pHecta);
        require(_tHecta != address(0), "Zero address: tHECTA");
        tHecta = IERC20(_tHecta);
        require(_gHecta != address(0), "Zero address: gHecta");
        gHecta = IgHECTA(_gHecta);
    }
}
