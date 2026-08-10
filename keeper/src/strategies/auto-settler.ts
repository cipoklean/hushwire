import type { Action, ScanContext, Strategy } from "../types";

/**
 * AutoSettler — settles auctions whose reveal window has closed but were never
 * settled. Before the settle deadline `settle` is creator-only on-chain, so
 * this only queues creator rounds; after the deadline anyone may settle (or
 * recover) and the keeper picks those up too.
 */
export class AutoSettler implements Strategy {
  name = "AutoSettler";

  async scan(ctx: ScanContext): Promise<Action[]> {
    const actions: Action[] = [];
    for (let i = 0; i < ctx.auctionCount; i++) {
      const a = await ctx.auction.auctions(i);
      if (a.settled) continue;
      if (ctx.now <= BigInt(a.revealDeadline)) continue; // reveal still open
      const isCreator = a.creator.toLowerCase() === ctx.keeperAddress.toLowerCase();
      if (!isCreator) {
        // Permissionless only after the settle deadline (creator has a window
        // to settleAndPay first — never race them).
        const deadline = BigInt(await ctx.auction.settleDeadline(i));
        if (ctx.now <= deadline) continue;
      }
      actions.push({ type: "settle-auction", id: i });
    }
    return actions;
  }
}
