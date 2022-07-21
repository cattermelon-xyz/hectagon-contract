const { ethers } = require("hardhat");
const cakeAbi = require("../abis/cake.json");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);

    const quickBondAddress = "0xC5f0634C55480284F4e66532E6222e688C317627";
    const HectagonQuickBond = await ethers.getContractFactory("HectagonQuickBond");
    const quickBond = await HectagonQuickBond.attach(quickBondAddress);

    const _fromTokenContractAddress = "0xa35062141Fa33BCA92Ce69FeD37D0E8908868AAe";
    const cake = new ethers.Contract(_fromTokenContractAddress, cakeAbi, deployer);

    const _pairAddress = "0xe10ddE9a9Ece840365a04CE85Eb9ca496e2489e6"; // busd - hecta
    const path = [
        "0xa35062141Fa33BCA92Ce69FeD37D0E8908868AAe",
        "0x9e3F47234e72e222348552e028ceEB8f4C428d26",
    ];
    const amount = ethers.utils.parseUnits("10", "ether");

    const _minTokenReceive = 0; // slipage 1, slippage khi swap
    const _maxPrice = "10000"; // slipage 2, slippage của giá bond
    const _bondId = "2";

    // approve token trước khi mua
    //  nếu approve số  lượng lớn từ trước thì có thể bỏ qua bước này
    await cake.approve(quickBondAddress, amount);

    await quickBond.quickLPBond(
        _fromTokenContractAddress,
        _pairAddress,
        path,
        amount,
        _minTokenReceive,
        true,
        false,
        "0x8703d1C3cd670dd678ddFacA1e98237f6a342C3C",
        _maxPrice,
        _bondId
    );

    const axsMockAdress = "0x24E03C6c2975B60d2E56F23bBFaa8de71AD654aB";
    const axsMock = new ethers.Contract(axsMockAdress, cakeAbi, deployer);
    const amount2 = ethers.utils.parseUnits("10", "ether");

    await axsMock.approve(quickBondAddress, amount2);

    const path2 = [axsMockAdress, "0x9e3F47234e72e222348552e028ceEB8f4C428d26"];
    const _maxPrice2 = "4971251083"; // slipage của giá bond

    await quickBond.quickStableBond(
        axsMockAdress,
        "0x9e3F47234e72e222348552e028ceEB8f4C428d26", // busd
        path2,
        amount2,
        false,
        "0x8703d1C3cd670dd678ddFacA1e98237f6a342C3C",
        _maxPrice2,
        "3"
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
