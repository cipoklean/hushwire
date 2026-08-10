import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("HushWire Protocol", function () {
  let auction: any;
  let vault: any;
  let fxrp: any;
  let verifier: any;
  let owner: any, agentA: any, agentB: any, agentC: any;

  beforeEach(async function () {
    [owner, agentA, agentB, agentC] = await ethers.getSigners();

    // Deploy MockFAsset
    const MockFAsset = await ethers.getContractFactory("MockFAsset");
    fxrp = await MockFAsset.deploy("Flare XRP", "FXRP", 18);
    await fxrp.waitForDeployment();

    // Deploy accepting enclave verifier (mock)
    const MockEnclaveVerifier = await ethers.getContractFactory("MockEnclaveVerifier");
    verifier = await MockEnclaveVerifier.deploy();
    await verifier.waitForDeployment();

    // Deploy HushWireVault gated by the verifier (vault first — the auction
    // needs its address for atomic settleAndPay)
    const HushWireVault = await ethers.getContractFactory("HushWireVault");
    vault = await HushWireVault.deploy(await verifier.getAddress());
    await vault.waitForDeployment();

    // Deploy SealedBidAuction
    const SealedBidAuction = await ethers.getContractFactory("SealedBidAuction");
    auction = await SealedBidAuction.deploy(await vault.getAddress());
    await auction.waitForDeployment();

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
        60,
        60
      );
      expect(await auction.auctionCount()).to.equal(1);
    });

    it("should reject zero-duration auctions", async function () {
      await expect(
        auction.connect(agentA).createAuction(await fxrp.getAddress(), ethers.parseEther("500"), 0, 60)
      ).to.be.revertedWithCustomError(auction, "ZeroDuration");
    });

    it("should reject zero-address asset", async function () {
      await expect(
        auction.connect(agentA).createAuction(ethers.ZeroAddress, ethers.parseEther("500"), 60, 60)
      ).to.be.revertedWithCustomError(auction, "ZeroAddress");
    });

    it("should accept sealed bid commits", async function () {
      await auction.connect(agentA).createAuction(await fxrp.getAddress(), ethers.parseEther("500"), 60, 60);

      const amount = ethers.parseEther("950");
      const salt = ethers.randomBytes(32);
      const hash = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [amount, salt]));

      await auction.connect(agentB).commitBid(0, hash);
      const bidders = await auction.getBidders(0);
      expect(bidders).to.include(agentB.address);
    });

    it("should reject a zero commit hash", async function () {
      await auction.connect(agentA).createAuction(await fxrp.getAddress(), ethers.parseEther("500"), 60, 60);
      await expect(
        auction.connect(agentB).commitBid(0, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(auction, "ZeroHash");
    });

    it("should reject duplicate commits from the same bidder", async function () {
      await auction.connect(agentA).createAuction(await fxrp.getAddress(), ethers.parseEther("500"), 60, 60);

      const hash = ethers.keccak256(ethers.randomBytes(32));
      await auction.connect(agentB).commitBid(0, hash);

      await expect(
        auction.connect(agentB).commitBid(0, ethers.keccak256(ethers.randomBytes(32)))
      ).to.be.revertedWithCustomError(auction, "AlreadyCommitted");

      // Bidder list must not contain duplicates
      const bidders = await auction.getBidders(0);
      expect(bidders.length).to.equal(1);
    });

    it("should reject commits after deadline", async function () {
      await auction.connect(agentA).createAuction(await fxrp.getAddress(), ethers.parseEther("500"), 60, 60);
      await time.increase(61);

      const hash = ethers.keccak256(ethers.randomBytes(32));
      await expect(
        auction.connect(agentB).commitBid(0, hash)
      ).to.be.revertedWithCustomError(auction, "CommitPhaseOver");
    });

    it("should verify reveal matches commit", async function () {
      await auction.connect(agentA).createAuction(await fxrp.getAddress(), ethers.parseEther("500"), 60, 60);

      const amount = ethers.parseEther("1020");
      const salt = ethers.randomBytes(32);
      const hash = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [amount, salt]));

      await auction.connect(agentB).commitBid(0, hash);
      await time.increase(61);

      await auction.connect(agentB).revealBid(0, amount, salt);
    });

    it("should reject reveal from a non-committed bidder", async function () {
      await auction.connect(agentA).createAuction(await fxrp.getAddress(), ethers.parseEther("500"), 60, 60);
      await time.increase(61);

      await expect(
        auction.connect(agentC).revealBid(0, ethers.parseEther("100"), ethers.randomBytes(32))
      ).to.be.revertedWithCustomError(auction, "NotCommitted");
    });

    it("should reject invalid reveal", async function () {
      await auction.connect(agentA).createAuction(await fxrp.getAddress(), ethers.parseEther("500"), 60, 60);

      const amount = ethers.parseEther("1020");
      const salt = ethers.randomBytes(32);
      const hash = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [amount, salt]));

      await auction.connect(agentB).commitBid(0, hash);
      await time.increase(61);

      await expect(
        auction.connect(agentB).revealBid(0, ethers.parseEther("9999"), salt)
      ).to.be.revertedWithCustomError(auction, "InvalidReveal");
    });

    it("should settle with highest valid bid", async function () {
      await auction.connect(agentA).createAuction(await fxrp.getAddress(), ethers.parseEther("500"), 60, 60);

      const amountB = ethers.parseEther("950");
      const saltB = ethers.randomBytes(32);
      const hashB = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [amountB, saltB]));
      await auction.connect(agentB).commitBid(0, hashB);

      const amountC = ethers.parseEther("1020");
      const saltC = ethers.randomBytes(32);
      const hashC = ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [amountC, saltC]));
      await auction.connect(agentC).commitBid(0, hashC);

      await time.increase(61);
      await auction.connect(agentB).revealBid(0, amountB, saltB);
      await auction.connect(agentC).revealBid(0, amountC, saltC);

      // Bidders back their revealed bids (only funded bids are eligible to win)
      await fxrp.connect(agentB).approve(await auction.getAddress(), amountB);
      await auction.connect(agentB).escrowBid(0);
      await fxrp.connect(agentC).approve(await auction.getAddress(), amountC);
      await auction.connect(agentC).escrowBid(0);

      await time.increase(61);

      await auction.connect(agentA).settle(0);

      const a = await auction.auctions(0);
      expect(a.settled).to.be.true;
      expect(a.winner).to.equal(agentC.address);
      expect(a.winningBid).to.equal(amountC);

      // Escrows are refunded at settle
      expect(await fxrp.balanceOf(agentB.address)).to.equal(ethers.parseEther("10000"));
      expect(await fxrp.balanceOf(agentC.address)).to.equal(ethers.parseEther("10000"));
    });
  });

  describe("HushWireVault", function () {
    it("should escrow and execute settlement with a valid attestation", async function () {
      const amount = ethers.parseEther("1020");
      await fxrp.connect(agentA).approve(await vault.getAddress(), amount);

      await vault.connect(agentA).createSettlement(
        agentC.address,
        await fxrp.getAddress(),
        amount,
        3600
      );

      // Execution is verifier-gated and permissionless; mock verifier accepts.
      const proof = ethers.keccak256(ethers.randomBytes(32));
      await vault.connect(agentB).executeSettlement(0, proof);

      const s = await vault.settlements(0);
      expect(s.executed).to.be.true;
      expect(await fxrp.balanceOf(agentC.address)).to.equal(ethers.parseEther("10000") + amount);
    });

    it("should reject execution when attestation fails", async function () {
      // Swap in a rejecting verifier
      const MockRejectingVerifier = await ethers.getContractFactory("MockRejectingVerifier");
      const rejecter = await MockRejectingVerifier.deploy();
      await rejecter.waitForDeployment();
      await vault.connect(owner).setVerifier(await rejecter.getAddress());

      const amount = ethers.parseEther("500");
      await fxrp.connect(agentA).approve(await vault.getAddress(), amount);
      await vault.connect(agentA).createSettlement(agentC.address, await fxrp.getAddress(), amount, 3600);

      await expect(
        vault.connect(agentB).executeSettlement(0, ethers.keccak256(ethers.randomBytes(32)))
      ).to.be.revertedWithCustomError(vault, "AttestationFailed");
    });

    it("should reject zero-amount settlement", async function () {
      await expect(
        vault.connect(agentA).createSettlement(agentC.address, await fxrp.getAddress(), 0, 3600)
      ).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("should reject zero-address payee", async function () {
      await expect(
        vault.connect(agentA).createSettlement(ethers.ZeroAddress, await fxrp.getAddress(), 100, 3600)
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("should not allow the owner to drain escrow", async function () {
      // Owner is NOT the verifier and holds no special execution privilege.
      const amount = ethers.parseEther("500");
      await fxrp.connect(agentA).approve(await vault.getAddress(), amount);
      await vault.connect(agentA).createSettlement(agentC.address, await fxrp.getAddress(), amount, 3600);

      // Swap to rejecting verifier: even the owner cannot force execution.
      const MockRejectingVerifier = await ethers.getContractFactory("MockRejectingVerifier");
      const rejecter = await MockRejectingVerifier.deploy();
      await rejecter.waitForDeployment();
      await vault.connect(owner).setVerifier(await rejecter.getAddress());

      await expect(
        vault.connect(owner).executeSettlement(0, ethers.keccak256(ethers.randomBytes(32)))
      ).to.be.revertedWithCustomError(vault, "AttestationFailed");
    });

    it("should allow refund after deadline", async function () {
      const amount = ethers.parseEther("500");
      await fxrp.connect(agentA).approve(await vault.getAddress(), amount);
      await vault.connect(agentA).createSettlement(agentC.address, await fxrp.getAddress(), amount, 60);

      await time.increase(61);
      await vault.connect(agentA).refund(0);

      const s = await vault.settlements(0);
      expect(s.refunded).to.be.true;
    });

    it("should reject refund before deadline", async function () {
      const amount = ethers.parseEther("500");
      await fxrp.connect(agentA).approve(await vault.getAddress(), amount);
      await vault.connect(agentA).createSettlement(agentC.address, await fxrp.getAddress(), amount, 3600);

      await expect(vault.connect(agentA).refund(0)).to.be.revertedWithCustomError(vault, "DeadlineNotPassed");
    });

    it("should reject refund from non-payer", async function () {
      const amount = ethers.parseEther("500");
      await fxrp.connect(agentA).approve(await vault.getAddress(), amount);
      await vault.connect(agentA).createSettlement(agentC.address, await fxrp.getAddress(), amount, 60);

      await time.increase(61);
      await expect(vault.connect(agentB).refund(0)).to.be.revertedWithCustomError(vault, "NotPayer");
    });

    it("should only let owner rotate the verifier", async function () {
      await expect(
        vault.connect(agentB).setVerifier(agentB.address)
      ).to.be.revertedWithCustomError(vault, "NotOwner");
    });
  });
});
