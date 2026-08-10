// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal view of HushWireVault used by settleAndPay.
interface IHushWireVault {
    function settlements(uint256)
        external
        view
        returns (
            address payer,
            address payee,
            address asset,
            uint256 amount,
            uint64 deadline,
            bool executed,
            bool refunded,
            bytes calldata enclaveProof
        );
    function executeSettlement(uint256 _id, bytes calldata _enclaveProof) external;
}

/**
 * @title SealedBidAuction
 * @notice Confidential sealed-bid negotiation between agents.
 *         Bids are committed as hashes, revealed after the deadline, and the
 *         winner is settled atomically via HushWireVault.
 *
 * v2 protocol properties:
 * - Bidders back their revealed bid by escrowing the bid amount into this
 *   contract (escrowBid). Only funded bids are eligible to win, so bids are
 *   binding and spam bids are excluded.
 * - settle() is permissionless after the settle deadline (revealDeadline +
 *   SETTLE_WINDOW) — a silent creator cannot hold a round hostage. Before that
 *   window only the creator may settle.
 * - settleAndPay() settles the round AND releases the escrowed payment from
 *   the vault in the SAME transaction, gated by a valid attestation over the
 *   exact settlement terms. This is the atomic settlement path.
 * - recover() refunds every bidder's escrow if the creator never settles by
 *   the settle deadline (hostage protection for bidder funds).
 * - The creator cannot bid in their own auction (conflict of interest).
 *
 * @dev The Auction struct is unchanged from v1 so existing off-chain readers
 *      of auctions() keep working; the settle deadline is derived, not stored.
 */
contract SealedBidAuction is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Bid {
        bytes32 commitHash; // keccak256(abi.encodePacked(amount, salt))
        uint256 amount;     // revealed amount (0 until reveal)
        bool revealed;
        uint256 timestamp;
    }

    struct Auction {
        address creator;        // agent that opened the negotiation
        address asset;          // FAsset token address (e.g. wrapped XRP)
        uint256 reservePrice;   // minimum acceptable bid
        uint64 commitDeadline;  // timestamp: no more commits after this
        uint64 revealDeadline;  // timestamp: no more reveals after this
        bool settled;
        address winner;
        uint256 winningBid;
    }

    /// @notice How long the creator has to settle after the reveal window.
    ///         After revealDeadline + SETTLE_WINDOW anyone can settle or recover.
    uint256 public constant SETTLE_WINDOW = 2 hours;

    /// @notice The vault that escrows the winning payment (set at deploy).
    IHushWireVault public immutable vault;

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => Bid)) private _bids;
    mapping(uint256 => address[]) private _bidders;
    mapping(uint256 => mapping(address => bool)) public hasCommitted;
    /// @notice Escrowed bid amounts (bidder skin-in-the-game), refunded at
    ///         settle / recover.
    mapping(uint256 => mapping(address => uint256)) public bidderEscrows;
    /// @notice Rounds closed by recover() because the creator never settled.
    mapping(uint256 => bool) public recovered;

    uint256 public auctionCount;

    event AuctionCreated(uint256 indexed auctionId, address creator, address asset, uint256 reservePrice);
    event BidCommitted(uint256 indexed auctionId, address bidder, bytes32 commitHash);
    event BidRevealed(uint256 indexed auctionId, address bidder, uint256 amount);
    event BidEscrowed(uint256 indexed auctionId, address bidder, uint256 amount);
    event AuctionSettled(uint256 indexed auctionId, address winner, uint256 amount);
    event AuctionRecovered(uint256 indexed auctionId);
    event EscrowRefunded(uint256 indexed auctionId, address bidder, uint256 amount);

    error AuctionNotFound();
    error NotCreator();
    error CreatorCannotBid();
    error CommitPhaseOver();
    error CommitPhaseActive();
    error RevealPhaseNotStarted();
    error RevealPhaseActive();
    error RevealPhaseOver();
    error AlreadyCommitted();
    error AlreadyRevealed();
    error NotCommitted();
    error InvalidReveal();
    error AlreadySettled();
    error AlreadyRecovered();
    error NoValidBids();
    error NotRevealed();
    error AlreadyEscrowed();
    error ZeroAmount();
    error SettleDeadlineNotPassed();
    error SettlementMismatch();
    error ZeroAddress();
    error ZeroHash();
    error ZeroDuration();

    constructor(address _vault) {
        if (_vault == address(0)) revert ZeroAddress();
        vault = IHushWireVault(_vault);
    }

    /// @notice Create a new sealed-bid auction (negotiation round)
    function createAuction(
        address _asset,
        uint256 _reservePrice,
        uint64 _commitDuration,
        uint64 _revealDuration
    ) external returns (uint256 auctionId) {
        if (_asset == address(0)) revert ZeroAddress();
        if (_commitDuration == 0 || _revealDuration == 0) revert ZeroDuration();

        auctionId = auctionCount++;
        Auction storage a = auctions[auctionId];
        a.creator = msg.sender;
        a.asset = _asset;
        a.reservePrice = _reservePrice;
        a.commitDeadline = uint64(block.timestamp) + _commitDuration;
        a.revealDeadline = a.commitDeadline + _revealDuration;

        emit AuctionCreated(auctionId, msg.sender, _asset, _reservePrice);
    }

    /// @notice Commit a sealed bid (hash only — amount stays private). One commit per bidder.
    /// @dev The auction creator cannot bid in their own round.
    function commitBid(uint256 _auctionId, bytes32 _commitHash) external {
        Auction storage a = auctions[_auctionId];
        if (a.creator == address(0)) revert AuctionNotFound();
        if (msg.sender == a.creator) revert CreatorCannotBid();
        if (block.timestamp > a.commitDeadline) revert CommitPhaseOver();
        if (_commitHash == bytes32(0)) revert ZeroHash();
        if (hasCommitted[_auctionId][msg.sender]) revert AlreadyCommitted();

        hasCommitted[_auctionId][msg.sender] = true;
        _bids[_auctionId][msg.sender] = Bid({
            commitHash: _commitHash,
            amount: 0,
            revealed: false,
            timestamp: block.timestamp
        });
        _bidders[_auctionId].push(msg.sender);

        emit BidCommitted(_auctionId, msg.sender, _commitHash);
    }

    /// @notice Reveal a bid after the commit deadline
    function revealBid(uint256 _auctionId, uint256 _amount, bytes32 _salt) external {
        Auction storage a = auctions[_auctionId];
        if (a.creator == address(0)) revert AuctionNotFound();
        if (block.timestamp <= a.commitDeadline) revert RevealPhaseNotStarted();
        if (block.timestamp > a.revealDeadline) revert RevealPhaseOver();

        Bid storage bid = _bids[_auctionId][msg.sender];
        if (!hasCommitted[_auctionId][msg.sender]) revert NotCommitted();
        if (bid.revealed) revert AlreadyRevealed();

        // Verify the reveal matches the commit
        bytes32 expectedHash = keccak256(abi.encodePacked(_amount, _salt));
        if (expectedHash != bid.commitHash) revert InvalidReveal();

        bid.amount = _amount;
        bid.revealed = true;

        emit BidRevealed(_auctionId, msg.sender, _amount);
    }

    /// @notice Back a revealed bid by escrowing its amount into this contract.
    ///         Only funded bids are eligible to win; escrows are refunded at
    ///         settle (all bidders) or recover (all bidders).
    function escrowBid(uint256 _auctionId) external nonReentrant {
        Auction storage a = auctions[_auctionId];
        if (a.creator == address(0)) revert AuctionNotFound();
        if (a.settled) revert AlreadySettled();
        if (recovered[_auctionId]) revert AlreadyRecovered();

        Bid storage bid = _bids[_auctionId][msg.sender];
        if (!bid.revealed) revert NotRevealed();
        if (bid.amount == 0) revert ZeroAmount();
        if (bidderEscrows[_auctionId][msg.sender] != 0) revert AlreadyEscrowed();

        IERC20(a.asset).safeTransferFrom(msg.sender, address(this), bid.amount);
        bidderEscrows[_auctionId][msg.sender] = bid.amount;

        emit BidEscrowed(_auctionId, msg.sender, bid.amount);
    }

    /// @notice Deadline after which anyone may settle or recover a round.
    function settleDeadline(uint256 _auctionId) public view returns (uint64) {
        return auctions[_auctionId].revealDeadline + uint64(SETTLE_WINDOW);
    }

    /// @notice Read the current winner off-chain (view — no state change), so
    ///         the creator knows who to escrow the payment for before calling
    ///         settleAndPay.
    function getWinner(uint256 _auctionId) public view returns (address winner, uint256 amount) {
        return _determineWinner(_auctionId);
    }

    /// @notice Settle the round — highest FUNDED valid bid wins.
    ///         Creator may settle any time after the reveal window; anyone may
    ///         settle after the settle deadline (a silent creator cannot hold
    ///         the round hostage). Refunds every bidder's escrow.
    function settle(uint256 _auctionId) external nonReentrant {
        Auction storage a = auctions[_auctionId];
        if (a.creator == address(0)) revert AuctionNotFound();
        if (a.settled) revert AlreadySettled();
        if (recovered[_auctionId]) revert AlreadyRecovered();
        if (block.timestamp <= a.revealDeadline) revert RevealPhaseActive();
        if (msg.sender != a.creator && block.timestamp <= settleDeadline(_auctionId)) revert NotCreator();

        (address winner, uint256 winningBid) = _determineWinner(_auctionId);
        if (winner == address(0)) revert NoValidBids();

        a.settled = true;
        a.winner = winner;
        a.winningBid = winningBid;

        _refundAllEscrows(_auctionId);
        emit AuctionSettled(_auctionId, winner, winningBid);
    }

    /// @notice ATOMIC settlement: settle the round and release the escrowed
    ///         payment from the vault in the SAME transaction. Permissionless —
    ///         anyone may submit a valid attestation, so a silent creator
    ///         cannot block the winner's payment.
    /// @dev The attestation (authority EIP-191 signature over the vault
    ///      settlement terms) is verified by the vault; if it is invalid the
    ///      vault reverts AttestationFailed and NOTHING happens — the round is
    ///      not settled and no funds move. This is the "atomic" claim.
    function settleAndPay(
        uint256 _auctionId,
        uint256 _settlementId,
        bytes calldata _attestation
    ) external nonReentrant {
        Auction storage a = auctions[_auctionId];
        if (a.creator == address(0)) revert AuctionNotFound();
        if (a.settled) revert AlreadySettled();
        if (recovered[_auctionId]) revert AlreadyRecovered();
        if (block.timestamp <= a.revealDeadline) revert RevealPhaseActive();

        (address winner, uint256 winningBid) = _determineWinner(_auctionId);
        if (winner == address(0)) revert NoValidBids();

        // The referenced escrow must match THIS round's outcome exactly.
        (
            address payer,
            address payee,
            address asset,
            uint256 amount,
            ,
            bool executed,
            bool refunded,

        ) = vault.settlements(_settlementId);
        if (
            payer != a.creator ||
            payee != winner ||
            asset != a.asset ||
            amount != winningBid ||
            executed ||
            refunded
        ) revert SettlementMismatch();

        // Attestation-gated release — invalid attestation reverts here and the
        // whole transaction (including the round settlement) rolls back.
        vault.executeSettlement(_settlementId, _attestation);

        a.settled = true;
        a.winner = winner;
        a.winningBid = winningBid;

        _refundAllEscrows(_auctionId);
        emit AuctionSettled(_auctionId, winner, winningBid);
    }

    /// @notice Hostage protection: if the creator never settles by the settle
    ///         deadline, anyone may recover the round, refunding every
    ///         bidder's escrow. A recovered round can never be settled.
    function recover(uint256 _auctionId) external nonReentrant {
        Auction storage a = auctions[_auctionId];
        if (a.creator == address(0)) revert AuctionNotFound();
        if (a.settled) revert AlreadySettled();
        if (recovered[_auctionId]) revert AlreadyRecovered();
        if (block.timestamp <= settleDeadline(_auctionId)) revert SettleDeadlineNotPassed();

        recovered[_auctionId] = true;
        _refundAllEscrows(_auctionId);
        emit AuctionRecovered(_auctionId);
    }

    /// @notice View a single bid
    function getBid(uint256 _auctionId, address _bidder) external view returns (Bid memory) {
        return _bids[_auctionId][_bidder];
    }

    /// @notice View all bidders for an auction
    function getBidders(uint256 _auctionId) external view returns (address[] memory) {
        return _bidders[_auctionId];
    }

    // ── Internals ──────────────────────────────────────────────────────────

    /// @dev Highest revealed, fully-funded bid at or above the reserve wins.
    function _determineWinner(uint256 _auctionId) private view returns (address winner, uint256 highest) {
        Auction storage a = auctions[_auctionId];
        address[] storage bidders = _bidders[_auctionId];
        for (uint256 i = 0; i < bidders.length; i++) {
            address bidder = bidders[i];
            Bid storage bid = _bids[_auctionId][bidder];
            if (
                bid.revealed &&
                bidderEscrows[_auctionId][bidder] == bid.amount &&
                bid.amount >= a.reservePrice &&
                bid.amount > highest
            ) {
                highest = bid.amount;
                winner = bidder;
            }
        }
    }

    /// @dev Refund every bidder's escrow for a round that reached a terminal
    ///      state (settled or recovered).
    function _refundAllEscrows(uint256 _auctionId) private {
        address[] storage bidders = _bidders[_auctionId];
        address asset = auctions[_auctionId].asset;
        for (uint256 i = 0; i < bidders.length; i++) {
            address bidder = bidders[i];
            uint256 escrowed = bidderEscrows[_auctionId][bidder];
            if (escrowed == 0) continue;
            bidderEscrows[_auctionId][bidder] = 0;
            IERC20(asset).safeTransfer(bidder, escrowed);
            emit EscrowRefunded(_auctionId, bidder, escrowed);
        }
    }
}
