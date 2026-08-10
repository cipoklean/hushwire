import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";
import addresses from "../src/lib/addresses.json";
import { HushWireClient, JsonFileCommitmentStore } from "../sdk/src/index";

dotenv.config({ path: path.join(__dirname, "../.env") });

// Deterministic demo agent keys — TESTNET ONLY.
const AGENT_A_PK = process.env.AGENT_A_PRIVATE_KEY || "0x" + "a1".repeat(32); // buyer / creator
const AGENT_B_PK = process.env.AGENT_B_PRIVATE_KEY || "0x" + "b2".repeat(32); // seller
const AGENT_C_PK = process.env.AGENT_C_PRIVATE_KEY || "0x" + "c3".repeat(32); // seller

// Durable, crash-safe salt storage: if the process dies between commit and
// reveal, the salt survives on disk and the bid can still be revealed.
// Each agent gets its own file (they hold different secrets).
const SALTS_FILE_B = path.join(__dirname, "../.hushwire-salts-B.json");
const SALTS_FILE_C = path.join(__dirname, "../.hushwire-salts-C.json");
const SALT_KEY = process.env.HUSHWIRE_SALT_KEY; // optional AES-256-GCM key

function log(actor: string, msg: string) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] ${actor.padEnd(10)} ${msg}`);
}

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  HushWire SDK — Autonomous Negotiation (atomic settleAndPay)");
  console.log(`  ${addresses.network} · chain ${addresses.chainId}`);
  console.log("══════════════════════════════════════════════════════\n");

  const provider = new ethers.JsonRpcProvider(addresses.rpcUrl, {
    chainId: addresses.chainId,
    name: "flare",
  });
  const deployer = new ethers.Wallet(pk, provider);

  const contracts = {
    auction: addresses.sealedBidAuction,
    vault: addresses.hushWireVault,
    fasset: addresses.fxrpToken,
  };

  // Each agent gets its own wallet + client. B and C persist their commit
  // salts to disk (crash-safe), optionally encrypted.
  const mkClient = (w: ethers.Wallet, store?: JsonFileCommitmentStore) =>
    new HushWireClient({
      rpcUrl: addresses.rpcUrl,
      chainId: addresses.chainId,
      signer: w,
      contracts,
      commitmentStore: store,
    });

  const agentA = mkClient(new ethers.Wallet(AGENT_A_PK)); // buyer (creator)
  const storeB = new JsonFileCommitmentStore(SALTS_FILE_B, SALT_KEY);
  const storeC = new JsonFileCommitmentStore(SALTS_FILE_C, SALT_KEY);
  const agentB = mkClient(new ethers.Wallet(AGENT_B_PK), storeB); // seller
  const agentC = mkClient(new ethers.Wallet(AGENT_C_PK), storeC); // seller
  const authority = mkClient(new ethers.Wallet(pk)); // attestation authority (deployer)

  log("setup", `A (buyer)  ${new ethers.Wallet(AGENT_A_PK).address}`);
  log("setup", `B (seller) ${new ethers.Wallet(AGENT_B_PK).address}`);
  log("setup", `C (seller) ${new ethers.Wallet(AGENT_C_PK).address}`);

  // Fund agents with gas
  log("setup", "funding agents with C2FLR…");
  for (const w of [new ethers.Wallet(AGENT_A_PK), new ethers.Wallet(AGENT_B_PK), new ethers.Wallet(AGENT_C_PK)]) {
    const tx = await deployer.sendTransaction({ to: w.address, value: ethers.parseEther("1") });
    await tx.wait();
  }

  // Mint FXRP via the testnet faucet
  log("setup", "minting FXRP to agents…");
  await agentA.mintFAsset(10000n);
  await agentB.mintFAsset(10000n);
  await agentC.mintFAsset(10000n);

  // 1. Buyer opens a sealed round
  log("Agent-A", "opening sealed round (reserve 500 FXRP)…");
  const { roundId } = await agentA.openRound({
    reservePrice: ethers.parseEther("500"),
    commitSeconds: 45,
    revealSeconds: 45,
  });
  log("Agent-A", `round #${roundId} open`);

  // 2. Sellers commit sealed bids (salt is persisted to disk)
  log("Agent-B", "committing sealed bid (950 FXRP)…");
  await agentB.commitBid(roundId, ethers.parseEther("950"));
  log("Agent-C", "committing sealed bid (1020 FXRP)…");
  await agentC.commitBid(roundId, ethers.parseEther("1020"));

  // 3. Wait for the commit window to close (chain time)
  log("wait", "commit window closing…");
  await agentA.waitForPhase(roundId, "REVEAL");

  // 4. CRASH SIMULATION: build fresh clients (as if the process restarted) —
  //    the salts loaded from disk still reveal the bids.
  log("sim", "process restart — reloading persisted salts…");
  const agentB2 = mkClient(new ethers.Wallet(AGENT_B_PK), new JsonFileCommitmentStore(SALTS_FILE_B, SALT_KEY));
  const agentC2 = mkClient(new ethers.Wallet(AGENT_C_PK), new JsonFileCommitmentStore(SALTS_FILE_C, SALT_KEY));
  log("Agent-B", "revealing bid…");
  const revB = await agentB2.revealBid(roundId);
  log("Agent-B", `revealed ${ethers.formatEther(revB.amount)} FXRP (salt from disk)`);
  log("Agent-C", "revealing bid…");
  const revC = await agentC2.revealBid(roundId);
  log("Agent-C", `revealed ${ethers.formatEther(revC.amount)} FXRP (salt from disk)`);

  // 5. Bidders back their bids (only funded bids can win; escrows refunded at settle)
  log("Agent-B", `escrowing bid (${ethers.formatEther(revB.amount)} FXRP)…`);
  await agentB2.escrowBid(roundId);
  log("Agent-C", `escrowing bid (${ethers.formatEther(revC.amount)} FXRP)…`);
  await agentC2.escrowBid(roundId);

  // 6. Wait for the reveal window to close
  log("wait", "reveal window closing…");
  await agentA.waitForPhase(roundId, "ENDED");

  // 7. Buyer reads the winner off-chain, then escrows the payment
  const { winner, amount } = await agentA.getWinner(roundId);
  log("Agent-A", `winner ${winner} at ${ethers.formatEther(amount)} FXRP`);
  log("Agent-A", `escrowing ${ethers.formatEther(amount)} FXRP to winner…`);
  const { settlementId } = await agentA.escrow({
    payee: winner,
    amount,
    durationSeconds: 3600,
  });
  log("Agent-A", `settlement #${settlementId} escrowed`);

  // 8. ATOMIC settle + pay: authority signs the exact terms, then ONE tx
  //    settles the round AND releases the payment from the vault.
  log("authority", `signing attestation for settlement #${settlementId}…`);
  const proof = await authority.attestSettlement(settlementId);
  log("keeper", "submitting settleAndPay (round settle + vault release in one tx)…");
  const sp = await authority.settleAndPay(roundId, settlementId, proof);
  log("keeper", `tx ${sp.txHash.slice(0, 18)}… · winner ${sp.winner.slice(0, 10)}… @ ${ethers.formatEther(sp.amount)} FXRP`);

  // 9. Verify
  const winnerClient = winner.toLowerCase() === new ethers.Wallet(AGENT_C_PK).address.toLowerCase() ? agentC2 : agentB2;
  const bal = await winnerClient.balanceFAsset();
  const settlement = await agentA.getSettlement(settlementId);
  const round = await agentA.getRound(roundId);
  log("verify", `winner FXRP balance now ${ethers.formatEther(bal)}`);
  log("verify", `settlement #${settlementId} executed=${settlement.executed}`);
  log("verify", `round #${roundId} phase=${round.phase} · bidder escrows refunded`);

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  ✓ Atomic negotiation complete (settleAndPay)");
  console.log("  Round settled + payment released in a single transaction");
  console.log("══════════════════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("Failed:", e?.message ?? e);
  process.exit(1);
});
