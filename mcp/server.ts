import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import addresses from "../src/lib/addresses.json";
import { HushWireClient } from "../sdk/src/index";

dotenv.config({ path: path.join(__dirname, "../.env") });

// stdout is reserved for MCP JSON-RPC — all logging goes to stderr.
const log = (msg: string) => console.error(`[hushwire-mcp] ${msg}`);

// JSON.stringify can't serialize bigint; render amounts as decimal strings.
function json(obj: unknown): string {
  return JSON.stringify(
    obj,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2
  );
}

const text = (obj: unknown) => ({ content: [{ type: "text" as const, text: json(obj) }] });

async function main() {
  const pk = process.env.AGENT_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
    throw new Error("Set AGENT_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) in .env");
  }

  const client = new HushWireClient({
    rpcUrl: addresses.rpcUrl,
    chainId: addresses.chainId,
    signer: new ethers.Wallet(pk),
    contracts: {
      auction: addresses.sealedBidAuction,
      vault: addresses.hushWireVault,
      fasset: addresses.fxrpToken,
    },
  });

  const server = new McpServer({ name: "hushwire", version: "0.1.0" });

  // ── Orientation ───────────────────────────────────────────────────────────
  server.tool(
    "get_status",
    "HushWire network status: chain, contract addresses, this agent's address and FXRP balance.",
    {},
    async () => {
      const [agent, balance] = await Promise.all([client.getAddress(), client.balanceFAsset()]);
      return text({
        network: addresses.network,
        chainId: addresses.chainId,
        agent,
        fxrpBalance: ethers.formatEther(balance),
        contracts: {
          auction: addresses.sealedBidAuction,
          vault: addresses.hushWireVault,
          fasset: addresses.fxrpToken,
        },
      });
    }
  );

  // ── Negotiation ───────────────────────────────────────────────────────────
  server.tool(
    "open_round",
    "Open a sealed-bid negotiation round. Returns the on-chain round id.",
    {
      reservePrice: z.string().describe("Minimum acceptable bid, in whole FXRP, e.g. '500'"),
      commitSeconds: z.number().describe("Length of the sealed-commit window in seconds"),
      revealSeconds: z.number().describe("Length of the reveal window in seconds"),
    },
    async ({ reservePrice, commitSeconds, revealSeconds }) => {
      const r = await client.openRound({
        reservePrice: ethers.parseEther(reservePrice),
        commitSeconds,
        revealSeconds,
      });
      return text(r);
    }
  );

  server.tool(
    "commit_bid",
    "Commit a sealed bid. The amount is hidden on-chain (only a hash is published) until reveal_bid. The SDK stores the salt automatically.",
    {
      roundId: z.number().describe("Round id from open_round"),
      amount: z.string().describe("Bid amount in whole FXRP, e.g. '1020'"),
    },
    async ({ roundId, amount }) => {
      const r = await client.commitBid(roundId, ethers.parseEther(amount));
      return text(r);
    }
  );

  server.tool(
    "reveal_bid",
    "Reveal a previously committed bid (call after the commit window closes). Uses the stored salt.",
    { roundId: z.number().describe("Round id") },
    async ({ roundId }) => {
      const r = await client.revealBid(roundId);
      return text({ txHash: r.txHash, amount: ethers.formatEther(r.amount) });
    }
  );

  server.tool(
    "settle_round",
    "Settle a round (creator only, after the reveal window). Returns the winner and winning amount.",
    { roundId: z.number().describe("Round id") },
    async ({ roundId }) => {
      const r = await client.settle(roundId);
      return text({ txHash: r.txHash, winner: r.winner, amount: ethers.formatEther(r.amount) });
    }
  );

  // ── Settlement ────────────────────────────────────────────────────────────
  server.tool(
    "escrow",
    "Escrow FXRP for a payee in the HushWireVault (auto-approves the vault). Returns the settlement id.",
    {
      payee: z.string().describe("Recipient address"),
      amount: z.string().describe("Amount in whole FXRP"),
      durationSeconds: z.number().describe("Escrow duration in seconds (refundable after)"),
    },
    async ({ payee, amount, durationSeconds }) => {
      const r = await client.escrow({
        payee,
        amount: ethers.parseEther(amount),
        durationSeconds,
      });
      return text(r);
    }
  );

  // ── Reads ─────────────────────────────────────────────────────────────────
  server.tool(
    "get_round",
    "Read a round's full state (creator, reserve, deadlines, bidders, phase, winner).",
    { roundId: z.number().describe("Round id") },
    async ({ roundId }) => {
      const r = await client.getRound(roundId);
      return text({
        ...r,
        reservePrice: ethers.formatEther(r.reservePrice),
        winningBid: ethers.formatEther(r.winningBid),
      });
    }
  );

  server.tool(
    "get_settlement",
    "Read a settlement's full state (payer, payee, amount, deadline, executed/refunded).",
    { settlementId: z.number().describe("Settlement id") },
    async ({ settlementId }) => {
      const s = await client.getSettlement(settlementId);
      return text({ ...s, amount: ethers.formatEther(s.amount) });
    }
  );

  // ── Testnet helper ────────────────────────────────────────────────────────
  server.tool(
    "mint_test_fxrp",
    "Mint FXRP from the testnet faucet (Coston2 only — not available on mainnet).",
    { amount: z.string().describe("Whole FXRP to mint, e.g. '10000'") },
    async ({ amount }) => {
      const txHash = await client.mintFAsset(BigInt(amount));
      return text({ txHash, minted: `${amount} FXRP` });
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`server ready on stdio · agent ${await client.getAddress()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
