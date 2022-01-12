import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS, TREASURY_TIMELOCK } from "../constants";
//import { DAI, FRAX, HectagonERC20Token, HectagonTreasury } from "../types";
import { HectagonTreasury__factory } from "../../types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers } = hre;

    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

    const hectaDeployment = await deployments.get(CONTRACTS.hecta);

    const authorityDeployment = await deployments.get(CONTRACTS.authority);

    // TODO: TIMELOCK SET TO 0 FOR NOW, CHANGE FOR ACTUAL DEPLOYMENT
    const treasuryDeployment = await deploy(CONTRACTS.treasury, {
        from: deployer,
        args: [hectaDeployment.address, TREASURY_TIMELOCK, authorityDeployment.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    await HectagonTreasury__factory.connect(treasuryDeployment.address, signer);
};

func.tags = [CONTRACTS.treasury, "treasury"];
func.dependencies = [CONTRACTS.hecta];

export default func;
