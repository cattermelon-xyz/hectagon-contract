// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/IDistributor.sol";

import "./types/HectagonAccessControlled.sol";
import "./interfaces/IHectaCirculatingSupply.sol";

contract Distributor is IDistributor, HectagonAccessControlled {
    /* ========== DEPENDENCIES ========== */
    using SafeERC20 for IERC20;

    /* ====== VARIABLES ====== */
    ITreasury private immutable treasury;
    address private immutable gHecta;
    IHectaCirculatingSupply public circulatingHectaContract;

    mapping(uint256 => Adjust) public adjustments;
    uint256 public override bounty;

    uint256 private immutable rateDenominator = 1_000_000;

    /* ====== STRUCTS ====== */

    struct Info {
        uint256 rate; // in ten-thousandths ( 5000 = 0.5% )
        address recipient;
    }
    Info[] public info;

    struct Adjust {
        bool add;
        uint256 rate;
        uint256 target;
    }

    /* ====== CONSTRUCTOR ====== */

    constructor(
        address _treasury,
        address _gHecta,
        address _authority,
        address _circulatingHectaContract
    ) HectagonAccessControlled(IHectagonAuthority(_authority)) {
        require(_treasury != address(0), "Zero address: Treasury");
        treasury = ITreasury(_treasury);
        require(_gHecta != address(0), "Zero address: gHecta");
        gHecta = _gHecta;
        require(_circulatingHectaContract != address(0), "Zero address: circulatingHectaContract");
        circulatingHectaContract = IHectaCirculatingSupply(_circulatingHectaContract);
    }

    /* ====== PUBLIC FUNCTIONS ====== */

    /**
        @notice send epoch reward to gHecta contract
     */
    function distribute() external override {
        require(msg.sender == gHecta, "Only gHecta");
        // distribute rewards to each recipient
        for (uint256 i = 0; i < info.length; i++) {
            if (info[i].rate > 0) {
                treasury.mint(info[i].recipient, nextRewardAt(info[i].rate)); // mint and send tokens
                adjust(i); // check for adjustment
            }
        }
    }

    function retrieveBounty() external override returns (uint256) {
        require(msg.sender == gHecta, "Only gHecta");
        // If the distributor bounty is > 0, mint it for the gHecta contract.
        if (bounty > 0) {
            treasury.mint(gHecta, bounty);
        }

        return bounty;
    }

    /* ====== INTERNAL FUNCTIONS ====== */

    /**
        @notice increment reward rate for collector
     */
    function adjust(uint256 _index) internal {
        Adjust memory adjustment = adjustments[_index];
        if (adjustment.rate != 0) {
            if (adjustment.add) {
                // if rate should increase
                info[_index].rate = info[_index].rate + adjustment.rate; // raise rate
                if (info[_index].rate >= adjustment.target) {
                    // if target met
                    adjustments[_index].rate = 0; // turn off adjustment
                    info[_index].rate = adjustment.target; // set to target
                }
            } else {
                // if rate should decrease
                if (info[_index].rate > adjustment.rate) {
                    // protect from underflow
                    info[_index].rate = info[_index].rate - adjustment.rate; // lower rate
                } else {
                    info[_index].rate = 0;
                }

                if (info[_index].rate <= adjustment.target) {
                    // if target met
                    adjustments[_index].rate = 0; // turn off adjustment
                    info[_index].rate = adjustment.target; // set to target
                }
            }
        }
    }

    /* ====== VIEW FUNCTIONS ====== */

    /**
        @notice view function for next reward at given rate
        @param _rate uint
        @return uint
     */
    function nextRewardAt(uint256 _rate) public view override returns (uint256) {
        return (circulatingHectaContract.circulatingSupply() * _rate) / rateDenominator;
    }

    /**
        @notice view function for next reward for specified address
        @param _recipient address
        @return uint
     */
    function nextRewardFor(address _recipient) public view override returns (uint256) {
        uint256 reward;
        for (uint256 i = 0; i < info.length; i++) {
            if (info[i].recipient == _recipient) {
                reward = reward + nextRewardAt(info[i].rate);
            }
        }
        return reward;
    }

    /* ====== POLICY FUNCTIONS ====== */

    /**
     * @notice set bounty to incentivize keepers
     * @param _bounty uint256
     */
    function setBounty(uint256 _bounty) external override onlyGovernor {
        require(_bounty <= 2e9, "Too much");
        bounty = _bounty;
    }

    /**
        @notice adds recipient for distributions
        @param _recipient address
        @param _rewardRate uint
     */
    function addRecipient(address _recipient, uint256 _rewardRate) external override onlyGovernor {
        require(_recipient != address(0), "Zero address: Recipient");
        require(_rewardRate <= rateDenominator, "Rate cannot exceed denominator");
        info.push(Info({recipient: _recipient, rate: _rewardRate}));
    }

    /**
        @notice removes recipient for distributions
        @param _index uint
     */
    function removeRecipient(uint256 _index) external override {
        require(
            msg.sender == authority.governor() || msg.sender == authority.guardian(),
            "Caller is not governor or guardian"
        );
        require(info[_index].recipient != address(0), "Recipient does not exist");
        info[_index].recipient = address(0);
        info[_index].rate = 0;
    }

    /**
        @notice set adjustment info for a collector's reward rate
        @param _index uint
        @param _add bool
        @param _rate uint
        @param _target uint
     */
    function setAdjustment(
        uint256 _index,
        bool _add,
        uint256 _rate,
        uint256 _target
    ) external override {
        require(
            msg.sender == authority.governor() || msg.sender == authority.guardian(),
            "Caller is not governor or guardian"
        );
        require(info[_index].recipient != address(0), "Recipient does not exist");

        if (msg.sender == authority.guardian()) {
            require(_rate <= (info[_index].rate * 25) / 1000, "Limiter: cannot adjust by >2.5%");
        }

        if (!_add) {
            require(_rate <= info[_index].rate, "Cannot decrease rate by more than it already is");
        }

        adjustments[_index] = Adjust({add: _add, rate: _rate, target: _target});
    }
}
