const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const circulatingSupplyAddress = "";
    const pHectaAddress = "";
    const tHectaAddress = "";
    const gHectaAddress = "";

    const Snapshot = await ethers.getContractFactory("Snapshot");
    const snapshot = await Snapshot.deploy(
        circulatingSupplyAddress,
        pHectaAddress,
        tHectaAddress,
        gHectaAddress
    );
    console.log("snapshot:", snapshot.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.q
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
