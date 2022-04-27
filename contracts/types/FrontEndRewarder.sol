// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.10;

import "../types/HectagonAccessControlled.sol";
import "../interfaces/IERC20.sol";

abstract contract FrontEndRewarder is HectagonAccessControlled {
    struct RewardConfig {
        uint256 refReward; // reward for referrer (3 decimals: 100 = 1%)
        uint256 buyerReward; // reward for bond buyer (3 decimals: 100 = 1%)
    }

    struct Reward {
        uint256 toRef;
        uint256 toDAO;
        uint256 toBuyer;
    }

    /* ========= STATE VARIABLES ========== */

    uint256 public daoReward; // % reward for dao (3 decimals: 100 = 1%)
    uint256 public refRewardCap = 1000; // % reward Cap for referrer (3 decimals: 100 = 1%)
    mapping(address => uint256) public rewards; // front end operator rewards
    mapping(address => RewardConfig) public refConfig; // whitelisted status for operators
    uint256 public rewardTime; // cannot get rewards before that time  

    IERC20 internal immutable hecta; // reward token

    constructor(IHectagonAuthority _authority, IERC20 _hecta) HectagonAccessControlled(_authority) {
        hecta = _hecta;
    }

    /* ========= EXTERNAL FUNCTIONS ========== */

    // pay reward to front end operator
    function getReward() external {
        require(block.timestamp >= rewardTime, "Cannot get reward in vesting time");
        uint256 reward = rewards[msg.sender];

        rewards[msg.sender] = 0;
        hecta.transfer(msg.sender, reward);
    }

    /* ========= INTERNAL ========== */

    /**
     * @notice add new market payout to user data
     */
    function _giveRewards(uint256 _payout, address _referral) internal returns (uint256, uint256) {
        // first we calculate rewards paid to the DAO and to the front end operator (referrer)
        Reward memory reward;
        reward.toDAO = (_payout * daoReward) / 1e4;

        rewards[authority.guardian()] += reward.toDAO;

        RewardConfig memory rewardConfig = refConfig[_referral];

        if (rewardConfig.refReward > 0) {
            reward.toRef = (_payout * rewardConfig.refReward) / 1e4;
            rewards[_referral] += reward.toRef;
        }

        if (rewardConfig.buyerReward > 0) {
            reward.toBuyer = (_payout * rewardConfig.buyerReward) / 1e4;
        }

        return (reward.toDAO + reward.toRef + reward.toBuyer, reward.toBuyer + _payout);
    }

    /**
     * @notice set Cap for referrer % reward
     */
    function setRefRewardCap(uint256 _cap) external onlyGovernor {
        refRewardCap = _cap;
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
     * @notice set refReward and buyerReward for specific address
     */
    function setReferConfig(
        address _referrer,
        uint256 _refReward,
        uint256 _buyerReward
    ) external onlyPolicy {
        require((_buyerReward + _refReward) <= refRewardCap, "reward too hight");
        refConfig[_referrer] = RewardConfig(_refReward, _buyerReward);
    }
}
