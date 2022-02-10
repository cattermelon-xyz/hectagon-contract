const { ethers } = require("hardhat");
const { resolve } = require("path");
const { config } = require("dotenv");
const retry = require("retry");
const { NonceManager } = require("@ethersproject/experimental");

config({ path: resolve(__dirname, "./.env") });
const stakingAddress = process.env.STAKING_ADDRESS;

async function retryer() {
    let operation = retry.operation({ retries: 10, factor: 1, minTimeout: 10000 }); // retry 10 times each 10 seconds
    const [owner] = await ethers.getSigners();
    console.log("[Cron][Rebase] Owner:", owner.address);
    const managedSigner = new NonceManager(owner);
    const contract = await ethers.getContractAt("[Cron][Rebase] HectagonStaking", stakingAddress);
    const contractWithSigner = contract.connect(managedSigner);

    return new Promise((resolve, reject) => {
        operation.attempt(async (currentAttempt) => {
            console.log("[Cron][Rebase] currentAttempt #:", currentAttempt);
            let err = false;
            let secondsToNextEpoch;
            try {
                secondsToNextEpoch = await contractWithSigner.secondsToNextEpoch();
            } catch (error) {
                console.log(error);
                secondsToNextEpoch = 0;
            }
            console.log("[Cron][Rebase] secondsToNextEpoch", secondsToNextEpoch);
            if (secondsToNextEpoch === 0) {
                try {
                    const tx = await contractWithSigner.rebase();
                    console.log("[Cron][Rebase] rebase tx", tx);
                } catch (error) {
                    console.log(error);
                    err = true;
                }
            }

            if (operation.retry(err)) {
                return;
            }
        });
    });
}

async function main() {
    if (!stakingAddress) {
        throw Error("[Cron][Rebase] process.env.STAKING_ADDRESS is required");
    }
    console.log("[Cron][Rebase] Start");
    await retryer();
    console.log("[Cron][Rebase] End");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
