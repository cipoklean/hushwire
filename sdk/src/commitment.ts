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
 * In-memory commitment store. DEMO ONLY — a crash between commit and reveal
 * loses the salt and bricks the bid. Use JsonFileCommitmentStore or
 * LocalStorageCommitmentStore for anything real.
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

// ── Durable stores (crash-safe between commit and reveal) ──────────────────

const bytesToHex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const hexToBytes = (h: string) => new Uint8Array(Buffer.from(h, "hex"));

/** JSON shape persisted to disk / localStorage. */
interface PersistedShape {
  [roundId: string]: {
    [bidder: string]: { amount: string; salt: string }; // amount: decimal str, salt: hex
  };
}

function toPersisted(map: Map<string, CommitmentRecord>): PersistedShape {
  const out: PersistedShape = {};
  for (const [key, rec] of map) {
    const [roundId, bidder] = key.split(":");
    out[roundId] ??= {};
    out[roundId][bidder] = { amount: rec.amount.toString(), salt: bytesToHex(rec.salt) };
  }
  return out;
}

function fromPersisted(shape: PersistedShape): Map<string, CommitmentRecord> {
  const map = new Map<string, CommitmentRecord>();
  for (const [roundId, bidders] of Object.entries(shape)) {
    for (const [bidder, rec] of Object.entries(bidders)) {
      map.set(`${roundId}:${bidder}`, {
        amount: BigInt(rec.amount),
        salt: hexToBytes(rec.salt),
      });
    }
  }
  return map;
}

// ── AES-256-GCM (node:crypto) — optional encryption at rest ────────────────

interface EncryptedEnvelope {
  v: 1;
  iv: string; // hex
  tag: string; // hex
  data: string; // hex ciphertext
}

function encryptPayload(plain: string, key: Buffer): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require("crypto") as typeof import("crypto");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: EncryptedEnvelope = { v: 1, iv: iv.toString("hex"), tag: tag.toString("hex"), data: enc.toString("hex") };
  return JSON.stringify(envelope);
}

function decryptPayload(payload: string, key: Buffer): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require("crypto") as typeof import("crypto");
  const envelope = JSON.parse(payload) as EncryptedEnvelope;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "hex"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
  const plain = Buffer.concat([decipher.update(Buffer.from(envelope.data, "hex")), decipher.final()]);
  return plain.toString("utf8");
}

function normalizeKey(key?: string): Buffer | null {
  if (!key) return null;
  const hex = key.startsWith("0x") ? key.slice(2) : key;
  // Accept 64 hex chars (32 bytes) or any utf8 string (sha256'd to 32 bytes).
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, "hex");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * File-backed commitment store (Node.js). Survives crashes between commit and
 * reveal — a restarted agent can still reveal its bid. Writes are atomic
 * (tmp file + rename). When `key` is provided, the file is encrypted with
 * AES-256-GCM; without a key it writes plain JSON (demo only).
 */
export class JsonFileCommitmentStore implements CommitmentStore {
  private readonly filePath: string;
  private readonly key: Buffer | null;

  constructor(filePath: string, key?: string) {
    this.filePath = filePath;
    this.key = normalizeKey(key);
    if (!this.key) {
      // eslint-disable-next-line no-console
      console.warn(
        `[hushwire] JsonFileCommitmentStore: no encryption key — ${filePath} holds commit salts in PLAINTEXT. ` +
          `Pass a key (e.g. from env HUSHWIRE_SALT_KEY) for AES-256-GCM at rest.`
      );
    }
  }

  private keyOf(roundId: number, bidder: string): string {
    return `${roundId}:${bidder.toLowerCase()}`;
  }

  /**
   * Always re-read the file before mutating: multiple store instances (e.g.
   * several agents sharing one file) must never clobber each other's records.
   */
  private readFromDisk(): Map<string, CommitmentRecord> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    if (!fs.existsSync(this.filePath)) return new Map();
    const raw = fs.readFileSync(this.filePath, "utf8");
    try {
      const plain = this.key ? decryptPayload(raw, this.key) : raw;
      return fromPersisted(JSON.parse(plain));
    } catch {
      // Corrupt or wrong key — start fresh rather than bricking reveals.
      return new Map();
    }
  }

  private writeToDisk(map: Map<string, CommitmentRecord>): void {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    const plain = JSON.stringify(toPersisted(map));
    const payload = this.key ? encryptPayload(plain, this.key) : plain;
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, payload, "utf8");
    fs.renameSync(tmp, this.filePath);
  }

  async save(roundId: number, bidder: string, rec: CommitmentRecord): Promise<void> {
    const map = this.readFromDisk();
    map.set(this.keyOf(roundId, bidder), rec);
    this.writeToDisk(map);
  }

  async load(roundId: number, bidder: string): Promise<CommitmentRecord | null> {
    return this.readFromDisk().get(this.keyOf(roundId, bidder)) ?? null;
  }
}

/**
 * Browser localStorage-backed commitment store. Survives page reloads between
 * commit and reveal. Stores plaintext (web crypto key management is out of
 * scope) — treat localStorage as the agent's own device storage.
 */
export class LocalStorageCommitmentStore implements CommitmentStore {
  private readonly storageKey: string;

  constructor(storageKey = "hushwire.commitments") {
    this.storageKey = storageKey;
  }

  private read(): Map<string, CommitmentRecord> {
    if (typeof localStorage === "undefined") return new Map();
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return new Map();
    try {
      return fromPersisted(JSON.parse(raw));
    } catch {
      return new Map();
    }
  }

  private write(map: Map<string, CommitmentRecord>): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(this.storageKey, JSON.stringify(toPersisted(map)));
  }

  private keyOf(roundId: number, bidder: string): string {
    return `${roundId}:${bidder.toLowerCase()}`;
  }

  async save(roundId: number, bidder: string, rec: CommitmentRecord): Promise<void> {
    const map = this.read();
    map.set(this.keyOf(roundId, bidder), rec);
    this.write(map);
  }

  async load(roundId: number, bidder: string): Promise<CommitmentRecord | null> {
    return this.read().get(this.keyOf(roundId, bidder)) ?? null;
  }
}
