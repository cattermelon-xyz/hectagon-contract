const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const bondDepositoryAddress = "0x466CB9382856cC732499105558739E81ffBC961B";
    const HectagonBondDepository = await ethers.getContractFactory("HectagonBondDepository");
    const hectagonBondDepositoryV2 = await HectagonBondDepository.attach(bondDepositoryAddress);

    await hectagonBondDepositoryV2.close("11");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
