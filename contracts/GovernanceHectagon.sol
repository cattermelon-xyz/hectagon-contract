// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IDistributor.sol";
import "./types/HectagonAccessControlled.sol";

contract GovernanceHectagon is ERC4626, HectagonAccessControlled {
    /* ========== EVENTS ========== */

    event DistributorSet(address distributor);
    event LogEpoch(uint256 indexed epoch, uint256 distribute);

    /* ========== DATA STRUCTURES ========== */

    struct Epoch {
        uint256 length; // in seconds
        uint256 number; // since inception
        uint256 end; // timestamp
    }

    /* ========== STATE VARIABLES ========== */
    Epoch public epoch;
    IDistributor public distributor;

    constructor(
        IERC20Metadata _asset,
        uint256 _epochLength,
        uint256 _firstEpochNumber,
        uint256 _firstEpochTime,
        address _authority
    ) ERC20("Governance Hectagon", "gHECTA") ERC4626(_asset) HectagonAccessControlled(IHectagonAuthority(_authority)) {
        epoch = Epoch({length: _epochLength, number: _firstEpochNumber, end: _firstEpochTime});
    }

    /*//////////////////////////////////////////////////////////////
                        DEPOSIT/WITHDRAWAL LOGIC
    //////////////////////////////////////////////////////////////*/

    function deposit(uint256 assets, address receiver) public virtual override returns (uint256) {
        require(assets <= maxDeposit(receiver), "ERC4626: deposit more than max");

        uint256 bounty = nextEpoch(); // add bounty if nextEpoch occurred
        uint256 shares = previewDeposit(assets + bounty);
        _deposit(_msgSender(), receiver, assets, shares);

        return shares;
    }

    function mint(uint256 shares, address receiver) public virtual override returns (uint256) {
        require(shares <= maxMint(receiver), "ERC4626: mint more than max");

        uint256 bounty = nextEpoch(); // add bounty if nextEpoch occurred
        uint256 bountyShares = previewDeposit(bounty);
        uint256 assets = previewMint(shares);
        _deposit(_msgSender(), receiver, assets, shares + bountyShares);

        return assets;
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override returns (uint256) {
        require(assets <= maxWithdraw(owner), "ERC4626: withdraw more than max");

        uint256 bounty = nextEpoch(); // add bounty if nextEpoch occurred
        uint256 shares = previewWithdraw(assets);
        _withdraw(_msgSender(), receiver, owner, assets + bounty, shares);

        return shares;
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public virtual override returns (uint256) {
        require(shares <= maxRedeem(owner), "ERC4626: redeem more than max");

        uint256 bounty = nextEpoch(); // add bounty if nextEpoch occurred
        uint256 assets = previewRedeem(shares) + bounty;
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        return assets;
    }

    /**
     * @notice trigger nextEpoch if epoch over
     */
    function nextEpoch() public returns (uint256 bounty) {
        if (epoch.end <= block.timestamp) {
            epoch.end = epoch.end + epoch.length;
            epoch.number++;
            uint256 previousAsset = totalAssets();

            if (address(distributor) != address(0) && totalSupply() > 0) {
                distributor.distribute();
                bounty = distributor.retrieveBounty(); // Will mint HECTA for this contract if there exists a bounty
            }

            uint256 distribute = totalAssets() - previousAsset;

            emit LogEpoch(epoch.number - 1, distribute);
        }
    }

    function bountyHunter() public {
        uint256 bounty = nextEpoch();
        if (bounty > 0) {
            SafeERC20.safeTransfer(IERC20Metadata(asset()), msg.sender, bounty);
        }
    }

    /* ========== VIEW FUNCTIONS ========== */

    /**
     * @notice returns the index, which tracks protocol growth
     * @return uint
     */
    function index() public view returns (uint256) {
        return previewRedeem(10**decimals());
    }

    /**
     * @notice seconds until the next epoch begins
     */
    function secondsToNextEpoch() external view returns (uint256) {
        if (epoch.end <= block.timestamp) return 0;
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
}
