import { NextResponse } from "next/server";

/**
 * POST /api/simulate
 * Triggers a lightweight agent negotiation simulation.
 * Runs as a Vercel serverless function — no persistent server needed.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { scenario = "default" } = body;

    // Simulated negotiation result
    const result = {
      scenario,
      network: "coston2",
      chainId: 114,
      steps: [
        { agent: "Agent-A", action: "CREATE_AUCTION", detail: "Sealed-bid auction opened for FXRP compute credits" },
        { agent: "Agent-B", action: "COMMIT_BID", detail: "Hash committed (amount hidden)" },
        { agent: "Agent-C", action: "COMMIT_BID", detail: "Hash committed (amount hidden)" },
        { agent: "Agent-B", action: "REVEAL_BID", detail: "Revealed: 950 FXRP" },
        { agent: "Agent-C", action: "REVEAL_BID", detail: "Revealed: 1020 FXRP" },
        { agent: "Agent-A", action: "SETTLE", detail: "Winner: Agent-C at 1020 FXRP" },
        { agent: "Enclave", action: "VERIFY", detail: "Confidential Compute attests mutual agreement" },
        { agent: "Vault", action: "EXECUTE", detail: "1020 FXRP released from escrow" },
      ],
      outcome: {
        winner: "Agent-C",
        amount: "1020 FXRP",
        privacy: "Terms hidden until reveal. Enclave verified. Settlement public.",
        txHash: "0x_simulated_" + Date.now().toString(16),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Simulation failed", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: "HushWire Simulation API",
    version: "0.1.0",
    network: "coston2",
    endpoints: {
      POST: "/api/simulate — run a negotiation simulation",
    },
  });
}
