const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const authorityAddress = "";

    const HIC = await ethers.getContractFactory("HectagonInvestmentCouncil");
    const HIT = await ethers.getContractFactory("HectagonInvestmentTeam");
    const HCT = await ethers.getContractFactory("HectagonCampaignTeam");

    const hic = await HIC.deploy(authorityAddress);
    const hit = await HIT.deploy(authorityAddress);
    const hct = await HCT.deploy(authorityAddress);
    console.log("HIC address:", hic.address);
    console.log("HIT address:", hit.address);
    console.log("HCT address:", hct.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
