import { ethers, network } from "hardhat";
import { exec } from "child_process";
import { promisify } from "util";
const execPromise = promisify(exec);

const authorityAddress = "";
const gHectaAddress = "";
const hectaAddress = "";
const hectaCirculatingSupplyAddress = "";
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const Asset = await ethers.getContractFactory("Asset");

    const asset = await Asset.deploy(
        authorityAddress,
        gHectaAddress,
        hectaAddress,
        hectaCirculatingSupplyAddress
    );

    console.log("Asset address:", asset.address);
    console.log("Verifying address contract...");
    try {
        const cmd = `npx hardhat verify ${asset.address} --network ${network.name} --contract "contracts/Asset.sol:Asset" "${authorityAddress}" "${gHectaAddress}" "${hectaAddress}" "${hectaCirculatingSupplyAddress}"`;
        console.log(cmd);
        const { stdout } = await execPromise(cmd);
        console.log(stdout);
    } catch (e: any) {
        console.error(e?.toString());
    }
    console.log("Completed");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
