import { ethers } from "ethers";
import { AUCTION_ABI, VAULT_ABI, FASSET_ABI } from "./abi";
import { makeCommitment, MemoryCommitmentStore, type CommitmentStore } from "./commitment";
import type { AuctionPhase, HushWireConfig, RoundView, SettlementView } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function computePhase(
  settled: boolean,
  commitDeadline: bigint,
  revealDeadline: bigint,
  now: bigint
): AuctionPhase {
  if (settled) return "SETTLED";
  if (now <= commitDeadline) return "COMMIT";
  if (now <= revealDeadline) return "REVEAL";
  return "ENDED";
}

// Total ordering used by waitForPhase. ENDED and SETTLED are both "after reveal".
const PHASE_RANK: Record<AuctionPhase, number> = {
  COMMIT: 0,
  REVEAL: 1,
  ENDED: 2,
  SETTLED: 3,
};

/**
 * HushWireClient — a signer-aware, high-level client for one agent.
 *
 * Wraps SealedBidAuction + HushWireVault + the FAsset token, and hides the
 * commit-reveal cryptography (salt generation + storage). Each agent gets its
 * own client instance backed by its own wallet.
 */
export class HushWireClient {
  readonly provider: ethers.JsonRpcProvider;
  readonly contracts: HushWireConfig["contracts"];
  private readonly signer: ethers.Signer;
  private readonly auction: ethers.Contract;
  private readonly vault: ethers.Contract;
  private readonly fasset: ethers.Contract;
  private readonly store: CommitmentStore;

  constructor(config: HushWireConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl, {
      chainId: config.chainId ?? 114,
      name: config.networkName ?? "flare",
    });
    // Connect the agent's wallet to our provider if it isn't already.
    this.signer = (config.signer as ethers.Wallet).connect
      ? (config.signer as ethers.Wallet).connect(this.provider)
      : config.signer;
    this.auction = new ethers.Contract(config.contracts.auction, AUCTION_ABI, this.signer);
    this.vault = new ethers.Contract(config.contracts.vault, VAULT_ABI, this.signer);
    this.fasset = new ethers.Contract(config.contracts.fasset, FASSET_ABI, this.signer);
    this.store = config.commitmentStore ?? new MemoryCommitmentStore();
    this.contracts = config.contracts;
  }

  getAddress(): Promise<string> {
    return this.signer.getAddress();
  }

  async getChainTime(): Promise<bigint> {
    const block = await this.provider.getBlock("latest");
    return BigInt(block!.timestamp);
  }

  // ── Negotiation (SealedBidAuction) ────────────────────────────────────────

  /** Open a sealed-bid round. Returns the on-chain round id. */
  async openRound(opts: {
    reservePrice: bigint;
    commitSeconds: number;
    revealSeconds: number;
    asset?: string;
  }): Promise<{ roundId: number; txHash: string }> {
    const asset = opts.asset ?? this.contracts.fasset;
    const tx = await this.auction.createAuction(
      asset,
      opts.reservePrice,
      opts.commitSeconds,
      opts.revealSeconds
    );
    const receipt = await tx.wait();
    const roundId = Number(await this.auction.auctionCount()) - 1;
    return { roundId, txHash: receipt!.hash };
  }

  /** Commit a sealed bid. Generates + stores the salt; only the hash goes on-chain. */
  async commitBid(roundId: number, amount: bigint): Promise<{ txHash: string }> {
    const { salt, hash } = makeCommitment(amount);
    const tx = await this.auction.commitBid(roundId, hash);
    const receipt = await tx.wait();
    const bidder = await this.signer.getAddress();
    await this.store.save(roundId, bidder, { amount, salt });
    return { txHash: receipt!.hash };
  }

  /** Reveal a previously committed bid using the stored salt. */
  async revealBid(roundId: number): Promise<{ txHash: string; amount: bigint }> {
    const bidder = await this.signer.getAddress();
    const rec = await this.store.load(roundId, bidder);
    if (!rec) {
      throw new Error(`No stored commitment for round ${roundId} / ${bidder}`);
    }
    const tx = await this.auction.revealBid(roundId, rec.amount, rec.salt);
    const receipt = await tx.wait();
    return { txHash: receipt!.hash, amount: rec.amount };
  }

  /** Settle the round (creator only). Returns the winner and winning amount. */
  async settle(roundId: number): Promise<{ txHash: string; winner: string; amount: bigint }> {
    const tx = await this.auction.settle(roundId);
    const receipt = await tx.wait();
    const a = await this.auction.auctions(roundId);
    return { txHash: receipt!.hash, winner: a.winner, amount: a.winningBid };
  }

  // ── Settlement (HushWireVault) ────────────────────────────────────────────

  /** Approve the vault (or another spender) to pull FXRP. */
  async approveFAsset(amount: bigint, spender?: string): Promise<string> {
    const target = spender ?? this.contracts.vault;
    const tx = await this.fasset.approve(target, amount);
    const receipt = await tx.wait();
    return receipt!.hash;
  }

  /** Escrow FXRP for a payee. Auto-approves the vault if allowance is short. */
  async escrow(opts: {
    payee: string;
    amount: bigint;
    durationSeconds: number;
  }): Promise<{ settlementId: number; txHash: string }> {
    const me = await this.signer.getAddress();
    const allowance: bigint = await this.fasset.allowance(me, this.contracts.vault);
    if (allowance < opts.amount) {
      await this.approveFAsset(opts.amount);
    }
    const tx = await this.vault.createSettlement(
      opts.payee,
      this.contracts.fasset,
      opts.amount,
      opts.durationSeconds
    );
    const receipt = await tx.wait();
    const settlementId = Number(await this.vault.settlementCount()) - 1;
    return { settlementId, txHash: receipt!.hash };
  }

  /** Execute a settlement given an enclave attestation proof. */
  async execute(settlementId: number, proof: ethers.BytesLike): Promise<string> {
    const tx = await this.vault.executeSettlement(settlementId, proof);
    const receipt = await tx.wait();
    return receipt!.hash;
  }

  /** Refund an expired escrow (payer only). */
  async refund(settlementId: number): Promise<string> {
    const tx = await this.vault.refund(settlementId);
    const receipt = await tx.wait();
    return receipt!.hash;
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async getRound(roundId: number): Promise<RoundView> {
    const a = await this.auction.auctions(roundId);
    const [bidders, now] = await Promise.all([
      this.auction.getBidders(roundId) as Promise<string[]>,
      this.getChainTime(),
    ]);
    return {
      id: roundId,
      creator: a.creator,
      asset: a.asset,
      reservePrice: a.reservePrice,
      commitDeadline: Number(a.commitDeadline),
      revealDeadline: Number(a.revealDeadline),
      settled: a.settled,
      winner: a.winner,
      winningBid: a.winningBid,
      bidders,
      phase: computePhase(a.settled, BigInt(a.commitDeadline), BigInt(a.revealDeadline), now),
    };
  }

  async getSettlement(settlementId: number): Promise<SettlementView> {
    const s = await this.vault.settlements(settlementId);
    return {
      id: settlementId,
      payer: s.payer,
      payee: s.payee,
      asset: s.asset,
      amount: s.amount,
      deadline: Number(s.deadline),
      executed: s.executed,
      refunded: s.refunded,
      enclaveProof: s.enclaveProof,
    };
  }

  async getPhase(roundId: number): Promise<AuctionPhase> {
    const a = await this.auction.auctions(roundId);
    const now = await this.getChainTime();
    return computePhase(a.settled, BigInt(a.commitDeadline), BigInt(a.revealDeadline), now);
  }

  async hasCommitted(roundId: number, bidder?: string): Promise<boolean> {
    const who = bidder ?? (await this.signer.getAddress());
    return await this.auction.hasCommitted(roundId, who);
  }

  // ── Testnet helpers (mock FAsset only) ────────────────────────────────────

  /** Mint FXRP from the mock faucet. Testnet only. */
  async mintFAsset(amount: bigint): Promise<string> {
    const tx = await this.fasset.faucet(amount);
    const receipt = await tx.wait();
    return receipt!.hash;
  }

  async balanceFAsset(): Promise<bigint> {
    const me = await this.signer.getAddress();
    return await this.fasset.balanceOf(me);
  }

  // ── High-level ────────────────────────────────────────────────────────────

  /**
   * Wait (on chain time) until a round reaches at least the target phase.
   * Robust to clock skew because it polls the latest block timestamp.
   */
  async waitForPhase(roundId: number, target: AuctionPhase, pollMs = 5000): Promise<AuctionPhase> {
    for (;;) {
      const phase = await this.getPhase(roundId);
      if (PHASE_RANK[phase] >= PHASE_RANK[target]) return phase;
      await sleep(pollMs);
    }
  }
}
