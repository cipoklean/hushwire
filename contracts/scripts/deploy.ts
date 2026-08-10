import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying HushWire contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "FLR");

  // --- 1. Deploy Mock FAsset Token (FXRP) for demo ---
  const MockFAsset = await ethers.getContractFactory("MockFAsset");
  const fxrp = await MockFAsset.deploy("Flare XRP", "FXRP", 18);
  await fxrp.waitForDeployment();
  console.log("MockFAsset (FXRP):", await fxrp.getAddress());

  // --- 2. Deploy SignatureVerifier (authority = deployer) ---
  // On mainnet, replace with Flare Confidential Compute's real attestation verifier.
  const SignatureVerifier = await ethers.getContractFactory("SignatureVerifier");
  const verifier = await SignatureVerifier.deploy(deployer.address);
  await verifier.waitForDeployment();
  console.log("SignatureVerifier (authority = deployer):", await verifier.getAddress());

  // Deploy HushWireVault gated by the verifier (vault first — the auction
  // needs its address for settleAndPay)
  const HushWireVault = await ethers.getContractFactory("HushWireVault");
  const vault = await HushWireVault.deploy(await verifier.getAddress());
  await vault.waitForDeployment();
  console.log("HushWireVault:", await vault.getAddress());

  // --- 4. Deploy SealedBidAuction (needs the vault for atomic settleAndPay) ---
  const SealedBidAuction = await ethers.getContractFactory("SealedBidAuction");
  const auction = await SealedBidAuction.deploy(await vault.getAddress());
  await auction.waitForDeployment();
  console.log("SealedBidAuction:", await auction.getAddress());

  // --- Summary ---
  const network = await ethers.provider.getNetwork();
  const deployedBlock = await ethers.provider.getBlockNumber();
  console.log("\n=== HushWire Deployment Summary ===");
  console.log("Network chainId:", network.chainId.toString());
  console.log("FXRP Token:          ", await fxrp.getAddress());
  console.log("SignatureVerifier:   ", await verifier.getAddress(), "(authority = deployer)");
  console.log("SealedBidAuction:    ", await auction.getAddress());
  console.log("HushWireVault:       ", await vault.getAddress());
  console.log("===================================\n");

  // Write addresses for frontend
  const addresses = {
    network: "coston2",
    chainId: Number(network.chainId),
    rpcUrl: "https://coston2-api.flare.network/ext/C/rpc",
    fxrpToken: await fxrp.getAddress(),
    signatureVerifier: await verifier.getAddress(),
    sealedBidAuction: await auction.getAddress(),
    hushWireVault: await vault.getAddress(),
    deployedBlock,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(__dirname, "../../src/lib/addresses.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("Addresses written to src/lib/addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
