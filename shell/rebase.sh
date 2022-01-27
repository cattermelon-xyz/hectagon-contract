#!/bin/bash
# This file is used to run cronjob for rebase() in staking smart contract
# crpntab -e, then edit
# 0 0,8,16 * * * $src/shell/rebase.sh >> /path/to/logfile/output.log

PWD=$(pwd)
cd $PWD

network=$1

if [[ "$network" =~ ^(testnet|binance|rinkeby)$ ]]; then
    echo "network: $network"
else
    echo "network is not valid"
fi

npm run cron:rebase:$network