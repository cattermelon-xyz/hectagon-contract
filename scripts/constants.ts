export const CONTRACTS: Record<string, string> = {
    hecta: "HectagonERC20Token",
    sHecta: "sHectagon",
    gHecta: "gHECTA",
    pHecta: "PHecta",
    tHecta: "tHecta",
    staking: "HectagonStaking",
    distributor: "Distributor",
    treasury: "HectagonTreasury",
    bondDepo: "HectagonBondDepositoryV2",
    bondingCalculator: "HectagonBondingCalculator",
    authority: "HectagonAuthority",
    migrator: "HectagonTokenMigrator",
    circulatingSupply: "HectaCirculatingSupply",
    redeemHelper: "RedeemHelper",
    snapshot: "Snapshot",
};

export const ADDRESSES: Record<string, string> = {
    busd: "0x9e3F47234e72e222348552e028ceEB8f4C428d26",
    treasury: "0x4250EA413cB2fD4A8fDc5cC73283d0070a52FB91",
};

// Constructor Arguments
export const TREASURY_TIMELOCK = 0;

export const LARGE_APPROVAL = "100000000000000000000000000000000";

export const EPOCH_LENGTH_IN_SECONDS = "28800"; // 8 hours
export const FIRST_EPOCH_NUMBER = "0";
export const FIRST_EPOCH_TIME = "1648684800";

// init system
export const INITIAL_REWARD_RATE = "5000";
export const INITIAL_INDEX = "1000000000";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const BOUNTY_AMOUNT = "100000000";
