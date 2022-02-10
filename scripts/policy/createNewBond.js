const { ethers } = require("hardhat");
const { ZERO_ADDRESS } = require("../constants");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const bondDepositoryAddress = "0xfBBB32190D7B612Ebb727Df661b6Dc887f902C72";
    const busdAddress = "0x3471157cE0C3f9d1272CA3510a7d00049bB3B0EA";
    const bondCalAddress = "0x985AC1159c29890868864e1dfe700D59E4d3365a";
    const treasuryAddress = "0xDB973a35911b265aC23547C5e3A64e4eD28AFa39";
    const hectabusdAddress = "0x008ec4be26f514a5cc906b908bff408f63916623";

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
        console.log("Add HECTA-BUSD as liquidity token on traesury, ");
    }

    const hectaPerUSD = (600000 * 1e18) / (50000 * 1e9); // dedcimal 9, BusdAmount / HectaAmount
    await hectagonBondDepositoryV2.create(
        busdAddress,
        ["10000000000000000000000", `${hectaPerUSD}`, "10000"],
        [true, true],
        ["360", "1643528598"],
        ["8640", "86400"]
    );

    const quoteTokenPrice = (2 * 600000 * 1e18) / Math.sqrt(600000 * 1e18 * 50000 * 1e9);
    const marketPrice = Math.floor(hectaPerUSD / quoteTokenPrice);
    await hectagonBondDepositoryV2.create(
        hectabusdAddress,
        [`${10000 * 1e9}`, `${marketPrice}`, "10000"],
        [false, true],
        ["360", "1643528598"],
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
