// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.10;

import "../types/HectagonAccessControlled.sol";
import "../interfaces/IERC20.sol";

abstract contract FrontEndRewarder is HectagonAccessControlled {
    struct Give {
        uint256 toRef;
        uint256 toFunds;
        uint256 toBuyer;
    }

    struct RefTerm {
        uint256 referrerPercent; // reward for referrer (3 decimals: 100 = 1%)
        uint256 buyerPercent; // reward for bond buyer (3 decimals: 100 = 1%)
    }

    struct PartnerTerm {
        uint256 amount; // partner's remaining hecta bonus, decimal 9
        uint256 percent; // partner's bonus percent per deposit, 3 decimals: 100 = 1%
    }

    /* ========= STATE VARIABLES ========== */

    mapping(address => uint256) public rewards; // rewards notes

    address[] public funds;
    uint256[] public fundsConfig;
    mapping(address => PartnerTerm) public partnerTerms; // reward term for each partner
    mapping(address => RefTerm) public referTerms; // reward term for refer

    uint256 public referTermCap = 1000; // % cap for referrer (3 decimals: 1000 = 10%)
    uint256 public rewardTime; // cannot get rewards before that time

    uint256 private immutable RATE_DENOMINATOR = 1e4;

    IERC20 internal immutable hecta; // reward token

    constructor(IHectagonAuthority _authority, IERC20 _hecta) HectagonAccessControlled(_authority) {
        hecta = _hecta;
    }

    /* ========= EXTERNAL FUNCTIONS ========== */

    // pay reward to referrer
    function getReward() external {
        require(block.timestamp >= rewardTime, "Cannot get reward in vesting time");
        uint256 reward = rewards[msg.sender];

        rewards[msg.sender] = 0;
        hecta.transfer(msg.sender, reward);
    }

    /* ========= INTERNAL ========== */

    /**
     * @notice              add new market payout to user data
     * @return rewards_     total rewards
     * @return finalPayout_ buyer final payout
     * @return commission_  refers commission
     */
    function _giveRewards(
        uint256 _payout,
        address _referral,
        address _buyer
    )
        internal
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        // first we calculate rewards paid to the DAO and to the front end operator (referrer)
        Give memory give;
        for (uint256 index = 0; index < funds.length; index++) {
            give.toFunds += (_payout * fundsConfig[index]) / RATE_DENOMINATOR;
            rewards[funds[index]] += (_payout * fundsConfig[index]) / RATE_DENOMINATOR;
        }

        // check partner logic
        if (partnerTerms[_buyer].percent > 0) {
            uint256 partnerBonus = (_payout * partnerTerms[_buyer].percent) / RATE_DENOMINATOR;
            if (partnerBonus >= partnerTerms[_buyer].amount) {
                give.toBuyer = partnerTerms[_buyer].amount;
            } else {
                give.toBuyer = partnerBonus;
            }
            partnerTerms[_buyer].amount -= give.toBuyer;
        } else {
            RefTerm memory refTerm = referTerms[_referral];

            if (refTerm.referrerPercent > 0) {
                give.toRef = (_payout * refTerm.referrerPercent) / RATE_DENOMINATOR;
                rewards[_referral] += give.toRef;
            }

            if (refTerm.buyerPercent > 0) {
                give.toBuyer = (_payout * refTerm.buyerPercent) / RATE_DENOMINATOR;
            }
        }

        return (give.toFunds + give.toRef + give.toBuyer, give.toBuyer + _payout, give.toRef);
    }

    /**
     * @notice set Cap for referrer % reward
     */
    function setRewardCap(uint256 _cap) external onlyGovernor {
        referTermCap = _cap;
    }

    /**
     * @notice set rewardTime for DAO
     */
    function setRewardTime(uint256 _time) external onlyGovernor {
        rewardTime = _time;
    }

    /**
     * @notice set protocols Funds
     */
    function setFunds(address[] calldata funds_, uint256[] calldata configs_) external onlyGovernor {
        require(funds_.length == configs_.length, "Params length mismatch");
        funds = funds_;
        fundsConfig = configs_;
    }

    /**
     * @notice set referrer term
     */
    function setReferTerm(
        address _referrer,
        uint256 _refPercent,
        uint256 _buyerPercent
    ) external onlyPolicy {
        require((_refPercent + _buyerPercent) <= referTermCap, "reward too high");
        referTerms[_referrer] = RefTerm({referrerPercent: _refPercent, buyerPercent: _buyerPercent});
    }

    /**
     * @notice set partner term
     */
    function setPartnerTerm(
        address _partner,
        uint256 _amount,
        uint256 _percent
    ) external onlyPolicy {
        require(_partner != address(0), "Zero address: Partner");
        partnerTerms[_partner] = PartnerTerm(_amount, _percent);
    }
}
