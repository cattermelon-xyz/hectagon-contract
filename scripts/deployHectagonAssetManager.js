const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const authorityAddress = "";
    const gHectaAddress = "";
    const hectaAddress = "";
    const hectaCirculatingSupplyAddress = "";
    const hectagonNFTAddress = "";

    const HectagonAssetManager = await ethers.getContractFactory("HectagonAssetManager");

    const hectagonAssetManager = await HectagonAssetManager.deploy(
        authorityAddress,
        gHectaAddress,
        hectaAddress,
        hectaCirculatingSupplyAddress,
        hectagonNFTAddress
    );

    console.log("HectagonNFT address:", hectagonAssetManager.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
