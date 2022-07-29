import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const hectaDeployment = await deployments.get(CONTRACTS.hecta);

    await deploy(CONTRACTS.circulatingSupply, {
        from: deployer,
        args: [hectaDeployment.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.circulatingSupply, "utility"];
func.dependencies = [CONTRACTS.hecta];
export default func;
