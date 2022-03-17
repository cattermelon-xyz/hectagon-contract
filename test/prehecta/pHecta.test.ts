import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
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
} from "../../types";

describe("Private Hectagon", async () => {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
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

    let premintHecta: BigNumber;
    const RateDenominator = BigNumber.from(1000000);
    const MaxPHectaToExercise = BigNumber.from(100000);
    const PremintPHecta = BigNumber.from("50000000000000000"); // 50,000,000 token

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
        treasury = await new HectagonTreasury__factory(owner).deploy(
            hecta.address,
            "0",
            auth.address
        );
        pHecta = await new PHecta__factory(owner).deploy();

        // Setup for each component
        // Needed for treasury deposit
        //await gOhm.migrate(staking.address, sOhm.address);
        await busd.approve(treasury.address, LARGE_APPROVAL);

        // To get past HECTA contract guards
        await auth.pushVault(treasury.address, true);

        // queue and toggle owner reserve depositor
        await treasury.enable("0", owner.address, ZERO_ADDRESS);
        // queue and toggle liquidity depositor
        await treasury.enable("4", owner.address, ZERO_ADDRESS);
        // queue and toggle BUSD as reserve token
        await treasury.enable("2", busd.address, ZERO_ADDRESS);
        // queue and toggle owner reserve depositor
        await treasury.enable("0", pHecta.address, ZERO_ADDRESS);

        // Deposit 10,000 BUSD to treasury, 1,000 HECTA gets minted to owner with 9000 as excess reserves (ready to be minted)
        const busdAmount = BigNumber.from(`10000000000000000000000`);
        const excessReserves = BigNumber.from(`9000000000000`);
        await treasury.connect(owner).deposit(busdAmount, busd.address, excessReserves);

        premintHecta = busdAmount.div(BigNumber.from("1000000000")).sub(excessReserves);

        await pHecta.initialize(hecta.address, treasury.address, busd.address);
    });

    it("correctly constructs an ERC20", async () => {
        expect(await pHecta.name()).to.equal("Private Hectagon");
        expect(await pHecta.symbol()).to.equal("pHecta");
        expect(await pHecta.decimals()).to.equal(9);
        expect(await pHecta.totalSupply()).to.equal(PremintPHecta);
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

    describe("initialize", () => {
        it("must be done by owner", async () => {
            await expect(
                pHecta.connect(bob).initialize(hecta.address, treasury.address, busd.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Owner can be done correctly", async () => {
            const ownerConn = pHecta.connect(owner);
            await ownerConn.initialize(hecta.address, treasury.address, busd.address);
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
            await expect(totalPHecta).to.be.eq(PremintPHecta);
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
            const hectaIncreAmount = BigNumber.from(1000000000000); // 1000 hecta
            await treasury.connect(owner).deposit(`${hectaIncreAmount}000000000`, busd.address, 0);

            const expectedClaimable = hectaIncreAmount
                .add(premintHecta)
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(mockBalance)
                .div(PremintPHecta);

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

            await expect(totalHecta).to.be.eq(premintHecta);
            await expect(totalPHecta).to.be.eq(PremintPHecta);

            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestampBefore = blockBefore.timestamp;
            await expect(timestamp).to.be.eq(timestampBefore);
        });
    });

    describe("transfer", () => {
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

            const aliceCurrentSpaceProfit = premintHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(PremintPHecta);

            const aliceMaxClaim = aliceCurrentSpaceProfit.sub(
                aliceCurrentSpaceProfit.mul(transferAmount).div(aliceMockBalance)
            );

            const bobCurrentSpaceProfit = premintHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(bobMockBalance)
                .div(PremintPHecta);

            const bobMaxClaim = bobCurrentSpaceProfit.add(
                aliceCurrentSpaceProfit.mul(transferAmount).div(aliceMockBalance)
            );

            await expect(aliceInfo[0]).to.be.eq(true); //isTransferable
            await expect(aliceInfo[1]).to.be.eq(1); // lastRebaseSpaceCount
            await expect(aliceInfo[2]).to.be.eq(aliceMaxClaim); // maxClaim
            await expect(aliceInfo[3]).to.be.eq(0); // claimed
            await expect(aliceInfo[4]).to.be.eq(aliceCurrentSpaceProfit); // currentSpaceProfit

            await expect(bobInfo[0]).to.be.eq(true); // isTransferable
            await expect(bobInfo[1]).to.be.eq(1); // lastRebaseSpaceCount
            await expect(bobInfo[2]).to.be.eq(bobMaxClaim); // maxClaim
            await expect(bobInfo[3]).to.be.eq(0); // claimed
            await expect(bobInfo[4]).to.be.eq(bobCurrentSpaceProfit); // currentSpaceProfit
        });

        it("user can transfer correctly after start in space 1, totalHecta incre then space 2 transfer called, then address info updated correctly", async () => {
            const ownerConn = pHecta.connect(owner);
            const transferAmount = BigNumber.from("1000000000000000"); // 1000 000 pHecta

            const spaceLength = await ownerConn.spaceLength();
            await increaseTime(spaceLength.toNumber() + 1);
            await mineBlock(); // new space

            await pHecta.connect(alice).transfer(bob.address, transferAmount);

            const space1AliceCurrentSpaceProfit = premintHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(PremintPHecta);

            const space1AliceMaxClaim = space1AliceCurrentSpaceProfit.sub(
                space1AliceCurrentSpaceProfit.mul(transferAmount).div(aliceMockBalance)
            );

            const space1BobCurrentSpaceProfit = premintHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(bobMockBalance)
                .div(PremintPHecta);

            const space1BobMaxClaim = space1BobCurrentSpaceProfit.add(
                space1AliceCurrentSpaceProfit.mul(transferAmount).div(aliceMockBalance)
            );

            const additionHectaAmount = 2000000000000;
            await treasury
                .connect(owner)
                .deposit(`${additionHectaAmount}000000000`, busd.address, "0");

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
                .div(PremintPHecta);

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
                .div(PremintPHecta);

            const space2BobMaxClaim = space2BobCurrentSpaceProfit
                .add(maxClaimTransfer)
                .add(space1BobMaxClaim);

            await pHecta.connect(alice).transfer(bob.address, transferAmount);

            const aliceInfo = await ownerConn.holders(alice.address);
            const bobInfo = await ownerConn.holders(bob.address);

            await expect(aliceInfo[0]).to.be.eq(true); //isTransferable
            await expect(aliceInfo[1]).to.be.eq(2); // lastRebaseSpaceCount
            await expect(aliceInfo[2]).to.be.eq(space2AliceMaxClaim); // maxClaim
            await expect(aliceInfo[3]).to.be.eq(0); // claimed
            await expect(aliceInfo[4]).to.be.eq(space2AliceCurrentSpaceProfit); // currentSpaceProfit

            await expect(bobInfo[0]).to.be.eq(true); // isTransferable
            await expect(bobInfo[1]).to.be.eq(2); // lastRebaseSpaceCount
            await expect(bobInfo[2]).to.be.eq(space2BobMaxClaim); // maxClaim
            await expect(bobInfo[3]).to.be.eq(0); // claimed
            await expect(bobInfo[4]).to.be.eq(space2BobCurrentSpaceProfit); // currentSpaceProfit
        });
    });

    describe("exercise", () => {
        const aliceMockBalance = BigNumber.from("4000000000000000"); // 4000 000 pHecta
        const bobMockBalance = BigNumber.from("1000000000000000"); // 1000 000 pHecta

        beforeEach(async () => {
            const ownerConn = pHecta.connect(owner);
            await ownerConn.transfer(alice.address, aliceMockBalance);
            await ownerConn.transfer(bob.address, bobMockBalance);
            await busd.transfer(alice.address, "100000000000000000000000"); // 10,000 busd
            await busd.transfer(bob.address, "100000000000000000000000");
            await ownerConn.start();
        });

        it("user can only claimable from space 1", async () => {
            await expect(pHecta.connect(bob).exercise("100000")).to.be.revertedWith(
                "Claim more than maximum amount"
            );
        });

        it("user can claim correctly from space 1", async () => {
            const ownerConn = pHecta.connect(owner);
            const aliceCurrentSpaceProfit = premintHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(PremintPHecta);

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
            const aliceHectaBalance = await hecta.connect(alice).balanceOf(alice.address);

            await expect(alicePHectaBalance).to.be.eq(
                aliceMockBalance.sub(aliceCurrentSpaceProfit)
            );
            await expect(aliceHectaBalance).to.be.eq(aliceCurrentSpaceProfit);
            await expect(aliceInfo[0]).to.be.eq(false); //isTransferable
            await expect(aliceInfo[1]).to.be.eq(1); // lastRebaseSpaceCount
            await expect(aliceInfo[2]).to.be.eq(aliceMaxClaim); // maxClaim
            await expect(aliceInfo[3]).to.be.eq(aliceCurrentSpaceProfit); // claimed
            await expect(aliceInfo[4]).to.be.eq(aliceCurrentSpaceProfit); // currentSpaceProfit
        });

        it("user cannot claim after exercise in same space", async () => {
            const ownerConn = pHecta.connect(owner);
            const aliceCurrentSpaceProfit = premintHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(PremintPHecta);

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

            const space1AliceCurrentSpaceProfit = premintHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(aliceMockBalance)
                .div(PremintPHecta);
            const exercisedPHecta = space1AliceCurrentSpaceProfit;
            await busd.connect(alice).approve(pHecta.address, exercisedPHecta.mul(toBusdRate));
            await pHecta.connect(alice).exercise(exercisedPHecta);

            const space1AliceMaxClaim = space1AliceCurrentSpaceProfit;

            const space1BobCurrentSpaceProfit = premintHecta
                .mul(MaxPHectaToExercise)
                .div(RateDenominator)
                .mul(bobMockBalance)
                .div(PremintPHecta);

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
                .div(PremintPHecta.sub(exercisedPHecta));
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
                .div(PremintPHecta.sub(exercisedPHecta));

            const space2BobMaxClaim = space2BobCurrentSpaceProfit
                .add(maxClaimTransfer)
                .add(space1BobMaxClaim);

            await pHecta.connect(alice).transfer(bob.address, transferAmount);

            const aliceInfo = await ownerConn.holders(alice.address);
            const bobInfo = await ownerConn.holders(bob.address);

            await expect(aliceInfo[0]).to.be.eq(true); //isTransferable
            await expect(aliceInfo[1]).to.be.eq(2); // lastRebaseSpaceCount
            await expect(aliceInfo[2]).to.be.eq(space2AliceMaxClaim); // maxClaim
            await expect(aliceInfo[3]).to.be.eq(space1AliceCurrentSpaceProfit); // claimed
            await expect(aliceInfo[4]).to.be.eq(space2AliceCurrentSpaceProfit); // currentSpaceProfit

            await expect(bobInfo[0]).to.be.eq(true); // isTransferable
            await expect(bobInfo[1]).to.be.eq(2); // lastRebaseSpaceCount
            await expect(bobInfo[2]).to.be.eq(space2BobMaxClaim); // maxClaim
            await expect(bobInfo[3]).to.be.eq(0); // claimed
            await expect(bobInfo[4]).to.be.eq(space2BobCurrentSpaceProfit); // currentSpaceProfit
        });
    });
});
