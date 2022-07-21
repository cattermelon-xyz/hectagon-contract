const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const circulatingSupplyAddress = "0xDBa54CAE3C9BC6601D4d558dEB59c4F07688b5a7";
    const pHectaAddress = "0x46e4E450e38fDd6113DC81d4E2df3166B6ec6559";
    const tHectaAddress = "0x46e4E450e38fDd6113DC81d4E2df3166B6ec6559"; // use phecta address for fake tHecta address
    const gHectaAddress = "0xA16d5937b56c94B91fE2f4626334E2b4E57F9690";

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
