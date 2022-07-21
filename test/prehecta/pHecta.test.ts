import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, utils } from "ethers";
import { ethers, network } from "hardhat";
import {
    HectagonERC20Token,
    HectagonAuthority,
    BEP20Token,
    PHecta,
    HectagonTreasury,
    HectagonERC20Token__factory,
    HectagonAuthority__factory,
    BEP20Token__factory,
    PHecta__factory,
    HectagonTreasury__factory,
    HectaCirculatingSupply,
    HectaCirculatingSupply__factory,
} from "../../types";

describe("Private Hectagon", async () => {
    const LARGE_APPROVAL = "100000000000000000000000000000000";
    // Increase timestamp by amount determined by `offset`
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;

    let auth: HectagonAuthority;
    let busd: BEP20Token;
    let hecta: HectagonERC20Token;
    let pHecta: PHecta;
    let treasury: HectagonTreasury;
    let circulatingSupplyConrtact: HectaCirculatingSupply;

    const preminedtHecta = utils.parseUnits("30000", 9);
    const RateDenominator = BigNumber.from(1000000);
    const MaxPHectaToExercise = BigNumber.from(100000);
    const premintedPHecta = utils.parseUnits("50000000", 9); // 50,000,000 token

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

        pHecta = await new PHecta__factory(owner).deploy();

        // Setup for each component
        await busd.approve(treasury.address, LARGE_APPROVAL);

        // To get past HECTA contract guards
        await auth.pushVault(treasury.address, true);

        // toggle owner treasury manager
        await treasury.enable("0", owner.address);
        //  toggle owner reward manager
        await treasury.enable("1", owner.address);
        // toggle pHecta reward manager
        await treasury.enable("1", pHecta.address);

        // initialize treasury, 30,000
        await treasury.initialize(owner.address, preminedtHecta);

        await pHecta.initialize(
            hecta.address,
            treasury.address,
            busd.address,
            circulatingSupplyConrtact.address
        );
    });

    it("correctly constructs an ERC20", async () => {
        expect(await pHecta.name()).to.equal("Private Hectagon");
        expect(await pHecta.symbol()).to.equal("pHecta");
        expect(await pHecta.decimals()).to.equal(9);
        expect(await pHecta.totalSupply()).to.equal(premintedPHecta);
    });

    describe("setSpaceLength", () => {
        it("must be done by owner", async () => {
            await expect(pHecta.connect(bob).setSpaceLength(100)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("Owner can be done correctly", async () => {
            const spaceLength = 1000;
            const ownerConn = pHecta.connect(owner);
            await ownerConn.setSpaceLength(spaceLength);
            await expect(await ownerConn.spaceLength()).to.be.equal(spaceLength);
        });
    });

    describe("setVestingLength", () => {
        it("must be done by owner", async () => {
            await expect(pHecta.connect(bob).setVestingLength(100)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("Owner can be done correctly", async () => {
            const vestingLength = 1000;
            const ownerConn = pHecta.connect(owner);
            await ownerConn.setVestingLength(vestingLength);
            await expect(await ownerConn.vestingLength()).to.be.equal(vestingLength);
        });
    });

    describe("initialize", () => {
        it("must be done by owner", async () => {
            await expect(
                pHecta
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
            const ownerConn = pHecta.connect(owner);
            await ownerConn.initialize(
                hecta.address,
                treasury.address,
                busd.address,
                circulatingSupplyConrtact.address
            );
            expect(await ownerConn.busdAddress()).to.be.equal(busd.address);
            expect(await pHecta.hectaAddress()).to.equal(hecta.address);
            expect(await pHecta.treasuryAddress()).to.equal(treasury.address);
        });
    });

    describe("start", () => {
        it("must be done by owner", async () => {
            await expect(pHecta.connect(bob).start()).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("Owner can be done correctly", async () => {
            const ownerConn = pHecta.connect(owner);
            await ownerConn.start();
            const startTimestamp = await ownerConn.startTimestamp();
            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestampBefore = blockBefore.timestamp;
            await expect(startTimestamp).to.be.equal(timestampBefore);

            const spaceCounter = await ownerConn.spaceCounter();
            await expect(spaceCounter).to.be.eq(0);

            const [totalHecta, totalPHecta, timestamp] = await ownerConn.spaces(spaceCounter);
            await expect(totalHecta).to.be.eq(0);
            await expect(totalPHecta).to.be.eq(premintedPHecta);
            await expect(timestamp).to.be.eq(timestampBefore);
        });
    });

    describe("getClaimable()", () => {
        const mockBalance = BigNumber.from("1000000000000000"); // 1000,000 pHecta

        beforeEach(async () => {
            const ownerConn = pHecta.connect(owner);
            await ownerConn.transfer(alice.address, mockBalance);
            await ownerConn.transfer(bob.address, mockBalance);
            await ownerConn.start();
        });

        it("show info correctly before start", async () => {
            const ownerConn = pHecta.connect(owner);

            const aliceClaimable = await ownerConn.getClaimable(alice.address);
            const bobClaimable = await ownerConn.getClaimable(bob.address);

            await expect(aliceClaimable).to.be.eq(0);
            await expect(bobClaimable).to.be.eq(0);
        });

        it("show info correctly after start, first space, incre totalHecta", async () => {
            const hectaIncreAmount = utils.parseUnits("1000", 9); // 1000 hecta
            await treasury.connect(owner).mint(owner.address, hectaIncreAmount);

            const expectedClaimable = hectaIncreAmount
                .add(preminedtHecta)
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(mockBalance)
                .div(premintedPHecta);

            const ownerConn = pHecta.connect(owner);
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
            const ownerConn = pHecta.connect(owner);
            const bobConn = pHecta.connect(bob);
            await ownerConn.start();
            const spaceLength = await ownerConn.spaceLength();

            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock();
            await bobConn.beat();

            const currentSpaceCount = await bobConn.spaceCounter();
            await expect(currentSpaceCount).to.be.eq(1);
            const [totalHecta, totalPHecta, timestamp] = await ownerConn.spaces(currentSpaceCount);

            await expect(totalHecta).to.be.eq(preminedtHecta);
            await expect(totalPHecta).to.be.eq(premintedPHecta);

            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestampBefore = blockBefore.timestamp;
            await expect(timestamp).to.be.eq(timestampBefore);
        });
    });

    describe("transfer logic", () => {
        const aliceMockBalance = BigNumber.from("3000000000000000"); // 3000 000 pHecta
        const bobMockBalance = BigNumber.from("1000000000000000"); // 1000 000 pHecta

        beforeEach(async () => {
            const ownerConn = pHecta.connect(owner);
            await ownerConn.transfer(alice.address, aliceMockBalance);
            await ownerConn.transfer(bob.address, bobMockBalance);
            await ownerConn.start();
        });

        it("user can transfer correctly after start in space 0", async () => {
            const transferAmount = BigNumber.from("1000000000000");
            await pHecta.connect(alice).transfer(bob.address, transferAmount);

            await expect(await pHecta.connect(alice).balanceOf(alice.address)).to.be.eq(
                aliceMockBalance.sub(transferAmount)
            );
            await expect(await pHecta.connect(alice).balanceOf(bob.address)).to.be.eq(
                bobMockBalance.add(transferAmount)
            );
        });

        it("user can transfer correctly after start in space 1", async () => {
            const transferAmount = BigNumber.from("300000000000000"); // 300 000

            const ownerConn = pHecta.connect(owner);
            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock();
            await pHecta.connect(alice).transfer(bob.address, transferAmount);

            await expect(await pHecta.connect(alice).balanceOf(alice.address)).to.be.eq(
                aliceMockBalance.sub(transferAmount)
            );
            await expect(await pHecta.connect(alice).balanceOf(bob.address)).to.be.eq(
                bobMockBalance.add(transferAmount)
            );

            const aliceInfo = await ownerConn.holders(alice.address);
            const bobInfo = await ownerConn.holders(bob.address);

            const aliceCurrentSpaceProfit = preminedtHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(premintedPHecta);

            const aliceMaxClaim = aliceCurrentSpaceProfit.sub(
                aliceCurrentSpaceProfit.mul(transferAmount).div(aliceMockBalance)
            );

            const bobCurrentSpaceProfit = preminedtHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(bobMockBalance)
                .div(premintedPHecta);

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
            const ownerConn = pHecta.connect(owner);
            const transferAmount = BigNumber.from("1000000000000000"); // 1000 000 pHecta

            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock(); // new space

            await pHecta.connect(alice).transfer(bob.address, transferAmount);

            const space1AliceCurrentSpaceProfit = preminedtHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(premintedPHecta);

            const space1AliceMaxClaim = space1AliceCurrentSpaceProfit.sub(
                space1AliceCurrentSpaceProfit.mul(transferAmount).div(aliceMockBalance)
            );

            const space1BobCurrentSpaceProfit = preminedtHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(bobMockBalance)
                .div(premintedPHecta);

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
                .div(premintedPHecta);

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
                .div(premintedPHecta);

            const space2BobMaxClaim = space2BobCurrentSpaceProfit
                .add(maxClaimTransfer)
                .add(space1BobMaxClaim);

            await pHecta.connect(alice).transfer(bob.address, transferAmount);

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
        const aliceMockBalance = BigNumber.from("4000000000000000"); // 4000 000 pHecta
        const bobMockBalance = BigNumber.from("1000000000000000"); // 1000 000 pHecta

        beforeEach(async () => {
            const ownerConn = pHecta.connect(owner);
            await Promise.all([
                ownerConn.transfer(alice.address, aliceMockBalance),
                ownerConn.transfer(bob.address, bobMockBalance),
                busd.transfer(alice.address, "100000000000000000000000"),
                busd.transfer(bob.address, "100000000000000000000000"),
            ]);
            await ownerConn.start();
        });

        it("user can only exercise from space 1", async () => {
            await expect(pHecta.connect(bob).exercise("100000")).to.be.revertedWith(
                "Claim more than maximum amount"
            );
        });

        it("user can exercise correctly from space 1", async () => {
            const ownerConn = pHecta.connect(owner);
            const aliceCurrentSpaceProfit = preminedtHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(premintedPHecta);

            const aliceMaxClaim = aliceCurrentSpaceProfit;
            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock();
            await busd
                .connect(alice)
                .approve(pHecta.address, aliceCurrentSpaceProfit.mul(toBusdRate));
            await pHecta.connect(alice).exercise(aliceCurrentSpaceProfit);

            const aliceInfo = await ownerConn.holders(alice.address);
            const alicePHectaBalance = await pHecta.connect(alice).balanceOf(alice.address);

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
            const ownerConn = pHecta.connect(owner);
            const aliceCurrentSpaceProfit = preminedtHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(premintedPHecta);

            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock();
            await busd
                .connect(alice)
                .approve(pHecta.address, aliceCurrentSpaceProfit.mul(toBusdRate));
            await pHecta.connect(alice).exercise(aliceCurrentSpaceProfit.div(2));

            await expect(
                pHecta.connect(alice).transfer(bob.address, aliceCurrentSpaceProfit.div(2))
            ).to.be.revertedWith("Cannot transfer after exercise");
        });

        it("after exercise, next space user can transfer correctly", async () => {
            const ownerConn = pHecta.connect(owner);
            const transferAmount = BigNumber.from("100000000000000"); // 100 000 pHecta

            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock();

            const space1AliceCurrentSpaceProfit = preminedtHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(premintedPHecta);
            const exercisedPHecta = space1AliceCurrentSpaceProfit;
            await busd.connect(alice).approve(pHecta.address, exercisedPHecta.mul(toBusdRate));
            await pHecta.connect(alice).exercise(exercisedPHecta);

            const space1AliceMaxClaim = space1AliceCurrentSpaceProfit;

            const space1BobCurrentSpaceProfit = preminedtHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(bobMockBalance)
                .div(premintedPHecta);

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
                .div(premintedPHecta.sub(exercisedPHecta));
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
                .div(premintedPHecta.sub(exercisedPHecta));

            const space2BobMaxClaim = space2BobCurrentSpaceProfit
                .add(maxClaimTransfer)
                .add(space1BobMaxClaim);

            await pHecta.connect(alice).transfer(bob.address, transferAmount);

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
        const aliceMockBalance = BigNumber.from("4000000000000000"); // 4000 000 pHecta
        const bobMockBalance = BigNumber.from("1000000000000000"); // 1000 000 pHecta
        const vestingLength = 100;
        beforeEach(async () => {
            const ownerConn = pHecta.connect(owner);
            await Promise.all([
                ownerConn.transfer(alice.address, aliceMockBalance),
                ownerConn.transfer(bob.address, bobMockBalance),
                busd.transfer(alice.address, "100000000000000000000000"),
                busd.transfer(bob.address, "100000000000000000000000"),
                ownerConn.setVestingLength(vestingLength),
            ]);
            await ownerConn.start();
        });

        it("after exercise and vesting time, user can get their vesting hecta", async () => {
            const ownerConn = pHecta.connect(owner);
            const aliceCurrentSpaceProfit = preminedtHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(premintedPHecta);

            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber());
            await mineBlock();
            await busd
                .connect(alice)
                .approve(pHecta.address, aliceCurrentSpaceProfit.mul(toBusdRate));
            await pHecta.connect(alice).exercise(aliceCurrentSpaceProfit);

            const alicePHectaBalance = await pHecta.connect(alice).balanceOf(alice.address);

            await expect(alicePHectaBalance).to.be.eq(
                aliceMockBalance.sub(aliceCurrentSpaceProfit)
            );
            await increaseTime(vestingLength + 100);
            await mineBlock();

            await pHecta.connect(alice).claimAll(alice.address);

            const aliceHectaBalance = await hecta.balanceOf(alice.address);

            await expect(aliceHectaBalance).to.be.eq(aliceCurrentSpaceProfit);
        });
    });
});
