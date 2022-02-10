// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.7.5;

import "./PHectagonERC20.sol";
import "./THectagonERC20.sol";
import "./PreHectagonERC20.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IHECTA.sol";
import "../interfaces/ITreasury.sol";
import "../libraries/SafeMath.sol";
import "../libraries/SafeERC20.sol";
import "../types/Pausable.sol";
import "../types/Ownable.sol";

/**
 * TODO: explain Exercise mechanism in plain English
 */
contract ExercisePreHectagon is Pausable, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IHECTA;
    using SafeERC20 for IERC20;

    uint256 public immutable blockStart;
    /* ====== SPACE CALCULATION ====== */
    /**
     * `blockSpace` is the time within each maximum number of mintable token is recalculated
     * `spaceCapMint` represent the maximum percentage of Hecta that user can claim
     */
    struct Config {
        uint256 blockSpace;
        uint256 spaceCapMint; // 1% ~ 100, 5% ~ 20, 10% ~ 10
    }
    // TODO: is there any better practise for spaceCapMint?

    struct CurrentSpace {
        uint256 spaceIndex;
        uint256 markedHectaTotalSupply;
        uint256 markedTokenTotalSupply;
    }

    struct UserInfo {
        uint256 lastSpaceIndex;
        uint256 totalMintableInCurrentSpace;
    }

    /**
     * userInfo[tokenAddress][userAddress] = UserInfo
     */
    mapping(address => mapping(address => UserInfo)) public userInfo;
    /**
     * tokenConfig[tokenAddress] = Config
     */
    mapping(address => Config) public tokenConfig;
    /**
     * tokenCurrentSpaceInfo[tokenAddress] = CurrentSpace
     */
    mapping(address => CurrentSpace) public tokenCurrentSpaceInfo;

    /* ====== DEPENDED CONTRACTS ====== */

    IHECTA public immutable hecta;
    IERC20 public immutable busd;
    ITreasury public immutable treasury;
    PHectagonERC20 public immutable pHecta;
    THectagonERC20 public immutable tHecta;

    /* ====== Events ====== */
    event ExerciseSuccess(address, uint256);

    constructor(
        address hecta_,
        address tHecta_,
        address pHecta_,
        address busd_,
        address treasury_,
        uint256 blockStart_
    ) {
        require(hecta_ != address(0), "ExercisePreHectagon: hecta is Zero Address");
        require(pHecta_ != address(0), "ExercisePreHectagon: pHecta is Zero Address");
        require(tHecta_ != address(0), "ExercisePreHectagon: tHecta is Zero Address");
        require(busd_ != address(0), "ExercisePreHectagon: busd is Zero Address");
        require(treasury_ != address(0), "ExercisePreHectagon: Treasury is Zero Address");

        hecta = IHECTA(hecta_);
        busd = IERC20(busd_);
        treasury = ITreasury(treasury_);
        pHecta = PHectagonERC20(pHecta_);
        tHecta = THectagonERC20(tHecta_);
        // blockSpace = 201600 ~ 1 week
        // spaceCapMint = 10 ~ 10%
        tokenConfig[pHecta_] = Config(201600, 10);
        // spaceCapMint = 50 ~ 2%
        tokenConfig[tHecta_] = Config(201600, 50);
        blockStart = blockStart_;
        _pause();
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function exercise(address tokenAddress, uint256 _amount) external whenNotPaused returns (bool) {
        require(
            tokenAddress == address(pHecta) || tokenAddress == address(tHecta),
            "ExercisePreHectagon: Wrong contract address"
        );
        require(
            PreHectagonERC20(tokenAddress).balanceOf(msg.sender) >= _amount,
            "ExercisePreHectagon: Amount exceeds balance"
        );
        uint256 blockSpace = tokenConfig[tokenAddress].blockSpace;
        uint256 spaceCapMint = tokenConfig[tokenAddress].spaceCapMint;

        UserInfo memory info = userInfo[tokenAddress][msg.sender];
        uint256 hectaBaseSupply = ITreasury(treasury).baseSupply();
        uint256 currentSpaceIndex = block.number.sub(blockStart).div(blockSpace);

        if (tokenCurrentSpaceInfo[tokenAddress].spaceIndex < currentSpaceIndex) {
            tokenCurrentSpaceInfo[tokenAddress].markedTokenTotalSupply = PreHectagonERC20(tokenAddress).totalSupply();
            tokenCurrentSpaceInfo[tokenAddress].markedHectaTotalSupply = hectaBaseSupply;
            tokenCurrentSpaceInfo[tokenAddress].spaceIndex = currentSpaceIndex;
        }
        if (currentSpaceIndex > info.lastSpaceIndex) {
            info.totalMintableInCurrentSpace = PreHectagonERC20(tokenAddress) // percentage of token owned by msg.sender
            .balanceOf(msg.sender)
            .div(tokenCurrentSpaceInfo[tokenAddress].markedTokenTotalSupply)
            // maximum amount of hecta can be claimed by this type of token
                .mul(tokenCurrentSpaceInfo[tokenAddress].markedHectaTotalSupply)
                .div(spaceCapMint);
            // TODO: this math is prone to error & hack
            info.lastSpaceIndex = currentSpaceIndex;
        }

        require(_amount < info.totalMintableInCurrentSpace, "ExercisePreHectagon: Exceeds quota in this space");

        // TODO: too many calls, prone to hack
        info.totalMintableInCurrentSpace = info.totalMintableInCurrentSpace.sub(_amount);
        PreHectagonERC20(tokenAddress).burnFrom(msg.sender, _amount);
        busd.safeTransferFrom(msg.sender, address(this), _amount);
        busd.approve(address(treasury), _amount);
        uint256 hectaToSend = treasury.deposit(_amount, address(busd), 0);
        hecta.safeTransfer(msg.sender, hectaToSend);
        emit ExerciseSuccess(msg.sender, hectaToSend);
        return true;
    }
}
