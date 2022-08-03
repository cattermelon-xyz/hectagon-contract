import { FakeContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
    MockERC20,
    GovernanceHectagon,
    HectaCirculatingSupply,
    Snapshot,
    Snapshot__factory,
} from "../../types";
const { BigNumber } = ethers;

describe("Snapshot", () => {
    let owner: SignerWithAddress;
    let other: SignerWithAddress;

    let hectaCirculatingSupply: FakeContract<HectaCirculatingSupply>;
    let pHecta: FakeContract<MockERC20>;
    let tHecta: FakeContract<MockERC20>;
    let gHecta: FakeContract<GovernanceHectagon>;

    let snapshot: Snapshot;

    beforeEach(async () => {
        [owner, other] = await ethers.getSigners();
        hectaCirculatingSupply = await smock.fake<HectaCirculatingSupply>("HectaCirculatingSupply");
        pHecta = await smock.fake<MockERC20>("MockERC20");
        tHecta = await smock.fake<MockERC20>("MockERC20");
        gHecta = await smock.fake<GovernanceHectagon>("GovernanceHectagon");

        snapshot = await new Snapshot__factory(owner).deploy(
            hectaCirculatingSupply.address,
            pHecta.address,
            tHecta.address,
            gHecta.address
        );
    });
    describe("constructor", () => {
        it("can be constructed", async () => {
            expect(await snapshot.hectaCirculatingSupply()).equal(hectaCirculatingSupply.address);
            expect(await snapshot.pHecta()).equal(pHecta.address);
            expect(await snapshot.tHecta()).equal(tHecta.address);
            expect(await snapshot.gHecta()).equal(gHecta.address);
        });
        it("return PHecta and tHECTA weight correctly", async () => {
            expect(await snapshot.pHectaWeight()).equal(BigNumber.from("500"));
            expect(await snapshot.tHectaWeight()).equal(BigNumber.from("500"));
        });

        it("calculate initial weight correctly", async () => {
            expect(await snapshot.gHectaWeight()).equal(BigNumber.from("0"));
        });

        it("calculate Hecta weight correctly", async () => {
            pHecta.totalSupply.returns(BigNumber.from(String(20 * 10 ** 15))); // 20M pHecta
            tHecta.totalSupply.returns(BigNumber.from(String(20 * 10 ** 15))); // 20M tHecta
            hectaCirculatingSupply.circulatingSupply.returns(BigNumber.from(String(60 * 10 ** 15))); // 60M Hecta
            gHecta.index.returns(BigNumber.from(String(2 * 10 ** 9))); // index = 2

            expect(await snapshot.gHectaWeight()).equal(BigNumber.from("2666"));
        });

        it("calculate Hecta weight correctly when pHecta and tHecta is zero", async () => {
            pHecta.totalSupply.returns(BigNumber.from("0"));
            tHecta.totalSupply.returns(BigNumber.from("0"));
            hectaCirculatingSupply.circulatingSupply.returns(BigNumber.from(String(50 * 10 ** 15))); // 50M Hecta
            gHecta.index.returns(BigNumber.from(String(2 * 10 ** 9))); // index = 2

            expect(await snapshot.gHectaWeight()).equal(BigNumber.from("4000"));
        });

        it("calculate Hecta weight correctly when pHecta and tHecta is maximum", async () => {
            pHecta.totalSupply.returns(BigNumber.from(String(20 * 10 ** 15))); // 20M pHecta
            tHecta.totalSupply.returns(BigNumber.from(String(20 * 10 ** 15))); // 20M tHecta
            hectaCirculatingSupply.circulatingSupply.returns(BigNumber.from(String(50 * 10 ** 15))); // 50M hecta
            gHecta.index.returns(BigNumber.from(String(2 * 10 ** 9))); // index = 2

            expect(await snapshot.gHectaWeight()).equal(BigNumber.from("3200"));
        });
    });

    describe("setAddresses", () => {
        it("only owner can set", async () => {
            const randomAddress = "0xf592FE7c105f4F2EF212AEb26aCb9740804cffC7";
            const tx = snapshot
                .connect(other)
                .setAddresses(randomAddress, randomAddress, randomAddress, randomAddress);
            expect(tx).reverted;
        });

        it("owner set successfully", async () => {
            const randomAddress = "0xf592FE7c105f4F2EF212AEb26aCb9740804cffC7";
            await snapshot.setAddresses(randomAddress, randomAddress, randomAddress, randomAddress);
            expect(await snapshot.hectaCirculatingSupply()).equal(randomAddress);
            expect(await snapshot.pHecta()).equal(randomAddress);
            expect(await snapshot.tHecta()).equal(randomAddress);
            expect(await snapshot.gHecta()).equal(randomAddress);
        });
    });
});
