import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// Helpers ---------------------------------------------------------------

function attestationPayload(
  vault: string,
  chainId: bigint,
  id: number,
  payer: string,
  payee: string,
  asset: string,
  amount: bigint
): string {
  return ethers.solidityPackedKeccak256(
    ["address", "uint256", "uint256", "address", "address", "address", "uint256"],
    [vault, chainId, id, payer, payee, asset, amount]
  );
}

/** Sign the payload exactly as the authority does off-chain (single EIP-191 wrap). */
async function signPayload(payload: string, signer: any): Promise<string> {
  // ethers.signMessage applies EIP-191 to the given message bytes. We pass the 32-byte
  // payload so the signed digest = keccak256("\x19Ethereum Signed Message:\n32" + payload).
  return signer.signMessage(ethers.getBytes(payload));
}

// ------------------------------------------------------------------------

describe("SignatureVerifier", function () {
  let verifier: any;
  let vault: any;
  let fxrp: any;
  let owner: any, authority: any, wrongSigner: any, agentA: any, agentC: any;
  let chainId: bigint;

  beforeEach(async function () {
    [owner, authority, wrongSigner, agentA, agentC] = await ethers.getSigners();
    chainId = (await ethers.provider.getNetwork()).chainId;

    const MockFAsset = await ethers.getContractFactory("MockFAsset");
    fxrp = await MockFAsset.deploy("Flare XRP", "FXRP", 18);

    const Sig = await ethers.getContractFactory("SignatureVerifier");
    verifier = await Sig.deploy(authority.address);

    const Vault = await ethers.getContractFactory("HushWireVault");
    vault = await Vault.deploy(await verifier.getAddress());

    await fxrp.transfer(agentA.address, ethers.parseEther("10000"));
  });

  describe("HushWireVault + SignatureVerifier", function () {
    async function escrow(amount: bigint) {
      await fxrp.connect(agentA).approve(await vault.getAddress(), amount);
      await vault.connect(agentA).createSettlement(
        agentC.address,
        await fxrp.getAddress(),
        amount,
        3600
      );
      return 0; // settlement id
    }

    it("executes when the authority signs the exact terms", async function () {
      const amount = ethers.parseEther("1020");
      await escrow(amount);

      const payload = attestationPayload(
        await vault.getAddress(), chainId, 0,
        agentA.address, agentC.address, await fxrp.getAddress(), amount
      );
      const sig = await signPayload(payload, authority);

      await vault.connect(agentA).executeSettlement(0, sig);

      expect(await fxrp.balanceOf(agentC.address)).to.equal(amount);
      const s = await vault.settlements(0);
      expect(s.executed).to.be.true;
    });

    it("rejects a signature from the wrong signer", async function () {
      const amount = ethers.parseEther("1020");
      await escrow(amount);

      const payload = attestationPayload(
        await vault.getAddress(), chainId, 0,
        agentA.address, agentC.address, await fxrp.getAddress(), amount
      );
      const sig = await signPayload(payload, wrongSigner);

      await expect(
        vault.connect(agentA).executeSettlement(0, sig)
      ).to.be.revertedWithCustomError(vault, "AttestationFailed");
    });

    it("rejects a valid-authority signature over WRONG terms (different amount)", async function () {
      const amount = ethers.parseEther("1020");
      await escrow(amount);

      // Authority signs for 999, vault checks 1020 → must fail.
      const wrongPayload = attestationPayload(
        await vault.getAddress(), chainId, 0,
        agentA.address, agentC.address, await fxrp.getAddress(), ethers.parseEther("999")
      );
      const sig = await signPayload(wrongPayload, authority);

      await expect(
        vault.connect(agentA).executeSettlement(0, sig)
      ).to.be.revertedWithCustomError(vault, "AttestationFailed");
    });

    it("rejects a valid-authority signature for a DIFFERENT settlement id (replay)", async function () {
      const amount = ethers.parseEther("1020");
      await escrow(amount); // id 0
      await escrow(amount); // id 1

      // Sign settlement 1, try to use it on settlement 0
      const payload1 = attestationPayload(
        await vault.getAddress(), chainId, 1,
        agentA.address, agentC.address, await fxrp.getAddress(), amount
      );
      const sig = await signPayload(payload1, authority);

      await expect(
        vault.connect(agentA).executeSettlement(0, sig)
      ).to.be.revertedWithCustomError(vault, "AttestationFailed");
    });

    it("rejects malformed (non-65-byte) proof", async function () {
      const amount = ethers.parseEther("1020");
      await escrow(amount);
      await expect(
        vault.connect(agentA).executeSettlement(0, "0x1234")
      ).to.be.revertedWithCustomError(vault, "AttestationFailed");
    });

    it("cannot execute twice (replay the same valid signature)", async function () {
      const amount = ethers.parseEther("1020");
      await escrow(amount);
      const payload = attestationPayload(
        await vault.getAddress(), chainId, 0,
        agentA.address, agentC.address, await fxrp.getAddress(), amount
      );
      const sig = await signPayload(payload, authority);

      await vault.connect(agentA).executeSettlement(0, sig);
      await expect(
        vault.connect(agentA).executeSettlement(0, sig)
      ).to.be.revertedWithCustomError(vault, "AlreadyExecuted");
    });
  });
});
