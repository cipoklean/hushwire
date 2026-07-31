import { ethers } from "ethers";
import type { Action, ScanContext, Strategy } from "../types";

/**
 * With the MOCK verifier, the attestation proof is unconstrained (verify()
 * always returns true), so any bytes32 works. With Flare's REAL Confidential
 * Compute verifier, supply a `proofProvider` that fetches the genuine enclave
 * attestation for each settlement — that hand-off is the one production dependency.
 */
const DEFAULT_MOCK_PROOF = ethers.keccak256(
  ethers.toUtf8Bytes("hushwire-mock-attestation")
);

export type ProofProvider = (id: number, ctx: ScanContext) => Promise<string>;

/**
 * Build a proof provider that signs settlement terms with the given private key.
 * The signature is the 65-byte EIP-191 signature over the exact settlement terms
 * expected by SignatureVerifier.
 */
export function makeSignerProofProvider(keeperKey: string): ProofProvider {
  const signer = new ethers.Wallet(keeperKey);
  return async (id, ctx) => {
    const s = await ctx.vault.settlements(id);
    const chainId = await (ctx.vault.runner?.provider as ethers.Provider).getNetwork().then(
      (n) => n.chainId
    );
    const terms = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256", "address", "address", "address", "uint256"],
      [await ctx.vault.getAddress(), chainId, BigInt(id), s.payer, s.payee, s.asset, s.amount]
    );
    return signer.signMessage(ethers.getBytes(terms));
  };
}

/**
 * SettlementExecutor — finds settlements that are live (not executed/refunded,
 * within deadline) and queues them for execution.
 */
export class SettlementExecutor implements Strategy {
  name = "SettlementExecutor";

  constructor(private proofProvider?: ProofProvider) {}

  async scan(ctx: ScanContext): Promise<Action[]> {
    const actions: Action[] = [];
    for (let i = 0; i < ctx.settlementCount; i++) {
      const s = await ctx.vault.settlements(i);
      if (s.executed || s.refunded) continue;
      if (ctx.now > BigInt(s.deadline)) continue; // expired → refund territory, not execute
      const proof = this.proofProvider ? await this.proofProvider(i, ctx) : ethers.keccak256(
        ethers.toUtf8Bytes("hushwire-mock-attestation")
      );
      actions.push({ type: "execute-settlement", id: i, proof });
    }
    return actions;
  }
}