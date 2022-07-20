// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IsHECTA.sol";
import "./interfaces/IgHECTA.sol";

contract gHECTA is IgHECTA, ERC20 {
    /* ========== DEPENDENCIES ========== */
    using Address for address;

    /* ========== MODIFIERS ========== */

    modifier onlyApproved() {
        require(msg.sender == approved, "Only approved");
        _;
    }

    /* ========== EVENTS ========== */

    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);

    /* ========== DATA STRUCTURES ========== */

    /// @notice A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint256 fromBlock;
        uint256 votes;
    }

    /* ========== STATE VARIABLES ========== */

    IsHECTA public sHECTA;
    address public approved;
    bool public migrated;

    mapping(address => mapping(uint256 => Checkpoint)) public checkpoints;
    mapping(address => uint256) public numCheckpoints;
    mapping(address => address) public delegates;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _sHECTA) ERC20("Governance HECTA", "gHECTA") {
        require(_sHECTA != address(0), "Zero address: sHECTA");
        sHECTA = IsHECTA(_sHECTA);
        approved = msg.sender;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @notice transfer mint rights from deployer to staking
     * @notice can only be done once, at the time of contract migration
     * @param _staking address
     */
    function setStaking(address _staking) external onlyApproved {
        require(!migrated, "Migrated");
        migrated = true;

        require(_staking != approved, "Invalid argument");
        require(_staking != address(0), "Zero address found");
        approved = _staking;
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) external {
        return _delegate(msg.sender, delegatee);
    }

    /**
        @notice mint gHECTA
        @param _to address
        @param _amount uint
     */
    function mint(address _to, uint256 _amount) external override onlyApproved {
        _mint(_to, _amount);
    }

    /**
        @notice burn gHECTA
        @param _from address
        @param _amount uint
     */
    function burn(address _from, uint256 _amount) external override onlyApproved {
        _burn(_from, _amount);
    }

    /* ========== VIEW FUNCTIONS ========== */

    /**
     * @notice pull index from sHECTA token
     */
    function index() public view override returns (uint256) {
        return sHECTA.index();
    }

    /**
        @notice converts gHECTA amount to HECTA
        @param _amount uint
        @return uint
     */
    function balanceFrom(uint256 _amount) public view override returns (uint256) {
        return (_amount * index()) / 10**decimals();
    }

    /**
        @notice converts HECTA amount to gHECTA
        @param _amount uint
        @return uint
     */
    function balanceTo(uint256 _amount) public view override returns (uint256) {
        return (_amount * (10**decimals())) / index();
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) external view returns (uint256) {
        uint256 nCheckpoints = numCheckpoints[account];
        return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint256 blockNumber) external view returns (uint256) {
        require(blockNumber < block.number, "gHECTA::getPriorVotes: not yet determined");

        uint256 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint256 lower = 0;
        uint256 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint256 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegates[delegator];
        uint256 delegatorBalance = balanceOf(delegator);
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    function _moveDelegates(
        address srcRep,
        address dstRep,
        uint256 amount
    ) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint256 srcRepNum = numCheckpoints[srcRep];
                uint256 srcRepOld = srcRepNum > 0 ? checkpoints[srcRep][srcRepNum - 1].votes : 0;
                uint256 srcRepNew = srcRepOld - amount;
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint256 dstRepNum = numCheckpoints[dstRep];
                uint256 dstRepOld = dstRepNum > 0 ? checkpoints[dstRep][dstRepNum - 1].votes : 0;
                uint256 dstRepNew = dstRepOld + amount;
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    function _writeCheckpoint(
        address delegatee,
        uint256 nCheckpoints,
        uint256 oldVotes,
        uint256 newVotes
    ) internal {
        if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == block.number) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(block.number, newVotes);
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }

        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    /**
        @notice Ensure delegation moves when token is transferred.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        _moveDelegates(delegates[from], delegates[to], amount);
    }
}
