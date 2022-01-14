import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import {
    HectagonTreasury__factory,
} from "../../types";
import { waitFor } from "../txHelper";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

    const bondDepoDeployment = await deployments.get(CONTRACTS.bondDepo);

    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const treasury = HectagonTreasury__factory.connect(treasuryDeployment.address, signer);

    await waitFor(treasury.enable(8, bondDepoDeployment.address, ethers.constants.AddressZero)); // Allows bondDepo to mint hecta.
    console.log("Allows bondDepo to mint hecta.");
};

func.tags = ["bonding"];
func.dependencies = [CONTRACTS.bondDepo];

export default func;
