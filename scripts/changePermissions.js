const { ethers } = require("hardhat");
const { CONTRACTS, ZERO_ADDRESS, LARGE_APPROVAL } = require("./constants");


async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);
    
    const governorAddress = "";
    const guardianAddress = "";
    const policyAddress = "";

    const authorityAddress = "0xE268A48536Fb11c7A4627dAE4738F7941d7fC1c4";
    const HectagonAuthority = await ethers.getContractFactory("HectagonAuthority");
    const authority = await HectagonAuthority.attach(authorityAddress);

    await authority.pushGovernor(governorAddress, true);
    await authority.pushGuardian(guardianAddress, true);
    await authority.pushPolicy(policyAddress, true);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});