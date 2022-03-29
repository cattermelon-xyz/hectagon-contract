const { ethers } = require("hardhat");
const { ZERO_ADDRESS, ADDRESSES, LARGE_APPROVAL } = require("./constants");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const HectagonTreasury = await ethers.getContractFactory("HectagonTreasury");
    const treasury = await HectagonTreasury.attach(ADDRESSES.treasury);

    const BUSD = await ethers.getContractFactory("BEP20Token");
    const busd = await BUSD.attach(ADDRESSES.busd);

    await treasury.enable("0", deployer.address, ZERO_ADDRESS);
    await treasury.enable("4", deployer.address, ZERO_ADDRESS);
    console.log("Add Treasury's deposit permission to deployer");

    await busd.approve(ADDRESSES.treasury, LARGE_APPROVAL);
    console.log("LARGE_APPROVAL");

    await treasury.enable("2", busd.address, ZERO_ADDRESS);
    console.log("Add Treasury's deposit permission to busd");

    await treasury.deposit("30000000000000000000000", busd.address, "14000000000000");
    console.log("Treasury deposit");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
