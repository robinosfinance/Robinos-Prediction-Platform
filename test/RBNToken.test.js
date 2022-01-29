const assert = require("assert");
const ganache = require("ganache-cli");
const Web3 = require("web3");
const web3 = new Web3(ganache.provider({
    gasLimit: 1000000000000
}));

const contracts = require("../compile");

const tokenContract = contracts["RBNV2Token.sol"].RBNV2Token;

const uniswap = require("../compiled/uniswap.json");
const tether = require("../compiled/tether.json");
const {
    secondsInTheFuture
} = require("../helper");

let accounts, RBNToken, UniswapV2, TetherToken, getBalance;

const name = "Robinos Token V2";
const symbol = "RBNv2";
const initialSupply = 100000000;
const taxPercentage = 20;

const tetherInitialSupply = 100000000;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();

    UniswapV2 = await new web3.eth.Contract(uniswap.abi)
        .deploy({
            data: uniswap.bytecode,
            arguments: [accounts[0], accounts[1]]
        })
        .send({
            from: accounts[0],
            gas: '1000000000'
        });

    RBNToken = await new web3.eth.Contract(tokenContract.abi)
        .deploy({
            data: tokenContract.evm.bytecode.object,
            arguments: [name, symbol, initialSupply, accounts[0], taxPercentage]
        })
        .send({
            from: accounts[0],
            gas: '1000000000'
        });

    TetherToken = await new web3.eth.Contract(tether.abi)
        .deploy({
            data: tether.bytecode,
            arguments: [tetherInitialSupply, "Tether", "USDT", 18]
        })
        .send({
            from: accounts[0],
            gas: '1000000000'
        });

    RBNToken.methods.setUniswapRouter(UniswapV2.options.address)
        .send({
            from: accounts[0],
            gas: '10000000000'
        });

    getBalance = async account => RBNToken.methods
        .balanceOf(account)
        .call({
            from: accounts[0],
            gas: '10000000000'
        });
});

describe("Uniswap Router", () => {
    it("deploys successfully", () => {
        assert.ok(UniswapV2.options.address);
    });
});

describe("TetherToken", () => {
    it("deploys successfully", () => {
        assert.ok(TetherToken.options.address);
    });
});

describe("RBNV2Token", () => {
    it("deploys successfully", () => {
        assert.ok(RBNToken.options.address);
    });

    it("accepts uniswap contract", async () => {
        const rbnAmountDesired = 10000;
        const tetherAmountDesired = 10000;
        const rbnAmountMin = 10000;
        const tetherAmountMin = 10000;
        const deadline = secondsInTheFuture(60 * 10);

        const address = await RBNToken.methods
            .getUniswapRouterAddress()
            .call({
                from: accounts[0],
                gas: '10000000000'
            });
        assert.strictEqual(address, UniswapV2.options.address);



        TetherToken.methods
            .approve(RBNToken.options.address, tetherAmountDesired)
            .send({
                from: accounts[0],
                gas: '10000000000'
            })
            .then(async () => {
                const balance = await RBNToken.methods
                    .getBalance(TetherToken.options.address)
                    .call({
                        from: accounts[0],
                        gas: '10000000000'
                    });

                console.log(`balance ${balance}`);

                const originalBalance = await TetherToken.methods
                    .balanceOf(accounts[0])
                    .call({
                        from: accounts[0],
                        gas: '10000000000'
                    });

                console.log(`originalBalance ${originalBalance}`);

                // Currently method is in online testing !!!

                // RBNToken.methods
                //     .addLiquidity(
                //         TetherToken.options.address,
                //         rbnAmountDesired,
                //         tetherAmountDesired,
                //         rbnAmountMin,
                //         tetherAmountMin,
                //         accounts[0],
                //         deadline
                //     )
                //     .send({
                //         from: accounts[0],
                //         gas: '10000000000'
                //     });
            });


    });

    it("takes tax and allows owner to tag tax free addresses", async () => {
        const transferAmount = 1000;
        const expectedTax = (transferAmount * taxPercentage) / 100;
        const totalTransferAmount = transferAmount * 2 + expectedTax;
        let balanceBeforeTransfer, balanceAfterTransfer;


        RBNToken.methods
            .transfer(accounts[1], totalTransferAmount)
            .send({
                from: accounts[0],
                gas: '10000000000'
            })
            .then(async () => {
                const requestInstance = getBalance(accounts[0]);
                balanceBeforeTransfer = parseInt(await requestInstance);
                return requestInstance;
            })
            .then(() => RBNToken.methods
                .transfer(accounts[2], transferAmount)
                .send({
                    from: accounts[1],
                    gas: '10000000000'
                }))
            .then(async () => {
                const requestInstance = getBalance(accounts[0]);
                balanceAfterTransfer = parseInt(await requestInstance);
                const taxGained = balanceAfterTransfer - balanceBeforeTransfer;
                assert.strictEqual(taxGained, expectedTax);
            })
            .then(() => {
                RBNToken.methods
                    .setTaxFreeAddress(accounts[2], true)
                    .send({
                        from: accounts[0],
                        gas: '10000000000'
                    })
                    .then(async () => {
                        const requestInstance = getBalance(accounts[0]);
                        balanceBeforeTransfer = parseInt(await requestInstance);
                        return requestInstance;
                    })
                    .then(() => RBNToken.methods
                        .transfer(accounts[2], transferAmount)
                        .send({
                            from: accounts[1],
                            gas: '10000000000'
                        }))
                    .then(async () => {
                        const requestInstance = getBalance(accounts[0]);
                        balanceAfterTransfer = parseInt(await requestInstance);
                        assert.strictEqual(balanceAfterTransfer, balanceBeforeTransfer);
                    });
            });

    });
});