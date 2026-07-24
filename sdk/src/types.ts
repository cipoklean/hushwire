import type { CommitmentStore } from "./commitment";

export type AuctionPhase = "COMMIT" | "REVEAL" | "SETTLED" | "ENDED";

export interface HushWireContracts {
  auction: string; // SealedBidAuction
  vault: string;   // HushWireVault
  fasset: string;  // FXRP (or other FAsset) token
}

export interface HushWireConfig {
  rpcUrl: string;
  chainId?: number;       // default 114 (Coston2)
  networkName?: string;   // default "flare"
  signer: import("ethers").Signer; // the agent's wallet
  contracts: HushWireContracts;
  commitmentStore?: CommitmentStore;
}

export interface RoundView {
  id: number;
  creator: string;
  asset: string;
  reservePrice: bigint;
  commitDeadline: number;
  revealDeadline: number;
  settled: boolean;
  winner: string;
  winningBid: bigint;
  bidders: string[];
  phase: AuctionPhase;
}

export interface SettlementView {
  id: number;
  payer: string;
  payee: string;
  asset: string;
  amount: bigint;
  deadline: number;
  executed: boolean;
  refunded: boolean;
  enclaveProof: string;
}
