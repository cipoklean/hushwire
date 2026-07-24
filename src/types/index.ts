export interface Agent {
  address: string;
  role: "buyer" | "seller";
  label: string;
}

export interface Auction {
  id: number;
  creator: string;
  asset: string;
  reservePrice: string;
  commitDeadline: number;
  revealDeadline: number;
  settled: boolean;
  winner: string | null;
  winningBid: string | null;
  bidders: string[];
}

export interface Bid {
  bidder: string;
  commitHash: string;
  amount: string | null; // null until revealed
  revealed: boolean;
  timestamp: number;
}

export interface Settlement {
  id: number;
  payer: string;
  payee: string;
  asset: string;
  amount: string;
  deadline: number;
  executed: boolean;
  refunded: boolean;
  enclaveProof: string | null;
}

export type NegotiationPhase = "commit" | "reveal" | "settle" | "settled";

export interface SimulationStep {
  agent: string;
  action: string;
  detail: string;
}

export interface SimulationResult {
  scenario: string;
  network: string;
  chainId: number;
  steps: SimulationStep[];
  outcome: {
    winner: string;
    amount: string;
    privacy: string;
    txHash: string;
  };
  timestamp: string;
}

// ── Live chain snapshot (read from Coston2) ──

export type AuctionPhase = "COMMIT" | "REVEAL" | "SETTLED" | "ENDED";
export type SettlementStatus = "EXECUTED" | "ESCROWED" | "REFUNDED" | "EXPIRED";

export interface AuctionView {
  id: number;
  creator: string;
  reserve: string;
  bidders: number;
  phase: AuctionPhase;
}

export interface SettlementView {
  id: number;
  payer: string;
  payee: string;
  amount: string;
  status: SettlementStatus;
}

export interface ChainStats {
  rounds: number;
  settlements: number;
  volumeRecent: number;
  biddersRecent: number;
}

export interface ChainSnapshot {
  network: string;
  chainId: number;
  timestamp: number;
  stats: ChainStats;
  auctions: AuctionView[];
  settlements: SettlementView[];
}
