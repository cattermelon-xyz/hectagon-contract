const { ethers } = require("hardhat");
const CONTRACTS = require("./contracts");

async function main() {
    const [deployer, MockDAO] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    // Ethereum 0 address, used when toggling changes in treasury
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    const principal = "0x964E4737DDB8c5eBc5AfcBb59ed8b1d01cF3bF0d"; //busd


    const HectagonBondDepository = await ethers.getContractFactory("HectagonBondDepository");
    const hectagonBondDepository = await HectagonBondDepository.attach(CONTRACTS.BOND_DEPOSITORY)

    
    await hectagonBondDepository.addBond(
        principal,
        zeroAddress,
        1000*10*9 + "",
        true // ban hecta
    );
    console.log("depository add bond");

    await hectagonBondDepository.setTerms(
        "0",
        "1000000",
        false,
        "200", // _vestingTerm
        "0", // 4 days
        "15708136", // 4 days
        "1000",
        "50",
        "1000000000000000",
        "0"
    )


    ////////////////////////////////////
    

    await hectagonBondDepository.addBond(
        principal,
        zeroAddress,
        "1000000000000",
        false // ban busd
    );
    console.log("depository add bond");

    await hectagonBondDepository.setTerms(
        "1",
        10000*10*9 + "",
        true,
        "0",
        "15651136", // 4 days
        "15708136", // 4 days
        "1000",
        "50",
        "1000000000000000",
        "0"
    )
    console.log("Depository set term")

    console.log("Deploy successfully");
}

main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
