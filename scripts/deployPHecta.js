const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deployer: " + deployer.address);

  const PHECTA = await ethers.getContractFactory("PHectagonERC20");
  const pHecta = await PHECTA.deploy();
  console.log("PHECTA: " + pHecta.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
