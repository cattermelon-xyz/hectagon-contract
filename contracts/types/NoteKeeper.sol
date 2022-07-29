// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/interfaces/IERC4626.sol";
import "../types/FrontEndRewarder.sol";
import "../interfaces/ITreasury.sol";
import "../interfaces/INoteKeeper.sol";
import "../interfaces/IgHECTA.sol";

abstract contract NoteKeeper is INoteKeeper, FrontEndRewarder {
    mapping(address => Note[]) public notes; // user deposit data
    mapping(address => mapping(uint256 => address)) private noteTransfers; // change note ownership

    IgHECTA internal immutable gHecta;
    ITreasury internal treasury;

    constructor(
        IHectagonAuthority _authority,
        IERC20 _hecta,
        IgHECTA _ghecta,
        ITreasury _treasury
    ) FrontEndRewarder(_authority, _hecta) {
        gHecta = _ghecta;
        treasury = _treasury;
    }

    // if treasury address changes on authority, update it
    function updateTreasury() external {
        require(
            msg.sender == authority.governor() ||
                msg.sender == authority.guardian() ||
                msg.sender == authority.policy(),
            "Only authorized"
        );
        treasury = ITreasury(authority.vault());
    }

    /* ========== ADD ========== */

    /**
     * @notice              adds a new Note for a user, stores Ref & DAO rewards, and mints & stakes payout & rewards
     * @param _user         the user that owns the Note
     * @param _payout       the amount of HECTA due to the user
     * @param _expiry       the timestamp when the Note is redeemable
     * @param _marketID     the ID of the market deposited into
     * @return give         rewards data
     */
    function addNote(
        address _user,
        uint256 _payout,
        uint48 _expiry,
        uint48 _marketID,
        address _referral
    ) internal returns (uint256, Give memory) {
        // front end operators can earn rewards by referring users
        Give memory give = _giveRewards(_payout, _referral, _user); // Give struct inherited fom FrontEndRewarder
        // the index of the note is the next in the user's array
        uint256 index_ = notes[_user].length;

        uint256 finalPayout = give.toBuyer + _payout;
        uint256 daoAmount = give.toDaoCommunity + give.toDaoInvestment - give.toBuyer - give.toRefer;

        // mint buyer's final payout and referer commission
        treasury.mint(address(this), finalPayout + give.toRefer);

        // note that only the buyer's final payout gets staked (referer commission are in HECTA)
        gHecta.deposit(finalPayout, address(this));

        // mint Dao Community Fund and Dao Investment Fund, store in treasury
        treasury.mint(address(treasury), daoAmount);

        // the new note is pushed to the user's array
        // This logic needs to be executed after staking
        notes[_user].push(
            Note({
                payout: gHecta.convertToShares(finalPayout),
                created: uint48(block.timestamp),
                matured: _expiry,
                redeemed: 0,
                marketID: _marketID
            })
        );

        return (index_, give);
    }

    /* ========== REDEEM ========== */

    /**
     * @notice             redeem notes for user
     * @param _user        the user to redeem for
     * @param _indexes     the note indexes to redeem
     * @param _unstake     option for redeem gHecta or Hecta
     * @return sum of payout sent, in gHecta or Hecta
     */
    function redeem(
        address _user,
        uint256[] memory _indexes,
        bool _unstake
    ) public override returns (uint256) {
        uint256 payout_;
        uint48 time = uint48(block.timestamp);

        for (uint256 i = 0; i < _indexes.length; i++) {
            (uint256 pay, bool matured) = pendingFor(_user, _indexes[i]);

            if (matured) {
                notes[_user][_indexes[i]].redeemed = time; // mark as redeemed
                payout_ += pay;
            }
        }

        if (_unstake) {
            return gHecta.redeem(payout_, _user, address(this)); // send payout as hecta
        } else {
            gHecta.transfer(_user, payout_); // send payout as gHecta
            return payout_;
        }
    }

    /**
     * @notice             redeem all redeemable markets for user
     * @dev                if possible, query indexesFor() off-chain and input in redeem() to save gas
     * @param _user        user to redeem all notes for
     * @param _unstake     option for redeem gHecta or Hecta
     * @return             sum of payout sent, in gHecta or Hecta
     */
    function redeemAll(address _user, bool _unstake) external returns (uint256) {
        return redeem(_user, indexesFor(_user), _unstake);
    }

    /* ========== TRANSFER ========== */

    /**
     * @notice             approve an address to transfer a note
     * @param _to          address to approve note transfer for
     * @param _index       index of note to approve transfer for
     */
    function pushNote(address _to, uint256 _index) external override {
        require(notes[msg.sender][_index].created != 0, "Depository: note not found");
        noteTransfers[msg.sender][_index] = _to;
    }

    /**
     * @notice             transfer a note that has been approved by an address
     * @param _from        the address that approved the note transfer
     * @param _index       the index of the note to transfer (in the sender's array)
     */
    function pullNote(address _from, uint256 _index) external override returns (uint256 newIndex_) {
        require(noteTransfers[_from][_index] == msg.sender, "Depository: transfer not found");
        require(notes[_from][_index].redeemed == 0, "Depository: note redeemed");

        newIndex_ = notes[msg.sender].length;
        notes[msg.sender].push(notes[_from][_index]);

        delete notes[_from][_index];
    }

    /* ========== VIEW ========== */

    // Note info

    /**
     * @notice             all pending notes for user
     * @param _user        the user to query notes for
     * @return             the pending notes for the user
     */
    function indexesFor(address _user) public view override returns (uint256[] memory) {
        Note[] memory info = notes[_user];

        uint256 length;
        for (uint256 i = 0; i < info.length; i++) {
            if (info[i].redeemed == 0 && info[i].payout != 0) length++;
        }

        uint256[] memory indexes = new uint256[](length);
        uint256 position;

        for (uint256 i = 0; i < info.length; i++) {
            if (info[i].redeemed == 0 && info[i].payout != 0) {
                indexes[position] = i;
                position++;
            }
        }

        return indexes;
    }

    /**
     * @notice             calculate amount available for claim for a single note
     * @param _user        the user that the note belongs to
     * @param _index       the index of the note in the user's array
     * @return payout_     the payout due, in gHecta
     * @return matured_    if the payout can be redeemed
     */
    function pendingFor(address _user, uint256 _index) public view override returns (uint256 payout_, bool matured_) {
        Note memory note = notes[_user][_index];

        payout_ = note.payout;
        matured_ = note.redeemed == 0 && note.matured <= block.timestamp && note.payout != 0;
    }
}
