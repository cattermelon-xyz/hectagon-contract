const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const authorityAddress = "";

    const HectagonNFT = await ethers.getContractFactory("HectagonNFT");
    const hectagonNFT = await HectagonNFT.deploy(authorityAddress);
    console.log("HectagonNFT address:", hectagonNFT.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
