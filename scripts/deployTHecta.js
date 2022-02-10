const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deployer: " + deployer.address);

    const THECTA = await ethers.getContractFactory("THectagonERC20");
    const tHecta = await THECTA.deploy();
    console.log("THECTA: " + tHecta.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
