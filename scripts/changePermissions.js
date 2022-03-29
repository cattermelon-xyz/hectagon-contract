const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const governorAddress = "0x8703d1C3cd670dd678ddFacA1e98237f6a342C3C";
    const guardianAddress = "0x8703d1C3cd670dd678ddFacA1e98237f6a342C3C";
    const policyAddress = "0x509d6FD596Bb9e66b01B9a87424CDa05b397bF28";

    const authorityAddress = "0x523886D6443eD639c6335f75E1f59E6614Db5441";
    const HectagonAuthority = await ethers.getContractFactory("HectagonAuthority");
    const authority = await HectagonAuthority.attach(authorityAddress);

    await authority.pushGuardian(guardianAddress, true);
    await authority.pushPolicy(policyAddress, true);
    await authority.pushGovernor(governorAddress, true);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
