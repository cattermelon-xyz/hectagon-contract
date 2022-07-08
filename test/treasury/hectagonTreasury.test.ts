import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { utils } from "ethers";
import { ethers } from "hardhat";
import {
    HectagonERC20Token,
    HectagonAuthority,
    BEP20Token,
    HectagonTreasury,
    HectagonERC20Token__factory,
    HectagonAuthority__factory,
    BEP20Token__factory,
    HectagonTreasury__factory,
} from "../../types";

describe("HectagonTreasury", async () => {
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;

    let auth: HectagonAuthority;
    let busd: BEP20Token;
    let hecta: HectagonERC20Token;
    let treasury: HectagonTreasury;
    const busdDepositAmount = utils.parseUnits("1000000", 18);

    const notApproved = "Treasury: not approved";

    /**
     * Everything in this block is only run once before all tests.
     * This is the home for setup methods
     */

    beforeEach(async () => {
        [owner, alice] = await ethers.getSigners();

        busd = await new BEP20Token__factory(owner).deploy();
        // TODO use promise.all
        auth = await new HectagonAuthority__factory(owner).deploy(
            owner.address,
            alice.address,
            owner.address,
            owner.address
        );
        hecta = await new HectagonERC20Token__factory(owner).deploy(auth.address);
        treasury = await new HectagonTreasury__factory(owner).deploy(hecta.address, auth.address);

        // To get past HECTA contract guards
        await auth.pushVault(treasury.address, true);

        await busd.transfer(treasury.address, busdDepositAmount);
    });

    describe("initialize", () => {
        it("should mint 30,000 Hecta for right recipient", async () => {
            const expectBalance = utils.parseUnits("30000", 9);

            await treasury.initialize(owner.address, expectBalance);
            const [hectaTotalSupply, ownerHectaBalance] = await Promise.all([
                hecta.totalSupply(),
                hecta.balanceOf(owner.address),
            ]);

            await expect(hectaTotalSupply).to.be.eq(expectBalance);
            await expect(ownerHectaBalance).to.be.eq(expectBalance);
        });

        it("only call one time", async () => {
            const expectBalance = utils.parseUnits("30000", 9);

            await treasury.initialize(owner.address, expectBalance);
            const sencondCall = treasury.initialize(owner.address, expectBalance);
            await expect(sencondCall).to.revertedWith("Already initialized")
        });
    });

    describe("enable and disable", () => {
        it("enable: governor done correctlly", async () => {
            const enableTreasuryManager = await treasury.enable("0", owner.address);
            const enableRewardManager = await treasury.enable("1", owner.address);
            await expect(enableTreasuryManager)
                .to.emit(treasury, "Permissioned")
                .withArgs(owner.address, 0, true);

            await expect(enableRewardManager)
                .to.emit(treasury, "Permissioned")
                .withArgs(owner.address, 1, true);
            const permissions = await Promise.all([
                treasury.permissions("0", owner.address),
                treasury.permissions("1", owner.address),
            ]);
            await expect(permissions[0]).to.be.eq(true);
            await expect(permissions[1]).to.be.eq(true);
        });

        it("disable: governor or guardian done correctlly", async () => {
            await Promise.all([
                treasury.enable("0", owner.address),
                treasury.enable("1", owner.address),
            ]);

            const disableTreasuryManager = await treasury
                .connect(alice)
                .disable("0", owner.address);
            const disableRewardManager = await treasury.connect(alice).disable("1", owner.address);
            await expect(disableTreasuryManager)
                .to.emit(treasury, "Permissioned")
                .withArgs(owner.address, 0, false);

            await expect(disableRewardManager)
                .to.emit(treasury, "Permissioned")
                .withArgs(owner.address, 1, false);
        });
    });

    describe("withdraw", () => {
        it("only TREASURYMANAGER can withdraw", async () => {
            const tx = treasury.withdraw(busd.address, busdDepositAmount);
            await expect(tx).to.be.revertedWith(notApproved);
        });

        it("TREASURYMANAGER can withdraw correctlly", async () => {
            await treasury.enable("0", owner.address);
            const tx = await treasury.withdraw(busd.address, busdDepositAmount);
            await expect(tx)
                .to.emit(treasury, "Withdrawal")
                .withArgs(busd.address, busdDepositAmount);
        });
    });

    describe("mint", () => {
        it("only REWARDMANAGER can mint", async () => {
            const tx = treasury.mint(owner.address, "0");
            await expect(tx).to.be.revertedWith(notApproved);
        });

        it("TREASURYMANAGER can withdraw correctlly", async () => {
            await treasury.enable("1", owner.address);
            const mintAmount = utils.parseUnits("1000", 9);
            const tx = await treasury.mint(alice.address, mintAmount);
            await expect(tx)
                .to.emit(treasury, "Minted")
                .withArgs(owner.address, alice.address, mintAmount);
        });
    });
});
