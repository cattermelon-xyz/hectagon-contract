const { ethers } = require("hardhat");
const { ZERO_ADDRESS } = require("../constants");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const bondDepositoryAddress = "0x466CB9382856cC732499105558739E81ffBC961B";
    const busdAddress = "0x59271a5Ed2b1163939173115544953658DD58EAE";
    const bondCalAddress = "0x5C7a2941283Eaf4e06e6d0bA7ACc6D8fC19F08Af";
    const treasuryAddress = "0x873695bCd66297BEB628B642d5e6DBbd19367d39";
    const hectabusdAddress = "0xedA6210a0e8Aee915bECaB3d6e42281a10b9D206";

    const HectagonTreasury = await ethers.getContractFactory("HectagonTreasury");
    const treasury = await HectagonTreasury.attach(treasuryAddress);
    const HectagonBondDepositoryV2 = await ethers.getContractFactory("HectagonBondDepositoryV2");
    const hectagonBondDepositoryV2 = await HectagonBondDepositoryV2.attach(bondDepositoryAddress);

    let permission = await treasury.permissions("2", busdAddress);
    if (!permission) {
        await treasury.enable("2", busdAddress, ZERO_ADDRESS);
        console.log("Add BUSD as reverse token on traesury");
    }

    permission = await treasury.permissions("5", hectabusdAddress);

    if (!permission) {
        await treasury.enable("5", hectabusdAddress, bondCalAddress);
        console.log("Add HECTA-BUSD as liquidity token on traesury");
    }

    const hectaPerUSD = (600000 * 1e18) / (50000 * 1e9); // dedcimal 9, BusdAmount / HectaAmount
    await hectagonBondDepositoryV2.create(
        busdAddress,
        ["10000000000000000000000", `${hectaPerUSD}`, "10000"],
        [true, true],
        ["360", "1649388185"],
        ["8640", "86400"]
    );

    const quoteTokenPrice = (2 * 600000 * 1e18) / Math.sqrt(600000 * 1e18 * 50000 * 1e9);
    const marketPrice = Math.floor(hectaPerUSD / quoteTokenPrice);
    await hectagonBondDepositoryV2.create(
        hectabusdAddress,
        [`${10000 * 1e9}`, `${marketPrice}`, "10000"],
        [false, true],
        ["360", "1649388185"],
        ["8640", "86400"]
    );

    console.log("hectagonBondDepositoryV2.create");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
