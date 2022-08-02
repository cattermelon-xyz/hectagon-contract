import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect, util } from "chai";
import { ethers, network } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import {
    HectagonAuthority,
    HectagonAuthority__factory,
    HectagonBondDepository,
    HectagonBondDepository__factory,
    ITreasury,
    MockERC20,
    MockERC20__factory,
    GovernanceHectagon,
    MockHecta,
    MockHecta__factory,
} from "../../types";
import { BigNumber, utils } from "ethers";

chai.use(smock.matchers);

describe("Bond Depository", () => {
    const LARGE_APPROVAL = "100000000000000000000000000000000";
    const initialMint = utils.parseEther("10000000");
    const initialDeposit = "1000000000000000000000000";

    let deployer: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let partner: SignerWithAddress;

    let auth: HectagonAuthority;
    let busd: MockERC20;
    let hecta: MockHecta;
    let depository: HectagonBondDepository;
    let treasury: FakeContract<ITreasury>;
    let gHecta: FakeContract<GovernanceHectagon>;

    const capacity = 100000e9;
    const initialPrice = 400e9;
    const buffer = 2e5;

    const vesting = 100;
    const timeToConclusion = 60 * 60 * 24;
    let conclusion: number;

    const depositInterval = 60 * 60 * 4;
    const tuneInterval = 60 * 60;

    const refPrecent = 500;
    const buyerPrecent = 100;
    const daoInvestmentPercent = 10000;
    const daoRewardPoolsPercent = 10000;

    const bid = 0;

    beforeEach(async () => {
        [deployer, alice, bob, carol, partner] = await ethers.getSigners();
        busd = await new MockERC20__factory(deployer).deploy("Busd", "BUSD");
        auth = await new HectagonAuthority__factory(deployer).deploy(
            deployer.address,
            deployer.address,
            deployer.address,
            deployer.address
        );
        hecta = await new MockHecta__factory(deployer).deploy("hecta", "HECTA");
        treasury = await smock.fake<ITreasury>("ITreasury");
        gHecta = await smock.fake<GovernanceHectagon>("GovernanceHectagon");
        depository = await new HectagonBondDepository__factory(deployer).deploy(
            auth.address,
            hecta.address,
            gHecta.address,
            treasury.address
        );

        // Setup for each component
        await busd.connect(deployer).mint(bob.address, initialMint);

        // To get past HECTA contract guards
        await auth.pushVault(treasury.address, true);

        await busd.connect(deployer).mint(deployer.address, initialDeposit);
        await busd.connect(deployer).approve(treasury.address, initialDeposit);
        await hecta.connect(deployer).mint(deployer.address, "10000000000000");

        // Mint enough gHecta to payout rewards
        // await gHecta.mint(depository.address, "1000000000000000000000");

        await hecta.connect(alice).approve(depository.address, LARGE_APPROVAL);
        await busd.connect(bob).approve(depository.address, LARGE_APPROVAL);

        await depository.setDaoRewards(daoInvestmentPercent, daoRewardPoolsPercent);
        await depository.setReferTerm(carol.address, refPrecent, buyerPrecent);

        await busd.connect(alice).approve(depository.address, capacity);

        const block = await ethers.provider.getBlock("latest");
        conclusion = block.timestamp + timeToConclusion;
        // create the first bond
        await depository.create(
            busd.address,
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
        const [, , , concludes] = await depository.terms(bid);
        expect(concludes).to.equal(conclusion);
        const [, , length, , , ,] = await depository.metadata(bid);
        // timestamps are a bit inaccurate with tests
        const upperBound = timeToConclusion * 1.0033;
        const lowerBound = timeToConclusion * 0.9967;
        expect(Number(length)).to.be.greaterThan(lowerBound);
        expect(Number(length)).to.be.lessThan(upperBound);
    });

    it("should set max payout to correct % of capacity", async () => {
        const [, , , , maxPayout, ,] = await depository.markets(bid);
        const upperBound = (capacity * 1.0033) / 6;
        const lowerBound = (capacity * 0.9967) / 6;
        expect(Number(maxPayout)).to.be.greaterThan(lowerBound);
        expect(Number(maxPayout)).to.be.lessThan(upperBound);
    });

    it("should return IDs of all markets", async () => {
        // create a second bond
        await depository.create(
            busd.address,
            [capacity, initialPrice, buffer],
            [false, true],
            [vesting, conclusion],
            [depositInterval, tuneInterval]
        );
        const [first, second] = await depository.liveMarkets();
        expect(Number(first)).to.equal(0);
        expect(Number(second)).to.equal(1);
    });

    it("should update IDs of markets", async () => {
        // create a second bond
        await depository.create(
            busd.address,
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
        const [id] = await depository.liveMarketsFor(busd.address);
        expect(Number(id)).to.equal(bid);
    });

    it("should start with price at initial price", async () => {
        const lowerBound = initialPrice * 0.9999;
        expect(Number(await depository.marketPrice(bid))).to.be.greaterThan(lowerBound);
    });

    it("should give accurate payout for price", async () => {
        const price = await depository.marketPrice(bid);
        const amount = "10000000000000000000000"; // 10,000
        const expectedPayout = Number(amount) / Number(price);
        const lowerBound = expectedPayout * 0.9999;
        expect(Number(await depository.payoutFor(amount, 0))).to.be.greaterThan(lowerBound);
    });

    it("should decay debt", async () => {
        const [, , , totalDebt, , ,] = await depository.markets(0);

        await network.provider.send("evm_increaseTime", [100]);
        await depository.connect(bob).deposit(bid, "0", initialPrice, bob.address, carol.address);

        const [, , , newTotalDebt, , ,] = await depository.markets(0);
        expect(Number(totalDebt)).to.be.greaterThan(Number(newTotalDebt));
    });

    it("should not start adjustment if ahead of schedule", async () => {
        const amount = "650000000000000000000000"; // 10,000
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
        const [, , , active] = await depository.adjustments(bid);
        expect(Boolean(active)).to.equal(false);
    });

    it("should start adjustment if behind schedule", async () => {
        await network.provider.send("evm_increaseTime", [tuneInterval]);
        const amount = "10000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        const [, , , active] = await depository.adjustments(bid);
        expect(Boolean(active)).to.equal(true);
    });

    it("adjustment should lower control variable by change in tune interval if behind", async () => {
        await network.provider.send("evm_increaseTime", [tuneInterval]);
        const [, controlVariable, , ,] = await depository.terms(bid);
        const amount = "10000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        await network.provider.send("evm_increaseTime", [tuneInterval]);
        const [change] = await depository.adjustments(bid);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        const [, newControlVariable, , ,] = await depository.terms(bid);
        expect(newControlVariable).to.equal(controlVariable.sub(change));
    });

    it("adjustment should lower control variable by half of change in half of a tune interval", async () => {
        await network.provider.send("evm_increaseTime", [tuneInterval]);
        const [, controlVariable, , ,] = await depository.terms(bid);
        const amount = "10000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        const [change] = await depository.adjustments(bid);
        await network.provider.send("evm_increaseTime", [tuneInterval / 2]);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        const [, newControlVariable, , ,] = await depository.terms(bid);
        const lowerBound = (Number(controlVariable) - Number(change) / 2) * 0.999;
        expect(Number(newControlVariable)).to.lessThanOrEqual(
            Number(controlVariable.sub(change.div(2)))
        );
        expect(Number(newControlVariable)).to.greaterThan(Number(lowerBound));
    });

    it("adjustment should continue lowering over multiple deposits in same tune interval", async () => {
        await network.provider.send("evm_increaseTime", [tuneInterval]);
        const [, controlVariable, , ,] = await depository.terms(bid);
        const amount = "10000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        const [change] = await depository.adjustments(bid);

        await network.provider.send("evm_increaseTime", [tuneInterval / 2]);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);

        await network.provider.send("evm_increaseTime", [tuneInterval / 2]);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        const [, newControlVariable, , ,] = await depository.terms(bid);
        expect(newControlVariable).to.equal(controlVariable.sub(change));
    });

    it("should allow a deposit", async () => {
        const amount = "10000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);

        expect(Array(await depository.indexesFor(bob.address)).length).to.equal(1);
    });

    it("should not allow a deposit greater than max payout", async () => {
        const amount = "6700000000000000000000000"; // 6.7m (400 * 10000 / 6 + 0.5%)
        await expect(
            depository.connect(bob).deposit(bid, amount, initialPrice, bob.address, carol.address)
        ).to.be.revertedWith("Depository: max size exceeded");
    });

    it("should not redeem before vested", async () => {
        const balance = await hecta.balanceOf(bob.address);
        const amount = "10000000000000000000000"; // 10,000
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        await depository.connect(bob).redeemAll(bob.address, false);
        expect(await hecta.balanceOf(bob.address)).to.equal(balance);
    });

    it("should redeem after vested", async () => {
        const amount = "10000000000000000000000"; // 10,000
        const gHectaMockAmount = utils.parseEther("1000");
        gHecta.deposit.returns(gHectaMockAmount);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);

        await network.provider.send("evm_increaseTime", [1000]);
        await depository.redeemAll(bob.address, false);
        gHecta.balanceOf.whenCalledWith(bob.address).returns(gHectaMockAmount);
        const bobBalance = await gHecta.balanceOf(bob.address);
        expect(bobBalance).to.eq(gHectaMockAmount);
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

    it("should give correct rewards to referrer, dao (treasury) and buyer", async () => {
        const refBalance = await hecta.balanceOf(carol.address);
        const amount = BigNumber.from("10000000000000000000000"); // 10,000
        const [finalPayout] = await depository
            .connect(bob)
            .callStatic.deposit(bid, amount, initialPrice, bob.address, carol.address);
        await depository
            .connect(bob)
            .deposit(bid, amount, initialPrice, bob.address, carol.address);
        const payout = Number(finalPayout) / (1 + buyerPrecent / 1e4);
        // Mint hecta for depository to payout reward
        await hecta.mint(depository.address, "1000000000000000000000");

        const refExpected = Number(refBalance) + Number((Number(payout) * refPrecent) / 1e4);
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
            const amount = ethers.utils.parseEther("1");
            const marketPrice = await depository.marketPrice(bid);
            const expectedPayout = amount.div(marketPrice);

            const expectedFinalPayout = expectedPayout.add(
                expectedPayout.mul(partnerPercent).div(1e4)
            );

            const [finalPayout] = await depository
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
            const amount = ethers.utils.parseEther("10000");
            const marketPrice = await depository.marketPrice(bid);
            const expectedPayout = amount.div(marketPrice);

            const expectedFinalPayout = expectedPayout.add(partnerMaxAmount);
            const [finalPayout] = await depository
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
        const [, , , , , maxPayout, ,] = await depository.markets(bid);
        const price = await depository.marketPrice(bid);
        const amount = maxPayout.mul(price);
        await depository.connect(bob).deposit(
            bid,
            amount, // amount for max payout
            initialPrice,
            bob.address,
            carol.address
        );
        await network.provider.send("evm_increaseTime", [depositInterval]);
        const newPrice = await depository.marketPrice(bid);
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

    describe("totalPayout and payoutCap", () => {
        it("governor can setPayoutCap correctlly", async () => {
            const expectedOutput = ethers.utils.parseUnits("10", 9);
            await depository.setPayoutCap(expectedOutput);
            const payoutCap = await depository.payoutCap();
            await expect(expectedOutput).to.be.eq(payoutCap);
        });

        it("user can't deposit when hit payoutCap", async () => {
            const expectedOutput = ethers.utils.parseUnits("10", 9);
            await depository.setPayoutCap(expectedOutput);
            const amount = BigNumber.from("10000000000000000000000"); // 10,000
            const tx = depository
                .connect(bob)
                .deposit(bid, amount, initialPrice, bob.address, carol.address);
            await expect(tx).to.revertedWith("Depository: total payout hit payout cap");
        });

        it("totalPayout incre correct follow by payout amount", async () => {
            const amount = BigNumber.from("10000000000000000000000"); // 10,000
            const [finalPayout] = await depository
                .connect(bob)
                .callStatic.deposit(bid, amount, initialPrice, bob.address, carol.address);
            await depository
                .connect(bob)
                .deposit(bid, amount, initialPrice, bob.address, carol.address);
            const payout = Number(finalPayout) / (1 + buyerPrecent / 1e4);

            const totalPayout = await depository.totalPayout();
            expect(payout).to.be.greaterThan(Number(totalPayout) / 1.0001);
            expect(payout).to.be.lessThan(Number(totalPayout) * 1.0001);
        });
    });
});
