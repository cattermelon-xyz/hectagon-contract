const { ethers } = require("hardhat");
const { ADDRESSES } = require("./constants");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const HectagonTreasury = await ethers.getContractFactory("HectagonTreasury");
    const treasury = await HectagonTreasury.attach(ADDRESSES.treasury);

    await treasury.initialize();
    console.log("Treasury initialized!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
