import type { Action, ScanContext, Strategy } from "../types";

/**
 * AutoSettler — settles auctions whose reveal window has closed but were never
 * settled. `settle` is creator-only on-chain, so this only queues auctions
 * where the keeper is the creator.
 */
export class AutoSettler implements Strategy {
  name = "AutoSettler";

  async scan(ctx: ScanContext): Promise<Action[]> {
    const actions: Action[] = [];
    for (let i = 0; i < ctx.auctionCount; i++) {
      const a = await ctx.auction.auctions(i);
      if (a.settled) continue;
      if (ctx.now <= BigInt(a.revealDeadline)) continue; // reveal still open
      if (a.creator.toLowerCase() !== ctx.keeperAddress.toLowerCase()) continue; // creator-only
      actions.push({ type: "settle-auction", id: i });
    }
    return actions;
  }
}
