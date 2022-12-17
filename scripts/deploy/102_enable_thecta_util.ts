import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS, ADDRESSES } from "../constants";
import { waitFor } from "../txHelper";
import { HectagonTreasury__factory, THecta__factory } from "../../types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const treasury = HectagonTreasury__factory.connect(treasuryDeployment.address, signer);

    const tHectaDeployment = await deployments.get(CONTRACTS.tHecta);
    const tHecta = THecta__factory.connect(tHectaDeployment.address, signer);
    const hectaDeployment = await deployments.get(CONTRACTS.hecta);
    const circulatingSupplyDeployment = await deployments.get(CONTRACTS.circulatingSupply);

    await waitFor(treasury.enable("1", tHectaDeployment.address)); // Allows tHecta to deposit busd.
    await waitFor(
        tHecta.initialize(
            hectaDeployment.address,
            treasuryDeployment.address,
            ADDRESSES.busd,
            circulatingSupplyDeployment.address
        )
    );
};

func.tags = [CONTRACTS.tHecta, "setup-thecta"];

func.dependencies = [CONTRACTS.treasury, CONTRACTS.hecta];

export default func;
