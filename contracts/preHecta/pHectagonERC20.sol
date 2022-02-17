// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../interfaces/ITreasury.sol";

contract pHectagon is Pausable, Ownable, ERC20 {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;
    /** Variables */
    Counters.Counter public spaceCount;

    address public immutable hectaAddress;
    address public immutable treasuryAddress;
    address public busdAddress;

    uint256 public startTimestamp;
    bool public useWhiteList;
    bool public isMigrationDone;

    mapping(address => bool) public investors;
    mapping(address => Info) public infos;
    mapping(uint256 => SpaceInfo) public spaces;

    uint256 public spaceLength = 604800; // 7 days timestamp

    /** Constant */
    uint256 public constant RateDenominator = 1000000; // 1,000,000
    uint256 public constant MaxPHectaToExercise = 100000; // in ten-thousandths ( 5000 = 0.5%, 100,000 = 10% )

    /** Event */
    event ClaimableTransfer(address from, address to, uint256 amount);

    /** Struct */
    struct Info {
        bool isTransferable;
        uint256 lastRebaseSpaceCount;
        uint256 maxClaim;
        uint256 claimed;
        uint256 currentSpaceProfit;
    }

    struct SpaceInfo {
        uint256 totalHecta;
        uint256 totalPHecta;
        uint256 timestamp;
    }

    struct RebaseInfo {
        uint256 maxClaim;
        uint256 currentSpaceProfit;
        uint256 lastRebaseCount;
    }

    /** Modifiers */
    modifier started() {
        require(startTimestamp > 0, "Waiting for owner to start");
        _;
    }

    modifier whitelisted() {
        if (useWhiteList == true) {
            require(investors[msg.sender] == true, "Investor must be whitelisted to use this function");
        }
        _;
    }

    constructor(address hectaAddress_, address treasuryAddress_) ERC20("Private Hectagon", "pHecta") {
        hectaAddress = hectaAddress_;
        treasuryAddress = treasuryAddress_;
    }

    function decimals() public view virtual override returns (uint8) {
        return 9;
    }

    /**
     * @notice mass approval saves gas
     */

    function massApprove() external {
        IERC20(busdAddress).approve(treasuryAddress, 1e33);
    }

    function mint(address account_, uint256 amount_) external onlyOwner {
        require(isMigrationDone == false, "Migration is finished");
        _mint(account_, amount_);
    }

    function setSpaceLength(uint256 spaceLength_) external onlyOwner {
        spaceLength = spaceLength_;
    }

    function setBusdAddress(address busdAddress_) external onlyOwner {
        busdAddress = busdAddress_;
        IERC20(busdAddress).approve(treasuryAddress, 1e33);
    }

    function stopMigration() external onlyOwner {
        isMigrationDone = true;
    }

    function start() external onlyOwner {
        require(startTimestamp == 0, "Already started!");
        startTimestamp = block.timestamp;
        spaces[spaceCount.current()] = SpaceInfo(0, totalSupply(), block.timestamp);
    }

    function enableWhiteList() external onlyOwner {
        useWhiteList = true;
    }

    function disableWhiteList() external onlyOwner {
        useWhiteList = false;
    }

    function whitelist(address investor) external onlyOwner {
        investors[investor] = true;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function showClaimable(address addr) external view returns (uint256) {
        RebaseInfo memory rInfo = _calcRebase(addr);
        uint256 claimable = rInfo.maxClaim - infos[addr].claimed;
        return claimable;
    }

    function transfer(address recipient, uint256 amount) public override started whenNotPaused returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function exercise(uint256 amount_) external started whitelisted whenNotPaused {
        _rebase(msg.sender);

        uint256 busdAmount = toTokenAmount(busdAddress, amount_);
        require(infos[msg.sender].maxClaim - infos[msg.sender].claimed >= amount_, "Claim more than maximum amount");
        require(
            IERC20(busdAddress).allowance(msg.sender, address(this)) >= busdAmount,
            "Must approve this contract to spend more than withdrawl amount"
        );
        require(IERC20(busdAddress).balanceOf(msg.sender) >= amount_, "BUSD balance is not enough");

        infos[msg.sender].isTransferable = false;
        _burn(msg.sender, amount_);
        infos[msg.sender].claimed += amount_;

        IERC20(busdAddress).safeTransferFrom(msg.sender, address(this), busdAmount);

        uint256 hectaToSend = ITreasury(treasuryAddress).deposit(busdAmount, busdAddress, 0);

        IERC20(hectaAddress).transfer(msg.sender, hectaToSend);
    }

    // Within a space: you can not safeTransfer after exercise
    function _beforeTokenTransfer(
        address from_,
        address to_,
        uint256 amount_
    ) internal override {
        if (from_ != address(0) && to_ != address(0)) {
            _rebase(from_);
            _rebase(to_);
            if (infos[from_].lastRebaseSpaceCount != 0) {
                require(infos[from_].isTransferable, "Cannot transfer after exercise");
            }
        }
    }

    /**
     * Transfer claimable
     */
    function _afterTokenTransfer(
        address from_,
        address to_,
        uint256 amount_
    ) internal override {
        if (from_ != address(0) && to_ != address(0)) {
            uint256 claimableToTransfer = (amount_ * infos[from_].currentSpaceProfit) / (balanceOf(from_) + amount_);
            infos[from_].maxClaim = infos[from_].maxClaim - claimableToTransfer;
            // add claimable from this transaction
            infos[to_].maxClaim = infos[to_].maxClaim + claimableToTransfer;
            emit ClaimableTransfer(from_, to_, claimableToTransfer);
        }
    }

    /*
     ** _rebase(address addr) before every transfer or exercise action
     */
    function _rebase(address addr) private {
        beat();
        // calculate maxClaim
        if (infos[addr].lastRebaseSpaceCount < spaceCount.current()) {
            RebaseInfo memory rebaseInfo = _calcRebase(addr);
            infos[addr].currentSpaceProfit = rebaseInfo.currentSpaceProfit;
            infos[addr].maxClaim = rebaseInfo.maxClaim;
            infos[addr].lastRebaseSpaceCount = rebaseInfo.lastRebaseCount;
            infos[addr].isTransferable = true;
        }
    }

    function beat() public {
        SpaceInfo memory currentSpace = spaces[spaceCount.current()];
        if (startTimestamp > 0 && block.timestamp - currentSpace.timestamp > spaceLength) {
            spaceCount.increment();
            spaces[spaceCount.current()] = SpaceInfo(
                IERC20(hectaAddress).totalSupply(),
                totalSupply(),
                block.timestamp
            );
        }
    }

    function _calcRebase(address addr) private view returns (RebaseInfo memory) {
        if (startTimestamp == 0 || totalSupply() == 0) {
            return RebaseInfo(0, 0, 0);
        }

        uint256 _spaceCount = spaceCount.current();
        SpaceInfo memory currentSpace = spaces[_spaceCount];

        uint256 accumulatedProfit = 0;
        uint256 currentSpaceProfit = infos[addr].currentSpaceProfit;
        // calculate maxClaim
        if (infos[addr].lastRebaseSpaceCount < _spaceCount) {
            for (uint256 i = infos[addr].lastRebaseSpaceCount; i < _spaceCount; i++) {
                currentSpaceProfit =
                    ((((spaces[i + 1].totalHecta - spaces[i].totalHecta) * MaxPHectaToExercise) / RateDenominator) *
                        balanceOf(addr)) /
                    spaces[i + 1].totalPHecta;
                accumulatedProfit += currentSpaceProfit;
            }
        }

        if (block.timestamp - currentSpace.timestamp > spaceLength) {
            SpaceInfo memory newSpace = SpaceInfo(IERC20(hectaAddress).totalSupply(), totalSupply(), block.timestamp);

            currentSpaceProfit =
                ((((newSpace.totalHecta - spaces[_spaceCount].totalHecta) * MaxPHectaToExercise) / RateDenominator) *
                    balanceOf(addr)) /
                newSpace.totalPHecta;

            accumulatedProfit += currentSpaceProfit;
        }
        return RebaseInfo(infos[addr].maxClaim + accumulatedProfit, currentSpaceProfit, _spaceCount);
    }

    /**
     * @notice convert pHecta to busd
     * @param _amount uint256
     * @return value_ uint256
     */
    function toTokenAmount(address token, uint256 _amount) public view returns (uint256 value_) {
        value_ = (_amount * (10**IERC20Metadata(token).decimals())) / (10**decimals());
    }
}
