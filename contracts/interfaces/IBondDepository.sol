// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBondDepository {
    // Info about each type of market
    struct Market {
        uint256 capacity; // capacity remaining
        IERC20 quoteToken; // token to accept as payment
        bool capacityInQuote; // capacity limit is in payment token (true) or in HECTA (false, default)
        uint64 totalDebt; // total debt from market
        uint64 maxPayout; // max tokens in/out (determined by capacityInQuote false/true, respectively)
        uint64 sold; // base tokens out
        uint256 purchased; // quote tokens in
    }

    // Info for creating new markets
    struct Terms {
        bool fixedTerm; // fixed term or fixed expiration
        uint64 controlVariable; // scaling variable for price
        uint48 vesting; // length of time from deposit to maturity if fixed-term
        uint48 conclusion; // timestamp when market no longer offered (doubles as time when market matures if fixed-expiry)
        uint64 maxDebt; // 9 decimal debt maximum in HECTA
    }

    // Additional info about market.
    struct Metadata {
        uint48 lastTune; // last timestamp when control variable was tuned
        uint48 lastDecay; // last timestamp when market was created and debt was decayed
        uint48 length; // time from creation to conclusion. used as speed to decay debt.
        uint48 depositInterval; // target frequency of deposits
        uint48 tuneInterval; // frequency of tuning
        uint8 quoteDecimals; // decimals of quote token
    }

    // Control variable adjustment data
    struct Adjustment {
        uint64 change;
        uint48 lastAdjustment;
        uint48 timeToAdjusted;
        bool active;
    }

    // user's bond info
    struct UserBond {
        uint256 finalPayout;
        uint256 expiry;
        uint256 index;
    }

    struct ControlDecay {
        uint64 decay; // change in control variable
        uint48 secondsSince; // seconds since last change in control variable
        bool active; // whether or not change remains active
    }

    /**
     * @notice deposit market
     * @param _bid uint256
     * @param _amount uint256
     * @param _maxPrice uint256
     * @param _user address
     * @param _referral address
     * @return userBond_ UserBond
     */
    function deposit(
        uint256 _bid,
        uint256 _amount,
        uint256 _maxPrice,
        address _user,
        address _referral
    ) external returns (UserBond memory userBond_);

    function create(
        IERC20 _quoteToken, // token used to deposit
        uint256[3] memory _market, // [capacity, initial price]
        bool[2] memory _booleans, // [capacity in quote, fixed term]
        uint256[2] memory _terms, // [vesting, conclusion]
        uint32[2] memory _intervals // [deposit interval, tune interval]
    ) external returns (uint256 id_);

    function close(uint256 _id) external;

    function isLive(uint256 _bid) external view returns (bool);

    function liveMarkets() external view returns (uint256[] memory);

    function liveMarketsFor(address _quoteToken) external view returns (uint256[] memory);

    function payoutFor(uint256 _amount, uint256 _bid) external view returns (uint256);

    function marketPrice(uint256 _bid) external view returns (uint256);

    function currentDebt(uint256 _bid) external view returns (uint256);

    function debtRatio(uint256 _bid) external view returns (uint256);

    function debtDecay(uint256 _bid) external view returns (uint64);
}
