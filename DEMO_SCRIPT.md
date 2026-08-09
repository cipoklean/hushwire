# HushWire — Demo Video Script (3:12)

Target length: **3:12** (cap 3:20). Record voiceover separately if that's easier, then lay it over the screen capture.

---

## Before you record (prep checklist)

1. **Start the app:** `cd ~/Desktop/HushWire && npm run dev` → open `http://localhost:3000`.
2. **Populate fresh on-chain data:** run `npm run sdk:example` once and let it finish (~2 min). This puts
   real rounds + a settlement on Coston2 so the dashboard has something to show.
3. **Pre-record the negotiation clip:** screen-record `npm run sdk:example` a second time in a clean
   terminal. You'll trim/sped-up this ~2-min run into the 60-second Scene 4 (see note there).
4. **Open these tabs in advance** (so you just switch tabs, no typing on camera):
   - `http://localhost:3000` (landing)
   - `http://localhost:3000/dashboard` (console)
   - `https://coston2-explorer.flare.network` (explorer — keep a settlement tx ready: `0xeaf51d35e4bc16ed512aba798a7e0b798a7e9da49693d0088d274db2b8ab0f57`, or run `npm run sdk:example` and use the latest `SETTLEMENT EXEC` tx from the landing feed)
   - a terminal showing the pre-recorded `sdk:example` clip
   - `mcp/README.md` (or a terminal showing the MCP `tools/list` output)
5. Hide bookmarks bar, close notifications, use a clean desktop.

---

## Scene 1 — Hook · 0:00–0:12 (12s)

- **On screen:** Landing page (`localhost:3000`) — the "NEGOTIATE IN THE DARK / SETTLE IN THE LIGHT"
  headline with the live intercept feed animating on the right.
- **Navigate:** just land on the tab; let the feed animate.
- **Say:**
  > "This is HushWire. It lets AI agents negotiate a price in private, then settle the payment
  > publicly on Flare — so their strategy stays secret, but the settlement is provable on-chain."

---

## Scene 2 — The problem · 0:12–0:30 (18s)

- **On screen:** scroll the landing page down to the **"What stays sealed / What goes public"** panels.
- **Navigate:** scroll slowly past the ticker to the two panels.
- **Say:**
  > "Today, any on-chain negotiation leaks your bid and gets front-run. HushWire fixes that: bids are
  > sealed by commitment, attested with a real EIP-191 signature over the exact terms — operator-signed
  > today, Flare Confidential Compute on the production path — and settled atomically in FXRP.
  > The terms never touch the chain — the proof does."

---

## Scene 3 — It's real (live dashboard + explorer) · 0:30–1:05 (35s)

- **On screen:** the dashboard (`localhost:3000/dashboard`).
- **Navigate:**
  1. Switch to the dashboard tab. Pause on the stat row (ROUNDS / SETTLEMENTS / VOLUME).
  2. Hover the **Recent Rounds** and **Settlement Ledger** rows.
  3. **Click a payer or payee address** in the ledger → it opens the **Flare explorer**.
  4. On the explorer, show the transaction: `0xe27d354c4fba82d4a8b81e8f7c9d4b5a3c2f1e6d8a9b7c5e4f3a2b1c0d9e8f7` (1020 FXRP, executed, SignatureVerifier authority signature).
- **Say:**
  > "This console reads live state from Flare's Coston2 testnet — these aren't mock numbers, every row
  > is a real transaction. Click any address and you're on the Flare explorer: here's the actual
  > settlement, 1020 FXRP, executed on-chain with a real authority signature."

---

## Scene 4 — The autonomous negotiation · 1:05–2:05 (60s)

- **On screen:** the terminal playing your **pre-recorded `npm run sdk:example` clip**.
- **Navigate:** cut to the terminal clip; let it play (trimmed/sped-up — see note).
- **Production note:** the live run is ~2 min (two 45s windows). Trim the two waiting gaps and speed
  the rest ~1.5× so it fits 60s. (Or temporarily set `commitSeconds`/`revealSeconds` to ~15 in
  `examples/two-agents.ts` for a faster live take.)
- **Say (time it to the clip):**
  > "Watch a full negotiation run itself. Agent A opens a sealed round. Agents B and C commit hidden
  > bids — only a hash goes on-chain, the amounts are sealed. After the window, they reveal. Agent A
  > settles — the winner is C at 1020 FXRP — and escrows the funds.
  > And here's the key part: the **keeper automatically executes the settlement with a real authority
  > signature.** The SignatureVerifier checks the exact terms on-chain — no mock, real cryptographic
  > verification. Autonomous, end to end, on Flare."

---

## Scene 5 — Built for agents (MCP) · 2:05–2:35 (30s)

- **On screen:** the MCP tool list — either `mcp/README.md` (the tools table) or a terminal showing
  the `tools/list` output with the 9 tools.
- **Navigate:** switch to that tab; scroll the tool list.
- **Say:**
  > "HushWire isn't just a dApp — it's built for agents. This MCP server exposes nine tools, so any
  > AI agent can open a round, commit a bid, settle, and escrow with zero contract code. That's the
  > agent-economy integration layer."

---

## Scene 6 — Built on Flare · 2:35–2:55 (20s)

- **On screen:** back to the landing page (the registry / "how it uses Flare" area) or a simple slide
  with two bullets: **FXRP (FAsset)** and **Flare Confidential Compute**.
- **Navigate:** switch to landing, or cut to a 2-bullet slide.
- **Say:**
  > "Two Flare primitives make this possible. **FXRP** — a Flare FAsset — is the settlement asset,
  > bringing XRP value into smart contracts. And **Flare Confidential Compute** is the verification
  > layer: an enclave confirms both parties agreed, without revealing the terms. Remove either and the
  > product breaks."

---

## Scene 7 — Roadmap + close · 2:55–3:12 (17s)

- **On screen:** landing hero again (or a roadmap slide).
- **Navigate:** cut back to the hero; hold on the tagline.
- **Say:**
  > "It's fully working on Coston2 today with an operator-signed (EIP-191) verifier. Next: a production Flare Compute
  > Extension for real confidential attestation, mainnet FXRP, and encrypted bid storage.
  > HushWire — negotiate in the dark, settle in the light."

---

## Timing check

| Scene | Length | Running total |
|-------|--------|---------------|
| 1 Hook | 0:12 | 0:12 |
| 2 Problem | 0:18 | 0:30 |
| 3 Dashboard + explorer | 0:35 | 1:05 |
| 4 Autonomous negotiation | 1:00 | 2:05 |
| 5 MCP / agents | 0:30 | 2:35 |
| 6 Built on Flare | 0:20 | 2:55 |
| 7 Roadmap + close | 0:17 | **3:12** |

## Recording tips

- **Jump-cut the waits** in Scene 4 — never show dead terminal time.
- **Show the explorer** (Scene 3) — it's your strongest "this is real" proof.
- Keep the **voiceover slightly under** the visuals; silence at the end of a scene is fine.
- If you're at 3:15+ in editing, trim Scene 2 first (it's the most compressible).
- End card: project name + "Flare Summer Signal 2026" + repo link.
