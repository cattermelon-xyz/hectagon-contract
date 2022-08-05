const { ethers } = require("hardhat");
const { ADDRESSES } = require("./constants");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const governorAddress = "";
    const guardianAddress = "";
    const policyAddress = "";
    const authorityAddress = "";

    const HectagonAuthority = await ethers.getContractFactory("HectagonAuthority");
    const authority = await HectagonAuthority.attach(authorityAddress);

    const HectagonTreasury = await ethers.getContractFactory("HectagonTreasury");
    const treasury = await HectagonTreasury.attach(ADDRESSES.treasury);

    let tx = await authority.pushGuardian(guardianAddress, true);
    await tx.wait();
    console.log("pushGuardian success");

    tx = await authority.pushPolicy(policyAddress, true);
    await tx.wait();
    console.log("pushPolicy success");

    tx = await authority.pushGovernor(governorAddress, true);
    await tx.wait();
    console.log("pushGovernor success");

    tx = await treasury.enable("0", guardianAddress);
    await tx.wait();
    console.log("treasury set guardian as TREASURYMANAGER success");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
