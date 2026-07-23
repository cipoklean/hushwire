import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("HushWire Protocol", function () {
  let auction: any;
  let vault: any;
  let fxrp: any;
  let owner: any, agentA: any, agentB: any, agentC: any;

  beforeEach(async function () {
    [owner, agentA, agentB, agentC] = await ethers.getSigners();

    // Deploy MockFAsset
    const MockFAsset = await ethers.getContractFactory("MockFAsset");
    fxrp = await MockFAsset.deploy("Flare XRP", "FXRP", 18);
    await fxrp.waitForDeployment();

    // Deploy SealedBidAuction
    const SealedBidAuction = await ethers.getContractFactory("SealedBidAuction");
    auction = await SealedBidAuction.deploy();
    await auction.waitForDeployment();

    // Deploy HushWireVault (owner as enclave attester for testing)
    const HushWireVault = await ethers.getContractFactory("HushWireVault");
    vault = await HushWireVault.deploy(owner.address);
    await vault.waitForDeployment();

    // Distribute FXRP to agents
    await fxrp.transfer(agentA.address, ethers.parseEther("10000"));
    await fxrp.transfer(agentB.address, ethers.parseEther("10000"));
    await fxrp.transfer(agentC.address, ethers.parseEther("10000"));
  });

  describe("SealedBidAuction", function () {
    it("should create an auction", async function () {
      await auction.connect(agentA).createAuction(
        await fxrp.getAddress(),
        ethers.parseEther("500"),
        60, // commit duration
        60  // reveal duration
      );

      expect(await auction.auctionCount()).to.equal(1);
    });

    it("should accept sealed bid commits", async function () {
      await auction.connect(agentA).createAuction(
        await fxrp.getAddress(),
        ethers.parseEther("500"),
        60,
        60
      );

      const amount = ethers.parseEther("950");
      const salt = ethers.randomBytes(32);
      const hash = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount, salt])
      );

      await auction.connect(agentB).commitBid(0, hash);
      const bidders = await auction.getBidders(0);
      expect(bidders).to.include(agentB.address);
    });

    it("should reject commits after deadline", async function () {
      await auction.connect(agentA).createAuction(
        await fxrp.getAddress(),
        ethers.parseEther("500"),
        60,
        60
      );

      await time.increase(61);

      const hash = ethers.keccak256(ethers.randomBytes(32));
      await expect(
        auction.connect(agentB).commitBid(0, hash)
      ).to.be.revertedWithCustomError(auction, "CommitPhaseOver");
    });

    it("should verify reveal matches commit", async function () {
      await auction.connect(agentA).createAuction(
        await fxrp.getAddress(),
        ethers.parseEther("500"),
        60,
        60
      );

      const amount = ethers.parseEther("1020");
      const salt = ethers.randomBytes(32);
      const hash = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount, salt])
      );

      await auction.connect(agentB).commitBid(0, hash);
      await time.increase(61); // past commit deadline

      await auction.connect(agentB).revealBid(0, amount, salt);
      // Valid reveal should not revert
    });

    it("should reject invalid reveal", async function () {
      await auction.connect(agentA).createAuction(
        await fxrp.getAddress(),
        ethers.parseEther("500"),
        60,
        60
      );

      const amount = ethers.parseEther("1020");
      const salt = ethers.randomBytes(32);
      const hash = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amount, salt])
      );

      await auction.connect(agentB).commitBid(0, hash);
      await time.increase(61);

      // Try to reveal a different amount
      await expect(
        auction.connect(agentB).revealBid(0, ethers.parseEther("9999"), salt)
      ).to.be.revertedWithCustomError(auction, "InvalidReveal");
    });

    it("should settle with highest valid bid", async function () {
      await auction.connect(agentA).createAuction(
        await fxrp.getAddress(),
        ethers.parseEther("500"),
        60,
        60
      );

      // Agent B bids 950
      const amountB = ethers.parseEther("950");
      const saltB = ethers.randomBytes(32);
      const hashB = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amountB, saltB])
      );
      await auction.connect(agentB).commitBid(0, hashB);

      // Agent C bids 1020
      const amountC = ethers.parseEther("1020");
      const saltC = ethers.randomBytes(32);
      const hashC = ethers.keccak256(
        ethers.solidityPacked(["uint256", "bytes32"], [amountC, saltC])
      );
      await auction.connect(agentC).commitBid(0, hashC);

      await time.increase(61); // past commit

      await auction.connect(agentB).revealBid(0, amountB, saltB);
      await auction.connect(agentC).revealBid(0, amountC, saltC);

      await time.increase(61); // past reveal

      await auction.connect(agentA).settle(0);

      const a = await auction.auctions(0);
      expect(a.settled).to.be.true;
      expect(a.winner).to.equal(agentC.address);
      expect(a.winningBid).to.equal(amountC);
    });
  });

  describe("HushWireVault", function () {
    it("should escrow and execute settlement", async function () {
      const amount = ethers.parseEther("1020");

      // Agent A approves vault
      await fxrp.connect(agentA).approve(await vault.getAddress(), amount);

      // Create settlement
      await vault.connect(agentA).createSettlement(
        agentC.address,
        await fxrp.getAddress(),
        amount,
        3600 // 1 hour deadline
      );

      // Execute with enclave proof (owner is attester in test)
      const proof = ethers.keccak256(ethers.randomBytes(32));
      await vault.connect(owner).executeSettlement(0, proof);

      const s = await vault.settlements(0);
      expect(s.executed).to.be.true;
      expect(await fxrp.balanceOf(agentC.address)).to.equal(
        ethers.parseEther("10000") + amount
      );
    });

    it("should allow refund after deadline", async function () {
      const amount = ethers.parseEther("500");

      await fxrp.connect(agentA).approve(await vault.getAddress(), amount);
      await vault.connect(agentA).createSettlement(
        agentC.address,
        await fxrp.getAddress(),
        amount,
        60 // 60 second deadline
      );

      await time.increase(61);

      await vault.connect(agentA).refund(0);
      const s = await vault.settlements(0);
      expect(s.refunded).to.be.true;
    });

    it("should reject execution by non-attester", async function () {
      const amount = ethers.parseEther("500");
      await fxrp.connect(agentA).approve(await vault.getAddress(), amount);
      await vault.connect(agentA).createSettlement(
        agentC.address,
        await fxrp.getAddress(),
        amount,
        3600
      );

      const proof = ethers.keccak256(ethers.randomBytes(32));
      await expect(
        vault.connect(agentB).executeSettlement(0, proof)
      ).to.be.revertedWithCustomError(vault, "NotAttester");
    });
  });
});
