const { utils } = require("ethers");
const { ethers } = require("hardhat");
const routerAbi = require("../abis/uni_router");
const { ADDRESSES } = require("./constants");

async function main() {
    const deadline = parseInt(Date.now() / 1000) + 100;

    const [deployer] = await ethers.getSigners();

    const hectaAddress = "";
    const pancakeRouterAddress = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";
    const uniRouter = new ethers.Contract(pancakeRouterAddress, routerAbi, deployer);

    const BUSD = await ethers.getContractFactory("BEP20Token");
    const busd = await BUSD.attach(ADDRESSES.busd);

    const HectagonERC20Token = await ethers.getContractFactory("HectagonERC20Token");
    const hecta = await HectagonERC20Token.attach(hectaAddress);

    const busdAmount = utils.parseUnits("75000", 18);
    const hectaAmount = utils.parseUnits("25000", 9);

    let tx = await busd.approve(pancakeRouterAddress, busdAmount);
    await tx.wait();
    console.log("addLiquidity: busd approved");

    tx = await hecta.approve(pancakeRouterAddress, hectaAmount);
    await tx.wait();
    console.log("addLiquidity: hecta approved");

    tx = await uniRouter.addLiquidity(
        busd.address,
        hecta.address,
        busdAmount,
        hectaAmount,
        busdAmount,
        hectaAmount,
        deployer.address,
        deadline
    );
    await tx.wait();

    console.log("addLiquidity: Supply sucessfull:");
    console.log("busdAmount:", busdAmount.toString());
    console.log("hectaAmount:", hectaAmount.toString());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
