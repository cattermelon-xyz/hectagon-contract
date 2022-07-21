import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { HectagonQuickBond__factory } from "../../types";
import { ethers } from "hardhat";
import { waitFor } from "../txHelper";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;

    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

    const bondDepoDeployment = await deployments.get(CONTRACTS.bondDepo);

    const quickBondDeployment = await deploy(CONTRACTS.quickBond, {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const quickBond = HectagonQuickBond__factory.connect(quickBondDeployment.address, signer);
    await waitFor(quickBond.updateDepo(bondDepoDeployment.address));
};

func.tags = [CONTRACTS.quickBond, "bonding"];
func.dependencies = [
    CONTRACTS.bondDepo,
];

export default func;
