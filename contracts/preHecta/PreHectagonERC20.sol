// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.7.5;

import "../types/ERC20.sol";
import "../types/Ownable.sol";
import "../types/Pausable.sol";
import "../libraries/SafeMath.sol";

abstract contract PreHectagonERC20 is ERC20, Ownable, Pausable {
  using SafeMath for uint256;
  event MintingDisabled(uint256 atBlockNumber);
  event TokenMinted(address receipient, uint256 amount);

  bool public allowMinting;

  function disableMinting() external onlyOwner() returns ( bool ) {
    require( allowMinting, "Minting has been disabled." );
    allowMinting = false;
    emit MintingDisabled(block.number);
    return allowMinting;
  }

  function mint( address recipient_, uint256 amount_) public onlyOwner() {
    require( allowMinting, "Minting has been disabled." );
    _mint( recipient_, amount_ );
    emit TokenMinted(recipient_, amount_);
  }

  function pause() public onlyOwner() {
    _pause();
  }

  function unpause() public onlyOwner() {
    _unpause();
  }

  function burn(uint256 amount_) public whenNotPaused() {
    _burn( msg.sender, amount_ );
  }

  function burnFrom( address account_, uint256 amount_ ) public whenNotPaused() {
    _burnFrom( account_, amount_ );
  }

  function _burnFrom( address account_, uint256 amount_ ) internal{
    uint256 decreasedAllowance_ = allowance( account_, msg.sender ).sub( amount_,
      "ERC20: burn amount exceeds allowance");
    _approve( account_, msg.sender, decreasedAllowance_ );
    _burn( account_, amount_ );
  }

  function _beforeTokenTransfer(address from, address to, uint256 amount)
    internal
    whenNotPaused
    override
  {
    super._beforeTokenTransfer(from, to, amount);
  }
}
