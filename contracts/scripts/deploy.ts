import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying HushWire contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "FLR");

  // --- 1. Deploy Mock FAsset Token (FXRP) for demo ---
  const MockFAsset = await ethers.getContractFactory("MockFAsset");
  const fxrp = await MockFAsset.deploy("Flare XRP", "FXRP", 18);
  await fxrp.waitForDeployment();
  console.log("MockFAsset (FXRP):", await fxrp.getAddress());

  // --- 2. Deploy SealedBidAuction ---
  const SealedBidAuction = await ethers.getContractFactory("SealedBidAuction");
  const auction = await SealedBidAuction.deploy();
  await auction.waitForDeployment();
  console.log("SealedBidAuction:", await auction.getAddress());

  // --- 3. Deploy HushWireVault ---
  // For demo, deployer acts as enclave attester (in production: Flare Confidential Compute oracle)
  const HushWireVault = await ethers.getContractFactory("HushWireVault");
  const vault = await HushWireVault.deploy(deployer.address);
  await vault.waitForDeployment();
  console.log("HushWireVault:", await vault.getAddress());

  // --- 4. Deploy FAssetSettlement ---
  const FAssetSettlement = await ethers.getContractFactory("FAssetSettlement");
  const settlement = await FAssetSettlement.deploy(
    ethers.ZeroAddress, // FAssetManager placeholder (use real address on mainnet)
    await vault.getAddress(),
    await fxrp.getAddress()
  );
  await settlement.waitForDeployment();
  console.log("FAssetSettlement:", await settlement.getAddress());

  // --- Summary ---
  console.log("\n=== HushWire Deployment Summary ===");
  console.log("Network:", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("FXRP Token:      ", await fxrp.getAddress());
  console.log("SealedBidAuction:", await auction.getAddress());
  console.log("HushWireVault:   ", await vault.getAddress());
  console.log("FAssetSettlement:", await settlement.getAddress());
  console.log("===================================\n");

  // Write addresses for frontend
  const addresses = {
    network: "coston2",
    chainId: 114,
    fxrpToken: await fxrp.getAddress(),
    sealedBidAuction: await auction.getAddress(),
    hushWireVault: await vault.getAddress(),
    fassetSettlement: await settlement.getAddress(),
    deployedAt: new Date().toISOString(),
  };

  const fs = await import("fs");
  fs.writeFileSync(
    "../src/lib/addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("Addresses written to src/lib/addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
