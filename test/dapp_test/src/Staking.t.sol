// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;
pragma abicoder v2;

import "ds-test/test.sol"; // ds-test

import "../../../contracts/libraries/SafeMath.sol";
import "../../../contracts/libraries/FixedPoint.sol";
import "../../../contracts/libraries/FullMath.sol";
import "../../../contracts/Staking.sol";
import "../../../contracts/HectagonERC20.sol";
import "../../../contracts/sHectagonERC20.sol";
import "../../../contracts/governance/gHECTA.sol";
import "../../../contracts/Treasury.sol";
import "../../../contracts/StakingDistributor.sol";
import "../../../contracts/HectagonAuthority.sol";

import "./util/Hevm.sol";
import "./util/MockContract.sol";

contract StakingTest is DSTest {
    using FixedPoint for *;
    using SafeMath for uint256;
    using SafeMath for uint112;

    HectagonStaking internal staking;
    HectagonTreasury internal treasury;
    HectagonAuthority internal authority;
    Distributor internal distributor;

    HectagonERC20Token internal hecta;
    sHectagon internal shecta;
    gHECTA internal ghecta;

    MockContract internal mockToken;

    /// @dev Hevm setup
    Hevm internal constant hevm = Hevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    uint256 internal constant AMOUNT = 1000;
    uint256 internal constant EPOCH_LENGTH = 8; // In Seconds
    uint256 internal constant START_TIME = 0; // Starting at this epoch
    uint256 internal constant NEXT_REBASE_TIME = 1; // Next epoch is here
    uint256 internal constant BOUNTY = 42;

    function setUp() public {
        // Start at timestamp
        hevm.warp(START_TIME);

        // Setup mockToken to deposit into treasury (for excess reserves)
        mockToken = new MockContract();
        mockToken.givenMethodReturn(abi.encodeWithSelector(ERC20.name.selector), abi.encode("mock DAO"));
        mockToken.givenMethodReturn(abi.encodeWithSelector(ERC20.symbol.selector), abi.encode("MOCK"));
        mockToken.givenMethodReturnUint(abi.encodeWithSelector(ERC20.decimals.selector), 18);
        mockToken.givenMethodReturnBool(abi.encodeWithSelector(IERC20.transferFrom.selector), true);

        authority = new HectagonAuthority(address(this), address(this), address(this), address(this));

        hecta = new HectagonERC20Token(address(authority));
        ghecta = new gHECTA(address(this), address(this));
        shecta = new sHectagon();
        shecta.setIndex(10);
        shecta.setgHECTA(address(ghecta));

        treasury = new HectagonTreasury(address(hecta), 1, address(authority));

        staking = new HectagonStaking(
            address(hecta),
            address(shecta),
            address(ghecta),
            EPOCH_LENGTH,
            START_TIME,
            NEXT_REBASE_TIME,
            address(authority)
        );

        distributor = new Distributor(address(treasury), address(hecta), address(staking), address(authority));
        distributor.setBounty(BOUNTY);
        staking.setDistributor(address(distributor));
        treasury.enable(HectagonTreasury.STATUS.REWARDMANAGER, address(distributor), address(0)); // Allows distributor to mint hecta.
        treasury.enable(HectagonTreasury.STATUS.RESERVETOKEN, address(mockToken), address(0)); // Allow mock token to be deposited into treasury
        treasury.enable(HectagonTreasury.STATUS.RESERVEDEPOSITOR, address(this), address(0)); // Allow this contract to deposit token into treeasury

        shecta.initialize(address(staking), address(treasury));
        ghecta.migrate(address(staking), address(shecta));

        // Give the treasury permissions to mint
        authority.pushVault(address(treasury), true);

        // Deposit a token who's profit (3rd param) determines how much hecta the treasury can mint
        uint256 depositAmount = 20e18;
        treasury.deposit(depositAmount, address(mockToken), BOUNTY.mul(2)); // Mints (depositAmount- 2xBounty) for this contract
    }

    function testStakeNoBalance() public {
        uint256 newAmount = AMOUNT.mul(2);
        try staking.stake(address(this), newAmount, true, true) {
            fail();
        } catch Error(string memory error) {
            assertEq(error, "TRANSFER_FROM_FAILED"); // Should be 'Transfer exceeds balance'
        }
    }

    function testStakeWithoutAllowance() public {
        try staking.stake(address(this), AMOUNT, true, true) {
            fail();
        } catch Error(string memory error) {
            assertEq(error, "TRANSFER_FROM_FAILED"); // Should be 'Transfer exceeds allowance'
        }
    }

    function testStake() public {
        hecta.approve(address(staking), AMOUNT);
        uint256 amountStaked = staking.stake(address(this), AMOUNT, true, true);
        assertEq(amountStaked, AMOUNT);
    }

    function testStakeAtRebaseToGhecta() public {
        // Move into next rebase window
        hevm.warp(EPOCH_LENGTH);

        hecta.approve(address(staking), AMOUNT);
        bool isShecta = false;
        bool claim = true;
        uint256 gHECTARecieved = staking.stake(address(this), AMOUNT, isShecta, claim);

        uint256 expectedAmount = ghecta.balanceTo(AMOUNT.add(BOUNTY));
        assertEq(gHECTARecieved, expectedAmount);
    }

    function testStakeAtRebase() public {
        // Move into next rebase window
        hevm.warp(EPOCH_LENGTH);

        hecta.approve(address(staking), AMOUNT);
        bool isShecta = true;
        bool claim = true;
        uint256 amountStaked = staking.stake(address(this), AMOUNT, isShecta, claim);

        uint256 expectedAmount = AMOUNT.add(BOUNTY);
        assertEq(amountStaked, expectedAmount);
    }

    function testUnstake() public {
        bool triggerRebase = true;
        bool isShecta = true;
        bool claim = true;

        // Stake the hecta
        uint256 initialHectaBalance = hecta.balanceOf(address(this));
        hecta.approve(address(staking), initialHectaBalance);
        uint256 amountStaked = staking.stake(address(this), initialHectaBalance, isShecta, claim);
        assertEq(amountStaked, initialHectaBalance);

        // Validate balances post stake
        uint256 hectaBalance = hecta.balanceOf(address(this));
        uint256 sHectaBalance = shecta.balanceOf(address(this));
        assertEq(hectaBalance, 0);
        assertEq(sHectaBalance, initialHectaBalance);

        // Unstake sHECTA
        shecta.approve(address(staking), sHectaBalance);
        staking.unstake(address(this), sHectaBalance, triggerRebase, isShecta);

        // Validate Balances post unstake
        hectaBalance = hecta.balanceOf(address(this));
        sHectaBalance = shecta.balanceOf(address(this));
        assertEq(hectaBalance, initialHectaBalance);
        assertEq(sHectaBalance, 0);
    }

    function testUnstakeAtRebase() public {
        bool triggerRebase = true;
        bool isShecta = true;
        bool claim = true;

        // Stake the hecta
        uint256 initialHectaBalance = hecta.balanceOf(address(this));
        hecta.approve(address(staking), initialHectaBalance);
        uint256 amountStaked = staking.stake(address(this), initialHectaBalance, isShecta, claim);
        assertEq(amountStaked, initialHectaBalance);

        // Move into next rebase window
        hevm.warp(EPOCH_LENGTH);

        // Validate balances post stake
        // Post initial rebase, distribution amount is 0, so sHECTA balance doens't change.
        uint256 hectaBalance = hecta.balanceOf(address(this));
        uint256 sHectaBalance = shecta.balanceOf(address(this));
        assertEq(hectaBalance, 0);
        assertEq(sHectaBalance, initialHectaBalance);

        // Unstake sHECTA
        shecta.approve(address(staking), sHectaBalance);
        staking.unstake(address(this), sHectaBalance, triggerRebase, isShecta);

        // Validate balances post unstake
        hectaBalance = hecta.balanceOf(address(this));
        sHectaBalance = shecta.balanceOf(address(this));
        uint256 expectedAmount = initialHectaBalance.add(BOUNTY); // Rebase earns a bounty
        assertEq(hectaBalance, expectedAmount);
        assertEq(sHectaBalance, 0);
    }

    function testUnstakeAtRebaseFromGhecta() public {
        bool triggerRebase = true;
        bool isShecta = false;
        bool claim = true;

        // Stake the hecta
        uint256 initialHectaBalance = hecta.balanceOf(address(this));
        hecta.approve(address(staking), initialHectaBalance);
        uint256 amountStaked = staking.stake(address(this), initialHectaBalance, isShecta, claim);
        uint256 ghectaAmount = ghecta.balanceTo(initialHectaBalance);
        assertEq(amountStaked, ghectaAmount);

        // test the unstake
        // Move into next rebase window
        hevm.warp(EPOCH_LENGTH);

        // Validate balances post-stake
        uint256 hectaBalance = hecta.balanceOf(address(this));
        uint256 ghectaBalance = ghecta.balanceOf(address(this));
        assertEq(hectaBalance, 0);
        assertEq(ghectaBalance, ghectaAmount);

        // Unstake gHECTA
        ghecta.approve(address(staking), ghectaBalance);
        staking.unstake(address(this), ghectaBalance, triggerRebase, isShecta);

        // Validate balances post unstake
        hectaBalance = hecta.balanceOf(address(this));
        ghectaBalance = ghecta.balanceOf(address(this));
        uint256 expectedHecta = initialHectaBalance.add(BOUNTY); // Rebase earns a bounty
        assertEq(hectaBalance, expectedHecta);
        assertEq(ghectaBalance, 0);
    }
}
