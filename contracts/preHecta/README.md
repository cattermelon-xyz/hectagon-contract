# How the algo work?
1. In the beginning of a space, protocol virtually distribute `profit` to all pHecta holder accordingly to `{their ownership percentage of pHecta total supply} * {new minted Hecta from last space} * {percentage of pHecta ownership over Hecta}`
2. In a space, pHecta holder cannot `exercise` after commiting a `transfer`.
3. If a holder `transfer` pHecta to new owner, protocol will `transfer` the newly minted `profit` of the `current space` of the `existing holder` to the `receiver`
4. The accumulated `profit` of each holder is the maximum pHecta one can exercise for Hecta or `max_claim`
5. In order to exercise 1 Hecta, holder must:

 - Approve smartcontract to be to transfer `BUSD`, pHecta out of their wallet
 - Run the smartcontract of which will transfer 1 `BUSD` to the treasury, burn 1 pHecta then recalculate pHecta holder's `max_claim`
 6. At each point in time the claimed amount of pHeacta is less than 10% of total HECTA in circulation (total supply minus HECTA in the Treasury)


 # What is a space?
 A space is the time within 2 `rebase` action performed by the team. A space lasts approx 7 days.
In a `rebase` action, protocol will
- anchor the total number of Hecta and total number of pHecta for `pHecta exercising`
- distribute profit to all pHecta holder accordingly to their ownership percentage.
