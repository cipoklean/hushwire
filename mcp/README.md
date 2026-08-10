# HushWire MCP Server

Exposes HushWire as [Model Context Protocol](https://modelcontextprotocol.io) tools, so any
MCP-capable AI agent can open sealed negotiations, commit/reveal bids, settle, and escrow FXRP —
without writing any contract code. This is the P4 adapter from `docs/SDK_KEEPER_DESIGN.md`.

The server wraps a single `HushWireClient` (one agent wallet, configured from `.env`) and talks
JSON-RPC over stdio.

## Tools

| Tool | What it does |
|------|--------------|
| `get_status` | Chain, contract addresses, agent address, FXRP balance |
| `open_round` | Open a sealed-bid round → returns `roundId` |
| `commit_bid` | Commit a sealed bid (amount hidden until reveal) |
| `reveal_bid` | Reveal a committed bid (after the commit window) |
| `settle_round` | Settle a round (creator before the settle deadline; anyone after) → winner + amount |
| `escrow` | Escrow FXRP for a payee → returns `settlementId` |
| `get_round` | Read a round's full state |
| `get_settlement` | Read a settlement's full state |
| `mint_test_fxrp` | Testnet faucet (Coston2 only) |

Amounts are passed as **whole-FXRP strings** (e.g. `"1020"`); the server converts to wei.

> The MCP server exposes the core negotiation/settlement toolset. The SDK additionally ships
> `escrowBid`, `settleAndPay` (atomic settle + pay) and `recover` (hostage protection) for
> programmatic use.

## Configuration

Set the agent's key in `.env` (the server uses `AGENT_PRIVATE_KEY`, falling back to
`DEPLOYER_PRIVATE_KEY`):

```
AGENT_PRIVATE_KEY=0x...
```

Contract addresses and RPC are read from `src/lib/addresses.json` (written by the deploy script).

## Run

```bash
npm run mcp
```

The server speaks MCP over stdio — it's meant to be launched by an MCP client, not used directly.

## Register with an MCP client

Example (Claude Desktop / any MCP host `mcpServers` config):

```json
{
  "mcpServers": {
    "hushwire": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "C:\\Users\\HomePC\\Desktop\\HushWire",
      "env": {
        "AGENT_PRIVATE_KEY": "0xYOUR_AGENT_KEY"
      }
    }
  }
}
```

## Smoke test

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | npm run mcp
```

You should see an `initialize` result and a `tools/list` result naming the nine tools.

## Production note

The server talks to the deployed **`SignatureVerifier`** (operator-signed EIP-191) on Coston2. For
mainnet, point the deploy at Flare's real Confidential Compute verifier (a Flare Compute Extension) —
the SDK/keeper/server code is unchanged.
