import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const SETTLE_WINDOW = 2 * 3600; // matches the on-chain constant

describe("HushWire v2 — atomic settleAndPay / permissionless settle / creator rules", function () {
  let auction: any;
  let vault: any;
  let fxrp: any;
  let verifier: any;
  let owner: any, agentA: any, agentB: any, agentC: any, stranger: any;

  const RESERVE = ethers.parseEther("500");
  const BID_B = ethers.parseEther("950");
  const BID_C = ethers.parseEther("1020");

  /** Attest settlement terms as the authority (owner). Mirrors SignatureVerifier. */
  async function attest(
    settlementId: number,
    payer: string,
    payee: string,
    asset: string,
    amount: bigint
  ): Promise<string> {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const terms = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256", "address", "address", "address", "uint256"],
      [await vault.getAddress(), chainId, settlementId, payer, payee, asset, amount]
    );
    return owner.signMessage(ethers.getBytes(terms));
  }

  /** Run a full sealed round: A creates, B/C commit+reveal+escrow. Returns roundId. */
  async function runRound(escrowBoth = true): Promise<number> {
    await auction.connect(agentA).createAuction(await fxrp.getAddress(), RESERVE, 60, 60);

    const saltB = ethers.randomBytes(32);
    const saltC = ethers.randomBytes(32);
    await auction.connect(agentB).commitBid(0, ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [BID_B, saltB])));
    await auction.connect(agentC).commitBid(0, ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [BID_C, saltC])));

    await time.increase(61);
    await auction.connect(agentB).revealBid(0, BID_B, saltB);
    await auction.connect(agentC).revealBid(0, BID_C, saltC);

    if (escrowBoth) {
      await fxrp.connect(agentB).approve(await auction.getAddress(), BID_B);
      await auction.connect(agentB).escrowBid(0);
      await fxrp.connect(agentC).approve(await auction.getAddress(), BID_C);
      await auction.connect(agentC).escrowBid(0);
    }
    return 0;
  }

  beforeEach(async function () {
    [owner, agentA, agentB, agentC, stranger] = await ethers.getSigners();

    const MockFAsset = await ethers.getContractFactory("MockFAsset");
    fxrp = await MockFAsset.deploy("Flare XRP", "FXRP", 18);
    await fxrp.waitForDeployment();

    // Real on-chain verification: authority (owner) signs the exact terms
    const SignatureVerifier = await ethers.getContractFactory("SignatureVerifier");
    verifier = await SignatureVerifier.deploy(owner.address);
    await verifier.waitForDeployment();

    const HushWireVault = await ethers.getContractFactory("HushWireVault");
    vault = await HushWireVault.deploy(await verifier.getAddress());
    await vault.waitForDeployment();

    const SealedBidAuction = await ethers.getContractFactory("SealedBidAuction");
    auction = await SealedBidAuction.deploy(await vault.getAddress());
    await auction.waitForDeployment();

    for (const a of [agentA, agentB, agentC]) {
      await fxrp.transfer(a.address, ethers.parseEther("10000"));
    }
  });

  describe("creator rules", function () {
    it("forbids the creator from bidding in their own auction", async function () {
      await auction.connect(agentA).createAuction(await fxrp.getAddress(), RESERVE, 60, 60);
      await expect(
        auction.connect(agentA).commitBid(0, ethers.keccak256(ethers.randomBytes(32)))
      ).to.be.revertedWithCustomError(auction, "CreatorCannotBid");
    });

    it("still lets other bidders commit (creator ban is per-round)", async function () {
      await auction.connect(agentA).createAuction(await fxrp.getAddress(), RESERVE, 60, 60);
      await auction.connect(agentB).commitBid(0, ethers.keccak256(ethers.randomBytes(32)));
      expect(await auction.hasCommitted(0, agentB.address)).to.be.true;
    });
  });

  describe("bidder escrows", function () {
    it("only funded (escrowed) bids are eligible to win", async function () {
      await runRound(false); // both reveal, NEITHER escrows
      await time.increase(61);
      await expect(auction.connect(agentA).settle(0)).to.be.revertedWithCustomError(auction, "NoValidBids");
    });

    it("ignores unfunded bids when picking the winner", async function () {
      await runRound(false);
      // Only B funds their bid
      await fxrp.connect(agentB).approve(await auction.getAddress(), BID_B);
      await auction.connect(agentB).escrowBid(0);
      await time.increase(61);

      await auction.connect(agentA).settle(0);
      const a = await auction.auctions(0);
      expect(a.winner).to.equal(agentB.address);
      expect(a.winningBid).to.equal(BID_B);
    });

    it("refuses a second escrow for the same bidder", async function () {
      await runRound();
      await expect(auction.connect(agentB).escrowBid(0)).to.be.revertedWithCustomError(auction, "AlreadyEscrowed");
    });

    it("refuses escrowing before the bid is revealed", async function () {
      await auction.connect(agentA).createAuction(await fxrp.getAddress(), RESERVE, 60, 60);
      await auction.connect(agentB).commitBid(0, ethers.keccak256(ethers.randomBytes(32)));
      await expect(auction.connect(agentB).escrowBid(0)).to.be.revertedWithCustomError(auction, "NotRevealed");
    });
  });

  describe("permissionless settle (no hostage)", function () {
    it("blocks non-creators before the settle deadline", async function () {
      await runRound();
      await time.increase(61);
      await expect(auction.connect(stranger).settle(0)).to.be.revertedWithCustomError(auction, "NotCreator");
    });

    it("lets ANYONE settle after the settle deadline", async function () {
      await runRound();
      await time.increase(SETTLE_WINDOW + 130);

      await auction.connect(stranger).settle(0);

      const a = await auction.auctions(0);
      expect(a.settled).to.be.true;
      expect(a.winner).to.equal(agentC.address);
      // Escrows refunded to both bidders
      expect(await fxrp.balanceOf(agentB.address)).to.equal(ethers.parseEther("10000"));
      expect(await fxrp.balanceOf(agentC.address)).to.equal(ethers.parseEther("10000"));
    });

    it("getWinner view returns the funded winner without settling", async function () {
      await runRound();
      const [winner, amount] = await auction.getWinner(0);
      expect(winner).to.equal(agentC.address);
      expect(amount).to.equal(BID_C);
    });
  });

  describe("hostage recovery", function () {
    it("recovers bidder escrows when the creator never settles", async function () {
      await runRound();
      await time.increase(SETTLE_WINDOW + 130);

      await auction.connect(stranger).recover(0);

      expect(await auction.recovered(0)).to.be.true;
      expect(await fxrp.balanceOf(agentB.address)).to.equal(ethers.parseEther("10000"));
      expect(await fxrp.balanceOf(agentC.address)).to.equal(ethers.parseEther("10000"));
      expect(await auction.bidderEscrows(0, agentB.address)).to.equal(0);
      expect(await auction.bidderEscrows(0, agentC.address)).to.equal(0);
    });

    it("blocks recover before the settle deadline", async function () {
      await runRound();
      await time.increase(61);
      await expect(auction.connect(stranger).recover(0)).to.be.revertedWithCustomError(
        auction,
        "SettleDeadlineNotPassed"
      );
    });

    it("a recovered round can never be settled or paid", async function () {
      await runRound();
      await time.increase(SETTLE_WINDOW + 130);
      await auction.connect(stranger).recover(0);

      await expect(auction.connect(agentA).settle(0)).to.be.revertedWithCustomError(auction, "AlreadyRecovered");
      await expect(
        auction.connect(agentA).settleAndPay(0, 0, ethers.randomBytes(65))
      ).to.be.revertedWithCustomError(auction, "AlreadyRecovered");
    });
  });

  describe("settleAndPay — atomic attestation-gated release", function () {
    it("settles the round AND releases the payment in the SAME transaction", async function () {
      await runRound();
      await time.increase(61);

      const [winner, winningBid] = await auction.getWinner(0);
      expect(winner).to.equal(agentC.address);

      // Creator escrows the winning payment into the vault
      await fxrp.connect(agentA).approve(await vault.getAddress(), winningBid);
      await vault.connect(agentA).createSettlement(winner, await fxrp.getAddress(), winningBid, 3600);

      // Authority signs the exact settlement terms
      const proof = await attest(0, agentA.address, winner, await fxrp.getAddress(), winningBid);

      // ANYONE triggers the atomic settle + pay
      await auction.connect(stranger).settleAndPay(0, 0, proof);

      const a = await auction.auctions(0);
      expect(a.settled).to.be.true;
      expect(a.winner).to.equal(agentC.address);

      // Winner received the payment…
      expect(await fxrp.balanceOf(agentC.address)).to.equal(ethers.parseEther("10000") + winningBid);
      // …bidder escrows were refunded…
      expect(await fxrp.balanceOf(agentB.address)).to.equal(ethers.parseEther("10000"));
      // …and the vault settlement is executed.
      const s = await vault.settlements(0);
      expect(s.executed).to.be.true;
    });

    it("reverts the WHOLE transaction when the attestation is invalid", async function () {
      await runRound();
      await time.increase(61);

      const [, winningBid] = await auction.getWinner(0);
      await fxrp.connect(agentA).approve(await vault.getAddress(), winningBid);
      await vault.connect(agentA).createSettlement(agentC.address, await fxrp.getAddress(), winningBid, 3600);

      await expect(
        auction.connect(stranger).settleAndPay(0, 0, ethers.randomBytes(65))
      ).to.be.revertedWithCustomError(vault, "AttestationFailed");

      // Atomicity: nothing happened — round unsettled, funds untouched.
      expect((await auction.auctions(0)).settled).to.be.false;
      // B/C escrows are still locked in the auction (round is not terminal)
      expect(await fxrp.balanceOf(agentC.address)).to.equal(ethers.parseEther("10000") - BID_C);
      expect((await vault.settlements(0)).executed).to.be.false;
    });

    it("rejects an escrow that does not match the round outcome", async function () {
      await runRound();
      await time.increase(61);

      // Wrong amount (950 instead of the winning 1020)
      await fxrp.connect(agentA).approve(await vault.getAddress(), BID_B);
      await vault.connect(agentA).createSettlement(agentC.address, await fxrp.getAddress(), BID_B, 3600);

      const proof = await attest(0, agentA.address, agentC.address, await fxrp.getAddress(), BID_B);
      await expect(auction.connect(stranger).settleAndPay(0, 0, proof)).to.be.revertedWithCustomError(
        auction,
        "SettlementMismatch"
      );
    });

    it("is blocked before the reveal window closes", async function () {
      await auction.connect(agentA).createAuction(await fxrp.getAddress(), RESERVE, 60, 60);
      await expect(auction.connect(stranger).settleAndPay(0, 0, ethers.randomBytes(65))).to.be.revertedWithCustomError(
        auction,
        "RevealPhaseActive"
      );
    });
  });
});
