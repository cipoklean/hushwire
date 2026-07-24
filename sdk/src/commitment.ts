import { ethers } from "ethers";

export interface CommitmentRecord {
  amount: bigint;
  salt: Uint8Array;
}

/**
 * Generate a random 32-byte salt and the keccak commitment hash for a bid.
 * commitHash = keccak256(abi.encodePacked(amount, salt))
 * The hash goes on-chain at commit time; the salt is kept secret until reveal.
 */
export function makeCommitment(amount: bigint): { salt: Uint8Array; hash: string } {
  const salt = ethers.randomBytes(32);
  const hash = ethers.keccak256(
    ethers.solidityPacked(["uint256", "bytes32"], [amount, salt])
  );
  return { salt, hash };
}

export interface CommitmentStore {
  save(roundId: number, bidder: string, rec: CommitmentRecord): Promise<void>;
  load(roundId: number, bidder: string): Promise<CommitmentRecord | null>;
}

/**
 * In-memory commitment store. DEMO ONLY.
 * The salt is sensitive — anyone holding it can precompute the bid hash before
 * reveal. A production agent must use an encrypted / enclave-backed store.
 */
export class MemoryCommitmentStore implements CommitmentStore {
  private map = new Map<string, CommitmentRecord>();

  private key(roundId: number, bidder: string): string {
    return `${roundId}:${bidder.toLowerCase()}`;
  }

  async save(roundId: number, bidder: string, rec: CommitmentRecord): Promise<void> {
    this.map.set(this.key(roundId, bidder), rec);
  }

  async load(roundId: number, bidder: string): Promise<CommitmentRecord | null> {
    return this.map.get(this.key(roundId, bidder)) ?? null;
  }
}
