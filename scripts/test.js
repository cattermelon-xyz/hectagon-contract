const { ethers } = require("hardhat");
const CONTRACTS = require("./contracts")

async function main() {
    const [deployer, MockDAO] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const HectagonBondDepository = await ethers.getContractFactory("HectagonBondDepository");
    const hectagonBondDepository = await HectagonBondDepository.attach(CONTRACTS.BOND_DEPOSITORY)

    const IDs = await hectagonBondDepository.getIDs();
    console.log("IDs: ", IDs);
    console.log("type: ", typeof(IDs));

    let currentBond

    for(let i = 0; i < IDs.length; i++){
        currentBond = await hectagonBondDepository.bonds(i);
        console.log(`Bond ${i}: ${currentBond}`)
    }

    // Bond object:
    // {
    //     principal: address token dùng để mua bonds,
    //     calculator: address calculator contract (stable coin là address 0),


    // }

}

main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
