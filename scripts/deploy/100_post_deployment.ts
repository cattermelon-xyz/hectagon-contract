import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { waitFor } from "../txHelper";
import { CONTRACTS, INITIAL_REWARD_RATE, INITIAL_INDEX } from "../constants";
import {
    GovernanceHectagon__factory,
    Distributor__factory,
    HectagonTreasury__factory,
    HectagonAuthority__factory,
} from "../../types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

    // Core

    const gHectaDeployment = await deployments.get(CONTRACTS.gHecta);
    const gHecta = GovernanceHectagon__factory.connect(gHectaDeployment.address, signer);

    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const treasury = HectagonTreasury__factory.connect(treasuryDeployment.address, signer);

    const distributorDeployment = await deployments.get(CONTRACTS.distributor);
    const distributor = Distributor__factory.connect(distributorDeployment.address, signer);

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const authority = HectagonAuthority__factory.connect(authorityDeployment.address, signer);

    // Step 1: Set treasury as vault on authority
    await waitFor(authority.pushVault(treasuryDeployment.address, true));
    console.log("Authority push vault treasury");

    // Step 2: Set distributor as minter on treasury
    await waitFor(treasury.enable(1, distributor.address)); // Allows distributor to mint hecta.
    console.log("Setup -- treasury.enable(1):  distributor enabled to mint hecta on treasury");

    // Step 3: Set distributor on staking
    await waitFor(gHecta.setDistributor(distributor.address));
    console.log("Setup -- gHecta.setDistributor:  distributor set on gHecta");

    await waitFor(distributor.addRecipient(gHecta.address, INITIAL_REWARD_RATE));
    console.log("Setup -- distributor.addRecipient(gHecta)");
};

func.tags = ["setup"];
func.dependencies = [CONTRACTS.hecta, CONTRACTS.treasury, CONTRACTS.gHecta, CONTRACTS.authority];

export default func;
