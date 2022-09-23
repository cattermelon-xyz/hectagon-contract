import { FakeContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, utils } from "ethers";
import { ethers } from "hardhat";
import {
    HectagonAssetManager,
    HectagonAssetManager__factory,
    HectagonAuthority,
    HectagonAuthority__factory,
    IERC4626,
    IHECTA,
    IHectaCirculatingSupply,
    IHectagonNFT,
    ITreasury,
    MockERC20,
    MockERC20__factory,
} from "../types";

describe("HectagonAssetManager", () => {
    let governor: SignerWithAddress;
    let guardian: SignerWithAddress;
    let other: SignerWithAddress;
    let hectagonAssetManager: HectagonAssetManager;
    let auth: HectagonAuthority;
    let gHectaFake: FakeContract<IERC4626>;
    let treasuryFake: FakeContract<ITreasury>;
    let hectaFake: FakeContract<IHECTA>;
    let erc20Fake: MockERC20;
    const erc20FakePremint = utils.parseEther("10000");
    let circulatingHectaFake: FakeContract<IHectaCirculatingSupply>;
    let hectagonNFTFake: FakeContract<IHectagonNFT>;
    const premium = 2_000;
    const RATE_DENOMINATOR = 10_000;

    const bigAmount = utils.parseEther("10000000000");

    beforeEach(async () => {
        [governor, guardian, other] = await ethers.getSigners();

        circulatingHectaFake = await smock.fake<IHectaCirculatingSupply>("IHectaCirculatingSupply");
        gHectaFake = await smock.fake<IERC4626>("IERC4626");
        hectaFake = await smock.fake<IHECTA>("IHECTA");
        treasuryFake = await smock.fake<ITreasury>("ITreasury");
        hectagonNFTFake = await smock.fake<IHectagonNFT>("IHectagonNFT");
        erc20Fake = await new MockERC20__factory(governor).deploy("mock", "MOCK");

        auth = await new HectagonAuthority__factory(governor).deploy(
            governor.address,
            guardian.address,
            governor.address,
            treasuryFake.address
        );

        hectagonAssetManager = await new HectagonAssetManager__factory(governor).deploy(
            auth.address,
            gHectaFake.address,
            hectaFake.address,
            circulatingHectaFake.address,
            hectagonNFTFake.address
        );
        erc20Fake.mint(governor.address, erc20FakePremint);
        erc20Fake.mint(guardian.address, erc20FakePremint);
    });

    describe("init state correctly", () => {
        it("assets empty", async () => {
            const assets = await hectagonAssetManager.getAssets();
            expect(assets["amounts_"].length).to.eq(0);
            expect(assets["tokens_"].length).to.eq(0);
        });
    });

    describe("mintNFT", () => {
        it("should decrease amount of all token in assets bucket", async () => {
            const depositAmount = utils.parseEther("1000");
            await erc20Fake.connect(guardian).approve(hectagonAssetManager.address, bigAmount);
            await hectagonAssetManager.connect(guardian).deposit(erc20Fake.address, depositAmount);
            const hectaBurnAmountMock = utils.parseEther("1000");
            const circulatingSupplyMock = utils.parseEther("100000");
            gHectaFake.redeem.returns(hectaBurnAmountMock);
            circulatingHectaFake.circulatingSupply.returns(circulatingSupplyMock);
            const nftAssetAmountExpect = depositAmount
                .mul(BigNumber.from(`${RATE_DENOMINATOR - premium}`))
                .mul(hectaBurnAmountMock)
                .div(circulatingSupplyMock)
                .div(RATE_DENOMINATOR);

            await hectagonAssetManager.connect(guardian).mintNFT(governor.address, 1000);

            const assets = await hectagonAssetManager.getAssets();

            expect(assets["amounts_"][0]).to.be.eq(depositAmount.sub(nftAssetAmountExpect));

            expect(hectaFake.burn).to.be.calledWith(hectaBurnAmountMock);
            expect(hectagonNFTFake.safeMint).to.be.calledWith(
                governor.address,
                [erc20Fake.address],
                [nftAssetAmountExpect]
            );
        });
    });

    describe("deposit", () => {
        it("must be done by Guardian", async () => {
            await expect(
                hectagonAssetManager.connect(governor).deposit(hectaFake.address, 1000)
            ).to.be.revertedWith("UNAUTHORIZED");
        });

        it("should send token to treasury, push new asset address to assets, increase amount, and emit event", async () => {
            const depositAmount = utils.parseEther("100");
            await erc20Fake.connect(guardian).approve(hectagonAssetManager.address, bigAmount);
            const tx = await hectagonAssetManager
                .connect(guardian)
                .deposit(erc20Fake.address, depositAmount);

            const assets = await hectagonAssetManager.getAssets();
            expect(await erc20Fake.balanceOf(treasuryFake.address)).to.be.eq(depositAmount);
            expect(assets["amounts_"][0]).to.eq(depositAmount);
            expect(assets["tokens_"][0]).to.eq(erc20Fake.address);
            expect(tx)
                .to.be.emit(hectagonAssetManager, "Deposit")
                .withArgs(erc20Fake.address, depositAmount);
        });
    });

    describe("withdraw", () => {
        it("must be done by Guardian", async () => {
            await expect(
                hectagonAssetManager.connect(governor).withdraw(hectaFake.address, 1000)
            ).to.be.revertedWith("UNAUTHORIZED");
        });

        it("should only withdraw token in asset list", async () => {
            await expect(
                hectagonAssetManager.connect(guardian).withdraw(hectaFake.address, 1000)
            ).to.be.revertedWith("Token not in asset list");
        });

        it("should call treasury withdraw, decrease asset amount, guardian amount increase, and emit Withdraw event", async () => {
            const depositAmount = utils.parseEther("1000");
            await erc20Fake.connect(guardian).approve(hectagonAssetManager.address, bigAmount);
            await hectagonAssetManager.connect(guardian).deposit(erc20Fake.address, depositAmount);

            const withdrawAmount = utils.parseEther("100");
            const guardianAmountBefore = await erc20Fake.balanceOf(guardian.address);
            await erc20Fake.mint(hectagonAssetManager.address, withdrawAmount);
            const tx = await hectagonAssetManager
                .connect(guardian)
                .withdraw(erc20Fake.address, withdrawAmount);

            const guardianAmountAfter = await erc20Fake.balanceOf(guardian.address);

            const assets = await hectagonAssetManager.getAssets();
            expect(assets["amounts_"][0]).to.eq(depositAmount.sub(withdrawAmount));
            expect(assets["tokens_"][0]).to.eq(erc20Fake.address);
            expect(tx)
                .to.be.emit(hectagonAssetManager, "Withdraw")
                .withArgs(erc20Fake.address, withdrawAmount);
            expect(guardianAmountBefore).to.be.eq(guardianAmountAfter.sub(withdrawAmount));
        });

        it("should remove token from asset when withdraw all", async () => {
            const depositAmount = utils.parseEther("100");
            await erc20Fake.connect(guardian).approve(hectagonAssetManager.address, bigAmount);
            await hectagonAssetManager.connect(guardian).deposit(erc20Fake.address, depositAmount);

            const withdrawAmount = utils.parseEther("100");
            const guardianAmountBefore = await erc20Fake.balanceOf(guardian.address);
            await erc20Fake.mint(hectagonAssetManager.address, withdrawAmount);
            const tx = await hectagonAssetManager
                .connect(guardian)
                .withdraw(erc20Fake.address, withdrawAmount);

            const guardianAmountAfter = await erc20Fake.balanceOf(guardian.address);

            const assets = await hectagonAssetManager.getAssets();
            expect(assets["amounts_"].length).to.eq(0);
            expect(assets["tokens_"].length).to.eq(0);
            expect(tx)
                .to.be.emit(hectagonAssetManager, "Withdraw")
                .withArgs(erc20Fake.address, withdrawAmount);
            expect(guardianAmountBefore).to.be.eq(guardianAmountAfter.sub(withdrawAmount));
        });
    });

    describe("setHectagonNFT", () => {
        it("must be done by governor", async () => {
            await expect(
                hectagonAssetManager.connect(other).setHectagonNFT(gHectaFake.address)
            ).to.be.revertedWith("UNAUTHORIZED");
        });

        it("Guardian should set successful", async () => {
            await hectagonAssetManager.connect(governor).setHectagonNFT(gHectaFake.address);
            expect(await hectagonAssetManager.hectagonNFT()).to.be.eq(gHectaFake.address);
        });
    });

    describe("setPremium", () => {
        it("must be done by governor", async () => {
            await expect(hectagonAssetManager.connect(other).setPremium(10)).to.be.revertedWith(
                "UNAUTHORIZED"
            );
        });

        it("Guardian should set successful", async () => {
            await hectagonAssetManager.connect(governor).setPremium(200);
            expect(await hectagonAssetManager.premium()).to.be.eq(200);
        });
    });

    describe("view functions", () => {
        const depositAmount = utils.parseEther("100");
        beforeEach(async () => {
            await erc20Fake.connect(guardian).approve(hectagonAssetManager.address, bigAmount);
            await hectagonAssetManager.connect(guardian).deposit(erc20Fake.address, depositAmount);
        });

        it("getAssets", async () => {
            const assets = await hectagonAssetManager.getAssets();
            expect(assets["amounts_"][0]).to.eq(depositAmount);
            expect(assets["tokens_"][0]).to.eq(erc20Fake.address);
        });

        it("getAsset", async () => {
            const amount = await hectagonAssetManager.getAsset(erc20Fake.address);
            expect(amount).to.eq(depositAmount);
        });

        it("assetsCount", async () => {
            const assetsCount = await hectagonAssetManager.assetsCount();
            expect(assetsCount).to.eq(1);
        });
    });
});
