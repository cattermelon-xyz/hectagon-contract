// SPDX-License-Identifier: MIT
pragma solidity >=0.8.10;

import "@openzeppelin/contracts/interfaces/IERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./types/HectagonAccessControlled.sol";
import "./interfaces/IHectaCirculatingSupply.sol";
import "./interfaces/IHECTA.sol";

contract Asset is HectagonAccessControlled {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    event Deposited(address indexed asset, uint256 amount);
    event Redeemed(address indexed to, uint256 amount);
    event Withdrawal(address indexed asset, uint256 amount);

    uint256 public constant RATE_DENOMINATOR = 10_000;
    uint256 public premium = 2_000;

    EnumerableSet.AddressSet private assets;
    IERC4626 public gHecta;
    IHECTA public hecta;
    IHectaCirculatingSupply public hectaCirculatingSupply;

    constructor(
        address _authority,
        address _gHecta,
        address _hecta,
        address _hectaCirculatingSupply
    ) HectagonAccessControlled(IHectagonAuthority(_authority)) {
        gHecta = IERC4626(_gHecta);
        hecta = IHECTA(_hecta);
        hectaCirculatingSupply = IHectaCirculatingSupply(_hectaCirculatingSupply);
    }

    function convertToAssets(uint256 _amount)
        public
        view
        returns (address[] memory assets_, uint256[] memory amounts_)
    {
        uint256 circulatingSupply = hectaCirculatingSupply.circulatingSupply();
        uint256 hectaAmount = gHecta.previewRedeem(_amount);
        if (circulatingSupply > 0) {
            uint256 assetLength = assets.length();
            assets_ = new address[](assetLength);
            amounts_ = new uint256[](assetLength);
            for (uint256 i = 0; i < assetLength; i++) {
                address asset = assets.at(i);
                assets_[i] = asset;
                amounts_[i] =
                    (hectaAmount * (RATE_DENOMINATOR - premium) * IERC20(asset).balanceOf(address(this))) /
                    circulatingSupply /
                    RATE_DENOMINATOR;
            }
        }
    }

    function redeem(address _to, uint256 _amount) public {
        require(_amount > 0, "Zero amount");
        require(assetsCount() > 0, "No asset");
        (address[] memory assets_, uint256[] memory amounts_) = convertToAssets(_amount);
        uint256 hectaBurnAmount = gHecta.redeem(_amount, address(this), msg.sender);
        hecta.burn(hectaBurnAmount);
        for (uint256 i = 0; i < assets_.length; i++) {
            IERC20(assets_[i]).safeTransfer(_to, amounts_[i]);
        }
        emit Redeemed(msg.sender, _amount);
    }

    function deposit(address _asset, uint256 _amount) public onlyGuardian {
        require(_asset != address(0), "Null address");
        require(_amount > 0, "Zero amount");
        IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);
        assets.add(_asset);
        emit Deposited(_asset, _amount);
    }

    function withdraw(address _asset, uint256 _amount) public onlyGuardian {
        uint256 balance = IERC20(_asset).balanceOf(address(this));
        if (balance == _amount) {
            assets.remove(_asset);
        }

        IERC20(_asset).safeTransfer(msg.sender, _amount);

        emit Withdrawal(_asset, _amount);
    }

    function setPremium(uint256 _premium) public onlyGovernor {
        premium = _premium;
    }

    function getAssets() public view returns (address[] memory assets_, uint256[] memory amounts_) {
        uint256 assetLength = assets.length();
        assets_ = new address[](assetLength);
        amounts_ = new uint256[](assetLength);
        for (uint256 i = 0; i < assetLength; i++) {
            address asset = assets.at(i);
            assets_[i] = asset;
            amounts_[i] = IERC20(asset).balanceOf(address(this));
        }
    }

    function getAsset(address _asset) public view returns (uint256) {
        if (!assets.contains(address(_asset))) return 0;
        return IERC20(_asset).balanceOf(address(this));
    }

    function assetsCount() public view returns (uint256) {
        return assets.length();
    }
}
