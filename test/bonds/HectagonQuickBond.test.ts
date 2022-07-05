import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import {
    IBondDepository,
    HectagonQuickBond,
    HectagonQuickBond__factory,
    HectagonERC20Token,
    MockERC20,
    MockERC20__factory,
    IUniswapV2Router,
    IUniswapV2Router__factory,
    IUniswapV2Factory,
    IUniswapV2Factory__factory,
    IUniswapV2Pair,
    IUniswapV2Pair__factory,
    IWETH,
    IWETH__factory,
    HectagonAuthority__factory,
    HectagonERC20Token__factory,
} from "../../types";
import { BigNumber } from "ethers";

chai.use(smock.matchers);

describe("HectagonQuickBond", () => {
    const largeAmount = BigNumber.from("1000000000000000000000000000"); // 1 billions

    // bsc mainnet
    const swapFactoryAddress = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
    const swapRouterAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    const wethAddress = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

    const ZERO_ADDRESS: string = ethers.utils.getAddress(
        "0x0000000000000000000000000000000000000000"
    );

    let owner: SignerWithAddress;
    let bondDepositoryFake: FakeContract<IBondDepository>;
    let quickBond: HectagonQuickBond;
    let cake: MockERC20;
    let busd: MockERC20;
    let hecta: HectagonERC20Token;
    let uniswapRouter: IUniswapV2Router;
    let uniswapFatory: IUniswapV2Factory;
    let weth: IWETH;

    function calculateSwapInAmount(reserveIn: BigNumber, userIn: BigNumber): BigNumber {
        return sqrt(reserveIn.mul(userIn.mul(399000000).add(reserveIn.mul(399000625))))
            .sub(reserveIn.mul(19975))
            .div(19950);
    }

    const ONE = BigNumber.from(1);
    const TWO = BigNumber.from(2);

    function sqrt(value: BigNumber): BigNumber {
        const x = value;
        let z = x.add(ONE).div(TWO);
        let y = x;
        while (z.sub(y).isNegative()) {
            y = z;
            z = x.div(z).add(z).div(TWO);
        }
        return y;
    }

    function getAmountOut(
        amountIn: BigNumber,
        reserveIn: BigNumber,
        reserveOut: BigNumber
    ): BigNumber {
        const amountInWithFee = amountIn.mul(9975);
        const numerator = amountInWithFee.mul(reserveOut);
        const denominator = reserveIn.mul(10000).add(amountInWithFee);
        return numerator.div(denominator);
    }

    beforeEach(async () => {
        [owner] = await ethers.getSigners();

        bondDepositoryFake = await smock.fake<IBondDepository>("IBondDepository");
        quickBond = await new HectagonQuickBond__factory(owner).deploy();
    });

    describe("updateDepo", () => {
        it("should update correctlly", async () => {
            await quickBond.updateDepo(bondDepositoryFake.address);
            const zapBondDepo = await quickBond.depo();
            await expect(zapBondDepo).to.be.eq(bondDepositoryFake.address);
        });
    });

    describe("quickLPBond", () => {
        const cakeToAddLiquidity = BigNumber.from("10000000000000000000000"); // 1000 (cake)
        const busdToAddLiquidity = BigNumber.from("100000000000000000000000"); // 10000 (busd)
        const hectaToAddLiquidity = BigNumber.from("5000000000000"); // 5000 (hecta)
        const wethToAddLiquidity = BigNumber.from("100000000000000000000"); // 100 (weth)
        let hectaBusdAddress: string;
        const hectaBusdPriceInHecta = Math.ceil(
            (2 * 10000 * 1e18) / Math.sqrt(5000 * 1e9 * 10000 * 1e18)
        );

        const premintHecta = BigNumber.from("100000000000000"); // 100000 Hecta

        let busdHectaTotalSupply: BigNumber;

        beforeEach(async () => {
            cake = await new MockERC20__factory(owner).deploy("Cake", "CAKE", 18);
            busd = await new MockERC20__factory(owner).deploy("BUSD", "BUSD", 18);

            await cake.mint(owner.address, largeAmount); // 1010 cake, so after add liquidity, owner have 10 cake left
            await busd.mint(owner.address, largeAmount);

            const authority = await new HectagonAuthority__factory(owner).deploy(
                owner.address,
                owner.address,
                owner.address,
                owner.address
            );
            await authority.deployed();

            hecta = await new HectagonERC20Token__factory(owner).deploy(authority.address);

            uniswapFatory = await IUniswapV2Factory__factory.connect(swapFactoryAddress, owner);
            uniswapRouter = await IUniswapV2Router__factory.connect(swapRouterAddress, owner);
            weth = await IWETH__factory.connect(wethAddress, owner);
            await weth.deposit({ value: wethToAddLiquidity });
            await hecta.mint(owner.address, premintHecta);

            await cake.approve(uniswapRouter.address, largeAmount);
            await busd.approve(uniswapRouter.address, largeAmount);
            await hecta.approve(uniswapRouter.address, largeAmount);
            await weth.approve(uniswapRouter.address, largeAmount);

            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestampBefore = blockBefore.timestamp;

            await Promise.all([
                uniswapRouter.addLiquidity(
                    cake.address,
                    busd.address,
                    cakeToAddLiquidity,
                    busdToAddLiquidity,
                    cakeToAddLiquidity,
                    busdToAddLiquidity,
                    owner.address,
                    timestampBefore + 10
                ),
                uniswapRouter.addLiquidity(
                    hecta.address,
                    busd.address,
                    hectaToAddLiquidity,
                    busdToAddLiquidity,
                    hectaToAddLiquidity,
                    busdToAddLiquidity,
                    owner.address,
                    timestampBefore + 10
                ),
                uniswapRouter.addLiquidity(
                    weth.address,
                    busd.address,
                    wethToAddLiquidity,
                    busdToAddLiquidity,
                    wethToAddLiquidity,
                    busdToAddLiquidity,
                    owner.address,
                    timestampBefore + 10
                ),
            ]);

            hectaBusdAddress = await uniswapFatory.getPair(hecta.address, busd.address);

            const busdHectaPair: IUniswapV2Pair = await IUniswapV2Pair__factory.connect(
                hectaBusdAddress,
                owner
            );
            busdHectaTotalSupply = await busdHectaPair.totalSupply();
            await quickBond.updateDepo(bondDepositoryFake.address);
        });

        it("bond with native coin should send value within when call smartcontact", async () => {
            const coinSwapAmount = ethers.utils.parseEther("1");
            await expect(
                quickBond.quickLPBond(
                    ZERO_ADDRESS,
                    hectaBusdAddress,
                    [ZERO_ADDRESS, busd.address],
                    coinSwapAmount,
                    0,
                    true,
                    false,
                    owner.address,
                    hectaBusdPriceInHecta,
                    "0"
                )
            ).to.be.revertedWith("No BNB sent");
        });

        it("bond with token must have amount greater than 0", async () => {
            await expect(
                quickBond.quickLPBond(
                    cake.address,
                    hectaBusdAddress,
                    [ZERO_ADDRESS, busd.address],
                    0,
                    0,
                    true,
                    false,
                    owner.address,
                    hectaBusdPriceInHecta,
                    "0"
                )
            ).to.be.revertedWith("Invalid token amount");
        });

        it("bond with token should not send ether within", async () => {
            const coinSwapAmount = ethers.utils.parseEther("1");
            await expect(
                quickBond.quickLPBond(
                    cake.address,
                    hectaBusdAddress,
                    [ZERO_ADDRESS, busd.address],
                    coinSwapAmount,
                    0,
                    true,
                    false,
                    owner.address,
                    hectaBusdPriceInHecta,
                    "0",
                    { value: coinSwapAmount }
                )
            ).to.be.revertedWith("BNB sent with token");
        });

        it("_shouldSellEntireBalance only true if sender is smart contract", async () => {
            const coinSwapAmount = ethers.utils.parseEther("1");
            await expect(
                quickBond.quickLPBond(
                    cake.address,
                    hectaBusdAddress,
                    [ZERO_ADDRESS, busd.address],
                    coinSwapAmount,
                    0,
                    true,
                    true,
                    owner.address,
                    hectaBusdPriceInHecta,
                    "0"
                )
            ).to.be.revertedWith("ERR: shouldSellEntireBalance is true for EOA");
        });

        it("bond with BUSD to get HECTA-BUSD bond", async () => {
            const coinSwapAmount = ethers.utils.parseEther("100");
            await busd.approve(quickBond.address, largeAmount);

            // calculate busd amout to swap
            const swapInAmount = calculateSwapInAmount(busdToAddLiquidity, coinSwapAmount);

            // busd need to add liquidity
            const amountLeft = coinSwapAmount.sub(swapInAmount);
            // => need to caculate hecta receive then calcualte LP token should recive after add liquidity
            const busdInPoolAfterSwap = busdToAddLiquidity.add(swapInAmount);

            const hectaReceived = getAmountOut(
                swapInAmount,
                busdToAddLiquidity,
                hectaToAddLiquidity
            );
            const hectaInPoolAfterSwap = hectaToAddLiquidity.sub(hectaReceived);

            // calculate LP token will receive when add liquidity amountLeft and hectaReceived
            let liquidity;
            const liquidity1 = hectaReceived.mul(busdHectaTotalSupply).div(hectaInPoolAfterSwap);
            const liquidity2 = amountLeft.mul(busdHectaTotalSupply).div(busdInPoolAfterSwap);
            if (liquidity1.gt(liquidity2)) {
                liquidity = liquidity2;
            } else {
                liquidity = liquidity1;
            }
            bondDepositoryFake.deposit
                .whenCalledWith(
                    0,
                    "353022732780419",
                    hectaBusdPriceInHecta,
                    owner.address, // depositor
                    owner.address
                )
                .returns([10, 0, 0]);

            const tx = quickBond.quickLPBond(
                busd.address,
                hectaBusdAddress,
                [],
                coinSwapAmount,
                10,
                true,
                false,
                owner.address,
                hectaBusdPriceInHecta,
                "0"
            );

            await expect(tx)
                .to.emit(quickBond, "QuickBond")
                .withArgs(owner.address, hectaBusdAddress, 10, owner.address);
        });

        it("bond with BUSD to get HECTA-BUSD bond but High Slippage", async () => {
            const coinSwapAmount = ethers.utils.parseEther("100");
            await busd.approve(quickBond.address, largeAmount);

            // calculate busd amout to swap
            const swapInAmount = calculateSwapInAmount(busdToAddLiquidity, coinSwapAmount);

            // busd need to add liquidity
            const amountLeft = coinSwapAmount.sub(swapInAmount);
            // => need to caculate hecta receive then calcualte LP token should recive after add liquidity
            const busdInPoolAfterSwap = busdToAddLiquidity.add(swapInAmount);

            const hectaReceived = getAmountOut(
                swapInAmount,
                busdToAddLiquidity,
                hectaToAddLiquidity
            );
            const hectaInPoolAfterSwap = hectaToAddLiquidity.sub(hectaReceived);

            // calculate LP token will receive when add liquidity amountLeft and hectaReceived
            let liquidity;
            const liquidity1 = hectaReceived.mul(busdHectaTotalSupply).div(hectaInPoolAfterSwap);
            const liquidity2 = amountLeft.mul(busdHectaTotalSupply).div(busdInPoolAfterSwap);
            if (liquidity1.gt(liquidity2)) {
                liquidity = liquidity2;
            } else {
                liquidity = liquidity1;
            }

            bondDepositoryFake.deposit
                .whenCalledWith(
                    0,
                    liquidity,
                    hectaBusdPriceInHecta,
                    owner.address, // depositor
                    owner.address
                )
                .returns([9, 0, 0]);

            const tx = quickBond.quickLPBond(
                busd.address,
                hectaBusdAddress,
                [],
                coinSwapAmount,
                10,
                true,
                false,
                owner.address,
                hectaBusdPriceInHecta,
                "0"
            );

            await expect(tx).to.revertedWith("High Slippage");
        });

        it("bond with Cake (or any ECR20 token) to get HECTA-BUSD bond", async () => {
            const coinSwapAmount = ethers.utils.parseEther("100");
            await cake.approve(quickBond.address, largeAmount);
            const busdReceived = getAmountOut(
                coinSwapAmount,
                cakeToAddLiquidity,
                busdToAddLiquidity
            );
            // calculate busd amout to swap
            const busdSwapInAmount = calculateSwapInAmount(busdToAddLiquidity, busdReceived);

            // busd need to add liquidity
            const amountLeft = busdReceived.sub(busdSwapInAmount);
            // => need to caculate hecta receive then calcualte LP token should recive after add liquidity
            const busdInPoolAfterSwap = busdToAddLiquidity.add(busdSwapInAmount);

            const hectaReceived = getAmountOut(
                busdSwapInAmount,
                busdToAddLiquidity,
                hectaToAddLiquidity
            );
            const hectaInPoolAfterSwap = hectaToAddLiquidity.sub(hectaReceived);

            // calculate LP token will receive when add liquidity amountLeft and hectaReceived
            let liquidity;
            const liquidity1 = hectaReceived.mul(busdHectaTotalSupply).div(hectaInPoolAfterSwap);
            const liquidity2 = amountLeft.mul(busdHectaTotalSupply).div(busdInPoolAfterSwap);
            if (liquidity1.gt(liquidity2)) {
                liquidity = liquidity2;
            } else {
                liquidity = liquidity1;
            }

            bondDepositoryFake.deposit
                .whenCalledWith(
                    0,
                    "3478931502289142",
                    hectaBusdPriceInHecta,
                    owner.address, // depositor
                    owner.address
                )
                .returns([10, 0, 0]);

            const tx = quickBond.quickLPBond(
                cake.address,
                hectaBusdAddress,
                [cake.address, busd.address],
                coinSwapAmount,
                0,
                true,
                false,
                owner.address,
                hectaBusdPriceInHecta,
                "0"
            );

            await expect(tx)
                .to.emit(quickBond, "QuickBond")
                .withArgs(owner.address, hectaBusdAddress, 10, owner.address);
        });

        it("bond with native coin (BNB) to get HECTA-BUSD bond", async () => {
            const coinSwapAmount = ethers.utils.parseEther("100");
            const busdReceived = getAmountOut(
                coinSwapAmount,
                wethToAddLiquidity,
                busdToAddLiquidity
            );
            // calculate busd amout to swap
            const busdSwapInAmount = calculateSwapInAmount(busdToAddLiquidity, busdReceived);

            // busd need to add liquidity
            const amountLeft = busdReceived.sub(busdSwapInAmount);
            // => need to caculate hecta receive then calcualte LP token should recive after add liquidity
            const busdInPoolAfterSwap = busdToAddLiquidity.add(busdSwapInAmount);

            const hectaReceived = getAmountOut(
                busdSwapInAmount,
                busdToAddLiquidity,
                hectaToAddLiquidity
            );
            const hectaInPoolAfterSwap = hectaToAddLiquidity.sub(hectaReceived);

            // calculate LP token will receive when add liquidity amountLeft and hectaReceived
            let liquidity;
            const liquidity1 = hectaReceived.mul(busdHectaTotalSupply).div(hectaInPoolAfterSwap);
            const liquidity2 = amountLeft.mul(busdHectaTotalSupply).div(busdInPoolAfterSwap);
            if (liquidity1.gt(liquidity2)) {
                liquidity = liquidity2;
            } else {
                liquidity = liquidity1;
            }

            bondDepositoryFake.deposit
                .whenCalledWith(
                    0,
                    "158550948234515669",
                    hectaBusdPriceInHecta,
                    owner.address, // depositor
                    owner.address
                )
                .returns([10, 0, 0]);

            const tx = quickBond.quickLPBond(
                ZERO_ADDRESS,
                hectaBusdAddress,
                [weth.address, busd.address],
                coinSwapAmount,
                0,
                true,
                false,
                owner.address,
                hectaBusdPriceInHecta,
                "0",
                { value: coinSwapAmount }
            );

            await expect(tx)
                .to.emit(quickBond, "QuickBond")
                .withArgs(owner.address, hectaBusdAddress, 10, owner.address);
        });
    });

    describe("quickStableBond", () => {
        const cakeToAddLiquidity = BigNumber.from("10000000000000000000000"); // 1000 (cake)
        const busdToAddLiquidity = BigNumber.from("100000000000000000000000"); // 10000 (busd)
        const hectaToAddLiquidity = BigNumber.from("5000000000000"); // 5000 (hecta)
        const wethToAddLiquidity = BigNumber.from("100000000000000000000"); // 1000 (weth)

        const premintHecta = BigNumber.from("100000000000000"); // 100000 Hecta

        const hectaPriceInBusd: BigNumber = busdToAddLiquidity.div(hectaToAddLiquidity);

        beforeEach(async () => {
            cake = await new MockERC20__factory(owner).deploy("Cake", "CAKE", 18);
            busd = await new MockERC20__factory(owner).deploy("BUSD", "BUSD", 18);

            await cake.mint(owner.address, largeAmount); // 1010 cake, so after add liquidity, owner have 10 cake left
            await busd.mint(owner.address, largeAmount);

            const authority = await new HectagonAuthority__factory(owner).deploy(
                owner.address,
                owner.address,
                owner.address,
                owner.address
            );
            await authority.deployed();

            hecta = await new HectagonERC20Token__factory(owner).deploy(authority.address);

            uniswapFatory = await IUniswapV2Factory__factory.connect(swapFactoryAddress, owner);
            uniswapRouter = await IUniswapV2Router__factory.connect(swapRouterAddress, owner);
            weth = await IWETH__factory.connect(wethAddress, owner);
            await weth.deposit({ value: wethToAddLiquidity });
            await hecta.mint(owner.address, premintHecta);

            await cake.approve(uniswapRouter.address, largeAmount);
            await busd.approve(uniswapRouter.address, largeAmount);
            await hecta.approve(uniswapRouter.address, largeAmount);
            await weth.approve(uniswapRouter.address, largeAmount);

            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestampBefore = blockBefore.timestamp;

            await Promise.all([
                uniswapRouter.addLiquidity(
                    cake.address,
                    busd.address,
                    cakeToAddLiquidity,
                    busdToAddLiquidity,
                    cakeToAddLiquidity,
                    busdToAddLiquidity,
                    owner.address,
                    timestampBefore + 10
                ),
                uniswapRouter.addLiquidity(
                    hecta.address,
                    busd.address,
                    hectaToAddLiquidity,
                    busdToAddLiquidity,
                    hectaToAddLiquidity,
                    busdToAddLiquidity,
                    owner.address,
                    timestampBefore + 10
                ),
                uniswapRouter.addLiquidity(
                    weth.address,
                    busd.address,
                    wethToAddLiquidity,
                    busdToAddLiquidity,
                    wethToAddLiquidity,
                    busdToAddLiquidity,
                    owner.address,
                    timestampBefore + 10
                ),
            ]);

            await quickBond.updateDepo(bondDepositoryFake.address);
        });

        it("bond with native coin should send value within when call smartcontact", async () => {
            const coinSwapAmount = ethers.utils.parseEther("1");
            await expect(
                quickBond.quickStableBond(
                    ZERO_ADDRESS,
                    busd.address,
                    [ZERO_ADDRESS, busd.address],
                    coinSwapAmount,
                    false,
                    owner.address,
                    0,
                    0
                )
            ).to.be.revertedWith("No BNB sent");
        });

        it("bond with token must have amount greater than 0", async () => {
            await expect(
                quickBond.quickStableBond(
                    cake.address,
                    busd.address,
                    [ZERO_ADDRESS, busd.address],
                    0,
                    false,
                    owner.address,
                    0,
                    0
                )
            ).to.be.revertedWith("Invalid token amount");
        });

        it("bond with token should not send ether within", async () => {
            const coinSwapAmount = ethers.utils.parseEther("1");
            await expect(
                quickBond.quickStableBond(
                    cake.address,
                    busd.address,
                    [ZERO_ADDRESS, busd.address],
                    coinSwapAmount,
                    false,
                    owner.address,
                    0,
                    0,
                    { value: coinSwapAmount }
                )
            ).to.be.revertedWith("BNB sent with token");
        });

        it("bond with Cake (or any ECR20 token) to get Stable bond", async () => {
            const coinSwapAmount = ethers.utils.parseEther("100");
            await cake.approve(quickBond.address, largeAmount);
            const busdReceived = getAmountOut(
                coinSwapAmount,
                cakeToAddLiquidity,
                busdToAddLiquidity
            );

            bondDepositoryFake.deposit
                .whenCalledWith(
                    0,
                    busdReceived,
                    hectaPriceInBusd,
                    owner.address, // depositor
                    owner.address
                )
                .returns([10, 0, 0]);

            const tx = quickBond.quickStableBond(
                cake.address,
                busd.address,
                [cake.address, busd.address],
                coinSwapAmount,
                false,
                owner.address,
                hectaPriceInBusd,
                0
            );

            await expect(tx)
                .to.emit(quickBond, "QuickBond")
                .withArgs(owner.address, busd.address, 10, owner.address);
        });

        it("bond with native coin (BNB) to get Stable bond", async () => {
            const coinSwapAmount = ethers.utils.parseEther("100");
            const busdReceived = getAmountOut(
                coinSwapAmount,
                wethToAddLiquidity,
                busdToAddLiquidity
            );

            bondDepositoryFake.deposit
                .whenCalledWith(
                    0,
                    busdReceived,
                    hectaPriceInBusd,
                    owner.address, // depositor
                    owner.address
                )
                .returns([10, 0, 0]);

            const tx = quickBond.quickStableBond(
                ZERO_ADDRESS,
                busd.address,
                [cake.address, busd.address],
                coinSwapAmount,
                false,
                owner.address,
                hectaPriceInBusd,
                0,
                { value: coinSwapAmount }
            );

            await expect(tx)
                .to.emit(quickBond, "QuickBond")
                .withArgs(owner.address, busd.address, 10, owner.address);
        });
    });
});
