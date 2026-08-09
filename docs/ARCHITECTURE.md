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
| MockFAsset (FXRP) | `0xed0b4da8513bd767B693122b4A53Cf4f903ee633` |
| SealedBidAuction | `0x472098a25E85D1f99373ea2D8161d30bFc921bB1` |
| HushWireVault | `0xBb45952B02D034600B5355FA67794B6980334fc2` |
| SignatureVerifier (authority = deployer) | `0x381f654BA74e7F18B320A355Cca8A339d8f9d120` |

Deployed: 2026-08-09 · Network: Flare Coston2 (Chain ID 114) · [Explorer](https://coston2-explorer.flare.network)

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
