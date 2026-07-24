# HushWire — Agent SDK & Keeper Design

**Status:** Design sketch (next build step)
**Goal:** Turn HushWire from "a human runs a script" into "agents negotiate and settle autonomously."

The smart contracts already support full autonomy — they are permissionless functions anyone can
call. What's missing is the **triggering layer**: a library agents call (`@hushwire/sdk`) and a
service that automates time-sensitive on-chain actions (`@hushwire/keeper`).

---

## Architecture

```
┌─────────────────┐        ┌──────────────────┐
│  AI Agent       │        │  AI Agent        │
│  (buyer)        │        │  (seller)        │
└────────┬────────┘        └────────┬─────────┘
         │  openRound / commitBid   │  commitBid / revealBid
         │  revealBid / settle      │
         ▼                          ▼
┌─────────────────────────────────────────────┐
│            @hushwire/sdk                     │
│  HushWireClient — high-level, signer-aware   │
│  • commitment (salt) generation + storage    │
│  • lifecycle helpers + reads                 │
│  • adapters: MCP tool, x402 handler          │
└──────────────────────┬──────────────────────┘
                       │ ethers v6
                       ▼
┌─────────────────────────────────────────────┐
│   Flare (Coston2 → Mainnet)                  │
│   SealedBidAuction · HushWireVault · FXRP    │
│        ▲                                     │
└────────┼─────────────────────────────────────┘
         │ watches events / polls state
┌────────┴────────────────────────────────────┐
│            @hushwire/keeper                  │
│  Watcher → Strategies → TxManager            │
│  • SettlementExecutor (fire executeSettlement)│
│  • RefundProtector (recover expired escrow)   │
│  • AutoSettler (settle matured auctions)      │
└──────────────────────────────────────────────┘
```

Two independent packages, both talking to the same deployed contracts.

---

## 1. `@hushwire/sdk` — the Agent SDK

### Goals
- Give an agent a **clean, high-level API** over the raw contract functions.
- Hide the commit-reveal cryptography (salt generation, hashing, storage).
- Be **framework-agnostic** (plain TS), with thin adapters for agent frameworks.

### Config

```ts
export interface HushWireConfig {
  rpcUrl: string;
  chainId?: number;                 // default 114 (Coston2)
  signer: ethers.Signer;            // the agent's wallet — signs its own txs
  contracts: {
    auction: string;                // SealedBidAuction
    vault: string;                  // HushWireVault
    fasset: string;                 // FXRP token
  };
  commitmentStore?: CommitmentStore; // defaults to in-memory
}
```

### Core API — `HushWireClient`

```ts
export class HushWireClient {
  constructor(config: HushWireConfig);

  // ── Negotiation (SealedBidAuction) ──────────────────────────
  /** Open a sealed-bid round. Returns the on-chain round id. */
  openRound(opts: {
    reservePrice: bigint;
    commitSeconds: number;
    revealSeconds: number;
    asset?: string;                 // defaults to configured FXRP
  }): Promise<{ roundId: number; txHash: string }>;

  /** Commit a sealed bid. Generates + stores the salt; only the hash goes on-chain. */
  commitBid(roundId: number, amount: bigint): Promise<{ txHash: string }>;

  /** Reveal a previously committed bid using the stored salt. */
  revealBid(roundId: number): Promise<{ txHash: string; amount: bigint }>;

  /** Settle the round (creator only). Returns winner + winning amount. */
  settle(roundId: number): Promise<{ txHash: string; winner: string; amount: bigint }>;

  // ── Settlement (HushWireVault) ──────────────────────────────
  /** Approve the vault to pull FXRP. */
  approveFAsset(amount: bigint): Promise<string>;

  /** Escrow FXRP for a payee. Auto-approves if allowance is insufficient. */
  escrow(opts: {
    payee: string;
    amount: bigint;
    durationSeconds: number;
  }): Promise<{ settlementId: number; txHash: string }>;

  /** Execute a settlement given an enclave attestation proof. */
  execute(settlementId: number, proof: ethers.BytesLike): Promise<string>;

  /** Refund an expired escrow (payer only). */
  refund(settlementId: number): Promise<string>;

  // ── Reads ───────────────────────────────────────────────────
  getRound(roundId: number): Promise<RoundView>;
  getSettlement(settlementId: number): Promise<SettlementView>;
  getPhase(roundId: number): Promise<AuctionPhase>;   // COMMIT | REVEAL | SETTLED | ENDED
  hasCommitted(roundId: number, bidder?: string): Promise<boolean>;

  // ── High-level (one-shot flows) ─────────────────────────────
  /** Wait for a round to reach a target phase (chain-time aware). */
  waitForPhase(roundId: number, phase: AuctionPhase): Promise<void>;
}
```

### Commitment (salt) management

The commit-reveal scheme requires the *same* salt at reveal that was used at commit. The SDK
generates it, hashes it, and persists it keyed by `(roundId, bidder)`.

```ts
// commitment.ts
export function makeCommitment(amount: bigint): { salt: Uint8Array; hash: string } {
  const salt = ethers.randomBytes(32);
  const hash = ethers.keccak256(
    ethers.solidityPacked(["uint256", "bytes32"], [amount, salt])
  );
  return { salt, hash };
}

export interface CommitmentStore {
  save(roundId: number, bidder: string, rec: { amount: bigint; salt: Uint8Array }): Promise<void>;
  load(roundId: number, bidder: string): Promise<{ amount: bigint; salt: Uint8Array } | null>;
}

// Default: in-memory Map. Production: encrypt-at-rest store (the salt is sensitive —
// anyone with it can precompute the bid hash before reveal).
export class MemoryCommitmentStore implements CommitmentStore { /* … */ }
```

> **Security note:** the salt must stay secret until reveal. The in-memory store is fine for a
> demo; a production agent would use an encrypted keystore or an enclave-backed store.

### Framework adapters

The core SDK is plain TypeScript. Adapters expose it to agent runtimes:

- **MCP tool** (`adapters/mcp.ts`) — register HushWire operations as MCP tools so any
  MCP-capable agent can `open_round`, `commit_bid`, `settle`, etc. This is the strongest fit for
  the "agent economy" narrative.
- **x402 handler** (`adapters/x402.ts`) — on HTTP 402 (payment-required), settle the invoice via
  HushWire and return the `X-PAYMENT` header. Bridges HushWire to pay-per-request agent APIs.

Adapters are thin wrappers over `HushWireClient`; they add no new on-chain logic.

---

## 2. `@hushwire/keeper` — the automation service

### Goals
- Fire **time-sensitive** on-chain actions without a human or an agent staying online.
- Be **idempotent** and **crash-safe** — re-check state before every transaction.
- Be **strategy-driven** so new automations plug in without touching the core loop.

### Config

```ts
export interface KeeperConfig {
  rpcUrl: string;
  signer: ethers.Signer;            // keeper wallet — pays gas
  contracts: { auction: string; vault: string };
  pollIntervalMs?: number;          // default 15_000
  strategies: Strategy[];
}

export interface Strategy {
  name: string;
  /** Inspect chain state; return actions worth taking. Must be read-only. */
  scan(ctx: ScanContext): Promise<Action[]>;
}

export type Action =
  | { type: "execute-settlement"; id: number; proof: ethers.BytesLike }
  | { type: "refund"; id: number }
  | { type: "settle-auction"; id: number };

export interface ScanContext {
  auction: ethers.Contract;
  vault: ethers.Contract;
  now: bigint;                      // latest block timestamp
  keeperAddress: string;
}
```

### Strategies

| Strategy | Watches | Acts when | Calls |
|----------|---------|-----------|-------|
| **SettlementExecutor** | `settlements(i)` | not executed/refunded, within deadline, verifier passes | `executeSettlement(id, proof)` |
| **RefundProtector** | `settlements(i)` | past deadline, keeper is the payer | `refund(id)` |
| **AutoSettler** | `auctions(i)` | past reveal deadline, not settled, keeper is creator | `settle(id)` |

With the **mock verifier**, `SettlementExecutor` can execute any live settlement immediately
(proof is unconstrained). With the **real Flare verifier**, the keeper must obtain the attestation
proof from the enclave before it can execute — that hand-off is the one production dependency.

### Core loop + reliability

```ts
// index.ts (sketch)
async function run(cfg: KeeperConfig) {
  const txm = new TxManager(cfg.signer);
  const seen = new Set<string>();                 // dedupe across polls

  for (;;) {
    const ctx = await buildScanContext(cfg);
    for (const strategy of cfg.strategies) {
      const actions = await strategy.scan(ctx);
      for (const a of actions) {
        const key = `${a.type}:${a.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // Re-verify on-chain right before sending (state may have changed).
        if (!(await stillValid(ctx, a))) continue;
        await txm.submit(a);                      // nonce + gas + retry
      }
    }
    await sleep(cfg.pollIntervalMs ?? 15_000);
  }
}
```

`TxManager` responsibilities:
- **Nonce management** — sequential nonces for back-to-back actions.
- **Gas** — estimate + a sensible buffer for testnet volatility.
- **Retries** — retry on transient RPC errors; drop on deterministic reverts.
- **Idempotency** — every strategy re-reads state before sending, so a restarted keeper never
  double-executes.

---

## 3. Mapping to the existing contracts

| SDK / Keeper call | Contract function |
|-------------------|-------------------|
| `openRound` | `SealedBidAuction.createAuction` |
| `commitBid` | `SealedBidAuction.commitBid` (hash from `makeCommitment`) |
| `revealBid` | `SealedBidAuction.revealBid` (stored salt) |
| `settle` / AutoSettler | `SealedBidAuction.settle` |
| `escrow` | `FXRP.approve` + `HushWireVault.createSettlement` |
| `execute` / SettlementExecutor | `HushWireVault.executeSettlement` |
| `refund` / RefundProtector | `HushWireVault.refund` |
| `getRound` / `getPhase` | `SealedBidAuction.auctions` + `getBidders` |
| `getSettlement` | `HushWireVault.settlements` |

No contract changes are required — the SDK and keeper build entirely on the deployed ABI.

---

## 4. Proposed folder structure

```
HushWire/
├── sdk/
│   ├── package.json              # @hushwire/sdk
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # exports HushWireClient
│       ├── client.ts             # HushWireClient
│       ├── commitment.ts         # makeCommitment + CommitmentStore
│       ├── types.ts
│       └── adapters/
│           ├── mcp.ts            # MCP tool wrapper
│           └── x402.ts           # HTTP 402 payment handler
├── keeper/
│   ├── package.json              # @hushwire/keeper
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # run loop + CLI entry
│       ├── watcher.ts            # buildScanContext / polling
│       ├── tx-manager.ts
│       └── strategies/
│           ├── settlement-executor.ts
│           ├── refund-protector.ts
│           └── auto-settler.ts
└── examples/
    └── two-agents.ts             # SDK demo: two clients negotiate + settle
```

---

## 5. Implementation phases

| Phase | Deliverable | Effort |
|-------|-------------|--------|
| **P1 — SDK core** | `HushWireClient` + commitment store + reads; `examples/two-agents.ts` runs a full negotiation via the SDK (replaces the hand-rolled simulator logic) | ~1 day |
| **P2 — Keeper core** | Run loop + `TxManager` + `SettlementExecutor`; keeper auto-executes the settlement the SDK created | ~1 day |
| **P3 — Remaining strategies** | `RefundProtector` + `AutoSettler` | ~0.5 day |
| **P4 — Adapters** | MCP tool wrapper (headline feature for the agent-economy story); optional x402 handler | ~1 day |
| **P5 — Hardening** | Encrypted commitment store, WebSocket subscriptions (replace polling), metrics/logging | ongoing |

P1 + P2 give a complete autonomous loop: **agents negotiate via the SDK, the keeper settles.**

---

## 6. Risks & open questions

- **Real attestation hand-off:** with the mock verifier the keeper can execute freely; with Flare's
  real Confidential Compute verifier, the keeper needs the enclave's proof. The exact API for
  retrieving that proof from Flare is the main unknown to resolve in P4/P5.
- **Salt secrecy:** the in-memory commitment store leaks the salt if the agent process is
  compromised. Production needs encrypted storage.
- **Public RPC limits:** the keeper polls; on a busy mainnet it should move to WebSocket
  subscriptions (P5) to stay under rate limits and reduce latency.
- **Keeper funding:** the keeper wallet needs gas. For the demo it's the deployer; production
  needs a funded, possibly rotated, keeper key.
