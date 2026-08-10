# HushWire — Flare Summer Signal Submission

> Copy each numbered section into the corresponding DoraHacks field.
> **[PENDING]** marks the two items left: the public GitHub repo URL and the demo video.

---

## 1. Project name

**HushWire** — *Private negotiations. Public settlement.*

---

## 2. Selected bounty or bounties

- **Bounty 1 — Interoperable Asset Products** — settlement is performed in **FXRP**, a Flare FAsset.
- **Bounty 2 — Confidential Compute Apps** — settlement is gated by an attestation verifier built for
  **Flare Confidential Compute**: operator-signed **EIP-191** on testnet today, a **Flare Compute
  Extension (FCE)** in production. The verifier interface already matches the FCC shielded-transfer
  pattern (see `docs/FCC_INTEGRATION.md`).

---

## 3. Short product description

HushWire is a settlement rail for autonomous agents. Agents negotiate price **privately** through a
commit–reveal sealed-bid auction; bidders back their bids with escrowed amounts; the winning terms are
**attested** (real EIP-191 signature over the exact terms — operator-signed today, Flare Confidential
Compute on the production path); and the payment **settles atomically on Flare in FXRP**:
`settleAndPay` settles the round and releases the escrowed payment in **one transaction**. The
negotiation strategy never touches the chain — the settlement proof does. In short:
*negotiate in the dark, settle in the light.*

---

## 4. Target user

- **Autonomous AI agents** transacting with each other (compute, data, API access) — the primary user.
- **OTC desks / counterparties** who need private price discovery with public settlement finality.
- **Agent-framework developers**, who integrate via the **MCP server** (9 tools) or the TypeScript **SDK**.

---

## 5. Demo link, video, or working app link

- **Live web console:** **https://hushwire-eight.vercel.app** — landing page with a **live on-chain
  event feed** (real Vault/Auction logs: commits, reveals, escrows, settlements — with block numbers
  and explorer links), plus a dashboard reading live Coston2 state.
- **On-chain demo (live now):** all contracts are deployed on **Coston2** and a full
  negotiation → settlement has been **executed on-chain** via `settleAndPay` (settlement #0,
  1020 FXRP, EXECUTED; the round settle + payment release + escrow refunds happened in a single
  transaction, `0xf9c62e13a36a5b5860d7e09e8fc21d432cbcd276b99b9dbf5695274d170ed7a7`).
  Verify on the explorer: https://coston2-explorer.flare.network
- **Run it yourself (from the repo):**
  - `npm run sdk:example` — two agents run a full **autonomous** negotiation: sealed commits,
    a simulated process restart that reveals bids from **crash-safe persisted salts**, escrowed bids,
    and an authority-signed `settleAndPay` that settles + pays in one tx (~2.5 min, no human in the loop).
  - `npm run mcp` — start the **MCP server**; any MCP-capable agent can call 9 HushWire tools
    (`get_status`, `open_round`, `commit_bid`, `reveal_bid`, `settle_round`, `escrow`, `get_round`,
    `get_settlement`, `mint_test_fxrp`).
  - `npm run dev` — local web console at `http://localhost:3000`.
- **Video:** **[PENDING — 2–3 min demo]** (landing + live feed → dashboard → autonomous negotiation →
  on-chain settlement → MCP tools). Full script: `DEMO_SCRIPT.md`.

---

## 6. GitHub repo / technical materials

- **Repository:** **[PENDING — GitHub push]**
- **In-repo technical materials:**
  - `README.md` — overview, architecture, deployed addresses, run instructions
  - `docs/ARCHITECTURE.md` — system architecture + security model
  - `docs/FCC_INTEGRATION.md` — Flare Confidential Compute / FCE research grounding the verifier design
  - `docs/SDK_KEEPER_DESIGN.md` — SDK/keeper design + the production verifier roadmap (§7)
  - `contracts/test/` — **42 passing tests** (HushWire.test.ts, HushWireV2.test.ts, SignatureVerifier.test.ts)
  - `mcp/README.md` — MCP tool reference + client registration config
  - `DEMO_SCRIPT.md` — full demo-video script

---

## 7. How the project uses Flare

The Flare integration is **structural, not superficial** — remove either primitive and the product
stops working.

| Flare primitive | How HushWire uses it |
|-----------------|----------------------|
| **FAssets (FXRP)** | The settlement asset. Escrow and atomic release happen in FXRP, turning XRP value (which has no native smart contracts) into a programmable settlement token. This is the *interoperable asset product*. |
| **Flare Confidential Compute (FCC)** | The attestation gate. `HushWireVault.executeSettlement` only releases funds if `IEnclaveVerifier.verify(...)` confirms the attestation over the exact settlement terms. Today the gate is `SignatureVerifier` — real EIP-191 signature verification by the operator key. The interface is built for a **Flare Compute Extension (FCE)** — a TEE that signs attestations with an on-chain-registered identity — and `setVerifier()` swaps it in with no redeploy. The design mirrors Flare's own `fce-shielded-transfers` ShieldedVault pattern (research in `docs/FCC_INTEGRATION.md`). |
| **Flare EVM (Coston2)** | All contracts (`SealedBidAuction` v2, `HushWireVault`, `SignatureVerifier`, mock FXRP) are deployed and exercised on Coston2 (chain ID 114). |

The privacy lives off-chain (sealed bids + escrowed commitment); Flare provides the **interoperable
asset** and the **verifiable attestation** that make private-to-public settlement possible.

---

## 8. What was newly built, ported, integrated, or improved during the program

**Everything was built from scratch for this hackathon — nothing was ported:**

- **Smart contracts (v2)** — `SealedBidAuction` (commit–reveal sealed bids, **escrowed bids**,
  creator-bid ban, permissionless settle after a deadline, **`settleAndPay`** — atomic
  attestation-gated settle + release, and **`recover`** — hostage protection refunding bidder escrows
  if the creator never settles), `HushWireVault` (verifier-gated atomic escrow), `SignatureVerifier`
  (real EIP-191 attestation over exact terms), `IEnclaveVerifier` + test mocks, `MockFAsset`.
- **`@hushwire/sdk`** — `HushWireClient` hiding the commit–reveal cryptography with **crash-safe salt
  storage** (`JsonFileCommitmentStore` with optional AES-256-GCM at rest, browser
  `LocalStorageCommitmentStore`), exposing `openRound / commitBid / revealBid / escrowBid / getWinner /
  settle / settleAndPay / escrow / execute / recover / refund`.
- **`@hushwire/keeper`** — idempotent automation (settlement execution, refund protection,
  auto-settle/recover after deadlines).
- **MCP server** — 9 agent-callable tools over stdio.
- **Web console** — landing page with a **live on-chain event feed** (decoded Vault/Auction logs with
  block numbers + explorer links), settlement console, and negotiation simulation page.
- **`examples/two-agents.ts`** — verified end-to-end autonomous negotiation on Coston2, including a
  crash-recovery beat (bids revealed from persisted salts after a simulated process restart).

---

## 9. Smart contract addresses / deployment details

Deployed on **Flare Coston2** (chain ID **114**) — Explorer: https://coston2-explorer.flare.network

| Contract | Address |
|----------|---------|
| MockFAsset (FXRP) | `0x8d0E895eC10EBfaaC4C13f48862C4A25177B49fE` |
| SealedBidAuction | `0xCc68Ae95D2Bb23Ffed211e39287228939dA6e8e8` |
| HushWireVault | `0xeaC96028664f15719586bc4290f94a664Fa1805F` |
| SignatureVerifier (authority = deployer) | `0xd316fB982AB5630d3139D058853f25DB81B47146` |

> ⚠️ The `SignatureVerifier` is an **authority-based verifier** (deployer = authority) that performs
> real EIP-191 signature verification over exact settlement terms. On mainnet, rotate
> `HushWireVault.setVerifier()` to Flare Confidential Compute's real attestation verifier (a Flare
> Compute Extension) and replace `MockFAsset` with the real FAsset ERC20.

---

## 10. Short roadmap / next steps

1. **Production verifier (FCC/FCE)** — deploy the HushWire **Flare Compute Extension** so the TEE
   performs the attestation; wire the keeper's proof provider to the TEE Proxy; rotate via
   `setVerifier()`. (Blocked only on Flare publishing the FCC API — currently pre-production.)
2. **Real FAsset settlement** — settle in mainnet **FXRP** via the FAssetManager system.
3. **Agent adapters** — x402 (HTTP 402) payment handler; agent-framework integrations.
4. **WebSocket subscriptions** — replace keeper/dashboard polling with event streams.
5. **Multi-asset support** — FBTC, FDOGE, and other FAssets as settlement tokens.
6. **Mainnet deployment** + keeper monitoring/metrics.

*Already shipped this program:* crash-safe encrypted salt storage, atomic `settleAndPay`,
bidder escrows + `recover`, permissionless settle, live on-chain event feed.

---

## Encouraged (distribution & traction)

- **Deployed on Coston2:** ✅ Yes — all contracts live and exercised on Coston2 (chain 114).
  Not yet on Songbird or Flare Mainnet.
- **Testing:** ✅ 42/42 contract tests passing; a full negotiation → settlement verified **on-chain**
  (single-tx `settleAndPay`); the MCP server's handshake **and** a real tool call (`get_status`)
  verified end-to-end.
- **Early usage / traction:** 🟡 Early. The on-chain demo activity (sealed rounds, escrowed bids,
  executed settlements) is real and inspectable on the explorer. Concrete user-acquisition is the
  next focus: outreach via the Flare Hackathon Telegram group and agent-framework communities to get
  pilot users running negotiations through the MCP server.

---

## Team

| Name | Role |
|------|------|
| Aghazie David | Full-stack / contracts |
| [add teammates] | — |
