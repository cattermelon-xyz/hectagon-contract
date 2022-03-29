const { ethers } = require("hardhat");
const { ADDRESSES } = require("../constants");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const bondDepositoryAddress = "0xBfda31BD9fc537e586E22C3a39ac15E7C072775e";
    const hectabusdAddress = "0xCCb7836994943564f3222D5B48B642D5d8ca4C9D";

    const HectagonBondDepositoryV2 = await ethers.getContractFactory("HectagonBondDepositoryV2");
    const hectagonBondDepositoryV2 = await HectagonBondDepositoryV2.attach(bondDepositoryAddress);

    const hectaPerUSD = (600000 * 1e18) / (50000 * 1e9); // dedcimal 9, BusdAmount / HectaAmount
    await hectagonBondDepositoryV2.create(
        ADDRESSES.busd,
        ["10000000000000000000000", `${hectaPerUSD}`, "10000"],
        [true, true],
        ["360", "1651142927"],
        ["8640", "86400"]
    );
    console.log("Create BUSD bond successfully!");

    // const quoteTokenPrice = (2 * 600000 * 1e18) / Math.sqrt(600000 * 1e18 * 50000 * 1e9);
    // const marketPrice = Math.floor(hectaPerUSD / quoteTokenPrice);
    // await hectagonBondDepositoryV2.create(
    //     hectabusdAddress,
    //     [`${10000 * 1e9}`, `${marketPrice}`, "10000"],
    //     [false, true],
    //     ["360", "1651142927"],
    //     ["8640", "86400"]
    // );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
