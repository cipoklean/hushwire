import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";
import addresses from "../src/lib/addresses.json";
import { HushWireClient } from "../sdk/src/index";
import { runKeeper } from "../keeper/src/index";
import { SettlementExecutor } from "../keeper/src/strategies/settlement-executor";

dotenv.config({ path: path.join(__dirname, "../.env") });

// Deterministic demo agent keys — TESTNET ONLY.
const AGENT_A_PK = process.env.AGENT_A_PRIVATE_KEY || "0x" + "a1".repeat(32); // buyer
const AGENT_B_PK = process.env.AGENT_B_PRIVATE_KEY || "0x" + "b2".repeat(32); // seller
const AGENT_C_PK = process.env.AGENT_C_PRIVATE_KEY || "0x" + "c3".repeat(32); // seller

function log(actor: string, msg: string) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] ${actor.padEnd(10)} ${msg}`);
}

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  HushWire SDK + Keeper — Autonomous Negotiation");
  console.log(`  ${addresses.network} · chain ${addresses.chainId}`);
  console.log("══════════════════════════════════════════════════════\n");

  const provider = new ethers.JsonRpcProvider(addresses.rpcUrl, {
    chainId: addresses.chainId,
    name: "flare",
  });
  const deployer = new ethers.Wallet(pk, provider);

  const walletA = new ethers.Wallet(AGENT_A_PK);
  const walletB = new ethers.Wallet(AGENT_B_PK);
  const walletC = new ethers.Wallet(AGENT_C_PK);

  const contracts = {
    auction: addresses.sealedBidAuction,
    vault: addresses.hushWireVault,
    fasset: addresses.fxrpToken,
  };
  const mkClient = (w: ethers.Wallet) =>
    new HushWireClient({ rpcUrl: addresses.rpcUrl, chainId: addresses.chainId, signer: w, contracts });

  const agentA = mkClient(walletA); // buyer
  const agentB = mkClient(walletB); // seller
  const agentC = mkClient(walletC); // seller

  log("setup", `A (buyer)  ${walletA.address}`);
  log("setup", `B (seller) ${walletB.address}`);
  log("setup", `C (seller) ${walletC.address}`);

  // Fund agents with gas
  log("setup", "funding agents with C2FLR…");
  for (const w of [walletA, walletB, walletC]) {
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

  // 2. Sellers commit sealed bids (SDK generates + stores the salt)
  log("Agent-B", "committing sealed bid (950 FXRP)…");
  await agentB.commitBid(roundId, ethers.parseEther("950"));
  log("Agent-C", "committing sealed bid (1020 FXRP)…");
  await agentC.commitBid(roundId, ethers.parseEther("1020"));

  // 3. Wait for the commit window to close (chain time)
  log("wait", "commit window closing…");
  await agentA.waitForPhase(roundId, "REVEAL");

  // 4. Sellers reveal (SDK supplies the stored salt)
  log("Agent-B", "revealing bid…");
  const revB = await agentB.revealBid(roundId);
  log("Agent-B", `revealed ${ethers.formatEther(revB.amount)} FXRP`);
  log("Agent-C", "revealing bid…");
  const revC = await agentC.revealBid(roundId);
  log("Agent-C", `revealed ${ethers.formatEther(revC.amount)} FXRP`);

  // 5. Wait for the reveal window to close
  log("wait", "reveal window closing…");
  await agentA.waitForPhase(roundId, "ENDED");

  // 6. Buyer settles
  log("Agent-A", "settling round…");
  const result = await agentA.settle(roundId);
  log("Agent-A", `winner ${result.winner} at ${ethers.formatEther(result.amount)} FXRP`);

  // 7. Buyer escrows the winning amount to the winner
  log("Agent-A", `escrowing ${ethers.formatEther(result.amount)} FXRP to winner…`);
  const { settlementId } = await agentA.escrow({
    payee: result.winner,
    amount: result.amount,
    durationSeconds: 3600,
  });
  log("Agent-A", `settlement #${settlementId} escrowed`);

  // 8. Keeper autonomously executes the settlement (one tick)
  log("keeper", "running keeper to execute settlement…");
  await runKeeper(
    {
      rpcUrl: addresses.rpcUrl,
      chainId: addresses.chainId,
      signer: new ethers.Wallet(pk),
      contracts: { auction: contracts.auction, vault: contracts.vault },
      strategies: [new SettlementExecutor()],
    },
    { once: true }
  );

  // 9. Verify
  const winnerClient =
    result.winner.toLowerCase() === walletC.address.toLowerCase() ? agentC : agentB;
  const bal = await winnerClient.balanceFAsset();
  const settlement = await agentA.getSettlement(settlementId);
  log("verify", `winner FXRP balance now ${ethers.formatEther(bal)}`);
  log("verify", `settlement #${settlementId} executed=${settlement.executed}`);

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  ✓ Autonomous negotiation complete");
  console.log("  SDK drove the agents · keeper executed the settlement");
  console.log("══════════════════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("Failed:", e?.message ?? e);
  process.exit(1);
});
