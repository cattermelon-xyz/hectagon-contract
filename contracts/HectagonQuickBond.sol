// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./interfaces/IBondDepository.sol";
import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IWETH.sol";
import "./libraries/Babylonian.sol";

contract HectagonQuickBond is Ownable, Pausable {
    using SafeERC20 for IERC20;

    ////////////////////////// STORAGE //////////////////////////

    address public depo;

    bool public stopped = false;

    // bsc mainnet
    IUniswapV2Factory private constant pancakeswapFactoryAddress =
        IUniswapV2Factory(0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73);
    IUniswapV2Router private pancakeswapRouter = IUniswapV2Router(0x10ED43C718714eb63d5aA57B78B54704E256024E);
    address private constant wbnbTokenAddress = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    uint256 private constant deadline = 0xf000000000000000000000000000000000000000000000000000000000000000;

    // Emitted when `sender` successfully calls ZapBond
    event QuickBond(address indexed sender, address indexed token, uint256 tokensRec, address referral);

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function quickLPBond(
        address _fromTokenAddress,
        address _pairAddress,
        address[] memory _path,
        uint256 _amount,
        uint256 _minTokenReceive,
        bool _transferResidual,
        bool _shouldSellEntireBalance,
        address _referral,
        uint256 _maxPrice,
        uint256 _bondId
    ) external payable whenNotPaused returns (uint256) {
        uint256 toInvest = _pullTokens(_fromTokenAddress, _amount, _shouldSellEntireBalance);

        uint256 LPBought = _performZapIn(_fromTokenAddress, _pairAddress, toInvest, _transferResidual, _path);

        _approveToken(_pairAddress, depo, LPBought);
        // purchase bond
        IBondDepository.UserBond memory userBond = IBondDepository(depo).deposit(
            _bondId,
            LPBought,
            _maxPrice,
            msg.sender, // depositor
            _referral
        );
        require(userBond.finalPayout >= _minTokenReceive, "High Slippage");

        emit QuickBond(msg.sender, _pairAddress, userBond.finalPayout, _referral);

        return userBond.finalPayout;
    }

    function quickStableBond(
        address _fromTokenAddress,
        address _principal,
        address[] memory _path,
        uint256 _amount,
        bool _shouldSellEntireBalance,
        address _referral,
        uint256 _maxPrice,
        uint256 _bondId
    ) external payable whenNotPaused returns (uint256) {
        uint256 toInvest = _pullTokens(_fromTokenAddress, _amount, _shouldSellEntireBalance);

        uint256 tokensBought = _fillQuote(_fromTokenAddress, toInvest, _path);

        // make sure bond depo is approved to spend this contracts "principal"
        _approveToken(_principal, depo, tokensBought);

        // purchase bond
        IBondDepository.UserBond memory userBond = IBondDepository(depo).deposit(
            _bondId,
            tokensBought,
            _maxPrice,
            msg.sender, // depositor
            _referral
        );

        emit QuickBond(msg.sender, _principal, userBond.finalPayout, _referral);
        return userBond.finalPayout;
    }

    function _getPairTokens(address _pairAddress) internal pure returns (address token0, address token1) {
        IUniswapV2Pair uniPair = IUniswapV2Pair(_pairAddress);
        token0 = uniPair.token0();
        token1 = uniPair.token1();
    }

    function _performZapIn(
        address _fromTokenAddress,
        address _pairAddress,
        uint256 _amount,
        bool transferResidual,
        address[] memory _path
    ) internal returns (uint256) {
        uint256 intermediateAmt;
        address intermediateToken;
        (address _ToUniswapToken0, address _ToUniswapToken1) = _getPairTokens(_pairAddress);

        if (_fromTokenAddress != _ToUniswapToken0 && _fromTokenAddress != _ToUniswapToken1) {
            // swap to intermediate
            (intermediateAmt, intermediateToken) = _fillQuote(_fromTokenAddress, _pairAddress, _amount, _path);
        } else {
            intermediateToken = _fromTokenAddress;
            intermediateAmt = _amount;
        }

        // divide intermediate into appropriate amount to add liquidity
        (uint256 token0Bought, uint256 token1Bought) = _swapIntermediate(
            intermediateToken,
            _ToUniswapToken0,
            _ToUniswapToken1,
            intermediateAmt
        );
        return _uniDeposit(_ToUniswapToken0, _ToUniswapToken1, token0Bought, token1Bought, transferResidual);
    }

    function _pullTokens(
        address token,
        uint256 amount,
        bool shouldSellEntireBalance
    ) internal returns (uint256 value) {
        if (token == address(0)) {
            require(msg.value > 0, "No BNB sent");
            return msg.value;
        }
        require(amount > 0, "Invalid token amount");
        require(msg.value == 0, "BNB sent with token");

        //transfer token
        if (shouldSellEntireBalance) {
            require(Address.isContract(msg.sender), "ERR: shouldSellEntireBalance is true for EOA");
            amount = IERC20(token).allowance(msg.sender, address(this));
        }
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        return amount;
    }

    function _uniDeposit(
        address _ToUnipoolToken0,
        address _ToUnipoolToken1,
        uint256 token0Bought,
        uint256 token1Bought,
        bool transferResidual
    ) internal returns (uint256) {
        _approveToken(_ToUnipoolToken0, address(pancakeswapRouter), token0Bought);
        _approveToken(_ToUnipoolToken1, address(pancakeswapRouter), token1Bought);

        (uint256 amountA, uint256 amountB, uint256 LP) = pancakeswapRouter.addLiquidity(
            _ToUnipoolToken0,
            _ToUnipoolToken1,
            token0Bought,
            token1Bought,
            1,
            1,
            address(this),
            deadline
        );

        if (transferResidual) {
            //Returning Residue in token0, if any.
            if (token0Bought - amountA > 0) {
                IERC20(_ToUnipoolToken0).safeTransfer(msg.sender, token0Bought - amountA);
            }

            //Returning Residue in token1, if any
            if (token1Bought - amountB > 0) {
                IERC20(_ToUnipoolToken1).safeTransfer(msg.sender, token1Bought - amountB);
            }
        }
        return LP;
    }

    function _fillQuote(
        address _fromTokenAddress,
        address _pairAddress,
        uint256 _amount,
        address[] memory _path
    ) internal returns (uint256 amountBought, address intermediateToken) {
        address fromTokenAddress;

        if (_fromTokenAddress == address(0)) {
            IWETH(wbnbTokenAddress).deposit{value: _amount}();
            fromTokenAddress = wbnbTokenAddress;
        } else {
            fromTokenAddress = _fromTokenAddress;
        }

        _approveToken(fromTokenAddress, address(pancakeswapRouter), _amount);

        (address _token0, address _token1) = _getPairTokens(_pairAddress);
        IERC20 token0 = IERC20(_token0);
        IERC20 token1 = IERC20(_token1);
        uint256 initialBalance0 = token0.balanceOf(address(this));
        uint256 initialBalance1 = token1.balanceOf(address(this));

        _path[0] = fromTokenAddress;

        uint256 tokenBought = pancakeswapRouter.swapExactTokensForTokens(_amount, 1, _path, address(this), deadline)[
            _path.length - 1
        ];

        require(tokenBought > 0, "Error Swapping Tokens 1");

        uint256 finalBalance0 = token0.balanceOf(address(this)) - initialBalance0;
        uint256 finalBalance1 = token1.balanceOf(address(this)) - initialBalance1;

        if (finalBalance0 > finalBalance1) {
            amountBought = finalBalance0;
            intermediateToken = _token0;
        } else {
            amountBought = finalBalance1;
            intermediateToken = _token1;
        }

        require(amountBought > 0, "Swapped to Invalid Intermediate");
    }

    function _fillQuote(
        address _fromTokenAddress,
        uint256 _amount,
        address[] memory _path
    ) internal returns (uint256) {
        address fromTokenAddress;

        if (_fromTokenAddress == address(0)) {
            IWETH(wbnbTokenAddress).deposit{value: _amount}();
            fromTokenAddress = wbnbTokenAddress;
        } else {
            fromTokenAddress = _fromTokenAddress;
        }

        _approveToken(fromTokenAddress, address(pancakeswapRouter), _amount);

        _path[0] = fromTokenAddress;

        uint256 tokenBought = pancakeswapRouter.swapExactTokensForTokens(_amount, 1, _path, address(this), deadline)[
            _path.length - 1
        ];
        require(tokenBought > 0, "Error Swapping Tokens 1");
        return tokenBought;
    }

    function _swapIntermediate(
        address _toContractAddress,
        address _ToUnipoolToken0,
        address _ToUnipoolToken1,
        uint256 _amount
    ) internal returns (uint256 token0Bought, uint256 token1Bought) {
        IUniswapV2Pair pair = IUniswapV2Pair(pancakeswapFactoryAddress.getPair(_ToUnipoolToken0, _ToUnipoolToken1));
        (uint256 res0, uint256 res1, ) = pair.getReserves();
        if (_toContractAddress == _ToUnipoolToken0) {
            uint256 amountToSwap = calculateSwapInAmount(res0, _amount);
            //if no reserve or a new pair is created
            if (amountToSwap <= 0) amountToSwap = _amount / 2;
            token1Bought = _token2Token(_toContractAddress, _ToUnipoolToken1, amountToSwap);
            token0Bought = _amount - amountToSwap;
        } else {
            uint256 amountToSwap = calculateSwapInAmount(res1, _amount);
            //if no reserve or a new pair is created
            if (amountToSwap <= 0) amountToSwap = _amount / 2;
            token0Bought = _token2Token(_toContractAddress, _ToUnipoolToken0, amountToSwap);
            token1Bought = _amount - amountToSwap;
        }
    }

    function calculateSwapInAmount(uint256 reserveIn, uint256 userIn) internal pure returns (uint256) {
        // in case fee is 0.25%
        return
            (Babylonian.sqrt(reserveIn * ((userIn * 399000000) + (reserveIn * 399000625))) - (reserveIn * 19975)) /
            19950;
    }

    /**
    @notice This function is used to swap ERC20 <> ERC20
    @param _fromTokenAddress The token address to swap from.
    @param _ToTokenContractAddress The token address to swap to. 
    @param tokens2Trade The amount of tokens to swap
    @return tokenBought The quantity of tokens bought
    */
    function _token2Token(
        address _fromTokenAddress,
        address _ToTokenContractAddress,
        uint256 tokens2Trade
    ) internal returns (uint256 tokenBought) {
        if (_fromTokenAddress == _ToTokenContractAddress) {
            return tokens2Trade;
        }

        _approveToken(_fromTokenAddress, address(pancakeswapRouter), tokens2Trade);

        address pair = pancakeswapFactoryAddress.getPair(_fromTokenAddress, _ToTokenContractAddress);
        require(pair != address(0), "No Swap Available");
        address[] memory path = new address[](2);
        path[0] = _fromTokenAddress;
        path[1] = _ToTokenContractAddress;

        tokenBought = pancakeswapRouter.swapExactTokensForTokens(tokens2Trade, 1, path, address(this), deadline)[
            path.length - 1
        ];

        require(tokenBought > 0, "Error Swapping Tokens 2");
    }

    ////////////////////////// HECTAGON ONLY //////////////////////////

    /// @notice update state for depo
    function updateDepo(address _depo) external onlyOwner {
        depo = _depo;
    }

    function withdraw(address _token, uint256 _amount) public onlyOwner {
        IERC20(_token).transfer(msg.sender, _amount);
    }

    function _approveToken(
        address token,
        address spender,
        uint256 amount
    ) internal {
        IERC20(token).safeApprove(spender, 0);
        IERC20(token).safeApprove(spender, amount);
    }

    receive() external payable {
        require(msg.sender != tx.origin, "Do not send BNB directly");
    }
}
