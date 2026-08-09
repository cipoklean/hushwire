# HushWire — Flare Summer Signal Submission

> Copy each section into the corresponding DoraHacks field. Items marked **[PENDING]** are the
> only two things left to fill: the live Vercel demo URL and the public GitHub repo URL.

---

## 1. Project name

**HushWire** — *Private negotiations. Public settlement.*

---

## 2. Selected bounty or bounties

- **Bounty 1 — Interoperable Asset Products** — settlement is performed in **FXRP**, a Flare FAsset.
- **Bounty 2 — Confidential Compute Apps** — the settlement gate is an enclave verifier designed for
  **Flare Confidential Compute** (a Flare Compute Extension in production; a mock on testnet).

---

## 3. Short product description

HushWire is a settlement rail for autonomous agents. Agents negotiate price **privately** through a
commit–reveal sealed-bid auction, the winning terms are **verified inside a confidential enclave**,
and the payment **settles atomically on Flare in FXRP**. The negotiation strategy never touches the
chain — the settlement proof does. In short: *negotiate in the dark, settle in the light.*

---

## 4. Target user

- **Autonomous AI agents** transacting with each other (compute, data, API access) — the primary user.
- **OTC desks / counterparties** who need private price discovery with public settlement finality.
- **Agent-framework developers**, who integrate via the **MCP server** (9 tools) or the TypeScript **SDK**.

---

## 5. Demo link, video, or working app link

- **Live web console:** **https://hushwire-eight.vercel.app** — a signal-intelligence-style dashboard that
  reads live Coston2 state (rounds, settlements, volume) with explorer links.
- **On-chain demo (live now):** all contracts are deployed on **Coston2** and a full
  negotiation → settlement has been **executed on-chain** (e.g. `HushWireVault` settlement #1,
  1020 FXRP, status EXECUTED). Verify on the explorer: https://coston2-explorer.flare.network
- **Run it yourself (from the repo):**
  - `npm run sdk:example` — two agents run a full **autonomous** negotiation, and the keeper
    executes the settlement on-chain (~2 min, no human in the loop).
  - `npm run mcp` — start the **MCP server**; any MCP-capable agent can call 9 HushWire tools
    (`open_round`, `commit_bid`, `reveal_bid`, `settle_round`, `escrow`, …).
  - `npm run dev` — local dashboard at `http://localhost:3000`.
- **Video:** **[PENDING — 2–3 min demo]** (landing → live dashboard → MCP tools → on-chain settlement).

---

## 6. GitHub repo / technical materials

- **Repository:** **[PENDING — GitHub push]**
- **In-repo technical materials:**
  - `README.md` — overview + deployed addresses
  - `docs/ARCHITECTURE.md` — system architecture + security model
  - `docs/SDK_KEEPER_DESIGN.md` — SDK/keeper design + the production verifier roadmap (§7, grounded
    in Flare Developer Hub research)
  - `contracts/test/HushWire.test.ts` + `SignatureVerifier.test.ts` — **26 passing tests**
  - `mcp/README.md` — MCP tool reference + client registration config

---

## 7. How the project uses Flare

The Flare integration is **structural, not superficial** — remove either primitive and the product
stops working.

| Flare primitive | How HushWire uses it |
|-----------------|----------------------|
| **FAssets (FXRP)** | The settlement asset. Escrow and atomic release happen in FXRP, turning XRP value (which has no native smart contracts) into a programmable settlement token. This is the *interoperable asset product*. |
| **Flare Confidential Compute (FCC)** | The settlement gate. `HushWireVault.executeSettlement` only releases funds if `IEnclaveVerifier.verify(...)` confirms both parties agreed to the exact terms. The interface is built for a **Flare Compute Extension (FCE)** — a TEE that signs the attestation with an on-chain-registered identity. A `MockEnclaveVerifier` stands in on testnet; `setVerifier()` swaps in the real one with no redeploy. |
| **Flare EVM (Coston2)** | All contracts (`SealedBidAuction`, `HushWireVault`, verifiers, mock FXRP) are deployed and exercised on Coston2 (chain ID 114). |

The privacy lives off-chain (sealed bids + enclave verification); Flare provides the **interoperable
asset** and the **verifiable confidential attestation** that make private-to-public settlement possible.

---

## 8. What was newly built during the program

**Everything was built from scratch for this hackathon:**

- **Smart contracts** — `SealedBidAuction` (commit–reveal sealed bids), `HushWireVault`
  (verifier-gated atomic escrow), `IEnclaveVerifier` + `MockEnclaveVerifier`/`MockRejectingVerifier`,
  `MockFAsset` (testnet FXRP).
- **`@hushwire/sdk`** — `HushWireClient`: a signer-aware agent client that hides the commit–reveal
  cryptography (salt generation + storage) and exposes `openRound / commitBid / revealBid / settle /
  escrow / execute / refund` plus chain-time-aware phase waiting.
- **`@hushwire/keeper`** — an idempotent automation service with three strategies
  (`SettlementExecutor`, `RefundProtector`, `AutoSettler`) that auto-executes settlements and recovers
  expired escrow.
- **MCP server** — exposes HushWire as 9 agent-callable tools (the agent-economy integration layer).
- **Web console** — live dashboard reading on-chain state via a server-side `/api/chain` route.
- **`examples/two-agents.ts`** — a verified end-to-end autonomous negotiation on Coston2.

Nothing was ported; all of it is new.

---

## 9. Smart contract addresses / deployment details

Deployed on **Flare Coston2** (chain ID **114**) — Explorer: https://coston2-explorer.flare.network

| Contract | Address |
|----------|---------|
| MockFAsset (FXRP) | `0xed0b4da8513bd767B693122b4A53Cf4f903ee633` |
| SealedBidAuction | `0x472098a25E85D1f99373ea2D8161d30bFc921bB1` |
| HushWireVault | `0xBb45952B02D034600B5355FA67794B6980334fc2` |
| SignatureVerifier (authority = deployer) | `0x381f654BA74e7F18B320A355Cca8A339d8f9d120` |

> ⚠️ The `SignatureVerifier` is an **authority-based verifier** (deployer = authority) that performs real EIP-191 signature verification over exact settlement terms. On mainnet, rotate `HushWireVault.setVerifier()` to Flare Confidential Compute's real attestation verifier (a Flare Compute Extension), and replace `MockFAsset` with the real FAsset ERC20.

---

## 10. Roadmap / next steps

1. **Production verifier (FCC/FCE)** — build the HushWire **Flare Compute Extension** that verifies
   mutual agreement inside a TEE and signs the attestation; wire the keeper's `proofProvider` to the
   TEE Proxy; rotate via `setVerifier()`. (Blocked only on Flare publishing the FCC API — currently
   pre-production.)
2. **Real FAsset settlement** — settle in mainnet **FXRP** via the FAssetManager system.
3. **Encrypted commitment store** — encrypt salts at rest (the in-memory store is demo-only).
4. **WebSocket subscriptions** — replace keeper/dashboard polling with event streams.
5. **Agent adapters** — x402 (HTTP 402) payment handler; framework integrations.
6. **Mainnet deployment** + monitoring/metrics for the keeper.

---

## Encouraged (distribution & traction)

- **Deployed on Coston2:** ✅ Yes — all contracts live and exercised on Coston2 (chain 114).
  Not yet on Songbird or Flare Mainnet.
- **Testing:** ✅ 26/26 contract tests passing; a full negotiation → settlement verified **on-chain**;
  the MCP server's handshake **and** a real tool call (`get_status`) verified end-to-end.
- **Early usage / traction:** 🟡 Early. The on-chain demo activity (sealed rounds + executed
  settlements) is real and inspectable on the explorer. Concrete user-acquisition is the next focus:
  outreach via the Flare Hackathon Telegram group and agent-framework communities to get pilot users
  running negotiations through the MCP server.

---

## Team

| Name | Role |
|------|------|
| Aghazie David | Full-stack / contracts |
| [add teammates] | — |
