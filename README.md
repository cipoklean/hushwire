# HushWire

**Private negotiations. Public settlement.**

HushWire is a confidential agent-to-agent payment protocol on Flare. Autonomous agents negotiate payment terms in complete privacy using Flare Confidential Compute, then settle atomically with FAssets on-chain. Nobody sees the bid strategy. Everyone sees the settlement proof.

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

1. **Sealed-Bid Negotiation** — Agents commit hashed bids on-chain. Amounts stay hidden until the reveal phase.
2. **Confidential Verification** — Flare Confidential Compute enclaves verify both parties agreed to the same terms *privately*, without exposing negotiation details.
3. **Atomic FAsset Settlement** — Once verified, HushWireVault releases escrowed FXRP (or any FAsset) atomically. Settlement is public. Terms remain private.

---

## How HushWire Uses Flare

| Flare Feature | Usage |
|---------------|-------|
| **FAssets (FXRP)** | Settlement asset — agents escrow and transfer FXRP for cross-chain payment finality |
| **Confidential Compute** | Private verification that both parties agreed to terms — the enclave attests without leaking terms |
| **EVM Smart Contracts** | SealedBidAuction + HushWireVault contracts handle the full negotiation-to-settlement lifecycle |
| **Coston2 Testnet** | All contracts deployed and tested on Coston2 |

This is **not** a superficial integration. FAssets are the settlement layer. Confidential Compute is the trust layer. Remove either and the product doesn't work.

---

## What Was Newly Built During the Hackathon

Everything. This project was built from scratch during Flare Summer Signal:

- `SealedBidAuction.sol` — Commit-reveal sealed-bid auction protocol
- `HushWireVault.sol` — Escrow vault with verifier-gated atomic settlement
- `IEnclaveVerifier.sol` + `MockEnclaveVerifier.sol` — pluggable attestation gate for Confidential Compute verification
- `MockFAsset.sol` — FXRP mock for Coston2 testing
- Next.js dashboard with live settlement view
- Agent simulator (autonomous negotiation demo)
- Vercel serverless API for simulation triggers

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
      │                                    │
      ├── SETTLE (pick winner) ───────────►│
      │                                    │
      │         ┌─────────────────┐        │
      │         │  FLARE ENCLAVE  │        │
      │         │  (Confidential  │        │
      │         │   Compute)      │        │
      │         │  verifies both  │        │
      │         │  agreed PRIVATELY│       │
      │         └────────┬────────┘        │
      │                  │                 │
      │◄──── ATTESTATION PROOF ───────────►│
      │                                    │
      ├── HushWireVault.execute() ────────►│
      │   (releases FXRP from escrow)      │
      │                                    │
      ▼         ON-CHAIN PROOF             ▼
        Settlement public. Terms private.
```

---

## Smart Contract Addresses (Coston2)

| Contract | Address |
|----------|---------|
| MockFAsset (FXRP) | `0xed0b4da8513bd767B693122b4A53Cf4f903ee633` |
| SealedBidAuction | `0x472098a25E85D1f99373ea2D8161d30bFc921bB1` |
| HushWireVault | `0xBb45952B02D034600B5355FA67794B6980334fc2` |
| SignatureVerifier (authority = deployer) | `0x381f654BA74e7F18B320A355Cca8A339d8f9d120` |

Deployed: 2026-08-09 · Network: Flare Coston2 (Chain ID 114) · [Explorer](https://coston2-explorer.flare.network)

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

# Run the autonomous agent simulation (two agents negotiate + keeper settles on-chain)
npm run simulate   # alias: npm run sdk:example
```

---

## Roadmap / Next Steps

1. **Mainnet deployment** — Deploy to Flare Mainnet with real FXRP FAssets
2. **Real Confidential Compute integration** — Connect to Flare's production enclave API for attestation
3. **Agent SDK** — TypeScript SDK for any agent framework (LangChain, AutoGPT, MCP) to use HushWire
4. **x402 protocol integration** — Support HTTP 402 payment flows for agent-to-API payments
5. **Multi-asset support** — Enable FBTC, FDOGE, and other FAssets as settlement tokens
6. **Reputation layer** — On-chain agent reputation based on settlement history (public proof, private terms)

---

## Traction Signals

- [ ] Deployed on Coston2 with working demo
- [ ] Agent simulation runs end-to-end
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
