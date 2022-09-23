// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./types/HectagonAccessControlled.sol";
import "./interfaces/ITreasury.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract HectagonNFT is ERC721, ERC721Enumerable, ERC721URIStorage, HectagonAccessControlled, ERC721Burnable {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;

    struct Asset {
        address tokenAddress;
        uint256 amount;
    }

    mapping(uint256 => Asset[]) private assets;
    address public assetManager;
    string public baseURI = "";

    Counters.Counter private _tokenIdCounter;

    constructor(address _authority)
        HectagonAccessControlled(IHectagonAuthority(_authority))
        ERC721("HectagonNFT", "HNFT")
    {}

    function safeMint(
        address _to,
        address[] calldata _tokens,
        uint256[] calldata amounts
    ) public {
        require(_to != address(0), "Mint to zero address");
        require(_msgSender() == assetManager, "Caller is not the assetManager");
        require(_tokens.length == amounts.length, "Length of list _tokens and list amounts not equal");

        uint256 tokenId = _tokenIdCounter.current();

        _tokenIdCounter.increment();
        _safeMint(_to, tokenId);
        for (uint256 index = 0; index < _tokens.length; index++) {
            assets[tokenId].push(Asset(_tokens[index], amounts[index]));
        }
    }

    function redeem(
        uint256 _tokenId,
        address _to,
        uint256 assetIndex,
        uint256 amount
    ) public {
        require(msg.sender == ownerOf(_tokenId), "Sender not owner");
        require(assets[_tokenId][assetIndex].amount != 0, "Zero amount of asset");
        require(assets[_tokenId][assetIndex].amount >= amount, "Redeem amount exceeds balance");

        assets[_tokenId][assetIndex].amount -= amount;

        ITreasury(authority.vault()).withdraw(assets[_tokenId][assetIndex].tokenAddress, amount);
        IERC20(assets[_tokenId][assetIndex].tokenAddress).safeTransfer(_to, amount);
    }

    function redeemAll(uint256 _tokenId, address _to) public {
        require(msg.sender == ownerOf(_tokenId), "Sender not owner");

        for (uint256 index = 0; index < assets[_tokenId].length; index++) {
            uint256 amount = assets[_tokenId][index].amount;
            assets[_tokenId][index].amount = 0;

            if (amount != 0) {
                ITreasury(authority.vault()).withdraw(assets[_tokenId][index].tokenAddress, amount);
                IERC20(assets[_tokenId][index].tokenAddress).safeTransfer(_to, amount);
            }
        }
    }

    function setAssetManager(address _assetManager) public onlyGovernor {
        assetManager = _assetManager;
    }

    function getTokenAssets(uint256 _tokenId)
        public
        view
        returns (uint256[] memory amounts_, address[] memory tokens_)
    {
        amounts_ = new uint256[](assets[_tokenId].length);
        tokens_ = new address[](assets[_tokenId].length);
        for (uint256 index = 0; index < assets[_tokenId].length; index++) {
            amounts_[index] = assets[_tokenId][index].amount;
            tokens_[index] = assets[_tokenId][index].tokenAddress;
        }
    }

    // The following functions are overrides required by Solidity.

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address from,
        address _to,
        uint256 _tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, _to, _tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function setBaseURI(string memory _uri) public onlyGovernor {
        baseURI = _uri;
    }

    function setTokensUri(uint256[] memory _ids, string[] memory _tokensURI) public onlyGovernor {
        require(_ids.length > 0, "ID arrays not empty");
        require(_ids.length == _tokensURI.length, "Length of ID and Data arrays is not equal!");

        for (uint256 i = 0; i < _ids.length; i++) {
            _setTokenURI(_ids[i], _tokensURI[i]);
        }
    }
}
