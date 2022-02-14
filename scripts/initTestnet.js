const { ethers } = require("hardhat");
const { CONTRACTS, ZERO_ADDRESS, LARGE_APPROVAL } = require("./constants");


async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);
    
    const treasuryAddress = "0x8335c8D5c40298868c1B161A5086559fcD1B5cB9";

    const HectagonTreasury = await ethers.getContractFactory("HectagonTreasury");
    const treasury = await HectagonTreasury.attach(treasuryAddress);
    const BUSD = await ethers.getContractFactory("BEP20Token");
    const busd = await BUSD.deploy();
    
    console.log("busd:", busd.address);

    await treasury.enable("0", deployer.address, ZERO_ADDRESS);
    await treasury.enable("4", deployer.address, ZERO_ADDRESS);
    console.log("Add Treasury's deposit permission to deployer");

    await busd.approve(treasuryAddress, LARGE_APPROVAL);
    console.log("LARGE_APPROVAL");
    await treasury.enable("2", busd.address, ZERO_ADDRESS);
    // Deposit 10,000,000 BUSD to treasury, 100,000 HECTA gets minted to deployer and 9,900,000 are in treasury as excesss reserves
    await treasury.deposit(
        "10000000000000000000000000",
        busd.address,
        "9900000000000000"
    );

    console.log("deposit 10,000,000 BUSD to treasury, 100,000 HECTA gets minted to deployer and 9,900,000 are in treasury as excesss reserves");

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});