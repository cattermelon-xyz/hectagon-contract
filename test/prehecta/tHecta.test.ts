import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, utils } from "ethers";
import { ethers, network } from "hardhat";
import {
    HectagonERC20Token,
    HectagonAuthority,
    BEP20Token,
    THecta,
    HectagonTreasury,
    HectagonERC20Token__factory,
    HectagonAuthority__factory,
    BEP20Token__factory,
    THecta__factory,
    HectagonTreasury__factory,
    HectaCirculatingSupply,
    HectaCirculatingSupply__factory,
} from "../../types";

describe("Team Hectagon", async () => {
    const LARGE_APPROVAL = "100000000000000000000000000000000";
    // Increase timestamp by amount determined by `offset`
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;

    let auth: HectagonAuthority;
    let busd: BEP20Token;
    let hecta: HectagonERC20Token;
    let tHecta: THecta;
    let treasury: HectagonTreasury;
    let circulatingSupplyConrtact: HectaCirculatingSupply;

    const preminedHecta = utils.parseUnits("30000", 9);
    const RateDenominator = BigNumber.from(1000000);
    const MaxPHectaToExercise = BigNumber.from(50000);
    const premintedTHecta = utils.parseUnits("50000000", 9); // 50,000,000 token

    const toBusdRate = BigNumber.from(1000000000);

    const mineBlock = async () => {
        await network.provider.request({
            method: "evm_mine",
            params: [],
        });
    };

    const increaseTime = async (time: number) => {
        await network.provider.send("evm_increaseTime", [time]);
    };
    const spaceLength = 604800;
    const startTime = () => Math.floor(Date.now() / 1000) - spaceLength - 100;

    /**
     * Everything in this block is only run once before all tests.
     * This is the home for setup methods
     */

    beforeEach(async () => {
        [owner, alice, bob] = await ethers.getSigners();

        busd = await new BEP20Token__factory(owner).deploy();
        // TODO use promise.all
        auth = await new HectagonAuthority__factory(owner).deploy(
            owner.address,
            owner.address,
            owner.address,
            owner.address
        );
        hecta = await new HectagonERC20Token__factory(owner).deploy(auth.address);
        treasury = await new HectagonTreasury__factory(owner).deploy(hecta.address, auth.address);
        circulatingSupplyConrtact = await new HectaCirculatingSupply__factory(owner).deploy(
            hecta.address
        );

        tHecta = await new THecta__factory(owner).deploy();

        // Setup for each component
        await busd.approve(treasury.address, LARGE_APPROVAL);

        // To get past HECTA contract guards
        await auth.pushVault(treasury.address, true);

        // toggle owner treasury manager
        await treasury.enable("0", owner.address);
        //  toggle owner reward manager
        await treasury.enable("1", owner.address);
        // toggle tHecta reward manager
        await treasury.enable("1", tHecta.address);

        // initialize treasury, 30,000
        await treasury.initialize(owner.address, preminedHecta);

        await tHecta.initialize(
            hecta.address,
            treasury.address,
            busd.address,
            circulatingSupplyConrtact.address
        );
    });

    it("correctly constructs an ERC20", async () => {
        expect(await tHecta.name()).to.equal("Team Hectagon");
        expect(await tHecta.symbol()).to.equal("tHecta");
        expect(await tHecta.decimals()).to.equal(9);
        expect(await tHecta.totalSupply()).to.equal(premintedTHecta);
    });

    describe("setSpaceLength", () => {
        it("must be done by owner", async () => {
            await expect(tHecta.connect(bob).setSpaceLength(100)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("Owner can be done correctly", async () => {
            const spaceLength = 1000;
            const ownerConn = tHecta.connect(owner);
            await ownerConn.setSpaceLength(spaceLength);
            await expect(await ownerConn.spaceLength()).to.be.equal(spaceLength);
        });
    });

    describe("setVestingLength", () => {
        it("must be done by owner", async () => {
            await expect(tHecta.connect(bob).setVestingLength(100)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("Owner can be done correctly", async () => {
            const vestingLength = 1000;
            const ownerConn = tHecta.connect(owner);
            await ownerConn.setVestingLength(vestingLength);
            await expect(await ownerConn.vestingLength()).to.be.equal(vestingLength);
        });
    });

    describe("initialize", () => {
        it("must be done by owner", async () => {
            await expect(
                tHecta
                    .connect(bob)
                    .initialize(
                        hecta.address,
                        treasury.address,
                        busd.address,
                        circulatingSupplyConrtact.address
                    )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Owner can be done correctly", async () => {
            const ownerConn = tHecta.connect(owner);
            await ownerConn.initialize(
                hecta.address,
                treasury.address,
                busd.address,
                circulatingSupplyConrtact.address
            );
            expect(await ownerConn.busdAddress()).to.be.equal(busd.address);
            expect(await tHecta.hectaAddress()).to.equal(hecta.address);
            expect(await tHecta.treasuryAddress()).to.equal(treasury.address);
        });
    });

    describe("start", () => {
        it("must be done by owner", async () => {
            await expect(tHecta.connect(bob).start(startTime())).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("Owner can be done correctly", async () => {
            const ownerConn = tHecta.connect(owner);
            const timestampBefore = startTime();
            await ownerConn.start(timestampBefore);
            const startTimestamp = await ownerConn.startTimestamp();

            await expect(startTimestamp).to.be.equal(timestampBefore);

            const spaceCounter = await ownerConn.spaceCounter();
            await expect(spaceCounter).to.be.eq(0);

            const [totalHecta, totalPHecta, timestamp] = await ownerConn.spaces(spaceCounter);
            await expect(totalHecta).to.be.eq(0);
            await expect(totalPHecta).to.be.eq(premintedTHecta);
            await expect(timestamp).to.be.eq(timestampBefore);
        });
    });

    describe("getClaimable()", () => {
        const mockBalance = BigNumber.from("1000000000000000"); // 1000,000 tHecta

        beforeEach(async () => {
            const ownerConn = tHecta.connect(owner);
            await ownerConn.transfer(alice.address, mockBalance);
            await ownerConn.transfer(bob.address, mockBalance);
            await ownerConn.start(startTime());
        });

        it("show info correctly right after start", async () => {
            const ownerConn = tHecta.connect(owner);

            const aliceClaimable = await ownerConn.getClaimable(alice.address);
            const bobClaimable = await ownerConn.getClaimable(bob.address);
            const expectedClaimable = preminedHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(mockBalance)
                .div(premintedTHecta);
            await expect(aliceClaimable).to.be.eq(expectedClaimable);
            await expect(bobClaimable).to.be.eq(expectedClaimable);
        });

        it("show info correctly after start, first space, incre totalHecta", async () => {
            const hectaIncreAmount = utils.parseUnits("1000", 9); // 1000 hecta
            await treasury.connect(owner).mint(owner.address, hectaIncreAmount);

            const expectedClaimable = hectaIncreAmount
                .add(preminedHecta)
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(mockBalance)
                .div(premintedTHecta);

            const ownerConn = tHecta.connect(owner);
            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock();

            const aliceClaimable = await ownerConn.getClaimable(alice.address);
            const bobClaimable = await ownerConn.getClaimable(bob.address);
            await expect(aliceClaimable).to.be.eq(expectedClaimable);
            await expect(bobClaimable).to.be.eq(expectedClaimable);
        });
    });

    describe("beat()", () => {
        it("after first space, space meta data should updated", async () => {
            const ownerConn = tHecta.connect(owner);
            const bobConn = tHecta.connect(bob);
            await ownerConn.start(startTime());
            const spaceLength = await ownerConn.spaceLength();

            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock();
            await bobConn.beat();

            const currentSpaceCount = await bobConn.spaceCounter();
            await expect(currentSpaceCount).to.be.eq(1);
            const [totalHecta, totalPHecta, timestamp] = await ownerConn.spaces(currentSpaceCount);

            await expect(totalHecta).to.be.eq(preminedHecta);
            await expect(totalPHecta).to.be.eq(premintedTHecta);

            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestampBefore = blockBefore.timestamp;
            await expect(timestamp).to.be.eq(timestampBefore);
        });
    });

    describe("transfer logic", () => {
        const aliceMockBalance = BigNumber.from("3000000000000000"); // 3000 000 tHecta
        const bobMockBalance = BigNumber.from("1000000000000000"); // 1000 000 tHecta

        beforeEach(async () => {
            const ownerConn = tHecta.connect(owner);
            await ownerConn.transfer(alice.address, aliceMockBalance);
            await ownerConn.transfer(bob.address, bobMockBalance);
            await ownerConn.start(startTime());
        });

        it("user can transfer correctly after start in space 0", async () => {
            const transferAmount = BigNumber.from("1000000000000");
            await tHecta.connect(alice).transfer(bob.address, transferAmount);

            await expect(await tHecta.connect(alice).balanceOf(alice.address)).to.be.eq(
                aliceMockBalance.sub(transferAmount)
            );
            await expect(await tHecta.connect(alice).balanceOf(bob.address)).to.be.eq(
                bobMockBalance.add(transferAmount)
            );
        });

        it("user can transfer correctly after start in space 1", async () => {
            const transferAmount = BigNumber.from("300000000000000"); // 300 000

            const ownerConn = tHecta.connect(owner);
            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock();
            await tHecta.connect(alice).transfer(bob.address, transferAmount);

            await expect(await tHecta.connect(alice).balanceOf(alice.address)).to.be.eq(
                aliceMockBalance.sub(transferAmount)
            );
            await expect(await tHecta.connect(alice).balanceOf(bob.address)).to.be.eq(
                bobMockBalance.add(transferAmount)
            );

            const aliceInfo = await ownerConn.holders(alice.address);
            const bobInfo = await ownerConn.holders(bob.address);

            const aliceCurrentSpaceProfit = preminedHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(premintedTHecta);

            const aliceMaxClaim = aliceCurrentSpaceProfit.sub(
                aliceCurrentSpaceProfit.mul(transferAmount).div(aliceMockBalance)
            );

            const bobCurrentSpaceProfit = preminedHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(bobMockBalance)
                .div(premintedTHecta);

            const bobMaxClaim = bobCurrentSpaceProfit.add(
                aliceCurrentSpaceProfit.mul(transferAmount).div(aliceMockBalance)
            );

            await Promise.all([
                expect(aliceInfo[0]).to.be.eq(true), //isTransferable
                expect(aliceInfo[1]).to.be.eq(1), // lastRebaseSpaceCount
                expect(aliceInfo[2]).to.be.eq(aliceMaxClaim), // maxClaim
                expect(aliceInfo[3]).to.be.eq(0), // claimed
                expect(aliceInfo[4]).to.be.eq(aliceCurrentSpaceProfit), // currentSpaceProfit

                expect(bobInfo[0]).to.be.eq(true), // isTransferable
                expect(bobInfo[1]).to.be.eq(1), // lastRebaseSpaceCount
                expect(bobInfo[2]).to.be.eq(bobMaxClaim), // maxClaim
                expect(bobInfo[3]).to.be.eq(0), // claimed
                expect(bobInfo[4]).to.be.eq(bobCurrentSpaceProfit), // currentSpaceProfit
            ]);
        });

        it("user can transfer correctly after start in space 1, totalHecta incre then space 2 transfer called, then address info updated correctly", async () => {
            const ownerConn = tHecta.connect(owner);
            const transferAmount = BigNumber.from("1000000000000000"); // 1000 000 tHecta

            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock(); // new space

            await tHecta.connect(alice).transfer(bob.address, transferAmount);

            const space1AliceCurrentSpaceProfit = preminedHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(premintedTHecta);

            const space1AliceMaxClaim = space1AliceCurrentSpaceProfit.sub(
                space1AliceCurrentSpaceProfit.mul(transferAmount).div(aliceMockBalance)
            );

            const space1BobCurrentSpaceProfit = preminedHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(bobMockBalance)
                .div(premintedTHecta);

            const space1BobMaxClaim = space1BobCurrentSpaceProfit.add(
                space1AliceCurrentSpaceProfit.mul(transferAmount).div(aliceMockBalance)
            );

            const additionHectaAmount = utils.parseUnits("2000", 9);
            await treasury.connect(owner).mint(owner.address, additionHectaAmount);

            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock(); // new space

            // 2000
            const space2AliceBalance = aliceMockBalance.sub(transferAmount);

            // 2000
            const space2BobBalance = bobMockBalance.add(transferAmount);

            const space2AliceCurrentSpaceProfit = BigNumber.from(additionHectaAmount)
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(space2AliceBalance)
                .div(premintedTHecta);

            const maxClaimTransfer = space2AliceCurrentSpaceProfit
                .mul(transferAmount)
                .div(space2AliceBalance);

            const space2AliceMaxClaim = space2AliceCurrentSpaceProfit
                .add(space1AliceMaxClaim)
                .sub(maxClaimTransfer);

            //
            const space2BobCurrentSpaceProfit = BigNumber.from(additionHectaAmount)
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(space2BobBalance)
                .div(premintedTHecta);

            const space2BobMaxClaim = space2BobCurrentSpaceProfit
                .add(maxClaimTransfer)
                .add(space1BobMaxClaim);

            await tHecta.connect(alice).transfer(bob.address, transferAmount);

            const [aliceInfo, bobInfo] = await Promise.all([
                ownerConn.holders(alice.address),
                ownerConn.holders(bob.address),
            ]);

            await Promise.all([
                expect(aliceInfo[0]).to.be.eq(true), //isTransferable
                expect(aliceInfo[1]).to.be.eq(2), // lastRebaseSpaceCount
                expect(aliceInfo[2]).to.be.eq(space2AliceMaxClaim), // maxClaim
                expect(aliceInfo[3]).to.be.eq(0), // claimed
                expect(aliceInfo[4]).to.be.eq(space2AliceCurrentSpaceProfit), // currentSpaceProfit
                expect(bobInfo[0]).to.be.eq(true), // isTransferable
                expect(bobInfo[1]).to.be.eq(2), // lastRebaseSpaceCount
                expect(bobInfo[2]).to.be.eq(space2BobMaxClaim), // maxClaim
                expect(bobInfo[3]).to.be.eq(0), // claimed
                expect(bobInfo[4]).to.be.eq(space2BobCurrentSpaceProfit), // currentSpaceProfit
            ]);
        });
    });

    describe("exercise", () => {
        const aliceMockBalance = BigNumber.from("4000000000000000"); // 4000 000 tHecta
        const bobMockBalance = BigNumber.from("1000000000000000"); // 1000 000 tHecta

        beforeEach(async () => {
            const ownerConn = tHecta.connect(owner);
            await Promise.all([
                ownerConn.transfer(alice.address, aliceMockBalance),
                ownerConn.transfer(bob.address, bobMockBalance),
                busd.transfer(alice.address, "100000000000000000000000"),
                busd.transfer(bob.address, "100000000000000000000000"),
            ]);

            await ownerConn.start(startTime());
        });

        it("user can exercise correctly from space 0", async () => {
            const ownerConn = tHecta.connect(owner);
            const aliceCurrentSpaceProfit = preminedHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(premintedTHecta);

            const aliceMaxClaim = aliceCurrentSpaceProfit;
            await busd
                .connect(alice)
                .approve(tHecta.address, aliceCurrentSpaceProfit.mul(toBusdRate));
            await tHecta.connect(alice).exercise(aliceCurrentSpaceProfit);

            const aliceInfo = await ownerConn.holders(alice.address);
            const alicePHectaBalance = await tHecta.connect(alice).balanceOf(alice.address);

            await expect(alicePHectaBalance).to.be.eq(
                aliceMockBalance.sub(aliceCurrentSpaceProfit)
            );
            const [amount] = await ownerConn.pendingFor(alice.address, 0);

            await Promise.all([
                expect(amount).to.be.eq(aliceCurrentSpaceProfit), //isTransferable
                expect(aliceInfo[0]).to.be.eq(false), //isTransferable
                expect(aliceInfo[0]).to.be.eq(false), //isTransferable
                expect(aliceInfo[1]).to.be.eq(1), // lastRebaseSpaceCount
                expect(aliceInfo[2]).to.be.eq(aliceMaxClaim), // maxClaim
                expect(aliceInfo[3]).to.be.eq(aliceCurrentSpaceProfit), // claimed
                expect(aliceInfo[4]).to.be.eq(aliceCurrentSpaceProfit), // currentSpaceProfit
            ]);
        });

        it("user cannot transfer after exercise in same space", async () => {
            const ownerConn = tHecta.connect(owner);
            const aliceCurrentSpaceProfit = preminedHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(premintedTHecta);

            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock();
            await busd
                .connect(alice)
                .approve(tHecta.address, aliceCurrentSpaceProfit.mul(toBusdRate));
            await tHecta.connect(alice).exercise(aliceCurrentSpaceProfit.div(2));

            await expect(
                tHecta.connect(alice).transfer(bob.address, aliceCurrentSpaceProfit.div(2))
            ).to.be.revertedWith("Cannot transfer after exercise");
        });

        it("after exercise, next space user can transfer correctly", async () => {
            const ownerConn = tHecta.connect(owner);
            const transferAmount = BigNumber.from("100000000000000"); // 100 000 tHecta

            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock();

            const space1AliceCurrentSpaceProfit = preminedHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(premintedTHecta);
            const exercisedPHecta = space1AliceCurrentSpaceProfit;
            await busd.connect(alice).approve(tHecta.address, exercisedPHecta.mul(toBusdRate));
            await tHecta.connect(alice).exercise(exercisedPHecta);

            const space1AliceMaxClaim = space1AliceCurrentSpaceProfit;

            const space1BobCurrentSpaceProfit = preminedHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(bobMockBalance)
                .div(premintedTHecta);

            const space1BobMaxClaim = space1BobCurrentSpaceProfit;

            const additionHectaAmount = space1AliceCurrentSpaceProfit;

            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock(); // new space

            // 2000
            const space2AliceBalance = aliceMockBalance.sub(exercisedPHecta);

            // 2000
            const space2BobBalance = bobMockBalance;

            const space2AliceCurrentSpaceProfit = BigNumber.from(additionHectaAmount)
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(space2AliceBalance)
                .div(premintedTHecta.sub(exercisedPHecta));
            const maxClaimTransfer = space2AliceCurrentSpaceProfit
                .mul(transferAmount)
                .div(space2AliceBalance);

            const space2AliceMaxClaim = space2AliceCurrentSpaceProfit
                .add(space1AliceMaxClaim)
                .sub(maxClaimTransfer);

            const space2BobCurrentSpaceProfit = BigNumber.from(additionHectaAmount)
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(space2BobBalance)
                .div(premintedTHecta.sub(exercisedPHecta));

            const space2BobMaxClaim = space2BobCurrentSpaceProfit
                .add(maxClaimTransfer)
                .add(space1BobMaxClaim);

            await tHecta.connect(alice).transfer(bob.address, transferAmount);

            const [aliceInfo, bobInfo] = await Promise.all([
                ownerConn.holders(alice.address),
                ownerConn.holders(bob.address),
            ]);

            await Promise.all([
                expect(aliceInfo[0]).to.be.eq(true), //isTransferable
                expect(aliceInfo[1]).to.be.eq(2), // lastRebaseSpaceCount
                expect(aliceInfo[2]).to.be.eq(space2AliceMaxClaim), // maxClaim
                expect(aliceInfo[3]).to.be.eq(space1AliceCurrentSpaceProfit), // claimed
                expect(aliceInfo[4]).to.be.eq(space2AliceCurrentSpaceProfit), // currentSpaceProfit

                expect(bobInfo[0]).to.be.eq(true), // isTransferable
                expect(bobInfo[1]).to.be.eq(2), // lastRebaseSpaceCount
                expect(bobInfo[2]).to.be.eq(space2BobMaxClaim), // maxClaim
                expect(bobInfo[3]).to.be.eq(0), // claimed
                expect(bobInfo[4]).to.be.eq(space2BobCurrentSpaceProfit), // currentSpaceProfit
            ]);
        });
    });

    describe("CLAIM", () => {
        const aliceMockBalance = BigNumber.from("4000000000000000"); // 4000 000 tHecta
        const bobMockBalance = BigNumber.from("1000000000000000"); // 1000 000 tHecta
        const vestingLength = 100;
        beforeEach(async () => {
            const ownerConn = tHecta.connect(owner);
            await Promise.all([
                ownerConn.transfer(alice.address, aliceMockBalance),
                ownerConn.transfer(bob.address, bobMockBalance),
                busd.transfer(alice.address, "100000000000000000000000"),
                busd.transfer(bob.address, "100000000000000000000000"),
                ownerConn.setVestingLength(vestingLength),
            ]);

            await ownerConn.start(startTime());
        });

        it("after exercise and vesting time, user can get their vesting hecta", async () => {
            const ownerConn = tHecta.connect(owner);
            const aliceCurrentSpaceProfit = preminedHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(premintedTHecta);

            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber());
            await mineBlock();
            await busd
                .connect(alice)
                .approve(tHecta.address, aliceCurrentSpaceProfit.mul(toBusdRate));
            await tHecta.connect(alice).exercise(aliceCurrentSpaceProfit);

            const alicePHectaBalance = await tHecta.connect(alice).balanceOf(alice.address);

            await expect(alicePHectaBalance).to.be.eq(
                aliceMockBalance.sub(aliceCurrentSpaceProfit)
            );
            await increaseTime(vestingLength + 100);
            await mineBlock();

            await tHecta.connect(alice).claimAll(alice.address);

            const aliceHectaBalance = await hecta.balanceOf(alice.address);

            await expect(aliceHectaBalance).to.be.eq(aliceCurrentSpaceProfit);
        });
    });
});
