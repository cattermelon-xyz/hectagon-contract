const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const bondDepoAddress = "";
    const HectagonQuickBond = await ethers.getContractFactory("HectagonQuickBond");
    const quickBond = await HectagonQuickBond.deploy();
    console.log("quickBond:", quickBond.address);
    await quickBond.updateDepo(bondDepoAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.q
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
