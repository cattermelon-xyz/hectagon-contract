import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";

import {
    GovernanceHectagon,
    GovernanceHectagon__factory,
    HectagonAuthority,
    HectagonAuthority__factory,
    HectagonERC20Token,
    HectagonERC20Token__factory,
    IDistributor,
} from "../../types";
import { BigNumber, utils } from "ethers";

const MAX_UINT256 = BigNumber.from("2").pow(BigNumber.from("256")).sub(BigNumber.from("1"));

const parseToken = (token: string | number) =>
    BigNumber.from(token).mul(BigNumber.from("1000000000"));

const assetDeciamlsToShareDeciamls = (asset: BigNumber) => asset.mul(BigNumber.from("1000000000"));

const parseShare = (share: string | number) =>
    BigNumber.from(share).mul(BigNumber.from("1000000000000000000"));

const shareDecimalsToAssetDecimals = (share: BigNumber) => share.div(BigNumber.from("1000000000"));

describe("Governance HECTA", () => {
    let owner: SignerWithAddress;
    let governor: SignerWithAddress;
    let guardian: SignerWithAddress;
    let gHecta: GovernanceHectagon;
    let other: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let hecta: HectagonERC20Token;
    let distributorFake: FakeContract<IDistributor>;
    let authority: HectagonAuthority;

    const mineBlock = async () => {
        await network.provider.request({
            method: "evm_mine",
            params: [],
        });
    };

    const increaseTime = async (time: number) => {
        await network.provider.send("evm_increaseTime", [time]);
    };

    const getCurrentBlockTimestamp = async () => {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        return blockBefore.timestamp;
    };

    const EPOCH_LENGTH = 100;
    const EPOCH_NUMBER = 1;

    beforeEach(async () => {
        [owner, governor, guardian, other, alice, bob] = await ethers.getSigners();

        authority = await new HectagonAuthority__factory(owner).deploy(
            governor.address,
            guardian.address,
            owner.address,
            owner.address
        );

        hecta = await new HectagonERC20Token__factory(owner).deploy(authority.address);
        distributorFake = await smock.fake<IDistributor>("IDistributor");
        const currentBlockTimestamp = await getCurrentBlockTimestamp();
        gHecta = await new GovernanceHectagon__factory(owner).deploy(
            hecta.address,
            EPOCH_LENGTH,
            EPOCH_NUMBER,
            currentBlockTimestamp - 1,
            authority.address
        );

        await hecta.approve(gHecta.address, MAX_UINT256);
        await gHecta.connect(governor).setDistributor(distributorFake.address);
    });

    it("is constructed correctly", async () => {
        expect(await gHecta.name()).to.equal("Governance Hectagon");
        expect(await gHecta.symbol()).to.equal("gHECTA");
        expect(await gHecta.decimals()).to.equal(18);
        expect(await gHecta.asset()).to.equal(hecta.address);
    });

    describe("setDistributor", () => {
        it("can set the distributor", async () => {
            await gHecta.connect(governor).setDistributor(distributorFake.address);
            expect(await gHecta.distributor()).to.equal(distributorFake.address);
        });

        it("emits the DistributorSet event", async () => {
            await expect(gHecta.connect(governor).setDistributor(distributorFake.address))
                .to.emit(gHecta, "DistributorSet")
                .withArgs(distributorFake.address);
        });

        it("can only be done by the governor", async () => {
            await expect(gHecta.connect(other).setDistributor(distributorFake.address)).to.be
                .reverted;
        });
    });

    it("multiple mint, deposit, redeem & withdrawal", async function () {
        await hecta.mint(alice.address, parseToken(4000));
        await hecta.mint(bob.address, parseToken(7001));
        await hecta.connect(alice).approve(gHecta.address, parseToken(4000));
        await hecta.connect(bob).approve(gHecta.address, parseToken(7001));

        let expectAliceGHectaBalance, expectBobGHectaBalance, expectTotalSupply, expectTotalAssets;

        {
            // 1. Alice mints 2000 shares (costs 2000 tokens)
            await gHecta.connect(alice).mint(parseShare(2000), alice.address);

            expect(await gHecta.balanceOf(alice.address)).to.be.equal(parseShare(2000));
            expect(await gHecta.balanceOf(bob.address)).to.be.equal(0);
            expect(await gHecta.previewDeposit(parseToken(2000))).to.be.equal(parseShare(2000));
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(alice.address))).to.be.equal(
                parseToken(2000)
            );
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(bob.address))).to.be.equal(
                0
            );
            expect(await gHecta.totalSupply()).to.be.equal(parseShare(2000));
            expect(await gHecta.totalAssets()).to.be.equal(parseToken(2000));
        }

        {
            // 2. bob deposits 4000 tokens (mints 4000 shares)
            await gHecta.connect(bob).mint(parseShare(4000), bob.address);

            expect(await gHecta.balanceOf(alice.address)).to.be.equal(parseShare(2000));
            expect(await gHecta.balanceOf(bob.address)).to.be.equal(parseShare(4000));
            expect(await gHecta.previewDeposit(parseToken(4000))).to.be.equal(parseShare(4000));
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(alice.address))).to.be.equal(
                parseToken(2000)
            );
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(bob.address))).to.be.equal(
                parseToken(4000)
            );
            expect(await gHecta.totalSupply()).to.be.equal(parseShare(6000));
            expect(await gHecta.totalAssets()).to.be.equal(parseToken(6000));
        }

        {
            // 3. Vault mutates by +3000 tokens (simulated yield returned from distributor)
            await hecta.mint(gHecta.address, parseToken(3000));

            expect(await gHecta.balanceOf(alice.address)).to.be.equal(parseShare(2000));
            expect(await gHecta.balanceOf(bob.address)).to.be.equal(parseShare(4000));
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(alice.address))).to.be.equal(
                parseToken(3000)
            );
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(bob.address))).to.be.equal(
                parseToken(6000)
            );
            expect(await gHecta.totalSupply()).to.be.equal(parseShare(6000));
            expect(await gHecta.totalAssets()).to.be.equal(parseToken(9000));
        }

        {
            // 4. Alice deposits 2000 tokens (mints 1333 shares) => totalAssets = 9000 + 2000
            await gHecta.deposit(parseToken(2000), alice.address);

            expectAliceGHectaBalance = parseShare(6000) // previous gHecta.totalSupply()
                .mul(assetDeciamlsToShareDeciamls(parseToken(2000))) // Alice deposits 2000 tokens
                .div(assetDeciamlsToShareDeciamls(parseToken(9000))) // totalAssets
                .add(parseShare(2000)); // alices previos gHecta balance
            // -> 3333333333333333333333

            expectBobGHectaBalance = parseShare(4000);

            expectTotalSupply = expectAliceGHectaBalance.add(expectBobGHectaBalance);
            expectTotalAssets = parseToken(11000);

            expect(await gHecta.balanceOf(alice.address)).to.be.equal(expectAliceGHectaBalance);
            expect(await gHecta.balanceOf(bob.address)).to.be.equal(expectBobGHectaBalance);
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(alice.address))).to.be.equal(
                shareDecimalsToAssetDecimals(expectAliceGHectaBalance)
                    .mul(expectTotalAssets)
                    .div(shareDecimalsToAssetDecimals(expectTotalSupply))
            );

            expect(await gHecta.convertToAssets(await gHecta.balanceOf(bob.address))).to.be.equal(
                shareDecimalsToAssetDecimals(expectBobGHectaBalance)
                    .mul(expectTotalAssets)
                    .div(shareDecimalsToAssetDecimals(expectTotalSupply))
            );
            expect(await gHecta.totalSupply()).to.be.equal(expectTotalSupply);
            expect(await gHecta.totalAssets()).to.be.equal(expectTotalAssets);
        }

        {
            // 5. bob mints 2000 shares (costs 3001 assets)
            // NOTE: bob's assets spent got rounded up
            // NOTE: Alices's vault assets got rounded up
            await gHecta.mint(parseShare(2000), bob.address);

            expectTotalAssets = expectTotalAssets.add(
                shareDecimalsToAssetDecimals(parseShare(2000))
                    .mul(expectTotalAssets)
                    .div(shareDecimalsToAssetDecimals(expectTotalSupply))
                    .add(1) // rounded up
            );
            expectTotalSupply = expectAliceGHectaBalance
                .add(expectBobGHectaBalance)
                .add(parseShare(2000));
            expectBobGHectaBalance = expectBobGHectaBalance.add(parseShare(2000));

            expect(await gHecta.balanceOf(alice.address)).to.be.equal(expectAliceGHectaBalance);
            expect(await gHecta.balanceOf(bob.address)).to.be.equal(expectBobGHectaBalance);
            expect(await gHecta.totalSupply()).to.be.equal(expectTotalSupply);
            expect(await gHecta.totalAssets()).to.be.equal(expectTotalAssets);
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(alice.address))).to.be.equal(
                shareDecimalsToAssetDecimals(expectAliceGHectaBalance)
                    .mul(expectTotalAssets)
                    .div(shareDecimalsToAssetDecimals(expectTotalSupply))
            );
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(bob.address))).to.be.equal(
                shareDecimalsToAssetDecimals(expectBobGHectaBalance)
                    .mul(expectTotalAssets)
                    .div(shareDecimalsToAssetDecimals(expectTotalSupply))
            );
        }

        {
            // 6. Vault mutates by +3000 tokens
            // NOTE: Vault holds 17001 tokens, but sum of assetsOf() is 17000.
            await hecta.mint(gHecta.address, parseToken(3000));
            expectTotalAssets = expectTotalAssets.add(parseToken(3000));

            expect(await gHecta.balanceOf(alice.address)).to.be.equal(expectAliceGHectaBalance);
            expect(await gHecta.balanceOf(bob.address)).to.be.equal(expectBobGHectaBalance);
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(alice.address))).to.be.equal(
                shareDecimalsToAssetDecimals(expectAliceGHectaBalance)
                    .mul(expectTotalAssets)
                    .div(shareDecimalsToAssetDecimals(expectTotalSupply))
            );
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(bob.address))).to.be.equal(
                shareDecimalsToAssetDecimals(expectBobGHectaBalance)
                    .mul(expectTotalAssets)
                    .div(shareDecimalsToAssetDecimals(expectTotalSupply))
            );
            expect(await gHecta.totalSupply()).to.be.equal(expectTotalSupply);
            expect(await gHecta.totalAssets()).to.be.equal(expectTotalAssets);
        }

        {
            // 7. Alice redeem 1333333333333333333333 shares
            const redeemAmount = BigNumber.from("1333333333333333333333");
            await gHecta.connect(alice).redeem(redeemAmount, alice.address, alice.address);

            expectAliceGHectaBalance = expectAliceGHectaBalance.sub(redeemAmount); // 2000
            expectTotalAssets = expectTotalAssets.sub(
                redeemAmount.mul(expectTotalAssets).div(expectTotalSupply)
            );
            expectTotalSupply = expectTotalSupply.sub(redeemAmount);

            expect(await gHecta.balanceOf(alice.address)).to.be.equal(expectAliceGHectaBalance); // 2000
            expect(await gHecta.balanceOf(bob.address)).to.be.equal(expectBobGHectaBalance); // 6000
            expect(await gHecta.totalSupply()).to.be.equal(expectTotalSupply); // "8000"
            expect(await gHecta.totalAssets()).to.be.equal(expectTotalAssets); // 14571428571430

            expect(await gHecta.convertToAssets(await gHecta.balanceOf(alice.address))).to.be.equal(
                shareDecimalsToAssetDecimals(expectAliceGHectaBalance)
                    .mul(expectTotalAssets)
                    .div(shareDecimalsToAssetDecimals(expectTotalSupply))
            );

            expect(await gHecta.convertToAssets(await gHecta.balanceOf(bob.address))).to.be.equal(
                shareDecimalsToAssetDecimals(expectBobGHectaBalance)
                    .mul(expectTotalAssets)
                    .div(shareDecimalsToAssetDecimals(expectTotalSupply))
            );
        }

        {
            await gHecta.connect(bob).redeem(parseShare(6000), bob.address, bob.address);

            const expectTotalAssetsReduce = shareDecimalsToAssetDecimals(parseShare(6000))
                .mul(expectTotalAssets)
                .div(shareDecimalsToAssetDecimals(expectTotalSupply))
                .toString();
            expectTotalAssets = expectTotalAssets.sub(expectTotalAssetsReduce);
            expectTotalSupply = expectTotalSupply.sub(parseShare(6000)); // 2000

            expect(await gHecta.balanceOf(bob.address)).to.be.equal("0");
            expect(await gHecta.balanceOf(alice.address)).to.be.equal(expectAliceGHectaBalance); // 2000
            expect(await gHecta.totalSupply()).to.be.equal(expectTotalSupply);
            expect(await gHecta.totalAssets()).to.be.equal(expectTotalAssets); // 3642857142858

            expect(await gHecta.convertToAssets(await gHecta.balanceOf(alice.address))).to.be.equal(
                shareDecimalsToAssetDecimals(expectAliceGHectaBalance)
                    .mul(expectTotalAssets)
                    .div(shareDecimalsToAssetDecimals(expectTotalSupply))
            );
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(bob.address))).to.be.equal(
                "0"
            );
        }

        {
            // Alice withdraws 3642857142858 assets (2000 shares)
            const withdrawAmount = BigNumber.from("3642857142858");
            await gHecta.connect(alice).withdraw(withdrawAmount, alice.address, alice.address);

            expect(await gHecta.balanceOf(bob.address)).to.be.equal("0");
            expect(await gHecta.balanceOf(alice.address)).to.be.equal(0);
            expect(await gHecta.totalSupply()).to.be.equal(0);
            expect(await gHecta.totalAssets()).to.be.equal(0);

            expect(await gHecta.convertToAssets(await gHecta.balanceOf(alice.address))).to.be.equal(
                0
            );
            expect(await gHecta.convertToAssets(await gHecta.balanceOf(bob.address))).to.be.equal(
                "0"
            );
        }
    });

    it("index", async () => {
        expect(await gHecta.index()).to.equal(parseToken(1));
    });

    it("bountyHunter", async () => {
        distributorFake.retrieveBounty.whenCalledWith().returns(parseToken(100));
        await hecta.mint(gHecta.address, parseToken(100));
        await gHecta.bountyHunter();
        expect(await hecta.balanceOf(owner.address)).to.be.eq(parseToken(100));
    });
});
