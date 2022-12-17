import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { utils } from "ethers";
import { ethers } from "hardhat";

import {
    HectagonERC20Token,
    HectagonERC20Token__factory,
    HectagonAuthority__factory,
} from "../../types";

describe("HectagonTest", () => {
    let deployer: SignerWithAddress;
    let vault: SignerWithAddress;
    let bob: SignerWithAddress;
    let alice: SignerWithAddress;
    let hecta: HectagonERC20Token;
    const initMaxMint = utils.parseUnits("20000000", 9); // 20,000,000
    beforeEach(async () => {
        [deployer, vault, bob, alice] = await ethers.getSigners();

        const authority = await new HectagonAuthority__factory(deployer).deploy(
            deployer.address,
            deployer.address,
            deployer.address,
            vault.address
        );
        await authority.deployed();

        hecta = await new HectagonERC20Token__factory(deployer).deploy(authority.address);
    });

    it("correctly constructs an ERC20", async () => {
        expect(await hecta.name()).to.equal("Hectagon");
        expect(await hecta.symbol()).to.equal("HECTA");
        expect(await hecta.decimals()).to.equal(9);
        expect(await hecta.maxMint()).to.equal(initMaxMint);
    });

    describe("mint", () => {
        it("must be done by vault", async () => {
            await expect(hecta.connect(deployer).mint(bob.address, 100)).to.be.revertedWith(
                "UNAUTHORIZED"
            );
        });

        it("increases total supply", async () => {
            const supplyBefore = await hecta.totalSupply();
            await hecta.connect(vault).mint(bob.address, 100);
            expect(supplyBefore.add(100)).to.equal(await hecta.totalSupply());
        });
    });

    describe("burn", () => {
        beforeEach(async () => {
            await hecta.connect(vault).mint(bob.address, 100);
        });

        it("reduces the total supply", async () => {
            const supplyBefore = await hecta.totalSupply();
            await hecta.connect(bob).burn(10);
            expect(supplyBefore.sub(10)).to.equal(await hecta.totalSupply());
        });

        it("cannot exceed total supply", async () => {
            const supply = await hecta.totalSupply();
            await expect(hecta.connect(bob).burn(supply.add(1))).to.be.revertedWith(
                "ERC20: burn amount exceeds balance"
            );
        });

        it("cannot exceed bob's balance", async () => {
            await hecta.connect(vault).mint(alice.address, 15);
            await expect(hecta.connect(alice).burn(16)).to.be.revertedWith(
                "ERC20: burn amount exceeds balance"
            );
        });
    });

    describe("max Mint", () => {
        it("governor can setMaxMint correctlly", async () => {
            const expectedOutput = ethers.utils.parseUnits("10", 9);
            await hecta.setMaxMint(expectedOutput);
            const maxMint = await hecta.maxMint();
            await expect(expectedOutput).to.be.eq(maxMint);
        });

        it("can't mint when hit maxMint", async () => {
            const expectedOutput = ethers.utils.parseUnits("10", 9);
            await hecta.setMaxMint(expectedOutput);
            const amount = expectedOutput.add("10");
            const tx = hecta.connect(vault).mint(deployer.address, amount);
            await expect(tx).to.revertedWith("HECTA: mint amount exceeds maxMint");
        });
    });
});
