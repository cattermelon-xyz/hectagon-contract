const { ethers } = require("hardhat");
const { ADDRESSES } = require("./constants");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const pHectaAddress = "0x9EEb5D78707E379441C399CEEd85164A1788b620";
    const tHectaAddress = "0x76b6452d64a040e61541FC780980e0c226e4b900";
    const hectaCirculatingSupplyAddress = "0x86A1777c77B78E58110B0eAE1947AAFfd0c049b1";
    const quickBondAddress = "0xC5f0634C55480284F4e66532E6222e688C317627";
    const bondDepoAddress = "0x5E91C79231a9b6c90f546617BA796B4ca30b48Eb";

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

    const HectagonQuickBond = await ethers.getContractFactory("HectagonQuickBond");
    const quickBond = await HectagonQuickBond.attach(quickBondAddress);

    const BUSD = await ethers.getContractFactory("BEP20Token");
    const busd = await BUSD.attach(ADDRESSES.busd);

    await pHecta.start();
    await tHecta.start();

    await busd.transfer(treasury.address, ethers.utils.parseUnits("75000", 18));

    await hectaCirculatingSupply.setNonCirculatingAddresses([treasury.address]);

    await quickBond.updateDepo(bondDepoAddress);

    await treasury.enable("0", deployer.address);
    await treasury.enable("1", deployer.address);

    await treasury.initialize(deployer.address, ethers.utils.parseUnits("75000", 9));

    console.log("Treasury initialized");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
