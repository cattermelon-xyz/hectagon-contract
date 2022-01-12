const { ethers } = require("hardhat");

async function main() {
    const [deployer, MockDAO] = await ethers.getSigners();
    console.log("Deployer: " + deployer.address);


    // Initial staking index
    const initialIndex = "1000000000";
    // 4547419269

    // First block epoch occurs
    const firstEpochBlock = "15643243";

    // What epoch will be first epoch
    const firstEpochNumber = "0";

    // How many blocks are in each epoch
    const epochLengthInBlocks = "120";

    // Initial reward rate for epoch
    const initialRewardRate = "3000";

    // Ethereum 0 address, used when toggling changes in treasury
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    // Large number for approval for BUSD
    const largeApproval = "100000000000000000000000000000000";

    // Initial mint for BUSD (10,000,000)

    // DAI bond BCV
    const busdBondBCV = "1000000";

    // Bond vesting length in blocks. 33110 ~ 5 days
    const bondVestingLength = "6000";

    // Min bond price
    const minBondPrice = "1000"; // = 10usd

    // Max bond payout
    const maxBondPayout = "50";

    // DAO fee for bond
    const bondFee = "10000";

    // Max debt bond can take on
    const maxBondDebt = "1000000000000000";

    // Initial Bond debt
    const intialBondDebt = "0";

    // Deploy Authority
    const Authority = await ethers.getContractFactory("HectagonAuthority");
    const authority = await Authority.deploy(
        deployer.address,
        deployer.address,
        deployer.address,
        deployer.address
    );
    console.log("Authority: " + authority.address);

    // Deploy HECTA
    const HECTA = await ethers.getContractFactory("HectagonERC20Token");
    const hecta = await HECTA.deploy(authority.address);
    console.log("HECTA: " + hecta.address);


    // Deploy bonding calc
    const HectagonBondingCalculator = await ethers.getContractFactory("HectagonBondingCalculator");
    const hetagonBondingCalculator = await HectagonBondingCalculator.deploy(hecta.address);
    console.log("HectagonBondingCalculator: " + hetagonBondingCalculator.address);


    // Deploy mock BUSD
    const BUSD = await ethers.getContractFactory("BEP20Token");
    const busd = await BUSD.deploy(); // 31 mil token to deployer
    console.log("BUSD: " + busd.address);


    // Deploy sHECTA
    const SHECTA = await ethers.getContractFactory("sHectagon");
    const sHECTA = await SHECTA.deploy();
    console.log("SHECTA: " + sHECTA.address);


    // Deploy GHECTA
    const GHECTA = await ethers.getContractFactory("gHECTA");
    const gHECTA = await GHECTA.deploy(sHECTA.address);
    console.log("GHECTA: " + gHECTA.address);

    // Deploy Circulating Supply Conrtact
    const HECTACirculatingSupplyConrtact = await ethers.getContractFactory("HectaCirculatingSupplyConrtact");
    const hECTACirculatingSupplyConrtact = await HECTACirculatingSupplyConrtact.deploy();
    console.log("HectaCirculatingSupplyConrtact: " + hECTACirculatingSupplyConrtact.address);

    await hECTACirculatingSupplyConrtact.initialize(hecta.address);
    console.log("Add hecta circulation supply")


    // Deploy Treasury
    const HectagonTreasury = await ethers.getContractFactory("HectagonTreasury");
    const hectagonTreasury = await HectagonTreasury.deploy(hecta.address, "0", authority.address);
    console.log("Treasury: " + hectagonTreasury.address);

    // Deploy Staking
    const HectagonStaking = await ethers.getContractFactory("HectagonStaking");
    const staking = await HectagonStaking.deploy(
        hecta.address,
        sHECTA.address,
        gHECTA.address,
        epochLengthInBlocks,
        firstEpochNumber,
        firstEpochBlock,
        authority.address
    );
    console.log("Staking: " + staking.address);

    // Deploy distributor
    const Distributor = await ethers.getContractFactory("Distributor");
    const distributor = await Distributor.deploy(
        hectagonTreasury.address,
        hecta.address,
        staking.address,
        authority.address
    );
    console.log("Distributor: " + distributor.address);


    // Deploy busd bond
    const BUSDBond = await ethers.getContractFactory("HectagonV1BondDepository");
    const busdBond = await BUSDBond.deploy(
        hecta.address,
        busd.address,
        hectagonTreasury.address,
        MockDAO.address,
        zeroAddress,
        staking.address,
        authority.address
    )
    console.log("BUSDBond: " + busdBond.address);


    // Initial Bond Term
    await busdBond.initializeBondTerms(
        busdBondBCV,
        bondVestingLength,
        minBondPrice,
        maxBondPayout,
        bondFee,
        maxBondDebt,
        intialBondDebt
    )
    console.log("Busd bond initialize")

    // Console.log("Initialize Treasury")
    await hectagonTreasury.initialize();

    // Add Busd Bond 
    await hectagonTreasury.queueTimelock("2", busd.address, zeroAddress);
    await hectagonTreasury.queueTimelock("0", busdBond.address, zeroAddress);


    await sHECTA.setIndex(initialIndex);
    await sHECTA.setgHECTA(gHECTA.address);
    await sHECTA.initialize(staking.address, hectagonTreasury.address);


    // Add staking contract as distributor recipient
    await distributor.addRecipient(staking.address, initialRewardRate);
    console.log("Add staking contract as distributor recipient...");

    // queue and toggle reward manager
    await hectagonTreasury.queueTimelock("8", distributor.address, zeroAddress);


    // queue and execute deployer reserve depositor
    await hectagonTreasury.queueTimelock("0", deployer.address, zeroAddress);


    // queue and execute liquidity depositor
    await hectagonTreasury.queueTimelock("4", deployer.address, zeroAddress);
    console.log("queue and execute liquidity depositor: Done");


    // Approve the treasury to spend BUSD
    await busd.approve(hectagonTreasury.address, largeApproval);
    // Approve busd bonds to spend deployer's BUSD
    await busd.approve(busd.address, largeApproval);
    // Approve staking and staking helper contact to spend deployer's HECTA
    await hecta.approve(staking.address, largeApproval);
    console.log("Busd, hecta approve");


    // Authority set treasury as vault
    await authority.pushVault(hectagonTreasury.address, true);


    // Set distributor for staking
    await staking.setDistributor(distributor.address);


    // Deploy redeem helper
    const RedeemHelper = await ethers.getContractFactory("RedeemHelper");
    const redeemHelper = await RedeemHelper.deploy(authority.address);
    console.log("RedeemHelper: " + redeemHelper.address);

    // Add busd bond redeem helper
    await redeemHelper.addBondContract(busdBond.address);
    console.log("redeem helper add busd bond");


    await hectagonTreasury.execute("0");
    await hectagonTreasury.execute("1");
    await hectagonTreasury.execute("2");
    await hectagonTreasury.execute("3");

    // Treasury deposit
    await hectagonTreasury.deposit(
        "10000000000000000000000000",
        busd.address,
        "9900000000000000"
    );
    console.log("Treasury deposit")


    // Staking stake
    await staking.stake(deployer.address, "100000000000", true, true);
    console.log("Staking stake")


    const HectagonBondDepository = await ethers.getContractFactory("HectagonBondDepository");

    const hectagonBondDepository = await HectagonBondDepository.deploy(
        hecta.address,
        hectagonTreasury.address,
        authority.address
    )
    console.log("HectagonBondDepository: " + hectagonBondDepository.address);


    // Deploy Bond Teller
    const BondTeller = await ethers.getContractFactory("BondTeller");
    const bondTeller = await BondTeller.deploy(
        hectagonBondDepository.address,
        staking.address,
        hectagonTreasury.address,
        hecta.address,
        sHECTA.address,
        authority.address
    )
    console.log("BondTeller: " + bondTeller.address);


    // Execute tresury bond teller
    await hectagonTreasury.queueTimelock("8", bondTeller.address, hetagonBondingCalculator.address);
    await hectagonTreasury.execute("4");
    console.log("Treasury execute bond teller");


    // Set teller for bond depository
    await hectagonBondDepository.setTeller(bondTeller.address);
    console.log("Depository set teller");


    console.log("Deploy successfully");

}

main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
