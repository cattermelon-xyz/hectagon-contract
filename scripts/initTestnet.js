const { ethers } = require("hardhat");
const { ADDRESSES } = require("./constants");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const HectagonTreasury = await ethers.getContractFactory("HectagonTreasury");
    const treasury = await HectagonTreasury.attach(ADDRESSES.treasury);

    await treasury.enable("0", deployer.address);
    await treasury.enable("1", deployer.address);

    await treasury.initialize(deployer.address, ethers.utils.parseUnits("75000", 9));

    console.log("Treasury initialized");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
