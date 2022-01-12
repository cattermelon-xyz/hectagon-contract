// SPDX-License-Identifier: MIT
pragma solidity ^0.7.5;

import "./interfaces/IERC20.sol";
import "./libraries/SafeMath.sol";

contract HectaCirculatingSupplyConrtact {
    using SafeMath for uint;

    bool public isInitialized;

    address public Hecta;
    address public owner;
    address[] public nonCirculatingHectaAddresses;

    constructor() {        
        owner = msg.sender;
    }

    function initialize( address _Hecta ) external returns ( bool ) {
        require( msg.sender == owner, "caller is not owner" );
        require( isInitialized == false );

        Hecta = _Hecta;

        isInitialized = true;

        return true;
    }

    function HectaCirculatingSupply() external view returns ( uint ) {
        uint _totalSupply = IERC20( Hecta ).totalSupply();

        uint _circulatingSupply = _totalSupply.sub( getNonCirculatingHecta() );

        return _circulatingSupply;
    }

    function getNonCirculatingHecta() public view returns ( uint ) {
        uint _nonCirculatingHecta;

        for( uint i=0; i < nonCirculatingHectaAddresses.length; i = i.add( 1 ) ) {
            _nonCirculatingHecta = _nonCirculatingHecta.add( IERC20( Hecta ).balanceOf( nonCirculatingHectaAddresses[i] ) );
        }

        return _nonCirculatingHecta;
    }

    function setNonCirculatingHectaAddresses( address[] calldata _nonCirculatingAddresses ) external returns ( bool ) {
        require( msg.sender == owner, "Sender is not owner" );
        nonCirculatingHectaAddresses = _nonCirculatingAddresses;

        return true;
    }

    function transferOwnership( address _owner ) external returns ( bool ) {
        require( msg.sender == owner, "Sender is not owner" );

        owner = _owner;

        return true;
    }
}