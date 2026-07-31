import { ethers } from "hardhat";

async function main() {
  const [authority, agentA, agentC] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  const MockFAsset = await ethers.getContractFactory("MockFAsset");
  const fxrp = await MockFAsset.deploy("Flare XRP", "FXRP", 18);
  const Sig = await ethers.getContractFactory("SignatureVerifier");
  const verifier = await Sig.deploy(authority.address);
  const Vault = await ethers.getContractFactory("HushWireVault");
  const vault = await Vault.deploy(await verifier.getAddress());

  const amount = ethers.parseEther("1020");
  const id = 0;

  // off-chain payload (same helper as tests)
  const payload = ethers.solidityPackedKeccak256(
    ["address","uint256","uint256","address","address","address","uint256"],
    [await vault.getAddress(), chainId, id, agentA.address, agentC.address, await fxrp.getAddress(), amount]
  );
  const digest = ethers.keccak256(ethers.concat([
    ethers.toUtf8Bytes("\x19Ethereum Signed Message:\n32"),
    ethers.getBytes(payload),
  ]));
  const sig = await authority.signMessage(ethers.getBytes(payload)); // note: signMessage applies EIP-191 to the raw payload bytes
  const sig2 = await authority.signMessage(ethers.getBytes(digest)); // alternative: sign the 32-byte hash

  // read what Solidity computes
  const onchainPayload = await verifier.payload(await vault.getAddress(), chainId, id, agentA.address, agentC.address, await fxrp.getAddress(), amount);
  const onchainDigest = ethers.keccak256(ethers.concat([
    ethers.toUtf8Bytes("\x19Ethereum Signed Message:\n32"),
    ethers.getBytes(onchainPayload),
  ]));

  console.log("offchain  payload:", payload);
  console.log("onchain   payload:", onchainPayload);
  console.log("payload match:", payload === onchainPayload);
  console.log("offchain  digest :", digest);
  console.log("onchain   digest :", onchainDigest);
  console.log("digest match:", digest === onchainDigest);
  console.log("signature  (EIP191 over payload):", sig);
  console.log("signature2 (EIP191 over digest ):", sig2);
  console.log("sig len:", Buffer.from(sig.slice(2), "hex").length);

  // recover both ways in-JS to see which matches authority
  const recA = ethers.verifyMessage(ethers.getBytes(payload), sig); // signer of payload-EIP191
  const recB = ethers.verifyMessage(ethers.getBytes(digest), sig);
  console.log("verifyMessage(payload) recovered:", recA, "= authority?", recA === authority.address);
  console.log("verifyMessage(digest) recovered:", recB, "= authority?", recB === authority.address);
}
main().catch(e => { console.error(e); process.exit(1); });
