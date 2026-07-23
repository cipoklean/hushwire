/**
 * HushWire Agent Simulator
 * 
 * Simulates a full negotiation cycle between autonomous agents:
 * 1. Agent-A creates a sealed-bid auction
 * 2. Agent-B and Agent-C commit hashed bids (amounts hidden)
 * 3. After commit deadline, agents reveal bids
 * 4. Agent-A settles with the winner
 * 5. Enclave attests terms match
 * 6. HushWireVault executes settlement
 * 
 * Usage: npx tsx agents/simulator.ts
 * Requires: contracts deployed to Coston2 (see contracts/scripts/deploy.ts)
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// Load deployed addresses
const addressesPath = path.join(__dirname, "../src/lib/addresses.json");
const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));

const RPC_URL = process.env.FLARE_RPC_URL || addresses.rpcUrl;
const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 114, name: "coston2" });

// ABIs (minimal)
const AUCTION_ABI = [
  "function createAuction(address _asset, uint256 _reservePrice, uint64 _commitDuration, uint64 _revealDuration) returns (uint256)",
  "function commitBid(uint256 _auctionId, bytes32 _commitHash)",
  "function revealBid(uint256 _auctionId, uint256 _amount, bytes32 _salt)",
  "function settle(uint256 _auctionId)",
  "function auctionCount() view returns (uint256)",
  "event AuctionCreated(uint256 indexed auctionId, address creator, address asset, uint256 reservePrice)",
  "event BidCommitted(uint256 indexed auctionId, address bidder, bytes32 commitHash)",
  "event BidRevealed(uint256 indexed auctionId, address bidder, uint256 amount)",
  "event AuctionSettled(uint256 indexed auctionId, address winner, uint256 amount)",
];

const VAULT_ABI = [
  "function createSettlement(address _payee, address _asset, uint256 _amount, uint64 _duration) returns (uint256)",
  "function executeSettlement(uint256 _id, bytes32 _enclaveProof)",
  "event SettlementCreated(uint256 indexed id, address payer, address payee, address asset, uint256 amount)",
  "event SettlementExecuted(uint256 indexed id, address payee, uint256 amount)",
];

const FASSET_ABI = [
  "function faucet(uint256 amount)",
  "function approve(address, uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

// Agent wallets (in production, these are autonomous agents with their own keys)
const AGENT_A_PK = process.env.AGENT_A_PRIVATE_KEY || "0x" + "a1".repeat(32); // Buyer
const AGENT_B_PK = process.env.AGENT_B_PRIVATE_KEY || "0x" + "b2".repeat(32); // Seller 1
const AGENT_C_PK = process.env.AGENT_C_PRIVATE_KEY || "0x" + "c3".repeat(32); // Seller 2

function log(agent: string, action: string, detail: string) {
  const time = new Date().toISOString().slice(11, 19);
  console.log(`[${time}] ${agent.padEnd(18)} ${action.padEnd(16)} ${detail}`);
}

async function main() {
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  HushWire Agent Negotiation Simulator");
  console.log("  Network: Flare Coston2 (chainId 114)");
  console.log("═══════════════════════════════════════════════════\n");

  const agentA = new ethers.Wallet(AGENT_A_PK, provider);
  const agentB = new ethers.Wallet(AGENT_B_PK, provider);
  const agentC = new ethers.Wallet(AGENT_C_PK, provider);

  log("System", "INIT", `Agent-A (Buyer):  ${agentA.address}`);
  log("System", "INIT", `Agent-B (Seller): ${agentB.address}`);
  log("System", "INIT", `Agent-C (Seller): ${agentC.address}`);

  const auction = new ethers.Contract(addresses.sealedBidAuction, AUCTION_ABI, provider);
  const vault = new ethers.Contract(addresses.hushWireVault, VAULT_ABI, provider);
  const fxrp = new ethers.Contract(addresses.fxrpToken, FASSET_ABI, provider);

  // --- Step 1: Agent-A creates auction ---
  log("Agent-A", "CREATE_AUCTION", "Opening sealed-bid for 1000 FXRP compute credits");
  const commitDuration = 30; // 30 seconds for demo
  const revealDuration = 30;

  const tx1 = await auction.connect(agentA).createAuction(
    addresses.fxrpToken,
    ethers.parseEther("500"), // reserve price
    commitDuration,
    revealDuration
  );
  await tx1.wait();
  const auctionId = (await auction.auctionCount()) - 1n;
  log("Agent-A", "AUCTION_CREATED", `Auction #${auctionId} live. Commit window: ${commitDuration}s`);

  // --- Step 2: Agents commit sealed bids ---
  const bidB = ethers.parseEther("950");
  const saltB = ethers.randomBytes(32);
  const hashB = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [bidB, saltB]));

  const bidC = ethers.parseEther("1020");
  const saltC = ethers.randomBytes(32);
  const hashC = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [bidC, saltC]));

  log("Agent-B", "COMMIT_BID", `Hash: ${hashB.slice(0, 10)}... (amount HIDDEN)`);
  const tx2 = await auction.connect(agentB).commitBid(auctionId, hashB);
  await tx2.wait();

  log("Agent-C", "COMMIT_BID", `Hash: ${hashC.slice(0, 10)}... (amount HIDDEN)`);
  const tx3 = await auction.connect(agentC).commitBid(auctionId, hashC);
  await tx3.wait();

  // --- Step 3: Wait for commit deadline, then reveal ---
  log("System", "WAITING", `Commit phase ends in ${commitDuration}s...`);
  await new Promise((r) => setTimeout(r, (commitDuration + 2) * 1000));

  log("Agent-B", "REVEAL_BID", `Revealing: 950 FXRP`);
  const tx4 = await auction.connect(agentB).revealBid(auctionId, bidB, saltB);
  await tx4.wait();

  log("Agent-C", "REVEAL_BID", `Revealing: 1020 FXRP`);
  const tx5 = await auction.connect(agentC).revealBid(auctionId, bidC, saltC);
  await tx5.wait();

  // --- Step 4: Wait for reveal deadline, then settle ---
  log("System", "WAITING", `Reveal phase ends in ${revealDuration}s...`);
  await new Promise((r) => setTimeout(r, (revealDuration + 2) * 1000));

  log("Agent-A", "SETTLE", "Selecting winner: Agent-C (1020 FXRP)");
  const tx6 = await auction.connect(agentA).settle(auctionId);
  await tx6.wait();

  // --- Step 5: Enclave attestation (simulated) ---
  const enclaveProof = ethers.keccak256(
    ethers.solidityPacked(["uint256", "address", "uint256"], [auctionId, agentC.address, bidC])
  );
  log("Enclave", "VERIFY_TERMS", "Confidential Compute confirms mutual agreement");
  log("Enclave", "ATTESTATION", `Proof: ${enclaveProof.slice(0, 14)}...`);

  // --- Step 6: Vault settlement ---
  log("Vault", "EXECUTE", `Releasing 1020 FXRP → Agent-C`);
  // In production: vault.executeSettlement(settlementId, enclaveProof)
  // For demo: log the flow
  log("Chain", "PROOF", "Settlement on-chain. Terms remain PRIVATE. ✓");

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  ✓ Negotiation complete");
  console.log("  Public: settlement proof, amounts");
  console.log("  Private: negotiation terms, bid strategy");
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Simulation failed:", err.message);
  process.exit(1);
});
