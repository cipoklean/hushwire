import { ethers } from "ethers";
import addresses from "./addresses.json";
import type {
  AuctionView,
  SettlementView,
  AuctionPhase,
  SettlementStatus,
  ChainSnapshot,
} from "@/types";

export const EXPLORER_BASE = "https://coston2-explorer.flare.network";

// Server-side provider (used by the /api/chain route — never shipped to the browser)
const provider = new ethers.JsonRpcProvider(addresses.rpcUrl, {
  chainId: addresses.chainId,
  name: addresses.network,
});

const AUCTION_ABI = [
  "function auctionCount() view returns (uint256)",
  "function auctions(uint256) view returns (address creator, address asset, uint256 reservePrice, uint64 commitDeadline, uint64 revealDeadline, bool settled, address winner, uint256 winningBid)",
  "function getBidders(uint256) view returns (address[])",
];

const VAULT_ABI = [
  "function settlementCount() view returns (uint256)",
  "function settlements(uint256) view returns (address payer, address payee, address asset, uint256 amount, uint64 deadline, bool executed, bool refunded, bytes enclaveProof)",
];

/**
 * Read a snapshot of live on-chain state: totals + the most recent
 * auctions and settlements. Reads are capped at `limit` (newest first)
 * to keep RPC calls bounded — there is no indexer on Coston2.
 */
export async function getChainSnapshot(limit = 5): Promise<ChainSnapshot> {
  const auction = new ethers.Contract(addresses.sealedBidAuction, AUCTION_ABI, provider);
  const vault = new ethers.Contract(addresses.hushWireVault, VAULT_ABI, provider);

  const [auctionCount, settlementCount, block] = await Promise.all([
    auction.auctionCount(),
    vault.settlementCount(),
    provider.getBlock("latest"),
  ]);

  const now = BigInt(block?.timestamp ?? Math.floor(Date.now() / 1000));
  const ac = Number(auctionCount);
  const sc = Number(settlementCount);

  // Recent auctions, newest first
  const auctions: AuctionView[] = [];
  for (let i = ac - 1; i >= Math.max(0, ac - limit); i--) {
    const a = await auction.auctions(i);
    const bidders: string[] = await auction.getBidders(i);
    let phase: AuctionPhase;
    if (a.settled) phase = "SETTLED";
    else if (now <= BigInt(a.commitDeadline)) phase = "COMMIT";
    else if (now <= BigInt(a.revealDeadline)) phase = "REVEAL";
    else phase = "ENDED";
    auctions.push({
      id: i,
      creator: a.creator,
      reserve: ethers.formatEther(a.reservePrice),
      bidders: bidders.length,
      phase,
    });
  }

  // Recent settlements, newest first
  const settlements: SettlementView[] = [];
  let volume = BigInt(0);
  for (let i = sc - 1; i >= Math.max(0, sc - limit); i--) {
    const s = await vault.settlements(i);
    let status: SettlementStatus;
    if (s.executed) status = "EXECUTED";
    else if (s.refunded) status = "REFUNDED";
    else if (now > BigInt(s.deadline)) status = "EXPIRED";
    else status = "ESCROWED";
    if (s.executed) volume += s.amount;
    settlements.push({
      id: i,
      payer: s.payer,
      payee: s.payee,
      amount: ethers.formatEther(s.amount),
      status,
    });
  }

  return {
    network: addresses.network,
    chainId: addresses.chainId,
    timestamp: Date.now(),
    stats: {
      rounds: ac,
      settlements: sc,
      // Derived from recent activity only — labelled as such in the UI.
      volumeRecent: Number(ethers.formatEther(volume)),
      biddersRecent: auctions.reduce((n, a) => n + a.bidders, 0),
    },
    auctions,
    settlements,
  };
}
