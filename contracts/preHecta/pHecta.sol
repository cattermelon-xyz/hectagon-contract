// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "../interfaces/ITreasury.sol";

contract PHecta is Pausable, Ownable, ERC20, ERC20Burnable {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;
    /** Variables */
    Counters.Counter public spaceCounter;

    address public hectaAddress;
    address public treasuryAddress;
    address public busdAddress;

    uint256 public startTimestamp;
    bool public useWhiteList;

    mapping(address => bool) public investors;
    mapping(address => Holder) public holders;
    mapping(uint256 => Space) public spaces;

    uint256 public spaceLength = 604800; // 7 days timestamp

    /** Constant */
    uint256 public constant RATE_DENOMINATOR = 1000000; // 1,000,000
    uint256 public constant RATE_NUMERATOR = 100000; // in ten-thousandths ( 5000 = 0.5%, 100,000 = 10%)

    /** Event */
    event Exercise(address indexed from, uint256 amount);

    /** Struct */
    struct Holder {
        bool isTransferable;
        uint256 lastRebaseSpaceIndex;
        uint256 maxClaim;
        uint256 claimed;
        uint256 currentSpaceProfit;
    }

    struct Space {
        uint256 totalHecta;
        uint256 totalPHecta;
        uint256 startedTime;
    }

    struct RebaseInfo {
        uint256 maxClaim;
        uint256 currentSpaceProfit;
        uint256 lastRebaseSpaceIndex;
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

    constructor() ERC20("Private Hectagon", "pHecta") {
        _mint(msg.sender, 50000000000000000); // mint 50,000,000 token
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

    function setSpaceLength(uint256 spaceLength_) external onlyOwner {
        spaceLength = spaceLength_;
    }

    function initialize(
        address hectaAddress_,
        address treasuryAddress_,
        address busdAddress_
    ) external onlyOwner {
        hectaAddress = hectaAddress_;
        treasuryAddress = treasuryAddress_;
        busdAddress = busdAddress_;
        IERC20(busdAddress).approve(treasuryAddress, 1e33);
    }

    function start() external onlyOwner {
        require(startTimestamp == 0, "Already started!");
        startTimestamp = block.timestamp;
        spaces[spaceCounter.current()] = Space(0, totalSupply(), block.timestamp);
    }

    function enableWhiteList() external onlyOwner {
        useWhiteList = true;
    }

    function disableWhiteList() external onlyOwner {
        useWhiteList = false;
    }

    function toggleInvestor(address investor) external onlyOwner {
        investors[investor] = !investors[investor];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getClaimable(address addr) external view returns (uint256) {
        RebaseInfo memory rInfo = _calcRebase(addr);
        uint256 claimable = rInfo.maxClaim - holders[addr].claimed;
        return claimable;
    }

    function transfer(address recipient, uint256 amount) public override whenNotPaused returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function exercise(uint256 amount_) external started whitelisted whenNotPaused {
        _rebase(msg.sender);

        uint256 busdAmount = toTokenAmount(busdAddress, amount_);
        require(
            holders[msg.sender].maxClaim - holders[msg.sender].claimed >= amount_,
            "Claim more than maximum amount"
        );
        require(
            IERC20(busdAddress).allowance(msg.sender, address(this)) >= busdAmount,
            "Must approve this contract to spend more than withdrawl amount"
        );
        require(IERC20(busdAddress).balanceOf(msg.sender) >= amount_, "BUSD balance is not enough");

        holders[msg.sender].isTransferable = false;
        _burn(msg.sender, amount_);
        holders[msg.sender].claimed += amount_;

        IERC20(busdAddress).safeTransferFrom(msg.sender, address(this), busdAmount);

        uint256 hectaToSend = ITreasury(treasuryAddress).deposit(busdAmount, busdAddress, 0);

        IERC20(hectaAddress).transfer(msg.sender, hectaToSend);

        emit Exercise(msg.sender, amount_);
    }

    // Within a space: you can not safeTransfer after exercise
    function _beforeTokenTransfer(
        address from_,
        address to_,
        uint256 amount_
    ) internal override {
        if (startTimestamp != 0 && from_ != address(0) && to_ != address(0)) {
            _rebase(from_);
            _rebase(to_);
            if (holders[from_].lastRebaseSpaceIndex != 0) {
                require(holders[from_].isTransferable, "Cannot transfer after exercise");
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
        if (startTimestamp != 0 && from_ != address(0) && to_ != address(0)) {
            uint256 claimableToTransfer = (amount_ * holders[from_].currentSpaceProfit) / (balanceOf(from_) + amount_);
            holders[from_].maxClaim = holders[from_].maxClaim - claimableToTransfer;
            // add claimable from this transaction
            holders[to_].maxClaim = holders[to_].maxClaim + claimableToTransfer;
        }
    }

    /*
     ** _rebase(address addr) before every transfer or exercise action
     */
    function _rebase(address addr) private {
        beat();
        // calculate maxClaim
        if (holders[addr].lastRebaseSpaceIndex < spaceCounter.current()) {
            RebaseInfo memory rebaseInfo = _calcRebase(addr);
            holders[addr].currentSpaceProfit = rebaseInfo.currentSpaceProfit;
            holders[addr].maxClaim = rebaseInfo.maxClaim;
            holders[addr].lastRebaseSpaceIndex = rebaseInfo.lastRebaseSpaceIndex;
            holders[addr].isTransferable = true;
        }
    }

    function beat() public {
        Space memory currentSpace = spaces[spaceCounter.current()];
        if (startTimestamp > 0 && block.timestamp - currentSpace.startedTime > spaceLength) {
            spaceCounter.increment();
            spaces[spaceCounter.current()] = Space(IERC20(hectaAddress).totalSupply(), totalSupply(), block.timestamp);
        }
    }

    function _calcRebase(address addr) private view returns (RebaseInfo memory) {
        if (startTimestamp == 0 || totalSupply() == 0) {
            return RebaseInfo(0, 0, 0);
        }

        uint256 _spaceCount = spaceCounter.current();
        Space memory currentSpace = spaces[_spaceCount];

        uint256 accumulatedProfit = 0;
        uint256 currentSpaceProfit = holders[addr].currentSpaceProfit;
        // calculate maxClaim
        if (holders[addr].lastRebaseSpaceIndex < _spaceCount) {
            for (uint256 i = holders[addr].lastRebaseSpaceIndex; i < _spaceCount; i++) {
                currentSpaceProfit =
                    ((((spaces[i + 1].totalHecta - spaces[i].totalHecta) * RATE_NUMERATOR) / RATE_DENOMINATOR) *
                        balanceOf(addr)) /
                    spaces[i + 1].totalPHecta;
                accumulatedProfit += currentSpaceProfit;
            }
        }

        if (block.timestamp - currentSpace.startedTime > spaceLength) {
            Space memory newSpace = Space(IERC20(hectaAddress).totalSupply(), totalSupply(), block.timestamp);

            currentSpaceProfit =
                ((((newSpace.totalHecta - spaces[_spaceCount].totalHecta) * RATE_NUMERATOR) / RATE_DENOMINATOR) *
                    balanceOf(addr)) /
                newSpace.totalPHecta;

            accumulatedProfit += currentSpaceProfit;
        }
        return RebaseInfo(holders[addr].maxClaim + accumulatedProfit, currentSpaceProfit, _spaceCount);
    }

    /**
     * @notice convert pHecta to busd
     * @param amount_ uint256
     * @return value_ uint256
     */
    function toTokenAmount(address token, uint256 amount_) public view returns (uint256 value_) {
        value_ = (amount_ * (10**IERC20Metadata(token).decimals())) / (10**decimals());
    }
}
