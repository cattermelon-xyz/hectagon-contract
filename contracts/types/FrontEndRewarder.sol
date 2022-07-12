// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.10;

import "../types/HectagonAccessControlled.sol";
import "../interfaces/IERC20.sol";

abstract contract FrontEndRewarder is HectagonAccessControlled {
    struct Give {
        uint256 toRefer;
        uint256 toDAO;
        uint256 toBuyer;
    }

    struct ReferTerm {
        uint256 referrerPercent; // reward for referrer (3 decimals: 100 = 1%)
        uint256 buyerPercent; // reward for bond buyer (3 decimals: 100 = 1%)
    }

    struct PartnerTerm {
        uint256 amount; // partner's remaining hecta bonus, decimal 9
        uint256 percent; // partner's bonus percent per deposit, 3 decimals: 100 = 1%
    }

    /* ========= STATE VARIABLES ========== */

    mapping(address => uint256) public rewards; // rewards notes

    mapping(address => PartnerTerm) public partnerTerms; // reward term for each partner
    mapping(address => ReferTerm) public referTerms; // reward term for refer

    uint256 public referTermCap = 2000; // % cap for referrer (3 decimals: 2000 = 20%)
    uint256 public partnerTermCap = 10000; // % cap for partner (3 decimals: 10000 = 100%)

    uint256 public daoInvestmentAmount; //  cumulative amount in hecta
    uint256 public daoInvestmentPercent = 10000; // 3 decimals: 10000 = 100%

    uint256 public daoCommunityAmount; //  cumulative amount in hecta
    uint256 public daoCommunityPercent = 45000; // 3 decimals: 45000 = 450%

    uint256 private immutable RATE_DENOMINATOR = 1e4;

    IERC20 internal immutable hecta; // reward token

    constructor(IHectagonAuthority _authority, IERC20 _hecta) HectagonAccessControlled(_authority) {
        hecta = _hecta;
    }

    /* ========= EXTERNAL FUNCTIONS ========== */

    // pay reward to referrer
    function getReward() external {
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

        give.toDAO += (_payout * daoInvestmentPercent) / RATE_DENOMINATOR;
        daoInvestmentAmount += (_payout * daoInvestmentPercent) / RATE_DENOMINATOR;

        give.toDAO += (_payout * daoCommunityPercent) / RATE_DENOMINATOR;
        daoCommunityAmount += (_payout * daoCommunityPercent) / RATE_DENOMINATOR;

        rewards[authority.guardian()] += give.toDAO;

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
            ReferTerm memory refTerm = referTerms[_referral];

            if (refTerm.referrerPercent > 0) {
                give.toRefer = (_payout * refTerm.referrerPercent) / RATE_DENOMINATOR;
                rewards[_referral] += give.toRefer;
            }

            if (refTerm.buyerPercent > 0) {
                give.toBuyer = (_payout * refTerm.buyerPercent) / RATE_DENOMINATOR;
            }
        }

        return (give.toDAO + give.toRefer + give.toBuyer, give.toBuyer + _payout, give.toRefer);
    }

    /**
     * @notice set Cap for referrer % reward
     */
    function setReferTermCap(uint256 _cap) external onlyGovernor {
        referTermCap = _cap;
    }

    /**
     * @notice set Cap for referrer % reward
     */
    function setPartnerTermCap(uint256 _cap) external onlyGovernor {
        partnerTermCap = _cap;
    }

    function setDaoRewards(uint256 daoInvestmentPercent_, uint256 daoCommunityPercent_) external onlyGovernor {
        daoInvestmentPercent = daoInvestmentPercent_;
        daoCommunityPercent = daoCommunityPercent_;
    }

    /**
     * @notice set referrer term
     */
    function setReferTerm(
        address _referrer,
        uint256 _referrerPercent,
        uint256 _buyerPercent
    ) external onlyPolicy {
        require(_referrer != address(0), "Zero address: Referrer");
        require((_referrerPercent + _buyerPercent) <= referTermCap, "reward too high");
        referTerms[_referrer] = ReferTerm({referrerPercent: _referrerPercent, buyerPercent: _buyerPercent});
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
        require(_percent <= partnerTermCap, "reward too high");
        partnerTerms[_partner] = PartnerTerm(_amount, _percent);
    }
}
