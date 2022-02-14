import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    console.log(deployer);
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const hectaDeployment = await deployments.get(CONTRACTS.hecta);

    await deploy(CONTRACTS.pHecta, {
        from: deployer,
        args: [treasuryDeployment.address, hectaDeployment.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.pHecta, "private"];

func.dependencies = [
    CONTRACTS.treasury,
    CONTRACTS.hecta,
];

export default func;
