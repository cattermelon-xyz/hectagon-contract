// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "./interfaces/IERC20.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IHectaCirculatingSupply.sol";
import "./interfaces/IsHECTA.sol";
import "./interfaces/IgHECTA.sol";

contract Snapshot {
    IHectaCirculatingSupply public immutable hectaCirculatingSupply;
    IERC20 public immutable pHecta;
    IERC20 public immutable tHecta;
    IgHECTA public immutable gHecta;

    uint256 public constant TOTAL_POINT = 100 * 10**9;
    uint256 public constant PHECTA_WEIGHT = 500;
    uint256 public constant THECTA_WEIGHT = 500;

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
        require(_gHecta != address(0), "Zero address: gHECTA");
        gHecta = IgHECTA(_gHecta);
    }

    function getSHectaWeight() public view returns (uint256) {
        return _caclulateHectaWeight();
    }

    function getGHectaWeight() public view returns (uint256) {
        return (_caclulateHectaWeight() * gHecta.index()) / 10**9;
    }

    function _caclulateHectaWeight() public view returns (uint256) {
        uint256 pHectaPoint = PHECTA_WEIGHT * pHecta.totalSupply();
        uint256 tHectaPoint = THECTA_WEIGHT * tHecta.totalSupply();
        uint256 circulatingSupply = hectaCirculatingSupply.circulatingSupply();
        if (circulatingSupply == 0) return 0;
        if (TOTAL_POINT * 10**9 < pHectaPoint + tHectaPoint) return 0;
        return (TOTAL_POINT * 10**9 - pHectaPoint - tHectaPoint) / circulatingSupply;
    }
}
