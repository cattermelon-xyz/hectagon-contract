import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";

import {
    HectagonStaking,
    HectagonTreasury,
    HectagonERC20Token,
    HectagonERC20Token__factory,
    SHectagon,
    SHectagon__factory,
    GHECTA,
    HectagonAuthority__factory,
} from "../../types";

const TOTAL_GONS = 5000000000000000;
const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");

describe("sHecta", () => {
    let initializer: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let hecta: HectagonERC20Token;
    let sHecta: SHectagon;
    let gHectaFake: FakeContract<GHECTA>;
    let stakingFake: FakeContract<HectagonStaking>;
    let treasuryFake: FakeContract<HectagonTreasury>;

    beforeEach(async () => {
        [initializer, alice, bob] = await ethers.getSigners();
        stakingFake = await smock.fake<HectagonStaking>("HectagonStaking");
        treasuryFake = await smock.fake<HectagonTreasury>("HectagonTreasury");
        gHectaFake = await smock.fake<GHECTA>("gHECTA");

        const authority = await new HectagonAuthority__factory(initializer).deploy(
            initializer.address,
            initializer.address,
            initializer.address,
            initializer.address
        );
        hecta = await new HectagonERC20Token__factory(initializer).deploy(authority.address);
        sHecta = await new SHectagon__factory(initializer).deploy();
    });

    it("is constructed correctly", async () => {
        expect(await sHecta.name()).to.equal("Staked HECTA");
        expect(await sHecta.symbol()).to.equal("sHECTA");
        expect(await sHecta.decimals()).to.equal(9);
    });

    describe("initialization", () => {
        describe("setIndex", () => {
            it("sets the index", async () => {
                await sHecta.connect(initializer).setIndex(3);
                expect(await sHecta.index()).to.equal(3);
            });

            it("must be done by the initializer", async () => {
                await expect(sHecta.connect(alice).setIndex(3)).to.be.reverted;
            });

            it("cannot update the index if already set", async () => {
                await sHecta.connect(initializer).setIndex(3);
                await expect(sHecta.connect(initializer).setIndex(3)).to.be.reverted;
            });
        });

        describe("setgHECTA", () => {
            it("sets gHectaFake", async () => {
                await sHecta.connect(initializer).setgHECTA(gHectaFake.address);
                expect(await sHecta.gHECTA()).to.equal(gHectaFake.address);
            });

            it("must be done by the initializer", async () => {
                await expect(sHecta.connect(alice).setgHECTA(gHectaFake.address)).to.be.reverted;
            });

            it("won't set gHectaFake to 0 address", async () => {
                await expect(sHecta.connect(initializer).setgHECTA(ZERO_ADDRESS)).to.be.reverted;
            });
        });

        describe("initialize", () => {
            it("assigns TOTAL_GONS to the stakingFake contract's balance", async () => {
                await sHecta
                    .connect(initializer)
                    .initialize(stakingFake.address, treasuryFake.address);
                expect(await sHecta.balanceOf(stakingFake.address)).to.equal(TOTAL_GONS);
            });

            it("emits Transfer event", async () => {
                await expect(
                    sHecta.connect(initializer).initialize(stakingFake.address, treasuryFake.address)
                )
                    .to.emit(sHecta, "Transfer")
                    .withArgs(ZERO_ADDRESS, stakingFake.address, TOTAL_GONS);
            });

            it("emits LogStakingContractUpdated event", async () => {
                await expect(
                    sHecta.connect(initializer).initialize(stakingFake.address, treasuryFake.address)
                )
                    .to.emit(sHecta, "LogStakingContractUpdated")
                    .withArgs(stakingFake.address);
            });

            it("unsets the initializer, so it cannot be called again", async () => {
                await sHecta
                    .connect(initializer)
                    .initialize(stakingFake.address, treasuryFake.address);
                await expect(
                    sHecta.connect(initializer).initialize(stakingFake.address, treasuryFake.address)
                ).to.be.reverted;
            });
        });
    });

    describe("post-initialization", () => {
        beforeEach(async () => {
            await sHecta.connect(initializer).setIndex(1);
            await sHecta.connect(initializer).setgHECTA(gHectaFake.address);
            await sHecta.connect(initializer).initialize(stakingFake.address, treasuryFake.address);
        });

        describe("approve", () => {
            it("sets the allowed value between sender and spender", async () => {
                await sHecta.connect(alice).approve(bob.address, 10);
                expect(await sHecta.allowance(alice.address, bob.address)).to.equal(10);
            });

            it("emits an Approval event", async () => {
                await expect(await sHecta.connect(alice).approve(bob.address, 10))
                    .to.emit(sHecta, "Approval")
                    .withArgs(alice.address, bob.address, 10);
            });
        });

        describe("increaseAllowance", () => {
            it("increases the allowance between sender and spender", async () => {
                await sHecta.connect(alice).approve(bob.address, 10);
                await sHecta.connect(alice).increaseAllowance(bob.address, 4);

                expect(await sHecta.allowance(alice.address, bob.address)).to.equal(14);
            });

            it("emits an Approval event", async () => {
                await sHecta.connect(alice).approve(bob.address, 10);
                await expect(await sHecta.connect(alice).increaseAllowance(bob.address, 4))
                    .to.emit(sHecta, "Approval")
                    .withArgs(alice.address, bob.address, 14);
            });
        });

        describe("decreaseAllowance", () => {
            it("decreases the allowance between sender and spender", async () => {
                await sHecta.connect(alice).approve(bob.address, 10);
                await sHecta.connect(alice).decreaseAllowance(bob.address, 4);

                expect(await sHecta.allowance(alice.address, bob.address)).to.equal(6);
            });

            it("will not make the value negative", async () => {
                await sHecta.connect(alice).approve(bob.address, 10);
                await sHecta.connect(alice).decreaseAllowance(bob.address, 11);

                expect(await sHecta.allowance(alice.address, bob.address)).to.equal(0);
            });

            it("emits an Approval event", async () => {
                await sHecta.connect(alice).approve(bob.address, 10);
                await expect(await sHecta.connect(alice).decreaseAllowance(bob.address, 4))
                    .to.emit(sHecta, "Approval")
                    .withArgs(alice.address, bob.address, 6);
            });
        });

        describe("circulatingSupply", () => {
            it("is zero when all owned by stakingFake contract", async () => {
                await stakingFake.supplyInWarmup.returns(0);
                await gHectaFake.totalSupply.returns(0);
                await gHectaFake.balanceFrom.returns(0);

                const totalSupply = await sHecta.circulatingSupply();
                expect(totalSupply).to.equal(0);
            });

            it("includes all supply owned by gHectaFake", async () => {
                await stakingFake.supplyInWarmup.returns(0);
                await gHectaFake.totalSupply.returns(10);
                await gHectaFake.balanceFrom.returns(10);

                const totalSupply = await sHecta.circulatingSupply();
                expect(totalSupply).to.equal(10);
            });

            it("includes all supply in warmup in stakingFake contract", async () => {
                await stakingFake.supplyInWarmup.returns(50);
                await gHectaFake.totalSupply.returns(0);
                await gHectaFake.balanceFrom.returns(0);

                const totalSupply = await sHecta.circulatingSupply();
                expect(totalSupply).to.equal(50);
            });
        });
    });
});
