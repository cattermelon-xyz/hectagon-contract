import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
    CONTRACTS,
    EPOCH_LENGTH_IN_SECONDS,
    FIRST_EPOCH_TIME,
    FIRST_EPOCH_NUMBER,
} from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const hectaDeployment = await deployments.get(CONTRACTS.hecta);

    await deploy(CONTRACTS.gHecta, {
        from: deployer,
        args: [
            hectaDeployment.address,
            EPOCH_LENGTH_IN_SECONDS,
            FIRST_EPOCH_NUMBER,
            FIRST_EPOCH_TIME,
            authorityDeployment.address,
        ],
        log: true,
    });
};

func.tags = [CONTRACTS.gHecta, "staking"];
func.dependencies = [CONTRACTS.hecta];

export default func;
