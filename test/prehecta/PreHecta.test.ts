const { expect } = require("chai");
const { ethers } = require("hardhat");
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";

import {
    HectagonERC20Token,
    HectagonERC20Token__factory,
    HectagonAuthority__factory,
    PHectagonERC20__factory,
    THectagonERC20__factory,
    PHectagonERC20,
    THectagonERC20,
} from "../../types";

describe("PHecta and THecta is PreHectagonERC20 so both of them", function () {
    let deployer: SignerWithAddress;
    let vault: SignerWithAddress;
    let bob: SignerWithAddress;
    let alice: SignerWithAddress;
    let harman: SignerWithAddress;
    let hecta: HectagonERC20Token;
    let phecta: PHectagonERC20;
    let thecta: THectagonERC20;
    let hectaDecimal: number;
    let pHectaDecimal: number;
    let tHectaDecimal: number;

    function _getNoOfToken(token: number) {
        return ethers.utils.parseUnits(token.toString(), hectaDecimal);
    }

    beforeEach(async function () {
        [deployer, vault, bob, alice, harman] = await ethers.getSigners();

        const authority = await new HectagonAuthority__factory(deployer).deploy(
            deployer.address,
            deployer.address,
            deployer.address,
            vault.address
        );
        await authority.deployed();

        hecta = await new HectagonERC20Token__factory(deployer).deploy(authority.address);
        phecta = await new PHectagonERC20__factory(deployer).deploy();
        thecta = await new THectagonERC20__factory(deployer).deploy();
        hectaDecimal = await hecta.decimals();
        pHectaDecimal = await phecta.decimals();
        tHectaDecimal = await thecta.decimals();
    });

    it("should correctly construct", async function () {
        expect(await phecta.name()).to.equal("Private Hectagon");
        expect(await thecta.name()).to.equal("Team Hectagon");
        expect(await phecta.symbol()).to.equal("pHECTA");
        expect(await thecta.symbol()).to.equal("tHECTA");
        expect(pHectaDecimal).to.equal(9);
        expect(tHectaDecimal).to.equal(9);
    });

    it("should initiate 50M token with decimals matching Hecta's", async function () {
        const initialSupplyPHecta = await phecta.totalSupply();
        const initialSupplyTHecta = await thecta.totalSupply();
        const totalSupply = _getNoOfToken(50000000);

        /**
         * testing on phecta
         */
        expect(hectaDecimal).to.equal(pHectaDecimal);
        expect(initialSupplyPHecta).to.equal(totalSupply);

        /**
         * testing on thecta
         */
        expect(hectaDecimal).to.equal(tHectaDecimal);
        expect(initialSupplyTHecta).to.equal(totalSupply);
    });

    it("should let Owner mint new token if allowMinting=true", async function () {
        /**
         * testing on phecta
         */
        let noOfNewToken = _getNoOfToken(30);
        expect(await phecta.connect(deployer).allowMinting()).equal(true);
        expect(await phecta.connect(deployer).mint(bob.address, noOfNewToken))
            .to.emit(phecta, "TokenMinted")
            .withArgs(bob.address, noOfNewToken);
        expect(await phecta.connect(bob).totalSupply()).to.equal(_getNoOfToken(50000030));
        expect(await phecta.connect(bob).balanceOf(bob.address)).to.equal(noOfNewToken);

        /**
         * testing on thecta
         */
        noOfNewToken = _getNoOfToken(50);
        expect(await thecta.connect(deployer).allowMinting()).equal(true);
        expect(await thecta.connect(deployer).mint(bob.address, noOfNewToken))
            .to.emit(thecta, "TokenMinted")
            .withArgs(bob.address, noOfNewToken);
        expect(await thecta.connect(bob).totalSupply()).to.equal(_getNoOfToken(50000050));
        expect(await thecta.connect(bob).balanceOf(bob.address)).to.equal(noOfNewToken);
    });

    it("shouldn't let Owner mint new token if allowMinting=false", async function () {
        const noOfNewToken = _getNoOfToken(30);
        /**
         * testing on phecta
         */
        await expect(phecta.connect(deployer).disableMinting()).to.emit(phecta, "MintingDisabled");
        await expect(phecta.connect(deployer).disableMinting()).to.be.revertedWith(
            "Minting has been disabled."
        );
        await expect(phecta.connect(deployer).mint(bob.address, noOfNewToken)).to.be.revertedWith(
            "Minting has been disabled."
        );
        /**
         * testing on thecta
         */
        await expect(thecta.connect(deployer).disableMinting()).to.emit(thecta, "MintingDisabled");
        await expect(thecta.connect(deployer).disableMinting()).to.be.revertedWith(
            "Minting has been disabled."
        );
        await expect(thecta.connect(deployer).mint(bob.address, noOfNewToken)).to.be.revertedWith(
            "Minting has been disabled."
        );
    });

    it("should let Owner pause all token transfer and no one (incl. owner) can tranfer anything", async function () {
        // TODO: testing on burn is missing
        const noOfTokenToTransfer = _getNoOfToken(0.03);
        /**
         * testing on phecta
         */
        // transfer something to alice
        await expect(phecta.connect(deployer).transfer(alice.address, noOfTokenToTransfer))
            .to.emit(phecta, "Transfer")
            .withArgs(deployer.address, alice.address, noOfTokenToTransfer);
        // pause
        await expect(phecta.connect(deployer).pause())
            .to.emit(phecta, "Paused")
            .withArgs(deployer.address);
        // deployer try to transfer and return error
        await expect(
            phecta.connect(deployer).transfer(alice.address, noOfTokenToTransfer)
        ).to.revertedWith("Pausable: paused");
        await expect(
            phecta.connect(alice).transfer(bob.address, noOfTokenToTransfer)
        ).to.revertedWith("Pausable: paused");

        /**
         * testing on thecta
         */
        // transfer something to alice
        await expect(thecta.connect(deployer).transfer(alice.address, noOfTokenToTransfer))
            .to.emit(thecta, "Transfer")
            .withArgs(deployer.address, alice.address, noOfTokenToTransfer);
        // pause
        await expect(thecta.connect(deployer).pause())
            .to.emit(thecta, "Paused")
            .withArgs(deployer.address);
        // deployer try to transfer and return error
        await expect(
            thecta.connect(deployer).transfer(alice.address, noOfTokenToTransfer)
        ).to.revertedWith("Pausable: paused");
        await expect(
            thecta.connect(alice).transfer(bob.address, noOfTokenToTransfer)
        ).to.revertedWith("Pausable: paused");
    });

    it("should let Owner unpause token transfer and everyone can transfer/burn token normally", async function () {
        const noOfTokenToTransfer = _getNoOfToken(0.03);
        /**
         * testing on phecta
         */
        // transfer something to alice
        await expect(phecta.connect(deployer).transfer(alice.address, noOfTokenToTransfer))
            .to.emit(phecta, "Transfer")
            .withArgs(deployer.address, alice.address, noOfTokenToTransfer);
        // pause
        await expect(phecta.connect(deployer).pause())
            .to.emit(phecta, "Paused")
            .withArgs(deployer.address);
        // deployer try to transfer and return error
        await expect(
            phecta.connect(deployer).transfer(alice.address, noOfTokenToTransfer)
        ).to.revertedWith("Pausable: paused");
        await expect(
            phecta.connect(alice).transfer(bob.address, noOfTokenToTransfer)
        ).to.revertedWith("Pausable: paused");
        // unpause
        await expect(phecta.connect(deployer).unpause())
            .to.emit(phecta, "Unpaused")
            .withArgs(deployer.address);
        await expect(phecta.connect(deployer).transfer(alice.address, noOfTokenToTransfer))
            .to.emit(phecta, "Transfer")
            .withArgs(deployer.address, alice.address, noOfTokenToTransfer);
        await expect(phecta.connect(alice).transfer(bob.address, noOfTokenToTransfer))
            .to.emit(phecta, "Transfer")
            .withArgs(alice.address, bob.address, noOfTokenToTransfer);

        /**
         * testing on thecta
         */
        // transfer something to alice
        await expect(thecta.connect(deployer).transfer(alice.address, noOfTokenToTransfer))
            .to.emit(thecta, "Transfer")
            .withArgs(deployer.address, alice.address, noOfTokenToTransfer);
        // pause
        await expect(thecta.connect(deployer).pause())
            .to.emit(thecta, "Paused")
            .withArgs(deployer.address);
        // deployer try to transfer and return error
        await expect(
            thecta.connect(deployer).transfer(alice.address, noOfTokenToTransfer)
        ).to.revertedWith("Pausable: paused");
        await expect(
            thecta.connect(alice).transfer(bob.address, noOfTokenToTransfer)
        ).to.revertedWith("Pausable: paused");
        // unpause
        await expect(thecta.connect(deployer).unpause())
            .to.emit(thecta, "Unpaused")
            .withArgs(deployer.address);
        await expect(thecta.connect(deployer).transfer(alice.address, noOfTokenToTransfer))
            .to.emit(thecta, "Transfer")
            .withArgs(deployer.address, alice.address, noOfTokenToTransfer);
        await expect(thecta.connect(alice).transfer(bob.address, noOfTokenToTransfer))
            .to.emit(thecta, "Transfer")
            .withArgs(alice.address, bob.address, noOfTokenToTransfer);
    });

    it("should let Owner pause but token owner still can approve others spend his token after Owner unpause", async function () {
        const noOfTokenToTransfer = _getNoOfToken(0.03);
        /**
         * testing on phecta
         */
        // transfer something to alice
        expect(await phecta.connect(deployer).transfer(alice.address, noOfTokenToTransfer))
            .to.emit(phecta, "Transfer")
            .withArgs(deployer.address, alice.address, noOfTokenToTransfer);
        // pause
        expect(await phecta.connect(deployer).pause())
            .to.emit(phecta, "Paused")
            .withArgs(deployer.address);
        // alice approve bob to be a sender with large amount
        expect(await phecta.connect(alice).approve(bob.address, _getNoOfToken(1000)))
            .to.emit(phecta, "Approval")
            .withArgs(alice.address, bob.address, _getNoOfToken(1000));
        // unpause
        expect(await phecta.connect(deployer).unpause())
            .to.emit(phecta, "Unpaused")
            .withArgs(deployer.address);
        expect(
            await phecta
                .connect(bob)
                .transferFrom(alice.address, harman.address, noOfTokenToTransfer / 2)
        )
            .to.emit(phecta, "Transfer")
            .withArgs(alice.address, harman.address, noOfTokenToTransfer / 2);

        /**
         * testing on thecta
         */
        expect(await thecta.connect(deployer).transfer(alice.address, noOfTokenToTransfer))
            .to.emit(thecta, "Transfer")
            .withArgs(deployer.address, alice.address, noOfTokenToTransfer);
        // pause
        expect(await thecta.connect(deployer).pause())
            .to.emit(thecta, "Paused")
            .withArgs(deployer.address);
        // alice approve bob to be a sender with large amount
        expect(await thecta.connect(alice).approve(bob.address, _getNoOfToken(1000)))
            .to.emit(thecta, "Approval")
            .withArgs(alice.address, bob.address, _getNoOfToken(1000));
        // unpause
        expect(await thecta.connect(deployer).unpause())
            .to.emit(thecta, "Unpaused")
            .withArgs(deployer.address);
        expect(
            await thecta
                .connect(bob)
                .transferFrom(alice.address, harman.address, noOfTokenToTransfer / 2)
        )
            .to.emit(thecta, "Transfer")
            .withArgs(alice.address, harman.address, noOfTokenToTransfer / 2);
    });
});
