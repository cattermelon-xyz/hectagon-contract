// SPDX-License-Identifier: MIT
pragma solidity >=0.7.5;

import "./libraries/SafeERC20.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IHECTA.sol";
import "./interfaces/ITreasury.sol";
import "./types/HectagonAccessControlled.sol";

contract HectagonTreasury is HectagonAccessControlled, ITreasury {
    /* ========== DEPENDENCIES ========== */

    using SafeERC20 for IERC20;

    /* ========== EVENTS ========== */

    event Withdrawal(address indexed token, uint256 amount);
    event Minted(address indexed caller, address indexed recipient, uint256 amount);
    event Permissioned(address addr, STATUS indexed status, bool result);

    /* ========== DATA STRUCTURES ========== */

    enum STATUS {
        TREASURYMANAGER,
        REWARDMANAGER
    }
    /* ========== STATE VARIABLES ========== */

    IHECTA public immutable HECTA;

    mapping(STATUS => mapping(address => bool)) public permissions;

    bool public initialized;

    string internal notApproved = "Treasury: not approved";

    /* ========== CONSTRUCTOR ========== */

    constructor(address _hecta, address _authority) HectagonAccessControlled(IHectagonAuthority(_authority)) {
        require(_hecta != address(0), "Zero address: HECTA");
        HECTA = IHECTA(_hecta);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @notice pre mint Hecta for initilization of protocol
     * @param _recipient address
     * @param _amount uint256
     */
    function initialize(address _recipient, uint256 _amount) external onlyGovernor {
        require(initialized == false, "Already initialized");
        initialized = true;
        HECTA.mint(_recipient, _amount);
        emit Minted(msg.sender, _recipient, _amount);
    }

    /**
     * @notice allow approved address to withdraw assets
     * @param _token address
     * @param _amount uint256
     */
    function withdraw(address _token, uint256 _amount) external override {
        require(permissions[STATUS.TREASURYMANAGER][msg.sender], notApproved);
        IERC20(_token).safeTransfer(msg.sender, _amount);
        emit Withdrawal(_token, _amount);
    }

    /**
     * @notice mint new HECTA
     * @param _recipient address
     * @param _amount uint256
     */
    function mint(address _recipient, uint256 _amount) external override {
        require(permissions[STATUS.REWARDMANAGER][msg.sender], notApproved);
        HECTA.mint(_recipient, _amount);
        emit Minted(msg.sender, _recipient, _amount);
    }

    /* ========== MANAGERIAL FUNCTIONS ========== */

    /**
     * @notice enable permission
     * @param _status STATUS
     * @param _address address
     */
    function enable(STATUS _status, address _address) external onlyGovernor {
        permissions[_status][_address] = true;
        emit Permissioned(_address, _status, true);
    }

    /**
     *  @notice disable permission from address
     *  @param _status STATUS
     *  @param _address address
     */
    function disable(STATUS _status, address _address) external {
        require(msg.sender == authority.governor() || msg.sender == authority.guardian(), "Only governor or guardian");
        permissions[_status][_address] = false;
        emit Permissioned(_address, _status, false);
    }
}
