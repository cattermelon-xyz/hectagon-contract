const { ethers } = require("hardhat");
const { ADDRESSES } = require("./constants");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const pHectaAddress = "";
    const tHectaAddress = "";
    const hectaCirculatingSupplyAddress = "";

    const HectagonTreasury = await ethers.getContractFactory("HectagonTreasury");
    const treasury = await HectagonTreasury.attach(ADDRESSES.treasury);

    const PHecta = await ethers.getContractFactory("PHecta");
    const pHecta = await PHecta.attach(pHectaAddress);

    const THecta = await ethers.getContractFactory("THecta");
    const tHecta = await THecta.attach(tHectaAddress);

    const HectaCirculatingSupply = await ethers.getContractFactory("HectaCirculatingSupply");
    const hectaCirculatingSupply = await HectaCirculatingSupply.attach(
        hectaCirculatingSupplyAddress
    );

    const BUSD = await ethers.getContractFactory("BEP20Token");
    const busd = await BUSD.attach(ADDRESSES.busd);

    await (await pHecta.start()).wait();
    await (await tHecta.start()).wait();
    console.log("pHecta and tHecta started");

    let tx = await busd.transfer(treasury.address, ethers.utils.parseUnits("75000", 18));
    await tx.wait();
    console.log("transfer 75,000 BUSD to treasury Successs!");

    tx = await hectaCirculatingSupply.setNonCirculatingAddresses([treasury.address]);
    await tx.wait();
    console.log("setNonCirculatingAddresses Successs!");

    tx = await treasury.initialize(deployer.address, ethers.utils.parseUnits("75000", 9));
    await tx.wait();

    console.log("Treasury initialized");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
