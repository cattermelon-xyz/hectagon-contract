const { ethers } = require("hardhat");
const { ZERO_ADDRESS} = require("../constants");


async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);
    
    const bondDepositoryAddress = "0xfBBB32190D7B612Ebb727Df661b6Dc887f902C72";
    const HectagonBondDepositoryV2 = await ethers.getContractFactory("HectagonBondDepositoryV2");
    const hectagonBondDepositoryV2 = await HectagonBondDepositoryV2.attach(bondDepositoryAddress);

    await hectagonBondDepositoryV2.close("11");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});