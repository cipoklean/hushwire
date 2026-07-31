# HushWire Architecture

## Overview

HushWire is a three-layer protocol:

1. **Negotiation Layer** (`SealedBidAuction`) — Commit-reveal auction for private price discovery
2. **Verification Layer** (`IEnclaveVerifier` → Flare Confidential Compute) — Attestation that terms match
3. **Settlement Layer** (`HushWireVault` + FAssets) — Atomic on-chain settlement with escrow

## Contracts

| Contract | Role |
|----------|------|
| `SealedBidAuction.sol` | Commit-reveal sealed-bid auctions. One commit per bidder; hashes hide amounts until reveal. |
| `HushWireVault.sol` | Escrows FAssets and releases them only when the verifier attests the exact settlement terms. |
| `interfaces/IEnclaveVerifier.sol` | Interface the vault calls to verify a settlement before release. |
| `MockEnclaveVerifier.sol` | **Testnet only.** Attests every settlement. Swapped for Flare's real verifier on mainnet. |
| `MockRejectingVerifier.sol` | **Test helper.** Always rejects — used to assert the vault blocks bad attestations. |
| `MockFAsset.sol` | **Testnet only.** Mock FXRP ERC20 with a public faucet. Replaced by the real FAsset on mainnet. |

## Contract Interactions

```
┌────────────────────────────────────────────────────────────────┐
│                        HushWire Protocol                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────┐     ┌──────────────────┐                │
│  │ SealedBidAuction │     │  MockFAsset      │                │
│  │                  │     │  (FXRP ERC20)    │                │
│  │ - createAuction  │     │                  │                │
│  │ - commitBid      │     │ - faucet()       │                │
│  │ - revealBid      │     │ - transfer()     │                │
│  │ - settle         │     │ - approve()      │                │
│  └────────┬─────────┘     └────────┬─────────┘                │
│           │  winner determined     │  tokens escrowed          │
│           ▼                        ▼                           │
│  ┌──────────────────────────────────────────┐                 │
│  │           HushWireVault                   │                 │
│  │                                           │                 │
│  │  - createSettlement (escrow FXRP)         │                 │
│  │  - executeSettlement (verifier-gated)     │                 │
│  │  - refund (payer, after deadline)         │                 │
│  └──────────────────────┬───────────────────┘                 │
│                         │  verify(terms, proof)               │
│                         ▼                                     │
│  ┌──────────────────────────────────────────┐                 │
│  │   IEnclaveVerifier                        │                 │
│  │   ├─ MockEnclaveVerifier (testnet)        │                 │
│  │   └─ Flare Confidential Compute (mainnet) │                 │
│  │                                           │                 │
│  │   Returns true only if the attestation    │                 │
│  │   proves both agents agreed to THESE      │                 │
│  │   exact terms privately. Terms never      │                 │
│  │   touch the chain.                        │                 │
│  └──────────────────────────────────────────┘                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Security Model

| Threat | Mitigation |
|--------|-----------|
| Bid front-running | Commit-reveal scheme: only hashes visible during the commit phase |
| Duplicate-commit griefing | `hasCommitted` flag — one commit per bidder per auction |
| Term leakage | Verification happens in a TEE via `IEnclaveVerifier`; terms stay off-chain |
| Escrow theft / unauthorized release | `executeSettlement` is gated by `verifier.verify()` over the exact terms — **no privileged caller can force a release** |
| Owner draining escrow | Owner can only rotate the verifier / transfer ownership; it **cannot** execute or refund settlements |
| Reentrancy | OpenZeppelin `ReentrancyGuard` on all vault state-changing functions |
| Non-standard ERC20 return values | `SafeERC20` for all token transfers |
| Replay / double-spend | Unique settlement IDs; `executed`/`refunded` flags |
| Invalid input | Zero-address, zero-amount, zero-duration, and zero-hash guards |

## Data Flow

### What's PUBLIC (on-chain):
- Auction existence and parameters (reserve price, deadlines)
- Commit hashes (not amounts)
- Revealed bid amounts (after the reveal phase)
- Settlement execution (payer, payee, amount)
- Enclave attestation hash (proof it happened, not what was verified)

### What's PRIVATE (never on-chain):
- Bid amounts during the commit phase
- Negotiation strategy / bidding patterns
- Enclave verification details (what exactly was compared)
- Agent identity linking (agents can use fresh wallets per negotiation)

## Testnet vs Mainnet

| Component | Coston2 (now) | Mainnet (production) |
|-----------|---------------|----------------------|
| Settlement asset | `MockFAsset` (faucet-minted) | Real FAsset ERC20 from the FAssetManager system |
| Attestation | `SignatureVerifier` (authority = deployer) | Flare Confidential Compute's on-chain attestation verifier (FCE) |
| Swap path | — | `HushWireVault.setVerifier(realVerifier)` — one address change |

The mocks are flagged on-chain (`IS_MOCK` / `IS_TEST_TOKEN`) so tooling can assert it is not talking to production contracts.

### Deployed Contracts (Coston2)

| Contract | Address |
|----------|---------|
| MockFAsset (FXRP) | `0x7d59e809DB91270Dfd788956FA1E4d6E915F0E28` |
| SealedBidAuction | `0x75F74f18B126fc3f95AFe19BB367A9a6b3a5C7fC` |
| HushWireVault | `0x3b55807B50e0217efCab081AAD3C051C57a3D505` |
| SignatureVerifier (authority = deployer) | `0x059F2780132a1d5bb54E1cAab7675C8338124d71` |

Deployed: 2026-07-23 · Network: Flare Coston2 (Chain ID 114) · [Explorer](https://coston2-explorer.flare.network)

> ⚠️ The `SignatureVerifier` uses the deployer as the attestation authority, performing real EIP-191 signature verification over exact settlement terms. On mainnet, rotate `HushWireVault.setVerifier()` to a Flare Compute Extension verifier, and replace `MockFAsset` with the real FAsset ERC20.

## Deployment Targets

| Network | Chain ID | Purpose |
|---------|----------|---------|
| Coston2 | 114 | Development & hackathon demo |
| Songbird | 19 | Canary testing |
| Flare Mainnet | 14 | Production |

## Frontend (Vercel)

- `/` — Landing page with a live intercept feed and the deployed contract registry
- `/dashboard` — Settlement console (rounds + ledger)
- `/agents` — Agent negotiation simulator
- `/api/simulate` — Serverless endpoint for triggering simulations

The UI reads contract addresses from `src/lib/addresses.json`, which the deploy script regenerates — so a redeploy updates the frontend automatically. No persistent server; all state lives on-chain.
