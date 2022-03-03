const { ethers } = require("hardhat");
const { ZERO_ADDRESS } = require("../constants");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const bondDepositoryAddress = "0x901493B74186E9b87b26060D25496e13e036eD06";
    const busdAddress = "0x1e965fBC26c8CDBEF6A7125efEea20EB5b26ED9A";
    const bondCalAddress = "0x5473E34AB19da0e99c4d710D29407760592467a8";
    const treasuryAddress = "0x3D51101569c52f19597b2653446BfB11379742Ef";
    const hectabusdAddress = "0xfCD2676F9253f9093ADcAF092181563277aa933c";

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
