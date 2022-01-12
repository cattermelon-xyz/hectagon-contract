const { ethers } = require("hardhat");

async function main() {
  const [deployer, MockDAO] = await ethers.getSigners();

  console.log("Deployer: " + deployer.address);

  const zeroAddress = "0x0000000000000000000000000000000000000000";

  const hectaAdrdess = "0x6f939f36d2F50c54711bCBB5966b4659ACe0b234";
  const hectaBusdAddress = "0xf3b9012a7c9a433ddc822a55f43cfe2a139004aa";
  const treasuryAddress = "0x136dFcD277E26f14f9c60c098b93d8E07C043A02";
  const stakingAddress = "0x48761276334a2CcF5abdfA4362e268CF5eE9414f";
  const redeemHelperAddress = "0x833b21C6B2E6685C09e6a4eb0d433599462c6A07";
  const authorityAddress = "0x64e3e9bb703569a78D16CbDab26e0b797e7fc360";
  const hetagonBondingCalculatorAddress = "0xF15d7626ED9beC1b94ba2c7A865167f14C6a1735";

  const Treasury = await ethers.getContractFactory("HectagonTreasury");
  const treasury = await Treasury.attach(treasuryAddress);

  const hectaBusdBCV = "100";

  // Bond vesting length in blocks. 33110 ~ 5 days
  const bondVestingLength = "6000";

  // Min bond price
  const minBondPrice = "300";

  // Max bond payout
  const maxBondPayout = "50";

  // DAO fee for bond
  const bondFee = "10000";

  // Max debt bond can take on
  const maxBondDebt = "1000000000000000";

  // Initial Bond debt
  const intialBondDebt = "0";

  const HECTABUSDBond = await await ethers.getContractFactory("HectagonV1BondDepository");
  const hectaBusdBond = await HECTABUSDBond.deploy(
    hectaAdrdess,
    hectaBusdAddress,
    treasuryAddress,
    MockDAO.address,
    hetagonBondingCalculatorAddress,
    stakingAddress,
    authorityAddress
  );
  console.log("hectaBusdBond: " + hectaBusdBond.address);

  // set liquidity token to treasury
  // enable
  await treasury.queueTimelock("4", hectaBusdBond.address, hetagonBondingCalculatorAddress);
  await treasury.execute("5");
  console.log("Execute...");

  await hectaBusdBond.initializeBondTerms(
    hectaBusdBCV,
    bondVestingLength,
    minBondPrice,
    maxBondPayout,
    bondFee,
    maxBondDebt,
    intialBondDebt
  );
  console.log("initializeBondTerms...");

  const RedeemHelper = await ethers.getContractFactory("RedeemHelper");
  const redeemHelper = await RedeemHelper.attach(redeemHelperAddress);

  await redeemHelper.addBondContract(hectaBusdBond.address);

  console.log("Success!!!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
