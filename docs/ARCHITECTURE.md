# HushWire Architecture

## Overview

HushWire is a three-layer protocol:

1. **Negotiation Layer** (SealedBidAuction) — Commit-reveal auction for private price discovery
2. **Verification Layer** (Flare Confidential Compute) — Private attestation that terms match
3. **Settlement Layer** (HushWireVault + FAssets) — Atomic on-chain settlement with escrow

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
│           │                        │                           │
│           │  winner determined     │  tokens escrowed          │
│           ▼                        ▼                           │
│  ┌──────────────────────────────────────────┐                 │
│  │           HushWireVault                   │                 │
│  │                                           │                 │
│  │  - createSettlement (escrow FXRP)         │                 │
│  │  - executeSettlement (enclave proof)      │                 │
│  │  - refund (deadline expiry)               │                 │
│  └──────────────────────┬───────────────────┘                 │
│                         │                                     │
│                         │  attestation request                │
│                         ▼                                     │
│  ┌──────────────────────────────────────────┐                 │
│  │   Flare Confidential Compute (external)   │                 │
│  │                                           │                 │
│  │   - Receives encrypted terms from both    │                 │
│  │     parties                               │                 │
│  │   - Verifies mutual agreement             │                 │
│  │   - Returns signed attestation proof      │                 │
│  │   - NEVER exposes terms on-chain          │                 │
│  └──────────────────────────────────────────┘                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Security Model

| Threat | Mitigation |
|--------|-----------|
| Bid front-running | Commit-reveal scheme: only hashes visible during commit phase |
| Term leakage | Confidential Compute enclave: verification happens off-chain in TEE |
| Escrow theft | HushWireVault: funds only released with valid enclave attestation or after deadline refund |
| Reentrancy | OpenZeppelin ReentrancyGuard on all vault state-changing functions |
| Replay attacks | Settlement IDs are unique; executed/refunded flags prevent double-spend |

## Data Flow

### What's PUBLIC (on-chain):
- Auction existence and parameters (reserve price, deadlines)
- Commit hashes (not amounts)
- Revealed bid amounts (after reveal phase)
- Settlement execution (payer, payee, amount)
- Enclave attestation hash (proof it happened, not what was verified)

### What's PRIVATE (never on-chain):
- Bid amounts during commit phase
- Negotiation strategy / bidding patterns
- Enclave verification details (what exactly was compared)
- Agent identity linking (agents can use fresh wallets per negotiation)

## Deployment Targets

| Network | Chain ID | Purpose |
|---------|----------|---------|
| Coston2 | 114 | Development & hackathon demo |
| Songbird | 19 | Canary testing |
| Flare Mainnet | 14 | Production |

## Frontend (Vercel)

- `/` — Landing page with protocol explanation
- `/dashboard` — Live settlement and auction view (reads chain state)
- `/agents` — Agent negotiation simulator (client-side demo)
- `/api/simulate` — Serverless endpoint for triggering simulations

No persistent server. All state lives on-chain. Vercel serves the UI and lightweight API routes.
