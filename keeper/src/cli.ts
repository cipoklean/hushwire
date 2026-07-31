import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";
import addresses from "../../src/lib/addresses.json";
import { runKeeper } from "./index";
import { SettlementExecutor } from "./strategies/settlement-executor";
import { RefundProtector } from "./strategies/refund-protector";
import { AutoSettler } from "./strategies/auto-settler";
import { makeSignerProofProvider } from "./strategies/settlement-executor";

dotenv.config({ path: path.join(__dirname, "../../.env") });

/**
 * Standalone keeper CLI. Watches the deployed HushWire contracts and:
 *   - executes live settlements (SettlementExecutor with real authority signatures)
 *   - refunds expired escrow the keeper owns (RefundProtector)
 *   - settles matured auctions the keeper created (AutoSettler)
 * Run: `npm run keeper`.
 */
async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

  const wallet = new ethers.Wallet(pk);
  console.log(`[keeper] HushWire keeper · ${addresses.network} (chain ${addresses.chainId})`);
  console.log(`[keeper] wallet ${wallet.address}`);
  console.log(`[keeper] vault  ${addresses.hushWireVault}`);
  console.log(`[keeper] auction ${addresses.sealedBidAuction}`);

  // Use the keeper's private key as the attestation authority (matches SignatureVerifier)
  const proofProvider = makeSignerProofProvider(pk);

  await runKeeper({
    rpcUrl: addresses.rpcUrl,
    chainId: addresses.chainId,
    signer: wallet,
    contracts: { auction: addresses.sealedBidAuction, vault: addresses.hushWireVault },
    pollIntervalMs: 15_000,
    strategies: [
      new SettlementExecutor(proofProvider),
      new RefundProtector(),
      new AutoSettler(),
    ],
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
