import { ethers } from "ethers";
import addresses from "./addresses.json";

// Provider for Flare Coston2
export function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl =
    process.env.NEXT_PUBLIC_FLARE_RPC_URL || addresses.rpcUrl;
  return new ethers.JsonRpcProvider(rpcUrl, {
    chainId: addresses.chainId,
    name: addresses.network,
  });
}

// Contract ABIs (minimal for reads)
export const SEALED_BID_ABI = [
  "function auctionCount() view returns (uint256)",
  "function auctions(uint256) view returns (address creator, address asset, uint256 reservePrice, uint64 commitDeadline, uint64 revealDeadline, bool settled, address winner, uint256 winningBid)",
  "function createAuction(address _asset, uint256 _reservePrice, uint64 _commitDuration, uint64 _revealDuration) returns (uint256)",
  "function commitBid(uint256 _auctionId, bytes32 _commitHash)",
  "function revealBid(uint256 _auctionId, uint256 _amount, bytes32 _salt)",
  "function settle(uint256 _auctionId)",
  "function getBidders(uint256 _auctionId) view returns (address[])",
  "event AuctionCreated(uint256 indexed auctionId, address creator, address asset, uint256 reservePrice)",
  "event BidCommitted(uint256 indexed auctionId, address bidder, bytes32 commitHash)",
  "event BidRevealed(uint256 indexed auctionId, address bidder, uint256 amount)",
  "event AuctionSettled(uint256 indexed auctionId, address winner, uint256 amount)",
];

export const VAULT_ABI = [
  "function settlementCount() view returns (uint256)",
  "function settlements(uint256) view returns (address payer, address payee, address asset, uint256 amount, uint64 deadline, bool executed, bool refunded, bytes32 enclaveProof)",
  "function createSettlement(address _payee, address _asset, uint256 _amount, uint64 _duration) returns (uint256)",
  "function executeSettlement(uint256 _id, bytes32 _enclaveProof)",
  "function refund(uint256 _id)",
  "event SettlementCreated(uint256 indexed id, address payer, address payee, address asset, uint256 amount)",
  "event SettlementExecuted(uint256 indexed id, address payee, uint256 amount)",
];

export const FASSET_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function transfer(address, uint256) returns (bool)",
  "function faucet(uint256 amount)",
];

// Get contract instances
export function getSealedBidContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    addresses.sealedBidAuction,
    SEALED_BID_ABI,
    signerOrProvider || getProvider()
  );
}

export function getVaultContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    addresses.hushWireVault,
    VAULT_ABI,
    signerOrProvider || getProvider()
  );
}

export function getFAssetContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    addresses.fxrpToken,
    FASSET_ABI,
    signerOrProvider || getProvider()
  );
}
