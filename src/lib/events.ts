import { ethers } from "ethers";
import addresses from "./addresses.json";
import type { ChainEvent, ChainEventTone } from "@/types";

export const EXPLORER_BASE = "https://coston2-explorer.flare.network";
const API = `${EXPLORER_BASE}/api`;

/**
 * Server-side event feed for the landing page "LIVE INTERCEPT" panel.
 * Reads real Vault/Auction logs via the Coston2 explorer (Blockscout) API —
 * the public RPC caps eth_getLogs at 30 blocks, the explorer is indexed and
 * returns block numbers + timestamps for free. Decodes each log with the
 * contract interfaces and renders newest-first.
 */

const AUCTION_EVENTS = [
  "event AuctionCreated(uint256 indexed auctionId, address creator, address asset, uint256 reservePrice)",
  "event BidCommitted(uint256 indexed auctionId, address bidder, bytes32 commitHash)",
  "event BidRevealed(uint256 indexed auctionId, address bidder, uint256 amount)",
  "event AuctionSettled(uint256 indexed auctionId, address winner, uint256 amount)",
];

const VAULT_EVENTS = [
  "event SettlementCreated(uint256 indexed id, address payer, address payee, address asset, uint256 amount)",
  "event SettlementExecuted(uint256 indexed id, address payee, uint256 amount)",
  "event SettlementRefunded(uint256 indexed id, address payer, uint256 amount)",
];

// Safe recent window used when the explorer API is unavailable.
const RPC_FALLBACK_BLOCKS = 30; // hard cap enforced by the public RPC

export interface EventsResult {
  events: ChainEvent[];
  windowed: boolean;
  fromBlock: number;
  toBlock: number;
}

function short(addr: string): string {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

const fxrp = (n: bigint) => ethers.formatEther(n);

const labelFor = (name: string): { label: string; tone: ChainEventTone } => {
  switch (name) {
    case "AuctionCreated":
      return { label: "ROUND OPEN", tone: "amber" };
    case "BidCommitted":
      return { label: "BID COMMIT", tone: "red" };
    case "BidRevealed":
      return { label: "BID REVEAL", tone: "cyan" };
    case "AuctionSettled":
      return { label: "AUCTION SETTLED", tone: "amber" };
    case "SettlementCreated":
      return { label: "ESCROW LOCK", tone: "amber" };
    case "SettlementExecuted":
      return { label: "SETTLEMENT EXEC", tone: "green" };
    case "SettlementRefunded":
      return { label: "REFUND", tone: "dim" };
    default:
      return { label: name.toUpperCase(), tone: "dim" };
  }
};

const summaryFor = (name: string, args: Record<string, unknown>): string => {
  const s = (v: unknown) => short(v as string);
  switch (name) {
    case "AuctionCreated":
      return `round #${args.auctionId} · creator ${s(args.creator)} · reserve ${fxrp(args.reservePrice as bigint)} FXRP`;
    case "BidCommitted":
      return `round #${args.auctionId} · ${s(args.bidder)} · amount ⌀ sealed`;
    case "BidRevealed":
      return `round #${args.auctionId} · ${s(args.bidder)} · ${fxrp(args.amount as bigint)} FXRP`;
    case "AuctionSettled":
      return `round #${args.auctionId} · winner ${s(args.winner)} · ${fxrp(args.amount as bigint)} FXRP`;
    case "SettlementCreated":
      return `settlement #${args.id} · ${s(args.payer)} → ${s(args.payee)} · ${fxrp(args.amount as bigint)} FXRP`;
    case "SettlementExecuted":
      return `settlement #${args.id} · ${fxrp(args.amount as bigint)} FXRP → ${s(args.payee)}`;
    case "SettlementRefunded":
      return `settlement #${args.id} · ${fxrp(args.amount as bigint)} FXRP → ${s(args.payer)}`;
    default:
      return JSON.stringify(args);
  }
};

interface ExplorerLog {
  address: string;
  blockNumber: string; // hex
  timeStamp: string; // hex
  topics: string[];
  data: string;
  transactionHash: string;
  logIndex: string; // hex
}

async function fetchLogs(
  address: string,
  fromBlock: number,
  toBlock: number
): Promise<ExplorerLog[]> {
  const url = `${API}?module=logs&action=getLogs&fromBlock=${fromBlock}&toBlock=${toBlock}&address=${address.toLowerCase()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`explorer ${res.status}`);
  const json = await res.json();
  if (json.message !== "OK") throw new Error(json.message ?? "explorer getLogs failed");
  const result = json.result as ExplorerLog[];
  if (!Array.isArray(result)) return [];
  // Blockscout caps a single call at ~1000 rows; if we hit the cap, split the
  // range and recurse so we never silently drop history.
  if (result.length >= 1000 && toBlock - fromBlock > 1000) {
    const mid = fromBlock + Math.floor((toBlock - fromBlock) / 2);
    const [lo, hi] = await Promise.all([fetchLogs(address, fromBlock, mid), fetchLogs(address, mid + 1, toBlock)]);
    return [...lo, ...hi];
  }
  return result;
}

export async function getRecentEvents(limit = 8): Promise<EventsResult> {
  const auctionIf = new ethers.Interface(AUCTION_EVENTS);
  const vaultIf = new ethers.Interface(VAULT_EVENTS);

  const toBlock = await latestBlock();
  const deployedBlock = (addresses as { deployedBlock?: number }).deployedBlock ?? 0;
  const fromBlock = Math.max(deployedBlock, 0);
  let windowed = false;

  let raw: ExplorerLog[] = [];
  try {
    const [a, v] = await Promise.all([
      fetchLogs(addresses.sealedBidAuction, fromBlock, toBlock),
      fetchLogs(addresses.hushWireVault, fromBlock, toBlock),
    ]);
    raw = [...a, ...v];
  } catch {
    // Explorer API down — fall back to a narrow RPC window (30-block cap).
    windowed = true;
    raw = await rpcFallback(RPC_FALLBACK_BLOCKS);
  }

  const events: ChainEvent[] = [];
  const seen = new Set<string>();

  const decode = (log: ExplorerLog) => {
    const key = `${log.blockNumber}-${log.logIndex}`;
    if (seen.has(key)) return;
    seen.add(key);

    let parsed: ethers.LogDescription | null = null;
    const addr = log.address.toLowerCase();
    // Blockscout returns null for non-indexed topic slots — ethers needs
    // BytesLike, so coerce empty slots to "0x".
    const topics = log.topics.map((t) => t ?? "0x");
    const asLog = { topics, data: log.data, address: log.address } as unknown as ethers.Log;
    if (addr === addresses.sealedBidAuction.toLowerCase()) parsed = auctionIf.parseLog(asLog);
    else if (addr === addresses.hushWireVault.toLowerCase()) parsed = vaultIf.parseLog(asLog);
    if (!parsed) return;

    const { label, tone } = labelFor(parsed.name);
    events.push({
      id: key,
      contract: addr === addresses.sealedBidAuction.toLowerCase() ? "auction" : "vault",
      name: parsed.name,
      label,
      tone,
      block: parseInt(log.blockNumber, 16),
      txHash: log.transactionHash,
      blockTime: parseInt(log.timeStamp, 16),
      summary: summaryFor(parsed.name, parsed.args as unknown as Record<string, unknown>),
    });
  };

  // Newest-first by (block, logIndex).
  raw.sort((x, y) => {
    const bx = parseInt(x.blockNumber, 16);
    const by = parseInt(y.blockNumber, 16);
    if (bx !== by) return by - bx;
    return parseInt(y.logIndex, 16) - parseInt(x.logIndex, 16);
  });

  for (const log of raw) {
    if (events.length >= limit) break;
    decode(log);
  }

  return { events, windowed, fromBlock, toBlock };
}

async function latestBlock(): Promise<number> {
  const res = await fetch(`${API}?module=block&action=eth_block_number`);
  const json = await res.json();
  return parseInt(json.result ?? "0x0", 16);
}

async function rpcFallback(blocks: number): Promise<ExplorerLog[]> {
  const provider = new ethers.JsonRpcProvider(addresses.rpcUrl, {
    chainId: addresses.chainId,
    name: addresses.network,
  });
  const latest = await provider.getBlockNumber();
  const logs = await provider.getLogs({
    address: [addresses.sealedBidAuction, addresses.hushWireVault],
    fromBlock: latest - blocks,
    toBlock: latest,
  });
  return logs.map((l) => ({
    address: l.address,
    blockNumber: `0x${l.blockNumber.toString(16)}`,
    timeStamp: "0x0",
    topics: [...l.topics],
    data: l.data,
    transactionHash: l.transactionHash,
    logIndex: `0x${l.index.toString(16)}`,
  }));
}
