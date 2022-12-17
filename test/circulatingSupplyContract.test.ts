import { FakeContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { HectaCirculatingSupply, HectaCirculatingSupply__factory, IHECTA } from "../types";

describe("HectaCirculatingSupply", () => {
    let owner: SignerWithAddress;
    let daoFund: SignerWithAddress;
    let circulatingSupplyConrtact: HectaCirculatingSupply;
    let hectaFake: FakeContract<IHECTA>;

    beforeEach(async () => {
        [owner, daoFund] = await ethers.getSigners();

        hectaFake = await smock.fake<IHECTA>("IHECTA");

        circulatingSupplyConrtact = await new HectaCirculatingSupply__factory(owner).deploy(
            hectaFake.address
        );
    });

    describe("setNonCirculatingAddresses", () => {
        it("only owner can set", async () => {
            expect(
                circulatingSupplyConrtact.connect(daoFund).setNonCirculatingAddresses([])
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Owner can set correctlly", async () => {
            await circulatingSupplyConrtact.setNonCirculatingAddresses([daoFund.address]);
            const nonCirculatingHectaAddresses =
                await circulatingSupplyConrtact.nonCirculatingAddresses(0);
            await expect(nonCirculatingHectaAddresses).to.be.eq(daoFund.address);
        });
    });

    describe("circulatingSupply and getNonCirculating", () => {
        const balanceOfDao: BigNumber = parseUnits("1", 9);
        const totalSupply: BigNumber = parseUnits("3", 9);
        beforeEach(async () => {
            hectaFake.balanceOf.whenCalledWith(daoFund.address).returns(balanceOfDao);
            hectaFake.totalSupply.returns(totalSupply);
            await circulatingSupplyConrtact.setNonCirculatingAddresses([daoFund.address]);
        });

        it("getNonCirculating", async () => {
            const nonCirculatingHecta = await circulatingSupplyConrtact.getNonCirculating();

            await expect(nonCirculatingHecta).to.be.eq(balanceOfDao);
        });

        it("circulatingSupply", async () => {
            const hectaCirculatingSupply = await circulatingSupplyConrtact.circulatingSupply();

            await expect(hectaCirculatingSupply).to.be.eq(totalSupply.sub(balanceOfDao));
        });
    });
});
