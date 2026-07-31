import { ethers } from "hardhat";

async function main() {
  const provider = new ethers.JsonRpcProvider(
    "https://coston2-api.flare.network/ext/C/rpc",
    { chainId: 114, name: "flare" }
  );

  const addresses = {
    fxrpToken: "0x7d59e809DB91270Dfd788956FA1E4d6E915F0E28",
    signatureVerifier: "0x059F2780132a1d5bb54E1cAab7675C8338124d71",
    sealedBidAuction: "0x75F74f18B126fc3f95AFe19BB367A9a6b3a5C7fC",
    hushWireVault: "0x3b55807B50e0217efCab081AAD3C051C57a3D505",
    rpcUrl: "https://coston2-api.flare.network/ext/C/rpc",
    chainId: 114,
  };

  const deployerWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY || "", provider);
  const chainId = 114n;

  const VAULT_ABI = [
    "function settlementCount() view returns (uint256)",
    "function settlements(uint256) view returns (address payer, address payee, address asset, uint256 amount, uint64 deadline, bool executed, bool refunded, bytes enclaveProof)",
    "function executeSettlement(uint256 _id, bytes _enclaveProof)",
  ];

  const vault = new ethers.Contract(addresses.hushWireVault, VAULT_ABI, deployerWallet);
  const settlementCount = await vault.settlementCount();
  console.log("Settlement count:", settlementCount.toString());

  if (settlementCount > 0) {
    const s = await vault.settlements(0);
    console.log("Settlement 0:", {
      payer: s.payer,
      payee: s.payee,
      asset: s.asset,
      amount: s.amount.toString(),
      deadline: s.deadline.toString(),
      executed: s.executed,
      refunded: s.refunded,
      enclaveProof: s.enclaveProof?.slice(0, 20) + "..."
    });

    const chainIdVal = 114n;
    const payload = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256", "address", "address", "address", "uint256"],
      ["0x3b55807B50e0217efCab081AAD3C051C57a3D505", chainIdVal, 0, s.payer, s.payee, s.asset, s.amount]
    );

    console.log("Expected payload:", payload);
    console.log("Payload match:", payload);

    // sign with deployer (authority)
    const sig = await deployerWallet.signMessage(ethers.getBytes(payload));
    console.log("Signature:", sig);

    // verify recovery
    const rec = ethers.verifyMessage(ethers.getBytes(ethers.keccak256(
      ethers.concat([
        ethers.toUtf8Bytes("\x19Ethereum Signed Message:\n32"),
        ethers.getBytes(payload)
      ])
    )), sig);
    console.log("verifyMessage(digest) recovered:", rec);
  }
}

main().catch(e => { console.error(e); process.exit(1); });