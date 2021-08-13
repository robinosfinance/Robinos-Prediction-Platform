const assert = require("assert");
const ganache = require("ganache-cli");
const Web3 = require("web3");
const web3 = new Web3(ganache.provider({
    gasLimit: 1000000000000
}));

const contracts = require("../compile");
const tokenContract = contracts["DBToken.sol"].DBToken;
const salesContract = contracts["DBTokenSale.sol"].DBTokenSale;

// Local instance of the USDT contract used for testing
const tether = require("./tether_compiled.json");


let accounts;
let rate;
let DBTokenSale;
var DBTokens;

// Teams and event code default info for testing
let teams = [
    "Manchester",
    "Liverpool",
    "Arsenal"
];
const eventCode = "EPL";
const totalSupply = 1 * 10 ** 12;
let minuteInTheFuture = Math.floor(Date.now() / 1000) + 60; // We just calculate the timestamp to give us enough time in the sale to finish all of the tests


beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    DBTokens = [];



    /**
     *  @dev DBTokens for each team from the array is initialized. Only one Event code in the testing provided.
     */
    teams.forEach(async team => {
        let token = await new web3.eth.Contract(tokenContract.abi)
            .deploy({
                data: tokenContract.evm.bytecode.object,
                arguments: ["DBToken", "DBT", eventCode, team, totalSupply]
            })
            .send({
                from: accounts[0],
                gas: '1000000000'
            });
        DBTokens.push(token);
    });


    /**
     *  @dev Local USDT instance. Address accounts[0] is the owner of the contract and is immediately minted totalSupply amount of tokens on initialization
     */
    TetherToken = await new web3.eth.Contract(tether.abi)
        .deploy({
            data: tether.bytecode,
            arguments: [totalSupply, "Tether", "USDT", 18]
        })
        .send({
            from: accounts[0],
            gas: '1000000000'
        });

    DBTokenSale = await new web3.eth.Contract(salesContract.abi)
        .deploy({
            data: salesContract.evm.bytecode.object,
            arguments: [TetherToken.options.address, accounts[1]]
        })
        .send({
            from: accounts[0],
            gas: '1000000000'
        });

    rate = await DBTokenSale.methods.rate().call({
        from: accounts[0]
    });

    DBTokens.forEach(async DBToken => {
        await DBToken.methods.transferOwnership(DBTokenSale.options.address).send({
            from: accounts[0]
        });
    });

});

describe("DBTokens", () => {
    it("all deployed successfully", () => {
        DBTokens.forEach(async (DBToken, index) => {
            let tokenTeamName = await DBToken.methods.teamName().call({
                from: accounts[0]
            });
            assert.ok(DBToken.options.address); // Check the address
            assert.strictEqual(tokenTeamName, teams[index]); // Compare the team names from the tokens with the given team names in the array above
        });
    });
});

describe("TetherToken", () => {
    it("deploys successfully", () => {
        assert.ok(TetherToken.options.address);
    });

    it("allows user to approve funds for transfer", async () => {

        /**
         * @dev This test is required to work for the DBTokenSale purchase to work below
         */
        await TetherToken.methods.approve(DBTokenSale.options.address, 200).send({
            from: accounts[0]
        });

        let allowance = await TetherToken.methods.allowance(accounts[0], DBTokenSale.options.address).call({
            from: accounts[0]
        });

        assert.strictEqual(allowance, '200');
    });
});

describe("DBTokenSale", () => {
    it("deploys successfully", () => {
        assert.ok(DBTokenSale.options.address);
    });


    it("accepts DBToken references", async () => {
        let tokenAddress;
        await DBTokens.forEach(async (DBToken, index) => {

            /**
             *  @dev Each DBToken instance is passed as a reference to the DBTokenSale contract. Arguments eventCode and teamName are used for security purposes
             */
            await DBTokenSale.methods.addDBTokenReference(DBToken.options.address, eventCode, teams[index], 0)
                .send({
                    from: accounts[0],
                    gas: '10000000000'
                });

            tokenAddress = await DBTokenSale.methods.getToken(eventCode, teams[index])
                .call({
                    from: accounts[0],
                    gas: '10000000000'
                });
            assert.ok(tokenAddress);
        });
    });

    it("allows to start, end and read sale time", async () => {
        /**
         *  @dev We have 3 tests for checking the sale status. This functions are available for any account to use.
         */
        let futureTime = Math.floor(Date.now() / 1000) + 60;
        let sale;

        const isSaleOn = async () => {
            return await DBTokenSale.methods.isSaleOn().call({
                from: accounts[0]
            });
        };

        // Sale start and end times have not yet been defined. We expect sale not to be active.
        sale = await isSaleOn();
        assert(!sale.saleActive);

        // Sale start set as 0. This means the sale will start immediately and we expect the sale update time to be a timestamp in the future
        await DBTokenSale.methods.setSaleStartEnd(0, futureTime).send({
            from: accounts[0]
        });
        sale = await isSaleOn();
        assert(sale.saleActive);
        assert(parseInt(sale.saleUpdateTime) >= Math.floor(Date.now() / 1000));

        // Sale has been prematurely ended by the owner of DBTokenSale contract. We expect the sale not to be active and saleUpdateTime to be 0 since there is not future sale update time
        await DBTokenSale.methods.endSaleNow().send({
            from: accounts[0]
        });
        sale = await isSaleOn();
        assert(!sale.saleActive);
        assert.strictEqual(sale.saleUpdateTime, '0');
    });

    it("allows exchange of DBTokens <> USDT and withdrawal of contract funds", async () => {

        /**
         * @dev This is the main and the most complicated test of all. The test is made up of multiple steps:
         *  1) We add at least one DBToken reference to the DBTokenSale contract
         *  2) We mint a certain amount of the added DBTokens to the sale contract which can be sold for USDT 
         *     (This function can later be modified so it automatically fires off in the addDBTokenReference function)
         *  3) The user who is looking to purchase DBTokens from our contract will need to approve some the required amount of tokens for transfer to our contract address
         *  4) The owner of DBTokenSale contract will start a sale immediately. It is not possible to purchase DBTokens unless a sale is active.
         *  5) The user tries to purchase a certain amount of DBTokens.
         *  6) We calculate the expected balances of the user and contract USDT and DBTokens and we compare them with the actual balances we received from the contracts
         *  7) The owner of DBTokenSale contract will withdraw the funds to the withdrawable address (in this case it's accounts[1]) and we will check the balance of USDT tokens later
         */
        let contractDBBalance, contractUSDTBalance;
        let userDBBalance, safeUSDTBalance;

        let teamName = teams[0];
        let DBToken = DBTokens[0];

        let saleContractBalance = 10000000;
        let purchaseUSDTFunds = 200;
        let purchaseDBTfunds = purchaseUSDTFunds * rate;

        const getTetherBalance = async address => {
            return await TetherToken.methods.balanceOf(address)
                .call({
                    from: accounts[0]
                });
        }

        const getDBTokenBalance = async address => {
            return await DBToken.methods.balanceOf(address)
                .call({
                    from: accounts[0]
                });
        }

        await DBTokenSale.methods.addDBTokenReference(DBToken.options.address, eventCode, teamName, saleContractBalance)
            .send({
                from: accounts[0],
                gas: '10000000000'
            });


        await TetherToken.methods.approve(DBTokenSale.options.address, 250)
            .send({
                from: accounts[0]
            });

        // If we set start argument to 0, the sale will start immediately.
        await DBTokenSale.methods.setSaleStartEnd(0, minuteInTheFuture)
            .send({
                from: accounts[0],
                gas: '10000000000'
            });


        await DBTokenSale.methods.buyTokens(eventCode, teamName, purchaseUSDTFunds)
            .send({
                from: accounts[0],
                gas: '10000000000'
            });


        contractUSDTBalance = parseInt(await getTetherBalance(DBTokenSale.options.address));
        contractDBBalance = parseInt(await getDBTokenBalance(DBTokenSale.options.address));
        userDBBalance = parseInt(await getDBTokenBalance(accounts[0]));

        // Variables purchaseUSDTFunds and purchaseDBTfunds can be different only if DBTokenSale.rate() != 1
        assert.strictEqual(contractUSDTBalance, purchaseUSDTFunds);
        assert.strictEqual(contractDBBalance, saleContractBalance - purchaseDBTfunds);
        assert.strictEqual(userDBBalance, purchaseDBTfunds);


        await DBTokenSale.methods.withdraw(purchaseUSDTFunds)
            .send({
                from: accounts[0],
                gas: '10000000000'
            });

        // We expect the withdrawn funds to be on accounts[1] as that was set as the withdrawable address in the DBTokenSale constructor
        safeUSDTBalance = parseInt(await getTetherBalance(accounts[1]));
        assert.strictEqual(safeUSDTBalance, purchaseUSDTFunds);

    });

    it("allows owner to record sold supply and mint 1% at the end of sale", async () => {
        let tokenInitialSupply = 100000000;
        let tokenPurchaseAmount = 100000;


        const tokenBalancesEqual = async (checkAmount = null) => {
            let amount, previousAmount;
            for (let i = 0; i < DBTokens.length; i++) {
                amount = parseInt(await DBTokenSale.methods.balanceOf(eventCode, teams[i], accounts[0]).call({
                    from: accounts[0]
                }));
                if (checkAmount && amount !== checkAmount) return null;
                else if (previousAmount && amount !== previousAmount) return null;
                previousAmount = amount;
            }
            return amount;
        }

        await TetherToken.methods.approve(DBTokenSale.options.address, tokenPurchaseAmount * DBTokens.length)
            .send({
                from: accounts[0]
            });

        await DBTokenSale.methods.setSaleStartEnd(0, minuteInTheFuture)
            .send({
                from: accounts[0],
                gas: '10000000000'
            });

        for (let i = 0; i < DBTokens.length; i++) {
            await DBTokenSale.methods.addDBTokenReference(DBTokens[i].options.address, eventCode, teams[i], tokenInitialSupply)
                .send({
                    from: accounts[0],
                    gas: '10000000000'
                });

            await DBTokenSale.methods.buyTokens(eventCode, teams[i], tokenPurchaseAmount)
                .send({
                    from: accounts[0],
                    gas: '10000000000'
                });
        }

        let tokenBalances = await tokenBalancesEqual();

        await DBTokenSale.methods.endSaleNow().send({
            from: accounts[0]
        });
        await DBTokenSale.methods.mintOnePercentToOwner().send({
            from: accounts[0],
            gas: '10000000000'
        });
        let tokensSold = await DBTokenSale.methods.tokensSold().call({
            from: accounts[0]
        });
        tokenBalances = await tokenBalancesEqual(tokenBalances + (tokenPurchaseAmount / 100));
        assert.ok(tokenBalances);
        assert(!tokensSold.length)
    });
});