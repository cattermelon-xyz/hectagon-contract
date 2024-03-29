import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const circulatingSupplyDeployment = await deployments.get(CONTRACTS.circulatingSupply);
    const gHectaDeployment = await deployments.get(CONTRACTS.gHecta);
    const authorityDeployment = await deployments.get(CONTRACTS.authority);

    // TODO: firstEpochBlock is passed in but contract constructor param is called _nextEpochBlock
    await deploy(CONTRACTS.distributor, {
        from: deployer,
        args: [
            treasuryDeployment.address,
            gHectaDeployment.address,
            authorityDeployment.address,
            circulatingSupplyDeployment.address,
        ],
        log: true,
    });
};

func.tags = [CONTRACTS.distributor, "staking"];
func.dependencies = [CONTRACTS.treasury, CONTRACTS.circulatingSupply, CONTRACTS.hectasAuthority];

export default func;
