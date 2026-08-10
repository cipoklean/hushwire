# HushWire

**Private negotiations. Public settlement.**

HushWire is a confidential agent-to-agent payment protocol on Flare. Autonomous agents negotiate payment terms in complete privacy — bids stay sealed until reveal — then settle atomically with FAssets on-chain. Attestation is operator-signed (EIP-191) today, with Flare Confidential Compute as the production path. Nobody sees the bid strategy. Everyone sees the settlement proof.

---

## Submission Details

| Field | Value |
|-------|-------|
| **Project Name** | HushWire |
| **Selected Bounties** | Bounty 1 (Interoperable Asset Products) + Bounty 2 (Confidential Compute Apps) |
| **Target User** | Autonomous AI agents, OTC desks, and any party needing private negotiation with public settlement finality |
| **Demo Link** | https://hushwire-eight.vercel.app |
| **GitHub Repo** | [This repo] |
| **Network** | Flare Coston2 (testnet) |

---

## Product Description

In the emerging agent economy, autonomous AI agents need to negotiate prices (for compute, data, API access) without leaking their bidding strategy to competitors. Today, all on-chain negotiation is public — agents get front-run, prices get gamed.

**HushWire solves this:**

1. **Sealed-Bid Negotiation** — Agents commit hashed bids on-chain, backed by escrowed bid amounts. Amounts stay hidden until the reveal phase.
2. **Verified Attestation** — A real EIP-191 signature over the exact settlement terms proves both parties agreed, without exposing the negotiation (operator-signed today; Flare Confidential Compute is the production path).
3. **Atomic FAsset Settlement** — `settleAndPay` settles the round and releases escrowed FXRP (or any FAsset) in a single transaction, gated by the attestation. Settlement is public. Terms remain private.

---

## How HushWire Uses Flare

| Flare Feature | Usage |
|---------------|-------|
| **FAssets (FXRP)** | Settlement asset — agents escrow and transfer FXRP for cross-chain payment finality |
| **Confidential Compute** | Production attestation path — a TEE attests mutual agreement without leaking terms. Today the gate is operator-signed EIP-191 (`SignatureVerifier`); the verifier interface already matches the FCC shielded-transfer pattern |
| **EVM Smart Contracts** | SealedBidAuction + HushWireVault contracts handle the full negotiation-to-settlement lifecycle |
| **Coston2 Testnet** | All contracts deployed and tested on Coston2 |

This is **not** a superficial integration. FAssets are the settlement layer. Attestation (operator-signed EIP-191 today, Flare Confidential Compute in production) is the trust layer. Remove either and the product doesn't work.

---

## What Was Newly Built During the Hackathon

Everything. This project was built from scratch during Flare Summer Signal:

- `SealedBidAuction.sol` — Commit-reveal sealed-bid auction with escrowed bids, creator-bid ban, permissionless settle, and atomic `settleAndPay`
- `HushWireVault.sol` — Escrow vault with verifier-gated atomic settlement
- `IEnclaveVerifier.sol` — pluggable attestation gate; `SignatureVerifier.sol` (real EIP-191, operator-signed) is what's deployed on Coston2; `MockEnclaveVerifier` is a test helper
- `MockFAsset.sol` — FXRP mock for Coston2 testing
- Next.js web console with a LIVE on-chain event feed and settlement dashboard
- Agent SDK + keeper + MCP server — autonomous negotiation, execution, and agent access
- Crash-safe commit-salt storage (AES-256-GCM file store / browser localStorage)

---

## Architecture

```
Agent A (Buyer)                    Agent B/C (Sellers)
      │                                    │
      ├── CREATE AUCTION ──────────────────►│
      │                                    │
      │◄────────── COMMIT BID (hash) ──────┤  ← amount hidden
      │                                    │
      │         [commit deadline]          │
      │                                    │
      │◄────────── REVEAL BID ─────────────┤  ← amount shown
      │◄────────── ESCROW BID ─────────────┤  ← bidder funds their bid
      │                                    │
      │         [reveal deadline]          │
      │                                    │
      │◄──── getWinner() → C @ 1020 ───────┤
      │                                    │
      ├── escrow payment in vault ────────►│
      │   (payee = winner, 1020 FXRP)      │
      │                                    │
      │◄──── ATTESTATION (EIP-191) ────────┤  ← operator-signed today,
      │                                    │     Flare Confidential
      │                                    │     Compute in production
      ├── settleAndPay() ─────────────────►│  ← ONE transaction:
      │   (round settle + vault release)   │     round settles, payment
      │                                    │     releases, escrows refund
      ▼         ON-CHAIN PROOF             ▼
        Settlement public. Terms private.
```

---

## Smart Contract Addresses (Coston2)

| Contract | Address |
|----------|---------|
| MockFAsset (FXRP) | `0x8d0E895eC10EBfaaC4C13f48862C4A25177B49fE` |
| SealedBidAuction | `0xCc68Ae95D2Bb23Ffed211e39287228939dA6e8e8` |
| HushWireVault | `0xeaC96028664f15719586bc4290f94a664Fa1805F` |
| SignatureVerifier (authority = deployer) | `0xd316fB982AB5630d3139D058853f25DB81B47146` |

Deployed: 2026-08-10 · Network: Flare Coston2 (Chain ID 114) · [Explorer](https://coston2-explorer.flare.network)

> ⚠️ The `SignatureVerifier` is an **authority-based verifier** (deployer = authority) that performs real EIP-191 signature verification over exact settlement terms. On mainnet, rotate `HushWireVault.setVerifier()` to Flare Confidential Compute's real attestation verifier (a Flare Compute Extension), and replace `MockFAsset` with the real FAsset ERC20.

---

## Tech Stack

- **Contracts:** Solidity 0.8.24, Hardhat, OpenZeppelin
- **Frontend:** Next.js 14, Tailwind CSS, ethers.js v6
- **Deployment:** Vercel (frontend), Flare Coston2 (contracts)
- **Agent Sim:** TypeScript, ethers.js

---

## Running Locally

```bash
# Install dependencies
npm install
cd contracts && npm install && cd ..

# Deploy to Coston2 (requires .env with DEPLOYER_PRIVATE_KEY)
npm run deploy:coston2

# Run frontend
npm run dev

# Run the autonomous agent simulation (two agents negotiate; authority-signed
# settleAndPay settles + pays in ONE on-chain transaction)
npm run simulate   # alias: npm run sdk:example

# Start the MCP server (exposes HushWire as agent-callable tools over stdio)
npm run mcp
```

---

## Roadmap / Next Steps

1. **Mainnet deployment** — Deploy to Flare Mainnet with real FXRP FAssets
2. **Production verifier** — Deploy the HushWire Flare Compute Extension so Flare Confidential Compute (FCC) performs the attestation (FCC API is still pre-production)
3. **Agent adapters** — x402 (HTTP 402) payment handler + framework integrations for the shipped TypeScript SDK
4. **Multi-asset support** — Enable FBTC, FDOGE, and other FAssets as settlement tokens
5. **WebSocket subscriptions** — replace keeper/dashboard polling with event streams
6. **Reputation layer** — On-chain agent reputation based on settlement history (public proof, private terms)

---

## Traction Signals

- [x] Deployed on Coston2 with working demo
- [x] Agent simulation runs end-to-end
- [ ] [Add: pilot interest from agent builders / OTC desks]
- [ ] [Add: community feedback from Flare Telegram]

---

## Team

| Name | Role |
|------|------|
| Aghazie David | Full-stack / Contracts |

---

## License

MIT
