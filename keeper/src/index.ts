import { ethers } from "ethers";
import { AUCTION_ABI, VAULT_ABI } from "../../sdk/src/abi";
import { TxManager } from "./tx-manager";
import type { Action, KeeperConfig, ScanContext } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Re-verify an action against live chain state immediately before sending.
 * This is what makes the keeper idempotent and crash-safe: a restarted keeper,
 * or one that scanned slightly stale state, never double-executes.
 */
async function stillValid(
  vault: ethers.Contract,
  auction: ethers.Contract,
  action: Action,
  now: bigint
): Promise<boolean> {
  if (action.type === "execute-settlement") {
    const s = await vault.settlements(action.id);
    return !s.executed && !s.refunded && now <= BigInt(s.deadline);
  }
  if (action.type === "refund") {
    const s = await vault.settlements(action.id);
    return !s.executed && !s.refunded && now > BigInt(s.deadline);
  }
  if (action.type === "settle-auction") {
    const a = await auction.auctions(action.id);
    return !a.settled && now > BigInt(a.revealDeadline);
  }
  return false;
}

/**
 * runKeeper — the automation loop.
 *
 * Each tick: snapshot chain state, ask every strategy for actions, re-verify
 * each action on-chain, then submit. With `{ once: true }` it runs a single
 * tick and returns (used by the example to auto-execute a settlement).
 */
export async function runKeeper(cfg: KeeperConfig, opts?: { once?: boolean }): Promise<void> {
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl, {
    chainId: cfg.chainId ?? 114,
    name: "flare",
  });
  const signer = (cfg.signer as ethers.Wallet).connect
    ? (cfg.signer as ethers.Wallet).connect(provider)
    : cfg.signer;
  const vault = new ethers.Contract(cfg.contracts.vault, VAULT_ABI, signer);
  const auction = new ethers.Contract(cfg.contracts.auction, AUCTION_ABI, signer);
  const keeperAddress = await signer.getAddress();
  const txm = new TxManager(signer);
  const seen = new Set<string>(); // dedupe within this process lifetime

  const tick = async () => {
    const block = await provider.getBlock("latest");
    const now = BigInt(block!.timestamp);
    const settlementCount = Number(await vault.settlementCount());
    const auctionCount = Number(await auction.auctionCount());
    const ctx: ScanContext = { vault, auction, now, keeperAddress, settlementCount, auctionCount };

    for (const strategy of cfg.strategies) {
      const actions = await strategy.scan(ctx);
      for (const action of actions) {
        const key = `${action.type}:${action.id}`;
        if (seen.has(key)) continue;
        if (!(await stillValid(vault, auction, action, now))) continue;
        seen.add(key);

        if (action.type === "execute-settlement") {
          await txm.submit(`execute settlement #${action.id}`, () =>
            vault.executeSettlement(action.id, action.proof)
          );
        } else if (action.type === "refund") {
          await txm.submit(`refund settlement #${action.id}`, () => vault.refund(action.id));
        } else if (action.type === "settle-auction") {
          await txm.submit(`settle auction #${action.id}`, () => auction.settle(action.id));
        }
      }
    }
  };

  if (opts?.once) {
    await tick();
    return;
  }

  console.log(`[keeper] running · strategies: ${cfg.strategies.map((s) => s.name).join(", ")}`);
  for (;;) {
    try {
      await tick();
    } catch (e) {
      console.error("[keeper] tick error:", (e as Error).message);
    }
    await sleep(cfg.pollIntervalMs ?? 15_000);
  }
}
