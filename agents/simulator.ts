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
import * as dotenv from "dotenv";

// Load .env from project root
dotenv.config({ path: path.join(__dirname, "../.env") });

// Load deployed addresses
const addressesPath = path.join(__dirname, "../src/lib/addresses.json");
const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));

const RPC_URL = process.env.FLARE_RPC_URL || addresses.rpcUrl || "https://coston2-api.flare.network/ext/C/rpc";
const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 114, name: "coston2" });

// ABIs (minimal)
const AUCTION_ABI = [
  "function createAuction(address _asset, uint256 _reservePrice, uint64 _commitDuration, uint64 _revealDuration) returns (uint256)",
  "function commitBid(uint256 _auctionId, bytes32 _commitHash)",
  "function revealBid(uint256 _auctionId, uint256 _amount, bytes32 _salt)",
  "function settle(uint256 _auctionId)",
  "function auctionCount() view returns (uint256)",
  "function auctions(uint256) view returns (address creator, address asset, uint256 reservePrice, uint64 commitDeadline, uint64 revealDeadline, bool settled, address winner, uint256 winningBid)",
  "event AuctionCreated(uint256 indexed auctionId, address creator, address asset, uint256 reservePrice)",
  "event BidCommitted(uint256 indexed auctionId, address bidder, bytes32 commitHash)",
  "event BidRevealed(uint256 indexed auctionId, address bidder, uint256 amount)",
  "event AuctionSettled(uint256 indexed auctionId, address winner, uint256 amount)",
];

const VAULT_ABI = [
  "function settlementCount() view returns (uint256)",
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
const DEPLOYER_PK = process.env.DEPLOYER_PRIVATE_KEY || "";

function log(agent: string, action: string, detail: string) {
  const time = new Date().toISOString().slice(11, 19);
  console.log(`[${time}] ${agent.padEnd(18)} ${action.padEnd(16)} ${detail}`);
}

/**
 * Wait until the CHAIN's block.timestamp passes `target`. Polls the latest
 * block instead of trusting the local wall clock, so phase transitions are
 * robust to clock skew between this machine and the Coston2 node.
 */
async function waitUntilChainTime(target: bigint, label: string) {
  log("System", "WAITING", `${label}…`);
  for (;;) {
    const block = await provider.getBlock("latest");
    if (BigInt(block!.timestamp) > target) return;
    await new Promise((r) => setTimeout(r, 5000));
  }
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

  // --- Step 0: Fund agent wallets with C2FLR for gas ---
  if (DEPLOYER_PK) {
    const deployer = new ethers.Wallet(DEPLOYER_PK, provider);
    const gasAmount = ethers.parseEther("1"); // 1 C2FLR each
    log("System", "FUNDING", "Sending 1 C2FLR to each agent for gas...");

    const txA = await deployer.sendTransaction({ to: agentA.address, value: gasAmount });
    await txA.wait();
    const txB = await deployer.sendTransaction({ to: agentB.address, value: gasAmount });
    await txB.wait();
    const txC = await deployer.sendTransaction({ to: agentC.address, value: gasAmount });
    await txC.wait();
    log("System", "FUNDED", "All agents funded ✓");
  } else {
    log("System", "WARN", "No DEPLOYER_PRIVATE_KEY in .env — agents must be pre-funded");
  }

  // --- Mint FXRP to agents for bidding ---
  const fxrpAddr = addresses.fxrpToken;
  const fxrpA = new ethers.Contract(fxrpAddr, FASSET_ABI, agentA);
  const fxrpB = new ethers.Contract(fxrpAddr, FASSET_ABI, agentB);
  const fxrpC = new ethers.Contract(fxrpAddr, FASSET_ABI, agentC);
  log("System", "MINT", "Minting 10,000 FXRP to each agent via faucet...");
  await (await fxrpA.faucet(10000)).wait();
  await (await fxrpB.faucet(10000)).wait();
  await (await fxrpC.faucet(10000)).wait();
  log("System", "MINTED", "FXRP balances ready ✓");

  const auction = new ethers.Contract(addresses.sealedBidAuction, AUCTION_ABI, provider);
  const vault = new ethers.Contract(addresses.hushWireVault, VAULT_ABI, provider);
  const fxrp = new ethers.Contract(addresses.fxrpToken, FASSET_ABI, provider);

  // --- Step 1: Agent-A creates auction ---
  log("Agent-A", "CREATE_AUCTION", "Opening sealed-bid for 1000 FXRP compute credits");
  const commitDuration = 120; // 2 min — enough buffer for Coston2 tx confirmation times
  const revealDuration = 120;

  const tx1 = await auction.connect(agentA).createAuction(
    addresses.fxrpToken,
    ethers.parseEther("500"), // reserve price
    commitDuration,
    revealDuration
  );
  await tx1.wait();
  const auctionId = (await auction.auctionCount()) - 1n;
  log("Agent-A", "AUCTION_CREATED", `Auction #${auctionId} live. Commit window: ${commitDuration}s`);

  // Read the authoritative on-chain deadlines (not wall clock)
  const auctionState = await auction.auctions(auctionId);
  const commitDeadline = BigInt(auctionState.commitDeadline);
  const revealDeadline = BigInt(auctionState.revealDeadline);

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

  // --- Step 3: Wait for commit deadline (chain time), then reveal ---
  await waitUntilChainTime(commitDeadline, "Commit phase — waiting for on-chain deadline");

  log("Agent-B", "REVEAL_BID", `Revealing: 950 FXRP`);
  const tx4 = await auction.connect(agentB).revealBid(auctionId, bidB, saltB);
  await tx4.wait();

  log("Agent-C", "REVEAL_BID", `Revealing: 1020 FXRP`);
  const tx5 = await auction.connect(agentC).revealBid(auctionId, bidC, saltC);
  await tx5.wait();

  // --- Step 4: Wait for reveal deadline (chain time), then settle ---
  await waitUntilChainTime(revealDeadline, "Reveal phase — waiting for on-chain deadline");

  log("Agent-A", "SETTLE", "Selecting winner: Agent-C (1020 FXRP)");
  const tx6 = await auction.connect(agentA).settle(auctionId);
  await tx6.wait();

  // --- Step 5: Escrow the winning amount into HushWireVault ---
  const winningAmount = bidC; // 1020 FXRP
  log("Agent-A", "APPROVE", `Approving vault for ${ethers.formatEther(winningAmount)} FXRP`);
  await (await fxrpA.approve(addresses.hushWireVault, winningAmount)).wait();

  log("Agent-A", "ESCROW", "Locking FXRP into HushWireVault");
  const vaultA = new ethers.Contract(addresses.hushWireVault, VAULT_ABI, agentA);
  const txEscrow = await vaultA.createSettlement(agentC.address, addresses.fxrpToken, winningAmount, 3600);
  await txEscrow.wait();
  const settlementId = (await vaultA.settlementCount()) - 1n;
  log("Vault", "ESCROWED", `Settlement #${settlementId} · ${ethers.formatEther(winningAmount)} FXRP locked`);

  // --- Step 6: Enclave attestation + verifier-gated execution (on-chain) ---
  const enclaveProof = ethers.keccak256(
    ethers.solidityPacked(["uint256", "address", "uint256"], [settlementId, agentC.address, winningAmount])
  );
  log("Enclave", "VERIFY_TERMS", "Confidential Compute attests mutual agreement (mock on testnet)");
  log("Enclave", "ATTESTATION", `Proof: ${enclaveProof.slice(0, 14)}...`);

  log("Vault", "EXECUTE", `Verifier gate passed → releasing ${ethers.formatEther(winningAmount)} FXRP to Agent-C`);
  const txExec = await vaultA.executeSettlement(settlementId, enclaveProof);
  const execReceipt = await txExec.wait();
  log("Chain", "SETTLED", `tx ${execReceipt.hash.slice(0, 16)}… · immutable`);

  const balC = await new ethers.Contract(addresses.fxrpToken, FASSET_ABI, provider).balanceOf(agentC.address);
  log("Agent-C", "RECEIVED", `FXRP balance now ${ethers.formatEther(balC)}`);
  log("Chain", "PROOF", "Settlement public on-chain. Negotiation terms remain PRIVATE. ✓");

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
