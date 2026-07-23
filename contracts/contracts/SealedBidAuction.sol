// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SealedBidAuction
 * @notice Confidential sealed-bid negotiation between agents.
 *         Bids are committed as hashes, revealed after the deadline,
 *         and the winner is settled atomically via HushWireVault.
 * @dev Designed for Flare Coston2 / Mainnet. In production, commit hashes
 *      would be generated inside Flare Confidential Compute enclaves so
 *      even the commit transaction doesn't leak bid metadata.
 */
contract SealedBidAuction {
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
        mapping(address => Bid) bids;
        address[] bidders;
    }

    mapping(uint256 => Auction) public auctions;
    uint256 public auctionCount;

    event AuctionCreated(uint256 indexed auctionId, address creator, address asset, uint256 reservePrice);
    event BidCommitted(uint256 indexed auctionId, address bidder, bytes32 commitHash);
    event BidRevealed(uint256 indexed auctionId, address bidder, uint256 amount);
    event AuctionSettled(uint256 indexed auctionId, address winner, uint256 amount);

    error AuctionNotFound();
    error NotCreator();
    error CommitPhaseOver();
    error RevealPhaseNotStarted();
    error RevealPhaseOver();
    error AlreadyRevealed();
    error InvalidReveal();
    error AlreadySettled();
    error NoValidBids();

    /// @notice Create a new sealed-bid auction (negotiation round)
    function createAuction(
        address _asset,
        uint256 _reservePrice,
        uint64 _commitDuration,
        uint64 _revealDuration
    ) external returns (uint256 auctionId) {
        auctionId = auctionCount++;
        Auction storage a = auctions[auctionId];
        a.creator = msg.sender;
        a.asset = _asset;
        a.reservePrice = _reservePrice;
        a.commitDeadline = uint64(block.timestamp) + _commitDuration;
        a.revealDeadline = a.commitDeadline + _revealDuration;

        emit AuctionCreated(auctionId, msg.sender, _asset, _reservePrice);
    }

    /// @notice Commit a sealed bid (hash only — amount stays private)
    function commitBid(uint256 _auctionId, bytes32 _commitHash) external {
        Auction storage a = auctions[_auctionId];
        if (a.creator == address(0)) revert AuctionNotFound();
        if (block.timestamp > a.commitDeadline) revert CommitPhaseOver();

        a.bids[msg.sender] = Bid({
            commitHash: _commitHash,
            amount: 0,
            revealed: false,
            timestamp: block.timestamp
        });
        a.bidders.push(msg.sender);

        emit BidCommitted(_auctionId, msg.sender, _commitHash);
    }

    /// @notice Reveal a bid after the commit deadline
    function revealBid(uint256 _auctionId, uint256 _amount, bytes32 _salt) external {
        Auction storage a = auctions[_auctionId];
        if (a.creator == address(0)) revert AuctionNotFound();
        if (block.timestamp <= a.commitDeadline) revert RevealPhaseNotStarted();
        if (block.timestamp > a.revealDeadline) revert RevealPhaseOver();

        Bid storage bid = a.bids[msg.sender];
        if (bid.revealed) revert AlreadyRevealed();

        // Verify the reveal matches the commit
        bytes32 expectedHash = keccak256(abi.encodePacked(_amount, _salt));
        if (expectedHash != bid.commitHash) revert InvalidReveal();

        bid.amount = _amount;
        bid.revealed = true;

        emit BidRevealed(_auctionId, msg.sender, _amount);
    }

    /// @notice Settle the auction — highest valid bid wins
    function settle(uint256 _auctionId) external {
        Auction storage a = auctions[_auctionId];
        if (a.creator == address(0)) revert AuctionNotFound();
        if (msg.sender != a.creator) revert NotCreator();
        if (block.timestamp <= a.revealDeadline) revert RevealPhaseOver();
        if (a.settled) revert AlreadySettled();

        uint256 highest = 0;
        address winner = address(0);

        for (uint256 i = 0; i < a.bidders.length; i++) {
            Bid storage bid = a.bids[a.bidders[i]];
            if (bid.revealed && bid.amount >= a.reservePrice && bid.amount > highest) {
                highest = bid.amount;
                winner = a.bidders[i];
            }
        }

        if (winner == address(0)) revert NoValidBids();

        a.settled = true;
        a.winner = winner;
        a.winningBid = highest;

        emit AuctionSettled(_auctionId, winner, highest);
    }

    /// @notice View all bidders for an auction
    function getBidders(uint256 _auctionId) external view returns (address[] memory) {
        return auctions[_auctionId].bidders;
    }
}
