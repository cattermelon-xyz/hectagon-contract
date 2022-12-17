import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const circulatingSupplyDeployment = await deployments.get(CONTRACTS.circulatingSupply);
    const pHectaDeployment = await deployments.get(CONTRACTS.pHecta);
    const tHectaDeployment = await deployments.get(CONTRACTS.tHecta);
    const gHectaDeployment = await deployments.get(CONTRACTS.gHecta);

    await deploy(CONTRACTS.snapshot, {
        from: deployer,
        args: [
            circulatingSupplyDeployment.address,
            pHectaDeployment.address,
            tHectaDeployment.address,
            gHectaDeployment.address,
        ],
        log: true,
    });
};

func.tags = [CONTRACTS.snapshot, "Snapshot"];
func.dependencies = [
    CONTRACTS.circulatingSupply,
    CONTRACTS.pHecta,
    CONTRACTS.tHecta,
    CONTRACTS.gHecta,
];

export default func;
