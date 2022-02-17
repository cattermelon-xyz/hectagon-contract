import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { waitFor } from "../txHelper";
import { HectagonTreasury__factory } from "../../types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const treasury = HectagonTreasury__factory.connect(treasuryDeployment.address, signer);

    const pHectaDeployment = await deployments.get(CONTRACTS.pHecta);

    await waitFor(treasury.enable("0", pHectaDeployment.address, ethers.constants.AddressZero)); // Allows pHecta to deposit busd.
};

func.tags = [CONTRACTS.pHecta, "private"];

func.dependencies = [CONTRACTS.treasury, CONTRACTS.hecta];

export default func;
