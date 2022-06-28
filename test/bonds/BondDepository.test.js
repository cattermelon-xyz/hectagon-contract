const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");

describe("Bond Depository", async () => {
    const LARGE_APPROVAL = "100000000000000000000000000000000";
    // Initial mint for Frax, HECTA and DAI (10,000,000)
    const initialMint = "10000000000000000000000000";
    const initialDeposit = "1000000000000000000000000";

    // Increase timestamp by amount determined by `offset`

    let deployer, alice, bob, carol, partner;
    let erc20Factory;
    let authFactory;
    let gHectaFactory;
    let depositoryFactory;

    let auth;
    let dai;
    let hecta;
    let depository;
    let treasury;
    let gHECTA;
    let staking;

    let capacity = 100000e9;
    let initialPrice = 400e9;
    let buffer = 2e5;

    let vesting = 100;
    let timeToConclusion = 60 * 60 * 24;
    let conclusion;

    let depositInterval = 60 * 60 * 4;
    let tuneInterval = 60 * 60;

    let refPrecent = 500;
    let buyerPrecent = 100;
    let daoInvestmentPercent = 10000;
    let daoRewardPoolsPercent = 10000;

    var bid = 0;
    /**
     * Everything in this block is only run once before all tests.
     * This is the home for setup methods
     */
    before(async () => {
        [deployer, alice, bob, carol, partner] = await ethers.getSigners();

        authFactory = await ethers.getContractFactory("HectagonAuthority");
        erc20Factory = await smock.mock("MockERC20");
        gHectaFactory = await smock.mock("MockGHecta");

        depositoryFactory = await ethers.getContractFactory("HectagonBondDepositoryV2");
    });

    beforeEach(async () => {
        dai = await erc20Factory.deploy("Dai", "DAI", 18);
        auth = await authFactory.deploy(
            deployer.address,
            deployer.address,
            deployer.address,
            deployer.address
        );
        hecta = await erc20Factory.deploy("Hectagon", "HECTA", 9);
        treasury = await smock.fake("ITreasury");
        gHECTA = await gHectaFactory.deploy("50000000000"); // Set index as 50
        staking = await smock.fake("HectagonStaking");
        depository = await depositoryFactory.deploy(
            auth.address,
            hecta.address,
            gHECTA.address,
            staking.address,
            treasury.address
        );

        // Setup for each component
        await dai.mint(bob.address, initialMint);

        // To get past HECTA contract guards
        await auth.pushVault(treasury.address, true);

        await dai.mint(deployer.address, initialDeposit);
        await dai.approve(treasury.address, initialDeposit);
        //await treasury.deposit(initialDeposit, dai.address, "10000000000000");
        await hecta.mint(deployer.address, "10000000000000");
        await treasury.baseSupply.returns(await hecta.totalSupply());

        // Mint enough gHECTA to payout rewards
        await gHECTA.mint(depository.address, "1000000000000000000000");

        await hecta.connect(alice).approve(depository.address, LARGE_APPROVAL);
        await dai.connect(bob).approve(depository.address, LARGE_APPROVAL);

        await depository.setDaoRewards(daoInvestmentPercent, daoRewardPoolsPercent);
        await depository.setReferTerm(carol.address, refPrecent, buyerPrecent);

        await dai.connect(alice).approve(depository.address, capacity);
        const block = await ethers.provider.getBlock("latest");
        conclusion = block.timestamp + timeToConclusion;
        // create the first bond
        await depository.create(
            dai.address,
            [capacity, initialPrice, buffer],
            [false, true],
            [vesting, conclusion],
            [depositInterval, tuneInterval]
        );
    });

    it("should create market", async () => {
        expect(await depository.isLive(bid)).to.equal(true);
    });

    it("should conclude in correct amount of time", async () => {
        let [, , , concludes] = await depository.terms(bid);
        expect(concludes).to.equal(conclusion);
        let [, , length, , , ,] = await depository.metadata(bid);
        // timestamps are a bit inaccurate with tests
        var upperBound = timeToConclusion * 1.0033;
        var lowerBound = timeToConclusion * 0.9967;
        expect(Number(length)).to.be.greaterThan(lowerBound);
        expect(Number(length)).to.be.lessThan(upperBound);
    });

    it("should set max payout to correct % of capacity", async () => {
        let [, , , , maxPayout, ,] = await depository.markets(bid);
        var upperBound = (capacity * 1.0033) / 6;
        var lowerBound = (capacity * 0.9967) / 6;
        expect(Number(maxPayout)).to.be.greaterThan(lowerBound);
        expect(Number(maxPayout)).to.be.lessThan(upperBound);
    });

    it("should return IDs of all markets", async () => {
        // create a second bond
        await depository.create(
            dai.address,
            [capacity, initialPrice, buffer],
            [false, true],
            [vesting, conclusion],
            [depositInterval, tuneInterval]
        );
        let [first, second] = await depository.liveMarkets();
        expect(Number(first)).to.equal(0);
        expect(Number(second)).to.equal(1);
    });

    it("should update IDs of markets", async () => {
        // create a second bond
        await depository.create(
            dai.address,
            [capacity, initialPrice, buffer],
            [false, true],
            [vesting, conclusion],
            [depositInterval, tuneInterval]
        );
        // close the first bond
        await depository.close(0);
        const [first] = await depository.liveMarkets();
        expect(Number(first)).to.equal(1);
    });

    it("should include ID in live markets for quote token", async () => {
        const [id] = await depository.liveMarketsFor(dai.address);
        expect(Number(id)).to.equal(bid);
    });

    it("should start with price at initial price", async () => {
        let lowerBound = initialPrice * 0.9999;
        expect(Number(await depository.marketPrice(bid))).to.be.greaterThan(lowerBound);
    });

    it("should give accurate payout for price", async () => {
        let price = await depository.marketPrice(bid);
        let amount = "10000000000000000000000"; // 10,000
        let expectedPayout = amount / price;
        let lowerBound = expectedPayout * 0.9999;
        expect(Number(await depository.payoutFor(amount, 0))).to.be.greaterThan(lowerBound);
    });

    it("should decay debt", async () => {
        let [, , , totalDebt, , ,] = await depository.markets(0);

        await network.provider.send("evm_increaseTime", [100]);
        await depository.connect(bob).deposit(bid, "0", initialPrice, bob.address, carol.address);

        let [, , , newTotalDebt, , ,] = await depository.markets(0);
        expect(Number(totalDebt)).to.be.greaterThan(Number(newTotalDebt));
    });

    it("should not start adjustment if ahead of schedule", async () => {
        let amount = "650000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice * 2, bob.address, carol.address);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice * 2, bob.address, carol.address);

        await network.provider.send("evm_increaseTime", [tuneInterval]);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice * 2, bob.address, carol.address);
        let [, , , active] = await depository.adjustments(bid);
        expect(Boolean(active)).to.equal(false);
    });

    it("should start adjustment if behind schedule", async () => {
        await network.provider.send("evm_increaseTime", [tuneInterval]);
        let amount = "10000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        let [, , , active] = await depository.adjustments(bid);
        expect(Boolean(active)).to.equal(true);
    });

    it("adjustment should lower control variable by change in tune interval if behind", async () => {
        await network.provider.send("evm_increaseTime", [tuneInterval]);
        let [, controlVariable, , ,] = await depository.terms(bid);
        let amount = "10000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        await network.provider.send("evm_increaseTime", [tuneInterval]);
        let [change] = await depository.adjustments(bid);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        let [, newControlVariable, , ,] = await depository.terms(bid);
        expect(newControlVariable).to.equal(controlVariable.sub(change));
    });

    it("adjustment should lower control variable by half of change in half of a tune interval", async () => {
        await network.provider.send("evm_increaseTime", [tuneInterval]);
        let [, controlVariable, , ,] = await depository.terms(bid);
        let amount = "10000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        let [change] = await depository.adjustments(bid);
        await network.provider.send("evm_increaseTime", [tuneInterval / 2]);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        let [, newControlVariable, , ,] = await depository.terms(bid);
        let lowerBound = (controlVariable - change / 2) * 0.999;
        expect(Number(newControlVariable)).to.lessThanOrEqual(
            Number(controlVariable.sub(change.div(2)))
        );
        expect(Number(newControlVariable)).to.greaterThan(Number(lowerBound));
    });

    it("adjustment should continue lowering over multiple deposits in same tune interval", async () => {
        await network.provider.send("evm_increaseTime", [tuneInterval]);
        const [, controlVariable, , ,] = await depository.terms(bid);
        let amount = "10000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        let [change] = await depository.adjustments(bid);

        await network.provider.send("evm_increaseTime", [tuneInterval / 2]);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);

        await network.provider.send("evm_increaseTime", [tuneInterval / 2]);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        let [, newControlVariable, , ,] = await depository.terms(bid);
        expect(newControlVariable).to.equal(controlVariable.sub(change));
    });

    it("should allow a deposit", async () => {
        let amount = "10000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);

        expect(Array(await depository.indexesFor(bob.address)).length).to.equal(1);
    });

    it("should not allow a deposit greater than max payout", async () => {
        let amount = "6700000000000000000000000"; // 6.7m (400 * 10000 / 6 + 0.5%)
        await expect(
            depository.connect(bob).deposit(bid, amount, initialPrice, bob.address, carol.address)
        ).to.be.revertedWith("Depository: max size exceeded");
    });

    it("should not redeem before vested", async () => {
        let balance = await hecta.balanceOf(bob.address);
        let amount = "10000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        await depository.connect(bob).redeemAll(bob.address, true);
        expect(await hecta.balanceOf(bob.address)).to.equal(balance);
    });

    it("should redeem after vested", async () => {
        let amount = "10000000000000000000000"; // 10,000
        let [expectedPayout] = await depository
            .connect(bob)
            .callStatic.deposit(bid, amount, initialPrice, bob.address, carol.address);

        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);

        await network.provider.send("evm_increaseTime", [1000]);
        await depository.redeemAll(bob.address, true);

        const bobBalance = Number(await gHECTA.balanceOf(bob.address));
        expect(bobBalance).to.greaterThanOrEqual(Number(await gHECTA.balanceTo(expectedPayout)));
        expect(bobBalance).to.lessThan(Number(await gHECTA.balanceTo(expectedPayout * 1.0001)));
    });

    describe("setReferTermCap", () => {
        it("only called by governor", async () => {
            await expect(depository.connect(alice).setReferTermCap("1000")).to.be.revertedWith(
                "UNAUTHORIZED"
            );
        });

        it("governor setRefer term cap correctlly", async () => {
            const termCap = BigNumber.from("2000");
            await depository.setReferTermCap(termCap);
            const referTermCap = await depository.referTermCap();
            expect(referTermCap).to.be.eq(termCap);
        });
    });

    it("general users can NOT get rewards in vesting time", async () => {
        const block = await ethers.provider.getBlock("latest");
        const timestampBefore = block.timestamp;

        await depository.setRewardTime(timestampBefore + 1000);
        await expect(depository.connect(alice).getReward()).to.be.revertedWith(
            "Cannot get reward in vesting time"
        );
    });

    it("DAO can get rewards in vesting time", async () => {
        const block = await ethers.provider.getBlock("latest");
        const timestampBefore = block.timestamp;

        await depository.setRewardTime(timestampBefore + 1000);
        await depository.getReward();
        return true;
    });

    it("general users can get rewards after vesting time", async () => {
        let deployerBalance = await hecta.balanceOf(deployer.address);
        const block = await ethers.provider.getBlock("latest");
        const timestampBefore = block.timestamp;

        await depository.setRewardTime(timestampBefore + 1000);
        await network.provider.send("evm_increaseTime", [timestampBefore + 1000 + 10]);
        await depository.getReward();

        const frontendReward = Number(await hecta.balanceOf(deployer.address));
        expect(frontendReward).to.be.eq(Number(deployerBalance));
    });

    it("should give correct rewards to referrer, dao and buyer", async () => {
        let daoBalance = await hecta.balanceOf(deployer.address);
        let refBalance = await hecta.balanceOf(carol.address);
        let amount = BigNumber.from("10000000000000000000000"); // 10,000
        let [finalPayout] = await depository
            .connect(bob)
            .callStatic.deposit(bid, amount, initialPrice, bob.address, carol.address);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        const payout = Number(finalPayout) / (1 + buyerPrecent / 1e4);
        // Mint hecta for depository to payout reward
        await hecta.mint(depository.address, "1000000000000000000000");

        let daoExpected =
            Number(daoBalance) +
            Number((Number(payout) * daoInvestmentPercent) / 1e4) +
            Number((Number(payout) * daoRewardPoolsPercent) / 1e4);
        await depository.connect(deployer).getReward();

        const daoFundBalance = Number(await hecta.balanceOf(deployer.address));
        expect(daoFundBalance).to.be.greaterThan(Number(daoExpected));
        expect(daoFundBalance).to.be.lessThan(Number(daoExpected) * 1.0001);

        let refExpected = Number(refBalance) + Number((Number(payout) * refPrecent) / 1e4);
        await depository.connect(carol).getReward();

        const carolReward = Number(await hecta.balanceOf(carol.address));
        expect(carolReward).to.be.greaterThan(Number(refExpected));
        expect(carolReward).to.be.lessThan(Number(refExpected) * 1.0001);
    });

    describe("Partner buy bond", () => {
        it("should give correct amount for partner: in case reward smaller than maxAmount", async () => {
            const partnerMaxAmount = ethers.utils.parseUnits("100", 9);
            const partnerPercent = 1000; // 10%
            await depository.setPartnerTerm(partner.address, partnerMaxAmount, partnerPercent);
            let amount = ethers.utils.parseEther("1");
            const marketPrice = await depository.marketPrice(bid);
            const expectedPayout = amount.div(marketPrice);

            const expectedFinalPayout = expectedPayout.add(
                expectedPayout.mul(partnerPercent).div(1e4)
            );

            let [finalPayout] = await depository
                .connect(bob)
                .callStatic.deposit(bid, amount, initialPrice, partner.address, partner.address);
            const payout = Number(finalPayout) / (1 + partnerPercent / 1e4);
            const partnerReward = Math.floor((payout * partnerPercent) / 1e4);
            const expectedPatnerRemainingAmount = partnerMaxAmount.sub(partnerReward);
            await depository
                .connect(bob)
                .deposit(bid, amount, initialPrice, partner.address, partner.address);
            expect(expectedFinalPayout.toNumber()).to.greaterThanOrEqual(finalPayout.toNumber());
            expect(expectedFinalPayout.toNumber()).to.lessThan(finalPayout.toNumber() * 1.0001);

            const [partnerRewardAmount] = await depository.partnerTerms(partner.address);

            expect(expectedPatnerRemainingAmount.toNumber()).to.greaterThanOrEqual(
                partnerRewardAmount.toNumber()
            );
            expect(expectedPatnerRemainingAmount.toNumber()).to.lessThan(
                partnerRewardAmount.toNumber() * 1.01
            );
        });

        it("should give correct amount for partner: in case reward larger than maxAmount", async () => {
            const partnerMaxAmount = ethers.utils.parseUnits("1", 9);
            const partnerPercent = 1000; // 10%
            await depository.setPartnerTerm(partner.address, partnerMaxAmount, partnerPercent);
            let amount = ethers.utils.parseEther("10000");
            const marketPrice = await depository.marketPrice(bid);
            const expectedPayout = amount.div(marketPrice);

            const expectedFinalPayout = expectedPayout.add(partnerMaxAmount);
            let [finalPayout] = await depository
                .connect(bob)
                .callStatic.deposit(bid, amount, initialPrice, partner.address, carol.address);
            await depository
                .connect(bob)
                .deposit(bid, amount, initialPrice, partner.address, carol.address);
            expect(expectedFinalPayout.toNumber()).to.greaterThanOrEqual(finalPayout.toNumber());
            expect(expectedFinalPayout.toNumber()).to.lessThan(finalPayout.toNumber() * 1.001);

            const [partnerRewardAmount] = await depository.partnerTerms(partner.address);
            expect(partnerRewardAmount.toNumber()).to.be.eq(0);
        });
    });

    it("should decay a max payout in target deposit interval", async () => {
        let [, , , , , maxPayout, ,] = await depository.markets(bid);
        let price = await depository.marketPrice(bid);
        let amount = maxPayout * price;
        await depository.connect(bob).deposit(
            bid,
            amount, // amount for max payout
            initialPrice,
            bob.address,
            carol.address
        );
        await network.provider.send("evm_increaseTime", [depositInterval]);
        let newPrice = await depository.marketPrice(bid);
        expect(Number(newPrice)).to.be.lessThan(Number(initialPrice));
    });

    it("should close a market", async () => {
        let [capacity, , , , , ,] = await depository.markets(bid);
        expect(Number(capacity)).to.be.greaterThan(0);
        await depository.close(bid);
        [capacity, , , , , ,] = await depository.markets(bid);
        expect(Number(capacity)).to.equal(0);
    });

    it("should not allow deposit past conclusion", async () => {
        await network.provider.send("evm_increaseTime", [timeToConclusion * 10000]);
        await expect(
            depository.connect(bob).deposit(bid, 0, initialPrice, bob.address, carol.address)
        ).to.be.revertedWith("Depository: market concluded");
    });
});
