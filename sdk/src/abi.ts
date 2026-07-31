/**
 * Contract ABIs (human-readable) for HushWire.
 * Single source of truth shared by the SDK and the keeper.
 * Matches the contracts deployed to Coston2 (see contracts/).
 */

export const AUCTION_ABI = [
  "function createAuction(address _asset, uint256 _reservePrice, uint64 _commitDuration, uint64 _revealDuration) returns (uint256)",
  "function commitBid(uint256 _auctionId, bytes32 _commitHash)",
  "function revealBid(uint256 _auctionId, uint256 _amount, bytes32 _salt)",
  "function settle(uint256 _auctionId)",
  "function auctionCount() view returns (uint256)",
  "function auctions(uint256) view returns (address creator, address asset, uint256 reservePrice, uint64 commitDeadline, uint64 revealDeadline, bool settled, address winner, uint256 winningBid)",
  "function getBidders(uint256) view returns (address[])",
  "function hasCommitted(uint256, address) view returns (bool)",
  "event AuctionCreated(uint256 indexed auctionId, address creator, address asset, uint256 reservePrice)",
  "event BidCommitted(uint256 indexed auctionId, address bidder, bytes32 commitHash)",
  "event BidRevealed(uint256 indexed auctionId, address bidder, uint256 amount)",
  "event AuctionSettled(uint256 indexed auctionId, address winner, uint256 amount)",
];

export const VAULT_ABI = [
  "function createSettlement(address _payee, address _asset, uint256 _amount, uint64 _duration) returns (uint256)",
  "function executeSettlement(uint256 _id, bytes _enclaveProof)",
  "function refund(uint256 _id)",
  "function settlementCount() view returns (uint256)",
  "function settlements(uint256) view returns (address payer, address payee, address asset, uint256 amount, uint64 deadline, bool executed, bool refunded, bytes enclaveProof)",
  "function verifier() view returns (address)",
  "event SettlementCreated(uint256 indexed id, address payer, address payee, address asset, uint256 amount)",
  "event SettlementExecuted(uint256 indexed id, address payee, uint256 amount)",
  "event SettlementRefunded(uint256 indexed id, address payer, uint256 amount)",
];

// The on-chain verification gate (see SignatureVerifier.sol / IEnclaveVerifier).
export const VERIFIER_ABI = [
  "function authority() view returns (address)",
  "function payload(address vault, uint256 chainId, uint256 settlementId, address payer, address payee, address asset, uint256 amount) view returns (bytes32)",
  "function verify(uint256 settlementId, address payer, address payee, address asset, uint256 amount, bytes proof) view returns (bool)",
];

export const FASSET_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  // Testnet-only mock faucet. Not present on the real mainnet FAsset.
  "function faucet(uint256 amount)",
];
