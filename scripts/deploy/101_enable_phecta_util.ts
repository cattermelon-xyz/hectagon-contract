import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS, ADDRESSES } from "../constants";
import { waitFor } from "../txHelper";
import { HectagonTreasury__factory, PHecta__factory } from "../../types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const treasury = HectagonTreasury__factory.connect(treasuryDeployment.address, signer);

    const pHectaDeployment = await deployments.get(CONTRACTS.pHecta);
    const pHecta = PHecta__factory.connect(pHectaDeployment.address, signer);
    const hectaDeployment = await deployments.get(CONTRACTS.hecta);
    const circulatingSupplyDeployment = await deployments.get(CONTRACTS.circulatingSupply);

    await waitFor(treasury.enable("1", pHectaDeployment.address)); // Allows pHecta to deposit busd.
    await waitFor(
        pHecta.initialize(
            hectaDeployment.address,
            treasuryDeployment.address,
            ADDRESSES.busd,
            circulatingSupplyDeployment.address
        )
    );
};

func.tags = [CONTRACTS.pHecta, "setup-phecta"];

func.dependencies = [CONTRACTS.treasury, CONTRACTS.hecta];

export default func;
