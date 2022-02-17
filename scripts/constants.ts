export const CONTRACTS: Record<string, string> = {
    hecta: "HectagonERC20Token",
    sHecta: "sHectagon",
    gHecta: "gHECTA",
    pHecta: "pHectagon",
    tHecta: "THectagonERC20",
    staking: "HectagonStaking",
    distributor: "Distributor",
    treasury: "HectagonTreasury",
    bondDepo: "HectagonBondDepositoryV2",
    bondingCalculator: "HectagonBondingCalculator",
    authority: "HectagonAuthority",
    migrator: "HectagonTokenMigrator",
    circulatingSupply: "HectaCirculatingSupplyConrtact",
    redeemHelper: "RedeemHelper",
};

// Constructor Arguments
export const TREASURY_TIMELOCK = 0;

export const LARGE_APPROVAL = "100000000000000000000000000000000";

export const EPOCH_LENGTH_IN_SECONDS = "3600";
export const FIRST_EPOCH_NUMBER = "0";
export const FIRST_EPOCH_TIME = "1644896415";

// init system
export const INITIAL_REWARD_RATE = "3000";
export const INITIAL_INDEX = "1000000000";
//
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const BOUNTY_AMOUNT = "100000000";

// Bond setup
export const BUSD_BOND_BCV = "100000";
export const BOND_VESTING_LENGTH = "6000";
export const MIN_BOND_PRICE = "1000";
export const MAX_BOND_PAYOUT = "50";
export const BOND_FEE = "10000";
export const MAX_BOND_DEBT = "1000000000000000";
export const INTIAL_BOND_DEBT = "0";
export const INITIAL_MINT = "6000000000000000";
