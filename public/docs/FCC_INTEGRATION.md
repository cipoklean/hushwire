# FCC / FCE Integration Research

<!-- SERVED COPY — source of truth: docs/FCC_INTEGRATION.md. Keep in sync when
     editing the source (the landing page links here). -->

Research from the Flare Developer Hub guides + GitHub (fetched during the Summer Signal build, July 2026).
Status caveat from the docs: *"Flare Confidential Compute is in the final stages of development and is
not yet a fully public production system."* It runs on **Coston2 only** (chain id 114), in a local
simulated mode. No mainnet deployment, no published npm/pip FCC SDK (the Go `tee-node` module + the
example repos are the kit), and no `flare-smart-contracts-v2` package yet (interfaces are vendored).

---

## The one repository that matters for HushWire

**`flare-foundation/fce-shielded-transfers`** — its `ShieldedVault.sol` is the canonical pattern for
"TEE signs a result off-chain → a Solidity contract verifies it on-chain with `ecrecover`." This is
exactly HushWire's settlement gate.

Other first-party repos:
- `fce-extension-scaffold` — Hello-World FCE starter (template to fork).
- `fce-sign` — a TEE that stores an ECIES-encrypted key and signs arbitrary messages (Go/Python/TS).
- `fce-orderbook`, `fce-weather-insurance-x402-agent` — deeper examples.
- `tee-node`, `tee-proxy` — core infrastructure (consumed via Go modules / pinned Docker build).

---

## The on-chain verification pattern (from `ShieldedVault.sol::executeWithdraw`)

Domain-separated EIP-191 `personal_sign` over an `abi.encodePacked` payload, then `ecrecover` against
a stored TEE authority address (set once by the owner):

```solidity
bytes32 hash = keccak256(abi.encodePacked(address(this), user, token, amount, withdrawalId));
bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
address recovered = _recover(ethSigned, signature);   // 65-byte r‖s‖v, v normalized to 27/28
require(recovered == teeAuthority, "invalid signature");
```

Notes from the example: replay protection via a unique id (`usedWithdrawals[bytes32]`); binding to
`address(this)` prevents cross-deployment replay; hand-rolled `_recover` (no OZ, no s-malleability check).
HushWire's production verifier should implement this, verifying that the TEE authority signed exactly
`(settlementId, payer, payee, asset, amount)` — i.e. that the FCE saw both parties agree to the terms.

---

## Coston2 (chain 114) contract addresses

- **FlareTeeManager (diamond, main entrypoint):** `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`
  (acts as both `ITeeExtensionRegistry` and `ITeeMachineRegistry`)
- Facets: `ExtensionManagerFacet` `0x13ebf34c3Fd436A657cb0f819c59790dF55CE14B`,
  `MachineManagerFacet` `0xF40B9a2e70EE96042217F10D94A4B1eDf13096a8`,
  `VerificationFacet` `0x78203332236cF39A0079746385F33060aCC95778`
- TEE proxy (public): `https://tee-proxy-coston2-1.flare.rocks` (`GET /info` returns the TEE public key
  used for ECIES-encrypting payloads sent to the TEE)
- RPC: `https://coston2-api.flare.network/ext/C/rpc` · Faucet: `https://faucet.flare.network/coston2`

---

## Key interfaces (vendored in the example repos)

```solidity
struct TeeInstructionParams {
    bytes32 opType; bytes32 opCommand; bytes message;
    address[] cosigners; uint64 cosignersThreshold; address claimBackAddress;
}
// ITeeExtensionRegistry
function sendInstructions(address[] calldata _teeIds, TeeInstructionParams calldata p) external payable returns (bytes32);
// ITeeMachineRegistry
function getRandomTeeIds(uint256 _extensionId, uint256 _count) external view returns (address[] memory);
```

Reserved op namespaces (don't reuse): `F_REG`, `F_WALLET`, `F_GET`, `F_POLICY`, `F_GOVERNANCE`, …

---

## Setup flow (canonical, from the examples)

```bash
git clone <fce repo> && cd <fce repo>
cp .env.example .env                       # DEPLOYMENT_PRIVATE_KEY, INITIAL_OWNER, PROXY_PRIVATE_KEY, ...
./scripts/use-chain.sh local coston2 go    # activates SIMULATED_TEE=true (TEE attestation simulated, chain real)
./scripts/pre-build.sh                     # deploy InstructionSender + register extension
./scripts/start-services.sh                 # docker compose: redis + ext-proxy + extension-tee
./scripts/post-build.sh                     # register TEE version (codeHash) + machine on-chain
./scripts/test.sh                           # E2E
```

Toolchain prerequisites: **Docker Desktop, Foundry (forge/cast), Go, jq, curl, ngrok or cloudflared**
(the local proxy must be publicly reachable so the TEE infra can call it back — you tunnel your own
port 6674). A Go-heavy setup.

## Blockers / gotchas

1. **Indexer DB credentials are not public.** The `ext-proxy` needs a Coston2 indexer DB
   (`34.38.42.208:3306/indexer`); credentials must be **requested from Flare support / @FlareDevs**.
   This is the one external dependency the hackathon dev experience doesn't ship out of the box.
2. **Toolchain weight:** Docker + Go + Foundry + a public tunnel, plus on-chain TEE registration.
3. Windows: the shell-script flow (`./scripts/*.sh`) assumes a POSIX shell (Git Bash may work; WSL is safer).

---

## Recommendation for HushWire

**Pattern to adopt (verification layer — cheap, correct, doc-grounded):**
Re-frame the verifier to verify an authority signature with `ecrecover` over a domain-separated
payload (`ShieldedVault` pattern). The verifiable payload = the exact settlement terms
`(settlementId, payer, payee, asset, amount)`.

**Two paths, both ending in the same Solidity verification shape:**

- **Path A (full FCE, heavy):** deploy a HushWire FCE via the scaffold; the TEE becomes the signing
  authority; the vault verifies the TEE's signature. Gives the real TEE attestation story.
  **Cost ~2-3+ days** + the indexer-credentials blocker. Viable for the hackathon now that local FCE
  is officially acceptable, but high effort.
- **Path B (SignatureVerifier, much lighter):** a `SignatureVerifier` implements `IEnclaveVerifier`
  and does the same `ecrecover` check, but the signer is the **two parties themselves** (dual EIP-712
  consent today; later = the TEE/FCE authority). Runs on-chain now with **zero external dependency**,
  real cryptographic verification, and swaps to the FCE by changing only the expected signer address.
  **Cost ~half a day.**

Both converge on the same on-chain verification; Path B proves the gate honestly without the FCE
infrastructure cost, and is forward-compatible with the FCE authority. See `docs/SDK_KEEPER_DESIGN.md` §7.
