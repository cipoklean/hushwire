import type { Action, ScanContext, Strategy } from "../types";

/**
 * RefundProtector — recovers escrow for settlements that expired without being
 * executed. `refund` is payer-only on-chain, so this only queues settlements
 * where the keeper is the payer.
 */
export class RefundProtector implements Strategy {
  name = "RefundProtector";

  async scan(ctx: ScanContext): Promise<Action[]> {
    const actions: Action[] = [];
    for (let i = 0; i < ctx.settlementCount; i++) {
      const s = await ctx.vault.settlements(i);
      if (s.executed || s.refunded) continue;
      if (ctx.now <= BigInt(s.deadline)) continue; // not expired yet
      if (s.payer.toLowerCase() !== ctx.keeperAddress.toLowerCase()) continue; // payer-only
      actions.push({ type: "refund", id: i });
    }
    return actions;
  }
}
