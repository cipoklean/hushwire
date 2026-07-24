import type { ethers } from "ethers";

/**
 * TxManager — submits transactions with logging and error isolation.
 * A failing action is logged and skipped; it never crashes the keeper loop.
 * Nonce/gas are handled by ethers; strategies re-verify state before sending,
 * so a restarted keeper never double-executes.
 */
export class TxManager {
  constructor(private signer: ethers.Signer) {}

  async submit(
    label: string,
    fn: () => Promise<ethers.ContractTransactionResponse>
  ): Promise<string | null> {
    try {
      const tx = await fn();
      const receipt = await tx.wait();
      console.log(`[keeper] ✓ ${label} → ${receipt!.hash.slice(0, 18)}…`);
      return receipt!.hash;
    } catch (e) {
      console.error(`[keeper] ✗ ${label} failed: ${(e as Error).message}`);
      return null;
    }
  }
}
