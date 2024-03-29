// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../types/HectagonAccessControlled.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract FrontEndRewarder is HectagonAccessControlled {
    struct Give {
        uint256 toRefer;
        uint256 toDaoInvestment;
        uint256 toDaoCommunity;
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

    uint256 public referTermCap = 2_000; // % cap for referrer (3 decimals: 2,000 = 20%)
    uint256 public partnerTermCap = 10_000; // % cap for partner (3 decimals: 1,0000 = 100%)

    uint256 public daoInvestmentPercent = 10_000; // 3 decimals: 10,000 = 100%

    uint256 public daoCommunityPercent = 45_000; // 3 decimals: 45,000 = 450%

    uint256 private immutable RATE_DENOMINATOR = 10_000;

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
     * @notice          add new market payout to user data
     * @return give     rewards data
     */
    function _giveRewards(
        uint256 _payout,
        address _referral,
        address _buyer
    ) internal returns (Give memory give) {
        // first we calculate rewards paid to the DAO and referrer
        give.toDaoInvestment += (_payout * daoInvestmentPercent) / RATE_DENOMINATOR;
        give.toDaoCommunity += (_payout * daoCommunityPercent) / RATE_DENOMINATOR;

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

        return give;
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
