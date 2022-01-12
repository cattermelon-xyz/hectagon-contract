import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
    CONTRACTS,
    EPOCH_LENGTH_IN_BLOCKS,
    FIRST_EPOCH_TIME,
    FIRST_EPOCH_NUMBER,
} from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const hectaDeployment = await deployments.get(CONTRACTS.hecta);
    const sHectaDeployment = await deployments.get(CONTRACTS.sHecta);
    const gHectaDeployment = await deployments.get(CONTRACTS.gHecta);

    await deploy(CONTRACTS.staking, {
        from: deployer,
        args: [
            hectaDeployment.address,
            sHectaDeployment.address,
            gHectaDeployment.address,
            EPOCH_LENGTH_IN_BLOCKS,
            FIRST_EPOCH_NUMBER,
            FIRST_EPOCH_TIME,
            authorityDeployment.address,
        ],
        log: true,
    });
};

func.tags = [CONTRACTS.staking, "staking"];
func.dependencies = [CONTRACTS.hecta, CONTRACTS.sHecta, CONTRACTS.gHecta];

export default func;
