import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const sHectaDeployment = await deployments.get(CONTRACTS.sHecta);

    await deploy(CONTRACTS.gHecta, {
        from: deployer,
        args: [sHectaDeployment.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.gHecta, "tokens"];
func.dependencies = [CONTRACTS.sHecta];

export default func;
