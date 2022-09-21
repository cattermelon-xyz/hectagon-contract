import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
    HectagonAuthority,
    HectagonAuthority__factory,
    HectagonInvestmentCouncil,
    HectagonInvestmentCouncil__factory,
} from "../../types";

describe("HectagonInvestmentCouncil", () => {
    let owner: SignerWithAddress;
    let bob: SignerWithAddress;

    let auth: HectagonAuthority;
    let hic: HectagonInvestmentCouncil;

    beforeEach(async () => {
        [owner, bob] = await ethers.getSigners();

        auth = await new HectagonAuthority__factory(owner).deploy(
            owner.address,
            owner.address,
            owner.address,
            owner.address
        );

        hic = await new HectagonInvestmentCouncil__factory(owner).deploy(auth.address);
    });

    it("correctly constructs an ERC20", async () => {
        expect(await hic.name()).to.equal("Hectagon Investment Council");
        expect(await hic.symbol()).to.equal("HIC");
        expect(await hic.decimals()).to.equal(0);
        expect(await hic.balanceOf(owner.address)).to.equal(6);
    });

    describe("mint", () => {
        it("must be done by governor", async () => {
            await expect(hic.connect(bob).mint(bob.address, 10)).to.be.revertedWith("UNAUTHORIZED");
        });

        it("increases total supply", async () => {
            const supplyBefore = await hic.totalSupply();
            await hic.connect(owner).mint(bob.address, 10);
            expect(supplyBefore.add(10)).to.equal(await hic.totalSupply());
        });
    });

    describe("burn", () => {
        beforeEach(async () => {
            await hic.connect(owner).mint(bob.address, 10);
        });

        it("only governor can burn", async () => {
            await expect(hic.connect(bob).burn(10)).to.be.revertedWith("UNAUTHORIZED");
        });

        it("reduces the total supply", async () => {
            const supplyBefore = await hic.totalSupply();
            await hic.connect(owner).burn(3);
            expect(supplyBefore.sub(3)).to.equal(await hic.totalSupply());
        });
    });

    describe("reclaim", () => {
        beforeEach(async () => {
            await hic.connect(owner).mint(bob.address, 10);
        });

        it("only governor can call", async () => {
            await expect(hic.connect(bob).reclaim(owner.address, 3)).to.be.revertedWith(
                "UNAUTHORIZED"
            );
        });

        it("reclaim success from one address", async () => {
            const otherBalanceBefore = await hic.balanceOf(bob.address);
            const governorBalanceBefore = await hic.balanceOf(owner.address);
            await hic.connect(owner).reclaim(bob.address, 5);
            const otherBalanceAfter = await hic.balanceOf(bob.address);
            const governorBalanceAfter = await hic.balanceOf(owner.address);
            expect(otherBalanceBefore.sub(5)).to.be.eq(otherBalanceAfter);
            expect(governorBalanceBefore.add(5)).to.be.eq(governorBalanceAfter);
        });

        it("cannot exceed bob's balance", async () => {
            await expect(hic.connect(owner).reclaim(bob.address, 11)).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance"
            );
        });
    });
});
