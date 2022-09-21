import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
    HectagonAuthority,
    HectagonAuthority__factory,
    HectagonInvestmentTeam,
    HectagonInvestmentTeam__factory,
} from "../../types";

describe("HectagonInvestmentTeam", () => {
    let owner: SignerWithAddress;
    let bob: SignerWithAddress;

    let auth: HectagonAuthority;
    let hit: HectagonInvestmentTeam;

    beforeEach(async () => {
        [owner, bob] = await ethers.getSigners();

        auth = await new HectagonAuthority__factory(owner).deploy(
            owner.address,
            owner.address,
            owner.address,
            owner.address
        );

        hit = await new HectagonInvestmentTeam__factory(owner).deploy(auth.address);
    });

    it("correctly constructs an ERC20", async () => {
        expect(await hit.name()).to.equal("Hectagon Investment Team");
        expect(await hit.symbol()).to.equal("HIT");
        expect(await hit.decimals()).to.equal(0);
        expect(await hit.balanceOf(owner.address)).to.equal(7);
    });

    describe("mint", () => {
        it("must be done by governor", async () => {
            await expect(hit.connect(bob).mint(bob.address, 10)).to.be.revertedWith("UNAUTHORIZED");
        });

        it("increases total supply", async () => {
            const supplyBefore = await hit.totalSupply();
            await hit.connect(owner).mint(bob.address, 10);
            expect(supplyBefore.add(10)).to.equal(await hit.totalSupply());
        });
    });

    describe("burn", () => {
        beforeEach(async () => {
            await hit.connect(owner).mint(bob.address, 10);
        });

        it("only governor can burn", async () => {
            await expect(hit.connect(bob).burn(10)).to.be.revertedWith("UNAUTHORIZED");
        });

        it("reduces the total supply", async () => {
            const supplyBefore = await hit.totalSupply();
            await hit.connect(owner).burn(3);
            expect(supplyBefore.sub(3)).to.equal(await hit.totalSupply());
        });
    });

    describe("reclaim", () => {
        beforeEach(async () => {
            await hit.connect(owner).mint(bob.address, 10);
        });

        it("only governor can call", async () => {
            await expect(hit.connect(bob).reclaim(owner.address, 3)).to.be.revertedWith(
                "UNAUTHORIZED"
            );
        });

        it("reclaim success from one address", async () => {
            const otherBalanceBefore = await hit.balanceOf(bob.address);
            const governorBalanceBefore = await hit.balanceOf(owner.address);
            await hit.connect(owner).reclaim(bob.address, 5);
            const otherBalanceAfter = await hit.balanceOf(bob.address);
            const governorBalanceAfter = await hit.balanceOf(owner.address);
            expect(otherBalanceBefore.sub(5)).to.be.eq(otherBalanceAfter);
            expect(governorBalanceBefore.add(5)).to.be.eq(governorBalanceAfter);
        });

        it("cannot exceed bob's balance", async () => {
            await expect(hit.connect(owner).reclaim(bob.address, 11)).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance"
            );
        });
    });
});
