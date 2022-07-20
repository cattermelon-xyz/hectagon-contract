// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IsHECTA.sol";
import "./interfaces/IgHECTA.sol";
import "./interfaces/IDistributor.sol";

import "./types/HectagonAccessControlled.sol";

contract HectagonStaking is HectagonAccessControlled {
    /* ========== DEPENDENCIES ========== */

    using SafeERC20 for IERC20;
    using SafeERC20 for IsHECTA;
    using SafeERC20 for IgHECTA;

    /* ========== EVENTS ========== */

    event DistributorSet(address distributor);
    event WarmupSet(uint256 warmup);

    /* ========== DATA STRUCTURES ========== */

    struct Epoch {
        uint256 length; // in seconds
        uint256 number; // since inception
        uint256 end; // timestamp
        uint256 distribute; // amount
    }

    struct Claim {
        uint256 deposit; // if forfeiting
        uint256 gons; // staked balance
        uint256 expiry; // end of warmup period
        bool lock; // prevents malicious delays for claim
    }

    /* ========== STATE VARIABLES ========== */

    IERC20 public immutable HECTA;
    IsHECTA public immutable sHECTA;
    IgHECTA public immutable gHECTA;

    Epoch public epoch;

    IDistributor public distributor;

    mapping(address => Claim) public warmupInfo;
    uint256 public warmupPeriod;
    uint256 private gonsInWarmup;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _hecta,
        address _sHECTA,
        address _gHECTA,
        uint256 _epochLength,
        uint256 _firstEpochNumber,
        uint256 _firstEpochTime,
        address _authority
    ) HectagonAccessControlled(IHectagonAuthority(_authority)) {
        require(_hecta != address(0), "Zero address: HECTA");
        HECTA = IERC20(_hecta);
        require(_sHECTA != address(0), "Zero address: sHECTA");
        sHECTA = IsHECTA(_sHECTA);
        require(_gHECTA != address(0), "Zero address: gHECTA");
        gHECTA = IgHECTA(_gHECTA);

        epoch = Epoch({length: _epochLength, number: _firstEpochNumber, end: _firstEpochTime, distribute: 0});
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @notice stake HECTA to enter warmup
     * @param _to address
     * @param _amount uint
     * @param _claim bool
     * @return uint
     */
    function stake(
        address _to,
        uint256 _amount,
        bool _claim
    ) external returns (uint256) {
        HECTA.safeTransferFrom(msg.sender, address(this), _amount);
        _amount = _amount + rebase(); // add bounty if rebase occurred
        if (_claim && warmupPeriod == 0) {
            return _send(_to, _amount);
        } else {
            Claim memory info = warmupInfo[_to];
            if (!info.lock) {
                require(_to == msg.sender, "External deposits for account are locked");
            }

            warmupInfo[_to] = Claim({
                deposit: info.deposit + _amount,
                gons: info.gons + sHECTA.gonsForBalance(_amount),
                expiry: epoch.number + warmupPeriod,
                lock: info.lock
            });

            gonsInWarmup = gonsInWarmup + sHECTA.gonsForBalance(_amount);

            return _amount;
        }
    }

    /**
     * @notice retrieve stake from warmup
     * @param _to address
     * @return uint
     */
    function claim(address _to) public returns (uint256) {
        Claim memory info = warmupInfo[_to];

        if (!info.lock) {
            require(_to == msg.sender, "External claims for account are locked");
        }

        if (epoch.number >= info.expiry && info.expiry != 0) {
            delete warmupInfo[_to];

            gonsInWarmup = gonsInWarmup - info.gons;

            return _send(_to, sHECTA.balanceForGons(info.gons));
        }
        return 0;
    }

    /**
     * @notice forfeit stake and retrieve HECTA
     * @return uint
     */
    function forfeit() external returns (uint256) {
        Claim memory info = warmupInfo[msg.sender];
        delete warmupInfo[msg.sender];

        gonsInWarmup = gonsInWarmup - info.gons;

        HECTA.safeTransfer(msg.sender, info.deposit);

        return info.deposit;
    }

    /**
     * @notice prevent new deposits or claims from ext. address (protection from malicious activity)
     */
    function toggleLock() external {
        warmupInfo[msg.sender].lock = !warmupInfo[msg.sender].lock;
    }

    /**
     * @notice redeem sHECTA for HECTAs
     * @param _to address
     * @param _amount uint
     * @param _trigger bool
     * @return amount_ uint
     */
    function unstake(
        address _to,
        uint256 _amount,
        bool _trigger
    ) external returns (uint256 amount_) {
        amount_ = _amount;
        uint256 bounty;
        if (_trigger) {
            bounty = rebase();
        }

        gHECTA.burn(msg.sender, _amount); // amount was given in gHECTA terms
        amount_ = gHECTA.balanceFrom(amount_) + bounty; // convert amount to HECTA terms & add bounty

        require(amount_ <= HECTA.balanceOf(address(this)), "Insufficient HECTA balance in contract");
        HECTA.safeTransfer(_to, amount_);
    }

    /**
     * @notice trigger rebase if epoch over
     * @return uint256
     */
    function rebase() public returns (uint256) {
        uint256 bounty;
        if (epoch.end <= block.timestamp) {
            sHECTA.rebase(epoch.distribute, epoch.number);

            epoch.end = epoch.end + epoch.length;
            epoch.number++;

            if (address(distributor) != address(0)) {
                distributor.distribute();
                bounty = distributor.retrieveBounty(); // Will mint HECTA for this contract if there exists a bounty
            }
            uint256 balance = HECTA.balanceOf(address(this));
            uint256 staked = sHECTA.circulatingSupply();
            if (balance <= staked + bounty) {
                epoch.distribute = 0;
            } else {
                epoch.distribute = balance - staked - bounty;
            }
        }
        return bounty;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /**
     * @notice send staker their amount as sHECTA or gHECTA
     * @param _to address
     * @param _amount uint
     */
    function _send(
        address _to,
        uint256 _amount
    ) internal returns (uint256) {
        gHECTA.mint(_to, gHECTA.balanceTo(_amount)); // send as gHECTA (convert units from HECTA)
        return gHECTA.balanceTo(_amount);
    }

    /* ========== VIEW FUNCTIONS ========== */

    /**
     * @notice returns the sHECTA index, which tracks rebase growth
     * @return uint
     */
    function index() public view returns (uint256) {
        return sHECTA.index();
    }

    /**
     * @notice total supply in warmup
     */
    function supplyInWarmup() public view returns (uint256) {
        return sHECTA.balanceForGons(gonsInWarmup);
    }

    /**
     * @notice seconds until the next epoch begins
     */
    function secondsToNextEpoch() external view returns (uint256) {
        return epoch.end - block.timestamp;
    }

    /* ========== MANAGERIAL FUNCTIONS ========== */

    /**
     * @notice sets the contract address for LP staking
     * @param _distributor address
     */
    function setDistributor(address _distributor) external onlyGovernor {
        distributor = IDistributor(_distributor);
        emit DistributorSet(_distributor);
    }

    /**
     * @notice set warmup period for new stakers
     * @param _warmupPeriod uint
     */
    function setWarmupLength(uint256 _warmupPeriod) external onlyGovernor {
        warmupPeriod = _warmupPeriod;
        emit WarmupSet(_warmupPeriod);
    }
}
