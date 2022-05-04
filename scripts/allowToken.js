const { ethers } = require("hardhat");
const { ZERO_ADDRESS, ADDRESSES } = require("./constants");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const hectabusdAddress = "0x055F3e6f76B6c6790b1310Cc8351806b41C51845";
    const bondCalAddress = "0xB53AF074F42D3F3190337c1613FF9ee0767cB7e1";

    const HectagonTreasury = await ethers.getContractFactory("HectagonTreasury");
    const treasury = await HectagonTreasury.attach(ADDRESSES.treasury);

    await treasury.queueTimelock("2", ADDRESSES.busd, ZERO_ADDRESS);
    await treasury.execute("0");

    await treasury.queueTimelock("5", hectabusdAddress, bondCalAddress);
    await treasury.execute("1");

    console.log("Add BUSD as reverse token on traesury");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
