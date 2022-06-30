// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.10;

import "../types/HectagonAccessControlled.sol";
import "../interfaces/IERC20.sol";

abstract contract FrontEndRewarder is HectagonAccessControlled {
    struct Reward {
        uint256 referrer; // reward for referrer (3 decimals: 100 = 1%)
        uint256 buyer; // reward for bond buyer (3 decimals: 100 = 1%)
        uint256 referrerAmount;
    }

    struct Give {
        uint256 toRef;
        uint256 toDAO;
        uint256 toBuyer;
    }

    struct PartnerReward {
        uint256 amount; // partner's remaining hecta bonus, decimal 9
        uint256 percent; // partner's bonus percent per deposit, 3 decimals: 100 = 1%
    }
    

    /* ========= STATE VARIABLES ========== */

    uint256 public daoReward; // % reward for dao (3 decimals: 100 = 1%)
    uint256 public rewardCap = 1000; // % reward Cap for referrer (3 decimals: 1000 = 10%)
    mapping(address => Reward) public rewards; // term for each referers
    mapping(address => PartnerReward) public partnerRewards; // reward term for each partner
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
        uint256 reward = rewards[msg.sender].referrerAmount;

        rewards[msg.sender].referrerAmount = 0;
        hecta.transfer(msg.sender, reward);
    }

    /* ========= INTERNAL ========== */

    /**
     * @notice              add new market payout to user data
     * @return rewards_     total rewards
     * @return finalPayout_ buyer final payout
     * @return commission_  refers commission
     */
    function _giveRewards(uint256 _payout, address _referral, address _buyer)
        internal
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        // first we calculate rewards paid to the DAO and to the front end operator (referrer)
        Give memory give;
        give.toDAO = (_payout * daoReward) / RATE_DENOMINATOR;

        rewards[authority.guardian()].referrerAmount += give.toDAO;
        
        // check partner logic
        if(partnerRewards[_buyer].percent > 0) {
            uint256 partnerReward = (_payout * partnerRewards[_buyer].percent) / RATE_DENOMINATOR;
            if(partnerReward >= partnerRewards[_buyer].amount) {
                give.toBuyer = partnerRewards[_buyer].amount;
            } else {
                give.toBuyer = partnerReward;
            }
            partnerRewards[_buyer].amount -= give.toBuyer;
        } else {
            Reward memory reward = rewards[_referral];

            if (reward.referrer > 0) {
                give.toRef = (_payout * reward.referrer) / RATE_DENOMINATOR;
                rewards[_referral].referrerAmount += give.toRef;
            }

            if (reward.buyer > 0) {
                give.toBuyer = (_payout * reward.buyer) / RATE_DENOMINATOR;
            }
        }

        return (give.toDAO + give.toRef + give.toBuyer, give.toBuyer + _payout, give.toRef);
    }

    /**
     * @notice set Cap for referrer % reward
     */
    function setRewardCap(uint256 _cap) external onlyGovernor {
        rewardCap = _cap;
    }

    /**
     * @notice set rewardTime for DAO
     */
    function setRewardTime(uint256 _time) external onlyGovernor {
        rewardTime = _time;
    }

    /**
     * @notice set rewards for DAO
     */
    function setDAORewards(uint256 _toDAO) external onlyGovernor {
        daoReward = _toDAO;
    }

    /**
     * @notice set referrer and buyer for specific address
     */
    function setReferConfig(
        address _referrer,
        uint256 _ref,
        uint256 _buyer
    ) external onlyPolicy {
        require((_buyer + _ref) <= rewardCap, "reward too high");
        rewards[_referrer] = Reward(_ref, _buyer, rewards[_referrer].referrerAmount);
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
        partnerRewards[_partner] = PartnerReward(_amount, _percent);
    }
}
