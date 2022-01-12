// SPDX-License-Identifier: MIT
pragma solidity ^0.7.5;

import "./interfaces/IHectagonAuthority.sol";
import "./types/HectagonAccessControlled.sol";

interface IBond {
	function principle() external returns (address); 
    function bondPrice() external view returns ( uint price_ );
    function deposit( uint _amount, uint _maxPrice, address _depositor) external returns ( uint );
	function redeem( address _recipient, bool _stake ) external returns ( uint );
    function pendingPayoutFor( address _depositor ) external view returns ( uint pendingPayout_ );
	
}

contract RedeemHelper is HectagonAccessControlled {

    address[] public bonds;

    /* ====== CONSTRUCTOR ====== */

    constructor(
        address _authority
    ) HectagonAccessControlled(IHectagonAuthority(_authority)) {
    }

    function redeemAll( address _recipient, bool _stake ) external {
        for( uint i = 0; i < bonds.length; i++ ) {
            if ( bonds[i] != address(0) ) {
                if ( IBond( bonds[i] ).pendingPayoutFor( _recipient ) > 0 ) {
                    IBond( bonds[i] ).redeem( _recipient, _stake );
                }
            }
        }
    }

    function addBondContract( address _bond ) external onlyGovernor {
        require( _bond != address(0) );
        bonds.push( _bond );
    }

    function removeBondContract( uint _index ) external onlyGovernor {
        bonds[ _index ] = address(0);
    }
}