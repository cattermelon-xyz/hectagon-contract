import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;

    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const hectaDeployment = await deployments.get(CONTRACTS.hecta);
    const gHectaDeployment = await deployments.get(CONTRACTS.gHecta);
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);

    await deploy(CONTRACTS.bondDepo, {
        from: deployer,
        args: [
            authorityDeployment.address,
            hectaDeployment.address,
            gHectaDeployment.address,
            treasuryDeployment.address,
        ],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.bondDepo, "bonding"];
func.dependencies = [CONTRACTS.authority, CONTRACTS.hecta, CONTRACTS.gHecta, CONTRACTS.treasury];

export default func;
