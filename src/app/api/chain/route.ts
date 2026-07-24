import { NextResponse } from "next/server";
import { getChainSnapshot } from "@/lib/chain";

// Always read fresh chain state; never serve a cached snapshot.
export const dynamic = "force-dynamic";

/**
 * GET /api/chain
 * Server-side chain read. Proxies Coston2 so the browser never talks to the
 * RPC directly (avoids CORS + keeps the client bundle free of ethers).
 */
export async function GET() {
  try {
    const snapshot = await getChainSnapshot(5);
    return NextResponse.json(snapshot);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "chain unreachable", detail },
      { status: 502 }
    );
  }
}
