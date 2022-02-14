// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../interfaces/ITreasury.sol";

contract pHectagon is Pausable, Ownable, ERC20 {
  using Counters for Counters.Counter;

  /** Variables */
  Counters.Counter public spaceCount;

  address public immutable hectaAddress;
  address public immutable treasuryAddress;
  address public busdAddress;
  
  uint256 public startTimestamp;
  bool public useWhiteList;
  bool public isMigrationDone;
  
  mapping (address => bool) public investors;
  mapping (address => Info) public infos; 
  mapping (uint256 => SpaceInfo) public spaces;
  
  uint256 public spaceLength = 604800; // 7 days timestamp
  

  /** Constant */
  uint256 constant public RateDenominator = 1000000; // 1,000,000
  uint256 constant public MaxPHectaToExercise = 100000; // in ten-thousandths ( 5000 = 0.5%, 100,000 = 10% )

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
    if(useWhiteList == true){
      require(investors[msg.sender] == true, "Investor must be whitelisted to use this function");
    }
    _;
  }

  constructor(address hectaAddress_, address treasuryAddress_) 
    ERC20("Private Hectagon", "pHecta") {
    hectaAddress = hectaAddress_;
    treasuryAddress = treasuryAddress_;
  }

  function decimals() public view virtual override returns (uint8) {
    return 9;
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
  }

  function stopMigration() external onlyOwner {
    isMigrationDone = true;
  }

  function start() external onlyOwner {
    require(startTimestamp == 0, "Already started!");
    startTimestamp = block.timestamp;
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

  function showClaimable(address addr) external view returns (uint256){
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

    require(infos[msg.sender].maxClaim - infos[msg.sender].claimed > amount_, "Claim more than maximum amount");
    require(IERC20(busdAddress).allowance(msg.sender, address(this)) >= amount_, 
      "Must approve this contract to spend more than withdrawl amount");
    require(IERC20(busdAddress).balanceOf(msg.sender) >= amount_,
      "BUSD balance is not enough");

    infos[msg.sender].isTransferable = false;
    _burn(msg.sender, amount_);
    infos[msg.sender].claimed = infos[msg.sender].claimed + amount_;

    IERC20(busdAddress).transferFrom( msg.sender, address(this), amount_ );

    ITreasury(treasuryAddress).deposit(amount_, busdAddress, 0);

    IERC20(hectaAddress).transfer(msg.sender, amount_);
  }

  // Within a space: you can not transfer after exercise
  function _beforeTokenTransfer(address from_, address to_, uint256 amount_) override internal {
    if(from_ != address(0)) {
        _rebase(from_);
        require(infos[from_].isTransferable, "Cannot transfer after exercise");
    }
  }

  /**
  * Transfer claimable
   */
  function _afterTokenTransfer(address from_, address to_, uint256 amount_) override internal {
    uint256 claimableToTransfer = amount_ / balanceOf(from_) * infos[from_].currentSpaceProfit;

    infos[from_].maxClaim = infos[from_].maxClaim - claimableToTransfer;
    // rebase for to_ with previous owned tokens
    _rebase(to_);
    // add claimable from this transaction
    infos[to_].maxClaim = infos[to_].maxClaim + claimableToTransfer;

    emit ClaimableTransfer(from_, to_, claimableToTransfer);
  }

  /*
  ** _rebase(address addr) before every transfer or exercise action
   */
  function _rebase(address addr) private {
    beat();
    // calculate maxClaim
    if(infos[addr].lastRebaseSpaceCount < spaceCount.current()) {
      RebaseInfo memory rebaseInfo = _calcRebase(addr);
      infos[addr].currentSpaceProfit = rebaseInfo.currentSpaceProfit;
      infos[addr].maxClaim = rebaseInfo.maxClaim;
      infos[addr].lastRebaseSpaceCount = rebaseInfo.lastRebaseCount;
      infos[addr].isTransferable = true;
    }
  }

  function beat() public {
    SpaceInfo memory currentSpace = spaces[spaceCount.current()];
    
    if(currentSpace.timestamp == 0) {
      currentSpace.timestamp = startTimestamp;
    }

    if(block.timestamp - currentSpace.timestamp > spaceLength) {
      spaceCount.increment();
      spaces[spaceCount.current()] = SpaceInfo(IERC20(hectaAddress).totalSupply(), totalSupply(), block.timestamp);
    }
  }
  
  function _calcRebase(address addr) private view returns (RebaseInfo memory) {
    uint _spaceCount = spaceCount.current();
    SpaceInfo memory currentSpace = spaces[_spaceCount];
    
    if(currentSpace.timestamp == 0) {
      currentSpace.timestamp = startTimestamp;
    }
  
    uint256 accumulatedProfit = 0;
    uint256 currentSpaceProfit = infos[addr].currentSpaceProfit;

    // calculate maxClaim
    if(infos[addr].lastRebaseSpaceCount < _spaceCount) {
      for(uint256 i = infos[addr].lastRebaseSpaceCount; i < _spaceCount; i++) {
        currentSpaceProfit = (spaces[i+1].totalHecta - spaces[i].totalHecta)
         * (MaxPHectaToExercise / RateDenominator ) * ( balanceOf(addr) / spaces[i+1].totalPHecta);
        accumulatedProfit += currentSpaceProfit;
      }
    }

    if(block.timestamp - currentSpace.timestamp > spaceLength) {
      SpaceInfo memory newSpace = SpaceInfo(IERC20(hectaAddress).totalSupply(), totalSupply(), block.timestamp);

      currentSpaceProfit = (newSpace.totalHecta - spaces[_spaceCount].totalHecta)
        * (MaxPHectaToExercise / RateDenominator ) * ( balanceOf(addr) / newSpace.totalPHecta);

      accumulatedProfit += currentSpaceProfit;
    }

    return RebaseInfo(
      infos[addr].maxClaim + accumulatedProfit,
      currentSpaceProfit,
      _spaceCount
    );
  }
}