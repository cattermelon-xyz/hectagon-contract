import { FakeContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, utils } from "ethers";
import { ethers } from "hardhat";
import {
    Asset,
    Asset__factory,
    HectagonAuthority,
    HectagonAuthority__factory,
    IERC4626,
    IHECTA,
    IHectaCirculatingSupply,
    MockERC20,
    MockERC20__factory,
} from "../types";

describe("Asset", () => {
    let governor: SignerWithAddress;
    let guardian: SignerWithAddress;
    let other: SignerWithAddress;
    let asset: Asset;
    let auth: HectagonAuthority;
    let gHectaFake: FakeContract<IERC4626>;
    let hectaFake: FakeContract<IHECTA>;
    let erc20Fake: MockERC20;
    const erc20FakePremint = utils.parseEther("10000");
    let circulatingHectaFake: FakeContract<IHectaCirculatingSupply>;
    const premium = 2_000;
    const RATE_DENOMINATOR = 10_000;

    const bigAmount = utils.parseEther("10000000000");

    beforeEach(async () => {
        [governor, guardian, other] = await ethers.getSigners();

        circulatingHectaFake = await smock.fake<IHectaCirculatingSupply>("IHectaCirculatingSupply");
        gHectaFake = await smock.fake<IERC4626>("IERC4626");
        hectaFake = await smock.fake<IHECTA>("IHECTA");
        erc20Fake = await new MockERC20__factory(governor).deploy("mock", "MOCK");

        auth = await new HectagonAuthority__factory(governor).deploy(
            governor.address,
            guardian.address,
            governor.address,
            "0x0000000000000000000000000000000000000001"
        );

        asset = await new Asset__factory(governor).deploy(
            auth.address,
            gHectaFake.address,
            hectaFake.address,
            circulatingHectaFake.address
        );
        erc20Fake.mint(governor.address, erc20FakePremint);
        erc20Fake.mint(guardian.address, erc20FakePremint);
    });

    describe("init state correctly", () => {
        it("assets empty", async () => {
            const assets = await asset.getAssets();
            expect(assets.assets_.length).to.eq(0);
            expect(assets.amounts_.length).to.eq(0);
        });
    });

    describe("deposit", () => {
        it("must be done by Guardian", async () => {
            await expect(
                asset.connect(governor).deposit(hectaFake.address, 1000)
            ).to.be.revertedWith("UNAUTHORIZED");
        });

        it("should send token to asset contract, push new asset address to assets, and emit event", async () => {
            const depositAmount = utils.parseEther("100");
            await erc20Fake.connect(guardian).approve(asset.address, bigAmount);
            const tx = await asset.connect(guardian).deposit(erc20Fake.address, depositAmount);
            const assets = await asset.getAssets();
            expect(await erc20Fake.balanceOf(asset.address)).to.be.eq(depositAmount);
            expect(assets.assets_[0]).to.eq(erc20Fake.address);
            expect(assets.amounts_[0]).to.eq(depositAmount);
            expect(tx).to.be.emit(asset, "Deposited").withArgs(erc20Fake.address, depositAmount);
        });
    });

    describe("withdraw", () => {
        it("must be done by Guardian", async () => {
            await expect(
                asset.connect(governor).withdraw(hectaFake.address, 1000)
            ).to.be.revertedWith("UNAUTHORIZED");
        });

        it("should call asset withdraw, decrease asset amount, guardian amount increase, and emit Withdrawal event", async () => {
            const depositAmount = utils.parseEther("1000");
            await erc20Fake.connect(guardian).approve(asset.address, bigAmount);
            await asset.connect(guardian).deposit(erc20Fake.address, depositAmount);

            const withdrawAmount = utils.parseEther("100");
            const guardianAmountBefore = await erc20Fake.balanceOf(guardian.address);
            const tx = await asset.connect(guardian).withdraw(erc20Fake.address, withdrawAmount);

            const guardianAmountAfter = await erc20Fake.balanceOf(guardian.address);

            const assets = await asset.getAssets();
            expect(assets.assets_[0]).to.eq(erc20Fake.address);
            expect(assets.amounts_[0]).to.eq(depositAmount.sub(withdrawAmount));
            expect(tx).to.be.emit(asset, "Withdrawal").withArgs(erc20Fake.address, withdrawAmount);
            expect(guardianAmountBefore).to.be.eq(guardianAmountAfter.sub(withdrawAmount));
        });

        it("should remove token from asset when withdraw all", async () => {
            const depositAmount = utils.parseEther("100");
            await erc20Fake.connect(guardian).approve(asset.address, bigAmount);
            await asset.connect(guardian).deposit(erc20Fake.address, depositAmount);

            const withdrawAmount = utils.parseEther("100");
            const guardianAmountBefore = await erc20Fake.balanceOf(guardian.address);
            const tx = await asset.connect(guardian).withdraw(erc20Fake.address, withdrawAmount);

            const guardianAmountAfter = await erc20Fake.balanceOf(guardian.address);

            const assets = await asset.getAssets();
            expect(assets.assets_.length).to.eq(0);
            expect(assets.amounts_.length).to.eq(0);
            expect(tx).to.be.emit(asset, "Withdrawal").withArgs(erc20Fake.address, withdrawAmount);
            expect(guardianAmountBefore).to.be.eq(guardianAmountAfter.sub(withdrawAmount));
        });
    });

    describe("redeem", () => {
        it("should decrease amount of all token in asset contract and receive asset correctly", async () => {
            const depositAmount = utils.parseEther("1000");
            const redeemAmount = utils.parseEther("100");
            await erc20Fake.connect(guardian).approve(asset.address, bigAmount);
            await asset.connect(guardian).deposit(erc20Fake.address, depositAmount);
            const hectaBurnAmountMock = utils.parseEther("1000");
            const circulatingSupplyMock = utils.parseEther("1000");
            gHectaFake.previewRedeem.returns(hectaBurnAmountMock);
            gHectaFake.redeem.returns(hectaBurnAmountMock);
            circulatingHectaFake.circulatingSupply.returns(circulatingSupplyMock);
            const assetAmountExpect = depositAmount
                .mul(BigNumber.from(`${RATE_DENOMINATOR - premium}`))
                .mul(hectaBurnAmountMock)
                .div(circulatingSupplyMock)
                .div(RATE_DENOMINATOR);

            await asset.connect(guardian).redeem(other.address, redeemAmount);

            const assets = await asset.getAssets();

            expect(assets.amounts_[0]).to.be.eq(depositAmount.sub(assetAmountExpect));
        });
    });

    describe("setPremium", () => {
        it("must be done by governor", async () => {
            await expect(asset.connect(other).setPremium(10)).to.be.revertedWith("UNAUTHORIZED");
        });

        it("Governor should set successful", async () => {
            await asset.connect(governor).setPremium(100);
            expect(await asset.premium()).to.be.eq(100);
        });
    });

    describe("view functions", () => {
        const depositAmount = utils.parseEther("100");
        beforeEach(async () => {
            await erc20Fake.connect(guardian).approve(asset.address, bigAmount);
            await asset.connect(guardian).deposit(erc20Fake.address, depositAmount);
        });

        it("getAssets", async () => {
            const assets = await asset.getAssets();
            expect(assets.assets_[0]).to.eq(erc20Fake.address);
            expect(assets.amounts_[0]).to.eq(depositAmount);
        });

        it("getAsset", async () => {
            const amount = await asset.getAsset(erc20Fake.address);
            expect(amount).to.eq(depositAmount);
        });

        it("assetsCount", async () => {
            const assetsCount = await asset.assetsCount();
            expect(assetsCount).to.eq(1);
        });
    });
});
