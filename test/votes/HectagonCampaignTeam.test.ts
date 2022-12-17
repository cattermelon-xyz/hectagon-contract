import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
    HectagonAuthority,
    HectagonAuthority__factory,
    HectagonCampaignTeam,
    HectagonCampaignTeam__factory,
} from "../../types";

describe("HectagonCampaignTeam", () => {
    let owner: SignerWithAddress;
    let bob: SignerWithAddress;

    let auth: HectagonAuthority;
    let hcm: HectagonCampaignTeam;

    beforeEach(async () => {
        [owner, bob] = await ethers.getSigners();

        auth = await new HectagonAuthority__factory(owner).deploy(
            owner.address,
            owner.address,
            owner.address,
            owner.address
        );

        hcm = await new HectagonCampaignTeam__factory(owner).deploy(auth.address);
    });

    it("correctly constructs an ERC20", async () => {
        expect(await hcm.name()).to.equal("Hectagon Campaign Team");
        expect(await hcm.symbol()).to.equal("HCT");
        expect(await hcm.decimals()).to.equal(0);
        expect(await hcm.balanceOf(owner.address)).to.equal(7);
    });

    describe("mint", () => {
        it("must be done by governor", async () => {
            await expect(hcm.connect(bob).mint(bob.address, 10)).to.be.revertedWith("UNAUTHORIZED");
        });

        it("increases total supply", async () => {
            const supplyBefore = await hcm.totalSupply();
            await hcm.connect(owner).mint(bob.address, 10);
            expect(supplyBefore.add(10)).to.equal(await hcm.totalSupply());
        });
    });

    describe("burn", () => {
        beforeEach(async () => {
            await hcm.connect(owner).mint(bob.address, 10);
        });

        it("only governor can burn", async () => {
            await expect(hcm.connect(bob).burn(10)).to.be.revertedWith("UNAUTHORIZED");
        });

        it("reduces the total supply", async () => {
            const supplyBefore = await hcm.totalSupply();
            await hcm.connect(owner).burn(3);
            expect(supplyBefore.sub(3)).to.equal(await hcm.totalSupply());
        });
    });

    describe("reclaim", () => {
        beforeEach(async () => {
            await hcm.connect(owner).mint(bob.address, 10);
        });

        it("only governor can call", async () => {
            await expect(hcm.connect(bob).reclaim(owner.address, 3)).to.be.revertedWith(
                "UNAUTHORIZED"
            );
        });

        it("reclaim success from one address", async () => {
            const otherBalanceBefore = await hcm.balanceOf(bob.address);
            const governorBalanceBefore = await hcm.balanceOf(owner.address);
            await hcm.connect(owner).reclaim(bob.address, 5);
            const otherBalanceAfter = await hcm.balanceOf(bob.address);
            const governorBalanceAfter = await hcm.balanceOf(owner.address);
            expect(otherBalanceBefore.sub(5)).to.be.eq(otherBalanceAfter);
            expect(governorBalanceBefore.add(5)).to.be.eq(governorBalanceAfter);
        });

        it("cannot exceed bob's balance", async () => {
            await expect(hcm.connect(owner).reclaim(bob.address, 11)).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance"
            );
        });
    });
});
