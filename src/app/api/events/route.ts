import { NextResponse } from "next/server";
import { getRecentEvents } from "@/lib/events";

// Always read fresh chain state; never serve a cached snapshot.
export const dynamic = "force-dynamic";

/**
 * GET /api/events
 * Server-side real event feed: decodes recent Vault/Auction logs on Coston2
 * (rounds opened, bids committed/revealed, auctions settled, escrow locked,
 * settlements executed/refunded) with block numbers + tx hashes.
 */
export async function GET() {
  try {
    const result = await getRecentEvents(8);
    return NextResponse.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "chain unreachable", detail }, { status: 502 });
  }
}
