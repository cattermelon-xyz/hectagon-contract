// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "./types/HectagonAccessControlled.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/IHectagonNFT.sol";
import "./interfaces/IHectaCirculatingSupply.sol";
import "./interfaces/IHECTA.sol";

contract HectagonAssetManager is HectagonAccessControlled {
    using SafeERC20 for IERC20;
    using EnumerableMap for EnumerableMap.AddressToUintMap;

    EnumerableMap.AddressToUintMap private assets;

    event Deposit(address indexed asset, uint256 amount);
    event Withdraw(address indexed asset, uint256 amount);

    uint256 public constant RATE_DENOMINATOR = 10_000;
    uint256 public premium = 2_000;

    IHectagonNFT public hectagonNFT;
    IERC4626 public gHecta;
    IHECTA public hecta;
    IHectaCirculatingSupply public hectaCirculatingSupply;

    constructor(
        address _authority,
        address _gHecta,
        address _hecta,
        address _hectaCirculatingSupply,
        address _hectagonNFT
    ) HectagonAccessControlled(IHectagonAuthority(_authority)) {
        gHecta = IERC4626(_gHecta);
        hecta = IHECTA(_hecta);
        hectaCirculatingSupply = IHectaCirculatingSupply(_hectaCirculatingSupply);
        hectagonNFT = IHectagonNFT(_hectagonNFT);
    }

    function setAddresses(
        address _gHecta,
        address _hecta,
        address _hectaCirculatingSupply,
        address _hectagonNFT
    ) external onlyGovernor {
        gHecta = IERC4626(_gHecta);
        hecta = IHECTA(_hecta);
        hectaCirculatingSupply = IHectaCirculatingSupply(_hectaCirculatingSupply);
        hectagonNFT = IHectagonNFT(_hectagonNFT);
    }

    function mintNFT(address _to, uint256 _amount) public {
        uint256 hectaBurnAmount = IERC4626(gHecta).redeem(_amount, address(this), msg.sender);
        uint256 circulatingSupply = IHectaCirculatingSupply(hectaCirculatingSupply).circulatingSupply();
        uint256 assetsAmountsLength = assets.length();
        uint256[] memory amounts = new uint256[](assetsAmountsLength);
        address[] memory tokens = new address[](assetsAmountsLength);

        for (uint256 index = 0; index < assetsAmountsLength; index++) {
            (address token, uint256 amount) = assets.at(index);

            uint256 nftAssetAmount = (amount * (RATE_DENOMINATOR - premium) * hectaBurnAmount) /
                circulatingSupply /
                RATE_DENOMINATOR;

            amounts[index] = nftAssetAmount;
            tokens[index] = token;
            assets.set(token, amount - nftAssetAmount);
        }

        hecta.burn(hectaBurnAmount);
        IHectagonNFT(hectagonNFT).safeMint(_to, tokens, amounts);
    }

    function deposit(address _tokenAddress, uint256 _amount) public onlyGuardian {
        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(authority.vault()), _amount);
        bool isTokenInSet = assets.contains(_tokenAddress);

        if (!isTokenInSet) {
            assets.set(_tokenAddress, _amount);
        } else {
            uint256 oldAmount = assets.get(_tokenAddress);
            assets.set(_tokenAddress, _amount + oldAmount);
        }
        emit Deposit(_tokenAddress, _amount);
    }

    function withdraw(address _tokenAddress, uint256 _amount) public onlyGuardian {
        uint256 assetAmount = assets.get(_tokenAddress, "Token not in asset list");

        require(assetAmount >= _amount, "Withdraw amount exceeds balance");

        if (assetAmount == _amount) {
            assets.remove(_tokenAddress);
        } else {
            assets.set(_tokenAddress, assetAmount - _amount);
        }

        ITreasury(authority.vault()).withdraw(_tokenAddress, _amount);
        IERC20(_tokenAddress).safeTransfer(msg.sender, _amount);

        emit Withdraw(_tokenAddress, _amount);
    }

    function setHectagonNFT(address _hectagonNFT) public onlyGovernor {
        hectagonNFT = IHectagonNFT(_hectagonNFT);
    }

    function setPremium(uint256 _premium) public onlyGovernor {
        premium = _premium;
    }

    function getAssets() public view returns (uint256[] memory amounts_, address[] memory tokens_) {
        uint256 assetSetLength = assets.length();

        amounts_ = new uint256[](assetSetLength);
        tokens_ = new address[](assetSetLength);

        for (uint256 index = 0; index < assetSetLength; index++) {
            (address token, uint256 amount) = assets.at(index);
            amounts_[index] = amount;
            tokens_[index] = token;
        }
    }

    function getAsset(address tokens_) public view returns (uint256) {
        bool isTokenInSet = assets.contains(tokens_);

        if (!isTokenInSet) {
            return 0;
        } else {
            return assets.get(tokens_);
        }
    }

    function assetsCount() public view returns (uint256) {
        return assets.length();
    }
}
