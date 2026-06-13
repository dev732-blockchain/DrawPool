import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("DrawPool Smart Contract Tests", function () {
  let usdt: any;
  let coordinator: any;
  let drawpool: any;
  
  let owner: any;
  let user1: any;
  let user2: any;
  let user3: any;

  let subId: any;
  const keyHash = "0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899";

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user1 = signers[1];
    user2 = signers[2];
    user3 = signers[3];

    // 1. Deploy VRF Coordinator Mock
    const baseFee = ethers.parseEther("0.1");
    const gasPriceLink = 1e9;
    const weiPerUnitLink = ethers.parseEther("1");
    const CoordinatorFactory = await ethers.getContractFactory("MockVRFCoordinator");
    coordinator = await CoordinatorFactory.deploy(baseFee, gasPriceLink, weiPerUnitLink);
    await coordinator.waitForDeployment();

    // Create Subscription
    const createSubTx = await coordinator.createSubscription();
    const createSubReceipt = await createSubTx.wait();
    const coordInterface = coordinator.interface;
    const subCreatedLog = createSubReceipt?.logs.find(
      (l) => coordInterface.parseLog(l as any)?.name === "SubscriptionCreated"
    );
    subId = coordInterface.parseLog(subCreatedLog as any)?.args[0];

    // Fund Subscription
    await coordinator.fundSubscription(subId, ethers.parseEther("10"));

    // 2. Deploy Mock USDT
    const USDTFactory = await ethers.getContractFactory("MockUSDT");
    usdt = await USDTFactory.deploy();
    await usdt.waitForDeployment();

    // 3. Deploy DrawPool
    const DrawPoolFactory = await ethers.getContractFactory("DrawPool");
    drawpool = await DrawPoolFactory.deploy(
      await usdt.getAddress(),
      await coordinator.getAddress(),
      subId,
      keyHash
    );
    await drawpool.waitForDeployment();

    // Add consumer
    await coordinator.addConsumer(subId, await drawpool.getAddress());

    // Distribute and approve USDT
    const defaultMintAmount = ethers.parseUnits("1000", 6); // $1000 USDT
    await usdt.mint(user1.address, defaultMintAmount);
    await usdt.mint(user2.address, defaultMintAmount);
    await usdt.mint(user3.address, defaultMintAmount);

    await usdt.connect(user1).approve(await drawpool.getAddress(), defaultMintAmount);
    await usdt.connect(user2).approve(await drawpool.getAddress(), defaultMintAmount);
    await usdt.connect(user3).approve(await drawpool.getAddress(), defaultMintAmount);
  });

  // 1. deploy
  it("1. should deploy with correct owner and initialize round 1", async function () {
    expect(await drawpool.owner()).to.equal(owner.address);
    expect(await drawpool.currentRoundId()).to.equal(1);
    
    const round = await drawpool.getRound(1);
    expect(round.id).to.equal(1);
    expect(round.isComplete).to.equal(false);
  });

  // 2. enterDraw - single entry
  it("2. should allow single ticket purchase and emit EntryPurchased event", async function () {
    await expect(drawpool.connect(user1).enterDraw(1))
      .to.emit(drawpool, "EntryPurchased")
      .withArgs(1, user1.address, 1);

    expect(await drawpool.getUserEntries(user1.address, 1)).to.equal(1);
  });

  // 3. enterDraw - multiple entries
  it("3. should allow multiple entries and update entriesPerUser", async function () {
    await drawpool.connect(user1).enterDraw(5);
    expect(await drawpool.getUserEntries(user1.address, 1)).to.equal(5);
  });

  // 4. enterDraw - rejects quantity 0
  it("4. should reject entry purchases of 0 quantity", async function () {
    await expect(drawpool.connect(user1).enterDraw(0)).to.be.revertedWith(
      "Quantity must be between 1 and 100"
    );
  });

  // 5. enterDraw - rejects quantity > 100
  it("5. should reject entry purchases exceeding 100 quantity", async function () {
    await expect(drawpool.connect(user1).enterDraw(101)).to.be.revertedWith(
      "Quantity must be between 1 and 100"
    );
  });

  // 6. enterDraw - rejects when round is locked
  it("6. should reject entry purchases when round is locked for drawing", async function () {
    // Fill up the round to lock it
    await drawpool.connect(user1).enterDraw(10);
    
    const round = await drawpool.getRound(1);
    expect(round.isLocked).to.equal(true);

    // Try to enter again
    await expect(drawpool.connect(user2).enterDraw(1)).to.be.revertedWith(
      "Current round is locked for drawing"
    );
  });

  // 7. enterDraw - rejects when isDestroyed is true
  it("7. should reject purchases when contract is destroyed", async function () {
    await drawpool.connect(owner).killSwitch();
    expect(await drawpool.isDestroyed()).to.equal(true);

    await expect(drawpool.connect(user1).enterDraw(1)).to.be.revertedWith(
      "Contract is deactivated"
    );
  });

  // 8. enterDraw - rejects quantity > remaining spots
  it("8. should reject entry purchases exceeding remaining round spots", async function () {
    await drawpool.connect(user1).enterDraw(8);
    // 2 spots left. Buying 3 should fail.
    await expect(drawpool.connect(user2).enterDraw(3)).to.be.revertedWith(
      "Not enough remaining entries in this round"
    );
  });

  // 9. fillRound
  it("9. should lock round and request VRF once MAX_ENTRIES is reached", async function () {
    await expect(drawpool.connect(user1).enterDraw(10))
      .to.emit(drawpool, "DrawRequested");

    const round = await drawpool.getRound(1);
    expect(round.isLocked).to.equal(true);
    expect(round.vrfRequestId).to.not.equal(0);
  });

  // 10. fulfillRandomWords - winner paid
  it("10. should select winner and pay prize upon receiving VRF callback", async function () {
    const tx = await drawpool.connect(user1).enterDraw(10);
    const receipt = await tx.wait();
    
    // Parse DrawRequested log to get requestId
    const round = await drawpool.getRound(1);
    const requestId = round.vrfRequestId;

    const balanceBefore = await usdt.balanceOf(user1.address);

    // Fulfill randomness
    await expect(coordinator.fulfillRandomWords(requestId, await drawpool.getAddress()))
      .to.emit(drawpool, "WinnerSelected")
      .withArgs(1, user1.address, 1);

    const balanceAfter = await usdt.balanceOf(user1.address);
    expect(balanceAfter - balanceBefore).to.equal(ethers.parseUnits("5", 6)); // $5 prize
  });

  // 11. fulfillRandomWords - owner receives revenue
  it("11. should send remaining round balances as revenue to the owner", async function () {
    await drawpool.connect(user1).enterDraw(10);
    const round = await drawpool.getRound(1);
    const requestId = round.vrfRequestId;

    const ownerBalanceBefore = await usdt.balanceOf(owner.address);
    
    // Fulfill
    await coordinator.fulfillRandomWords(requestId, await drawpool.getAddress());

    const ownerBalanceAfter = await usdt.balanceOf(owner.address);
    expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(ethers.parseUnits("5", 6)); // $5 revenue
  });

  // 12. fulfillRandomWords - new round started
  it("12. should initialize a new active round after draw completes", async function () {
    await drawpool.connect(user1).enterDraw(10);
    const round1 = await drawpool.getRound(1);
    const requestId = round1.vrfRequestId;

    await coordinator.fulfillRandomWords(requestId, await drawpool.getAddress());

    expect(await drawpool.currentRoundId()).to.equal(2);
    
    const round2 = await drawpool.getRound(2);
    expect(round2.id).to.equal(2);
    expect(round2.isComplete).to.equal(false);
  });

  // 13. killSwitch - reverts if called by non-owner
  it("13. should revert if killSwitch is triggered by non-owner", async function () {
    await expect(drawpool.connect(user1).killSwitch()).to.be.revertedWith(
      "Only callable by owner"
    );
  });

  // 14. killSwitch - refunds entries first
  it("14. should refund all current round entries upon trigger of killSwitch", async function () {
    await drawpool.connect(user1).enterDraw(3);
    await drawpool.connect(user2).enterDraw(2);

    const balance1Before = await usdt.balanceOf(user1.address);
    const balance2Before = await usdt.balanceOf(user2.address);

    await expect(drawpool.connect(owner).killSwitch())
      .to.emit(drawpool, "EntryRefunded");

    const balance1After = await usdt.balanceOf(user1.address);
    const balance2After = await usdt.balanceOf(user2.address);

    expect(balance1After - balance1Before).to.equal(ethers.parseUnits("3", 6));
    expect(balance2After - balance2Before).to.equal(ethers.parseUnits("2", 6));
  });

  // 15. killSwitch - isDestroyed set to true
  it("15. should set isDestroyed flags and prevent active loops", async function () {
    await drawpool.connect(owner).killSwitch();
    expect(await drawpool.isDestroyed()).to.equal(true);
  });

  // 16. killSwitch - sweeps remaining USDT to owner
  it("16. should sweep leftover contract token balances to owner during shutdown", async function () {
    // Directly fund contract with some extra USDT
    await usdt.mint(await drawpool.getAddress(), ethers.parseUnits("100", 6));

    const ownerBalanceBefore = await usdt.balanceOf(owner.address);
    await drawpool.connect(owner).killSwitch();
    const ownerBalanceAfter = await usdt.balanceOf(owner.address);

    expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(ethers.parseUnits("100", 6));
  });

  // 17. emergencyRefund
  it("17. should process active entry refunds in batches using index pointers", async function () {
    await drawpool.connect(user1).enterDraw(5); // index 0-4
    await drawpool.connect(user2).enterDraw(2); // index 5-6

    const balance1Before = await usdt.balanceOf(user1.address);

    // Refund batch of 3 (first 3 entries of user 1)
    await drawpool.connect(owner).emergencyRefund(3);
    expect(await drawpool.refundIndex()).to.equal(3);

    const balance1After = await usdt.balanceOf(user1.address);
    expect(balance1After - balance1Before).to.equal(ethers.parseUnits("3", 6));
  });

  // 18. pause
  it("18. should block draw entries when contract is paused", async function () {
    await drawpool.connect(owner).pause();
    await expect(drawpool.connect(user1).enterDraw(1)).to.be.revertedWith(
      "Pausable: paused"
    );
  });

  // 19. unpause
  it("19. should allow entries again once unpaused", async function () {
    await drawpool.connect(owner).pause();
    await drawpool.connect(owner).unpause();
    
    await expect(drawpool.connect(user1).enterDraw(1))
      .to.emit(drawpool, "EntryPurchased");
  });

  // 20. full round flow
  it("20. should execute full round flow (user1, user2, user3 buy -> round fills -> draw -> winner)", async function () {
    await drawpool.connect(user1).enterDraw(4);
    await drawpool.connect(user2).enterDraw(3);
    await drawpool.connect(user3).enterDraw(3); // total 10, triggers draw

    const round = await drawpool.getRound(1);
    const requestId = round.vrfRequestId;

    // Fulfill
    await expect(coordinator.fulfillRandomWords(requestId, await drawpool.getAddress()))
      .to.emit(drawpool, "WinnerSelected");

    const round1After = await drawpool.getRound(1);
    expect(round1After.isComplete).to.equal(true);
    expect(round1After.winner).to.not.equal(ethers.ZeroAddress);

    expect(await drawpool.currentRoundId()).to.equal(2);
  });
});
