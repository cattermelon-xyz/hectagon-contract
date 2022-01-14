const { ethers } = require("hardhat");
const { CONTRACTS, ZERO_ADDRESS, LARGE_APPROVAL } = require("./constants");


async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);
    
    const bondDepositoryAddress = "0x725093440F4A6e38a38a59536dbDA8b16b01eB6D";
    const treasuryAddress = "0xD79e75Ba21a0fb894C454B6F9144E8E39cC4F8c6";
    const busdAddress = "0xD6929A774463733c50D7D7f37c32FD7AF2a73c6d";

    const HectagonTreasury = await ethers.getContractFactory("HectagonTreasury");
    const treasury = await HectagonTreasury.attach(treasuryAddress);
    const BUSD = await ethers.getContractFactory("BEP20Token");
    const busd = await BUSD.attach(busdAddress);

    const HectagonBondDepositoryV2 = await ethers.getContractFactory("HectagonBondDepositoryV2");
    const hectagonBondDepositoryV2 = await HectagonBondDepositoryV2.attach(bondDepositoryAddress);

    await treasury.enable("2", busdAddress, ZERO_ADDRESS);
    console.log("Add BUSD as reverse token on traesury");

    
    await treasury.enable("0", deployer.address, ZERO_ADDRESS);
    await treasury.enable("4", deployer.address, ZERO_ADDRESS);
    console.log("Add Treasury's deposit permission to deployer");

    await busd.approve(treasuryAddress, LARGE_APPROVAL);
    console.log("LARGE_APPROVAL");
    // Deposit 10,000,000 BUSD to treasury, 100,000 HECTA gets minted to deployer and 9,900,000 are in treasury as excesss reserves
    await treasury.deposit(
        "10000000000000000000000000",
        busd.address,
        "9900000000000000"
    );
    console.log("eposit 10,000,000 BUSD to treasury, 100,000 HECTA gets minted to deployer and 9,900,000 are in treasury as excesss reserves");


    await hectagonBondDepositoryV2.create(
        busdAddress,
        ["10000000000000000000000", 12 * 1e8 + "", "10000"],
        [true, true],
        ["360", "1642920416"],
        ["8640", "86400"]
    );
    console.log("hectagonBondDepositoryV2.create");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});