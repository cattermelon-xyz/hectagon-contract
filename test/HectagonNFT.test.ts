import { FakeContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect, util } from "chai";
import { utils } from "ethers";
import { ethers } from "hardhat";
import {
    HectagonAssetManager,
    HectagonAuthority,
    HectagonAuthority__factory,
    HectagonNFT,
    HectagonNFT__factory,
    ITreasury,
    MockERC20,
    MockERC20__factory,
} from "../types";

describe.only("HectagonNFT", () => {
    let governor: SignerWithAddress;
    let guardian: SignerWithAddress;
    let other: SignerWithAddress;
    let hectagonNFT: HectagonNFT;
    let auth: HectagonAuthority;
    let treasuryFake: FakeContract<ITreasury>;
    let hectagonAssetManagerFake: FakeContract<HectagonAssetManager>;
    let erc20Fake: MockERC20;

    const NAME = "HectagonNFT";
    const SYMBOL = "HNFT";

    const BASE_URI = "https://nft.hectagon.finance/";
    const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");

    beforeEach(async () => {
        [governor, guardian, other] = await ethers.getSigners();
        treasuryFake = await smock.fake<ITreasury>("ITreasury");
        hectagonAssetManagerFake = await smock.fake<HectagonAssetManager>("HectagonAssetManager");
        erc20Fake = await new MockERC20__factory(governor).deploy("mock", "MOCK");

        auth = await new HectagonAuthority__factory(governor).deploy(
            governor.address,
            guardian.address,
            governor.address,
            treasuryFake.address
        );

        hectagonNFT = await new HectagonNFT__factory(governor).deploy(auth.address);
    });

    describe("base-contract", () => {
        describe("constructed", () => {
            it("can be constructed", async () => {
                expect(await hectagonNFT.name()).to.equal(NAME);
                expect(await hectagonNFT.symbol()).to.equal(SYMBOL);
                expect(await hectagonNFT.baseURI()).to.equal("");
            });
        });

        describe("setBaseURI", () => {
            it("should only done by governor", async () => {
                await expect(hectagonNFT.connect(other).setBaseURI(BASE_URI)).to.be.reverted;
            });

            it("can set base uri by governor", async () => {
                await hectagonNFT.connect(governor).setBaseURI(BASE_URI);
                expect(await hectagonNFT.baseURI()).to.equal(BASE_URI);
            });
        });

        describe("setAssetManager", () => {
            it("should only done by governor", async () => {
                await expect(
                    hectagonNFT.connect(other).setAssetManager(hectagonAssetManagerFake.address)
                ).to.be.reverted;
            });

            it("can set governor successfully", async () => {
                await hectagonNFT
                    .connect(governor)
                    .setAssetManager(hectagonAssetManagerFake.address);
                expect(await hectagonNFT.assetManager()).to.equal(hectagonAssetManagerFake.address);
            });
        });
    });

    describe("mint, redeem and redeemAll", () => {
        describe("safeMint", () => {
            beforeEach(async () => {
                await hectagonNFT.setAssetManager(governor.address);
            });

            it("should not mint to zero address", async () => {
                await expect(
                    hectagonNFT.safeMint(ZERO_ADDRESS, [erc20Fake.address], [100])
                ).to.be.revertedWith("Mint to zero address");
            });

            it("can mint only by assetManager contract", async () => {
                await expect(
                    hectagonNFT.connect(other).safeMint(other.address, [erc20Fake.address], [100])
                ).to.be.revertedWith("Caller is not the assetManager");
            });

            it("can not mint token if arrays length not equal", async () => {
                await expect(
                    hectagonNFT
                        .connect(governor)
                        .safeMint(other.address, [erc20Fake.address], [100, 200])
                ).to.be.revertedWith("Length of list _tokens and list amounts not equal");
            });

            it("can mint successfully", async () => {
                const tokenAmount = utils.parseEther("1000");
                await hectagonNFT
                    .connect(governor)
                    .safeMint(other.address, [erc20Fake.address], [tokenAmount]);
                const [amounts, tokens] = await hectagonNFT.getTokenAssets(0);

                expect(await hectagonNFT.ownerOf(0)).to.equal(other.address);
                expect(amounts[0]).to.be.eq(tokenAmount);
                expect(tokens[0]).to.equal(erc20Fake.address);
            });
        });

        describe("redeem", () => {
            const tokenAmount = utils.parseEther("1000");
            beforeEach(async () => {
                await hectagonNFT.setAssetManager(governor.address);
                await hectagonNFT
                    .connect(governor)
                    .safeMint(other.address, [erc20Fake.address], [tokenAmount]);
            });

            it("should only owner can redeem", async () => {
                await expect(
                    hectagonNFT.connect(governor).redeem(0, other.address, 0, tokenAmount.add(1))
                ).to.be.revertedWith("Sender not owner");
            });

            it("should not redeem amount greater than asset amount", async () => {
                await expect(
                    hectagonNFT.connect(other).redeem(0, other.address, 0, tokenAmount.add(1))
                ).to.be.revertedWith("Redeem amount exceeds balance");
            });

            it("should revert when redeem index amount is zero", async () => {
                await erc20Fake.mint(hectagonNFT.address, tokenAmount);
                await hectagonNFT.connect(other).redeem(0, other.address, 0, tokenAmount);
                await expect(
                    hectagonNFT.connect(other).redeem(0, other.address, 0, 1)
                ).to.be.revertedWith("Zero amount of asset");
            });

            it("nft owner redeem success", async () => {
                await erc20Fake.mint(hectagonNFT.address, tokenAmount);
                await hectagonNFT.connect(other).redeem(0, other.address, 0, tokenAmount.sub(100));
                const [amounts, tokens] = await hectagonNFT.getTokenAssets(0);

                expect(treasuryFake.withdraw).to.be.called;
                expect(await erc20Fake.balanceOf(other.address)).to.be.eq(tokenAmount.sub(100));
                expect(amounts[0]).to.be.eq(100);
                expect(tokens[0]).to.equal(erc20Fake.address);
            });
        });

        describe("redeemAll", () => {
            const tokenAmount = utils.parseEther("1000");
            beforeEach(async () => {
                await hectagonNFT.setAssetManager(governor.address);
                await hectagonNFT
                    .connect(governor)
                    .safeMint(other.address, [erc20Fake.address], [tokenAmount]);
            });

            it("should only owner can redeem", async () => {
                await expect(
                    hectagonNFT.connect(governor).redeemAll(0, other.address)
                ).to.be.revertedWith("Sender not owner");
            });

            it("nft owner redeem success", async () => {
                await erc20Fake.mint(hectagonNFT.address, tokenAmount);
                await hectagonNFT.connect(other).redeemAll(0, other.address);
                const [amounts, tokens] = await hectagonNFT.getTokenAssets(0);

                expect(treasuryFake.withdraw).to.be.called;
                expect(await erc20Fake.balanceOf(other.address)).to.be.eq(tokenAmount);
                expect(amounts[0]).to.be.eq(0);
                expect(tokens[0]).to.equal(erc20Fake.address);
            });
        });
    });

    describe("setTokensUri", () => {
        it("can set multiple tokens uri by Governor", async () => {
            await hectagonNFT.setAssetManager(governor.address);
            const MOCK_NEW_URI_TOKEN = "test";
            await hectagonNFT.connect(governor).safeMint(other.address, [erc20Fake.address], [100]);
            await hectagonNFT.connect(governor).safeMint(other.address, [erc20Fake.address], [100]);

            await hectagonNFT.setTokensUri(["0", "1"], [MOCK_NEW_URI_TOKEN, MOCK_NEW_URI_TOKEN]);
            const baseURI = await hectagonNFT.baseURI();
            expect(await hectagonNFT.tokenURI(0)).to.equal(baseURI + MOCK_NEW_URI_TOKEN);
            expect(await hectagonNFT.tokenURI(1)).to.equal(baseURI + MOCK_NEW_URI_TOKEN);
        });
    });
});
