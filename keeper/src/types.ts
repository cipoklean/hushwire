import type { ethers } from "ethers";

/** A single on-chain action a strategy wants the keeper to perform. */
export type Action =
  | { type: "execute-settlement"; id: number; proof: string }
  | { type: "refund"; id: number }
  | { type: "settle-auction"; id: number };

/** Read-only chain snapshot handed to each strategy on every tick. */
export interface ScanContext {
  vault: ethers.Contract;
  auction: ethers.Contract;
  now: bigint; // latest block timestamp
  keeperAddress: string;
  settlementCount: number;
  auctionCount: number;
}

/** A pluggable automation. `scan` must be read-only and idempotent. */
export interface Strategy {
  name: string;
  scan(ctx: ScanContext): Promise<Action[]>;
}

export interface KeeperConfig {
  rpcUrl: string;
  chainId?: number;
  signer: ethers.Signer; // keeper wallet — pays gas
  contracts: { auction: string; vault: string };
  pollIntervalMs?: number; // default 15_000
  strategies: Strategy[];
}
