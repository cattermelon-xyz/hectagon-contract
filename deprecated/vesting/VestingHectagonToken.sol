// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.7.5;

import "../libraries/SafeMath.sol";
import "../types/Ownable.sol";
import "../types/ERC20.sol";
import "../libraries/SafeERC20.sol";
import "../interfaces/IsHECTA.sol";
import "../interfaces/ITreasury.sol";
import "../interfaces/IERC20.sol";

contract VestingHectagonToken is ERC20, Ownable {

  using SafeMath for uint;
  using SafeERC20 for IERC20;

  bool public isWhiteListStopped;

  uint immutable public blockSpace = 604800; // 21 days 
  uint immutable public blockStart;
  uint immutable public spaceCapMint; // in thousandths of a %. i.e. 500 = 0.5%
  
  IERC20 immutable public hecta;
  IsHECTA immutable public sHECTA;
  address immutable public busd;
  address public immutable treasury;

  uint public spaceIndex;
  uint public markedHectaTotalSupply;
  uint public markedVestingTotalSupply;

  /* ====== STRUCTS ====== */

  struct UserInfo {
    uint lastSpaceIndex;
    uint totalMintableInCurrentSpace;
  }
  
  mapping( address => UserInfo ) public userInfo;

  modifier whiteListOngoing {
    require(isWhiteListStopped == false, "Sorry, whitelisting stopped");
    _;
  }
  
  constructor(
      address hecta_,
      address _sHECTA,
      address busd_,
      address treasury_,
      uint spaceCapMint_,
      string memory tokenName_,
      string memory tokenSymbol_,
      uint blockStart_
    ) ERC20(tokenName_, tokenSymbol_, 9) {
    require( hecta_ != address(0), "Zero address: hecta");
    require( _sHECTA != address(0), "Zero address: sHECTA");
    require( busd_ != address(0), "Zero address: busd");
    require( treasury_ != address(0), "Zero address: Treasury");

    hecta = IERC20(hecta_);
    sHECTA = IsHECTA(_sHECTA);
    busd = busd_;
    treasury = treasury_;
    spaceCapMint = spaceCapMint_;
    blockStart = blockStart_;
  }

  function stopWhiteList() external onlyOwner() returns ( bool ){
    isWhiteListStopped = true;
    return isWhiteListStopped;
  }

  function mint( address recipient_, uint amount_) internal virtual {
    _mint( recipient_, amount_ );
  }

  function burn(uint amount_) public virtual {
    _burn( msg.sender, amount_ );
  }

  function burnFrom( address account_, uint amount_ ) public virtual {
    _burnFrom( account_, amount_ );
  }

  function _burnFrom( address account_, uint amount_ ) internal virtual {
    uint decreasedAllowance_ = allowance( account_, msg.sender ).sub( amount_, "ERC20: burn amount exceeds allowance");
    _approve( account_, msg.sender, decreasedAllowance_ );
    _burn( account_, amount_ );
  }

  // Allows wallet to redeem hecta
  function exercise( uint _amount ) external returns ( bool ) {
    require( balanceOf(msg.sender) >= _amount, "Amount exceeds balance" );

    UserInfo memory info = userInfo[ msg.sender ];
    uint hectaBaseSupply = ITreasury( treasury ).baseSupply();

    uint currentSpaceIndex = block.number.sub(blockStart).div(blockSpace);
    
    if(spaceIndex < currentSpaceIndex){
      markedVestingTotalSupply = totalSupply();
      markedHectaTotalSupply = hectaBaseSupply;
      spaceIndex = currentSpaceIndex;
    }
    if(currentSpaceIndex > info.lastSpaceIndex){
      info.totalMintableInCurrentSpace = markedHectaTotalSupply.mul(spaceCapMint).div( 100000 ).mul(balanceOf(msg.sender)).div(markedVestingTotalSupply);
      info.lastSpaceIndex = currentSpaceIndex;
    }

    require(_amount < info.totalMintableInCurrentSpace, "Your amount exceeds your quota in this space");

    IERC20( busd ).safeTransferFrom( msg.sender, address( this ), _amount );
    info.totalMintableInCurrentSpace = info.totalMintableInCurrentSpace.sub(_amount);
    burnFrom( msg.sender, _amount );

    IERC20( busd ).approve( treasury, _amount );

    uint hectaToSend = ITreasury( treasury ).deposit( _amount, busd, 0 );

    hecta.safeTransfer( msg.sender, hectaToSend );

    return true;
  }

  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    userInfo[ recipient ] = userInfo[ msg.sender ];
    delete userInfo[ msg.sender ];
    _transfer(msg.sender, recipient, amount);
    return true;
  }
}