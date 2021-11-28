const { doesNotMatch } = require("assert");
const assert = require("assert");
const ganache = require("ganache-cli");
const Web3 = require("web3");
const web3 = new Web3(ganache.provider({
    gasLimit: 1000000000000
}));

const contracts = require("../compile");
const {
    secondsInTheFuture,
    randomInt,
} = require("../helper");

const tokenContract = contracts["RobinosGovernanceToken.sol"].RobinosGovernanceToken;
const luckyDrawContract = contracts["RobinosGovernanceTokenLuckyDraw.sol"].RobinosGovernanceTokenLuckyDraw;

// Local instance of the USDT contract used for testing
const tether = require("./tether_compiled.json");

let RobinosGovernanceToken, RobinosGovernanceTokenLuckyDraw, TetherToken, accounts;

const tokenName = "RobinosGovernanceToken";
const baseURI = "http://robinos_governance_token/";
const tokenSymbol = "RGT";
const batchName = "TestBatchOfNFTs";
const totalSupply = 1 * 10 ** 12;
// Stake period can be any of the following ["seconds", "minutes", "hours", "days", "weeks"]
// The stake period is multiplied by stake duration when deploying the lucky draw contract to get the stake cool-off period
// For the sake of testing we will use small periods, but should work the same way with longer periods
const stakeDuration = 2;
const stakePeriod = "seconds";

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    RobinosGovernanceToken = await new web3.eth.Contract(tokenContract.abi)
        .deploy({
            data: tokenContract.evm.bytecode.object,
            arguments: [tokenName, tokenSymbol, baseURI]
        })
        .send({
            from: accounts[0],
            gas: '1000000000'
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

    RobinosGovernanceTokenLuckyDraw = await new web3.eth.Contract(luckyDrawContract.abi)
        .deploy({
            data: luckyDrawContract.evm.bytecode.object,
            arguments: [RobinosGovernanceToken.options.address, TetherToken.options.address, stakePeriod, stakeDuration]
        })
        .send({
            from: accounts[0],
            gas: '1000000000'
        });
});

describe("RobinosGovernanceToken", () => {
    it("deployes successfully", () => {
        assert.ok(RobinosGovernanceToken.options.address); // Check the address
    });

    it("has name and symbol", async () => {
        const deployedName = await RobinosGovernanceToken.methods.name()
            .call({
                from: accounts[0],
                gas: '1000000000'
            });
        const deployedSymbol = await RobinosGovernanceToken.methods.symbol()
            .call({
                from: accounts[0],
                gas: '1000000000'
            });
        assert.strictEqual(deployedName, tokenName);
        assert.strictEqual(deployedSymbol, tokenSymbol);
    });

    it("mints NFT tokens", async () => {
        const account = accounts[0];
        const tokenId = 1;
        RobinosGovernanceToken.methods.mint(account, tokenId, batchName)
            .send({
                from: accounts[0],
                gas: '1000000000'
            })
            .then(async () => {
                const owner = await RobinosGovernanceToken.methods.ownerOf(tokenId)
                    .call({
                        from: accounts[0],
                        gas: '1000000000'
                    });

                const tokenURI = await RobinosGovernanceToken.methods.tokenURI(tokenId)
                    .call({
                        from: accounts[0],
                        gas: '1000000000'
                    });
                // We mint one token and check if the owner and tokenURI are correct
                assert.strictEqual(owner, account);
                assert.strictEqual(tokenURI, `${baseURI}${tokenId}`);
            });
    });

    it("mints NFT tokens in batches", async () => {
        // Test parameters
        const totalBatches = 5;
        const idsPerBatch = 7;


        const account = accounts[0];
        // Creates array of IDs: [fromId, fromId + 1, fromId + 2 ... fromId + length - 1]
        const idsFrom = (fromId, length) => {
            const idsArray = [];
            for (let i = 0; i < length; i++) {
                idsArray.push(fromId + i);
            }
            return idsArray;
        };
        const batches = (() => {
            const array = [];
            for (let i = 0; i < totalBatches; i++) {
                array.push({
                    name: `TestBatch${i + 1}`,
                    tokenIds: idsFrom((i * idsPerBatch) + 1, idsPerBatch)
                });
            }
            return array;
        })();

        Promise.all(
                // First we wait until all batches are fully minted
                batches.map(batch => Promise.resolve(RobinosGovernanceToken.methods
                    .mintBatch(account, batch.tokenIds, batch.name)
                    .send({
                        from: accounts[0],
                        gas: '1000000000'
                    })))
            )
            // After all promises are finished, we will inspect contract storage
            .then(async () => {
                const numOfBatches = await RobinosGovernanceToken.methods.numOfBatches()
                    .call({
                        from: accounts[0],
                        gas: '1000000000'
                    });
                // We check if the total number of batches is correct
                assert.strictEqual(parseInt(numOfBatches), batches.length);

                batches.forEach(async batch => {
                    const batchData = await RobinosGovernanceToken.methods
                        .getBatchData(batch.name)
                        .call({
                            from: accounts[0],
                            gas: '1000000000'
                        });
                    const [deployedBatchName, deployedNumOfTokens] = Object.values(batchData);
                    // Then for each local batch we check if the storage batch name and num of tokens is correct
                    assert.strictEqual(deployedBatchName, batch.name);
                    assert.strictEqual(parseInt(deployedNumOfTokens), batch.tokenIds.length);
                });
            });
    });

    it("allows owner to create polls & whitelisted users to vote", async () => {
        const polls = [{
                question: "Is George W. Bush a former US president?",
                answers: ["Yes", "No", "Maybe", "I don't know"],
                correctAnswerIndex: 0
            },
            {
                question: "What should we do today?",
                answers: ["Just work", "Work & relax", "Just relax"],
                correctAnswerIndex: 1
            }
        ];

        polls.forEach(async poll => {
            // As the owner we will create a new poll with given question and array of answers
            RobinosGovernanceToken.methods
                .createNewPoll(poll.question, poll.answers)
                .send({
                    from: accounts[0],
                    gas: '1000000000'
                })
                .then(async () => {
                    const pollData = await RobinosGovernanceToken.methods
                        .getPoll(poll.question, poll.answers)
                        .call({
                            from: accounts[0],
                            gas: '1000000000'
                        });
                    // Each created poll should have store the original question, given answers, votes per each answer and total number of votes
                    const [question, answers, answerVotes, totalVotes] = Object.values(pollData);
                    // We expect the initial votes for each answer and total amount of votes to be 0
                    assert(answerVotes.every(answerPoll => parseInt(answerPoll) === 0));
                    assert.strictEqual(parseInt(totalVotes), 0);

                });
        });

        RobinosGovernanceToken.methods
            // For any user to be able to vote, they have to be whitelisted by the owner of the contract
            .whitelistAddress(accounts[1])
            .send({
                from: accounts[0],
                gas: '1000000000'
            })
            .then(() => {
                polls.forEach(poll => {
                    RobinosGovernanceToken.methods
                        // Now that user has been whitelisted, they can vote by selecting poll question and poll answers
                        // to match the poll signature and they need to select the index of the correct answer which is
                        // within the poll answers array
                        .vote(poll.question, poll.answers, poll.correctAnswerIndex)
                        .send({
                            from: accounts[1],
                            gas: '1000000000'
                        })
                        .then(async () => {
                            const pollData = await RobinosGovernanceToken.methods
                                .getPoll(poll.question, poll.answers)
                                .call({
                                    from: accounts[0],
                                    gas: '1000000000'
                                });
                            const [question, answers, answerVotes, totalVotes] = Object.values(pollData);
                            // Once the user has voted, we expect the total number of votes and votes for correct answer to be 1
                            assert.strictEqual(parseInt(answerVotes[poll.correctAnswerIndex]), 1);
                            assert.strictEqual(parseInt(totalVotes), 1);
                        });
                });
            });

    });
});
describe("TetherToken", () => {
    it("deploys successfully", () => {
        assert.ok(TetherToken.options.address);
    });
});


describe("RobinosGovernanceTokenLuckyDraw", () => {
    it("deploys successfully", () => {
        assert.ok(RobinosGovernanceTokenLuckyDraw.options.address);
    });

    it("allows having multiple sales", async () => {
        let userStaked, errorMessage;
        const expectedError = "SaleFactory: sale not initialized";

        const eventCodes = [
            "EPL",
            "Champs",
            "Fifa",
            "Junior",
            "Senior",
            "London"
        ];

        const nonExistingEvent = "SomeEvent";



        (() => {
            // We first make sure to go through all the events and start their sales from the list above
            return Promise.resolve(eventCodes.forEach(async (code, index) => {
                RobinosGovernanceTokenLuckyDraw.methods.setSaleStartEnd(code, 0, secondsInTheFuture(randomInt(20, 100) * 30))
                    .send({
                        from: accounts[0],
                        gas: '10000000000'
                    });
            }));
        })()
        .then(() => {
                // Then we end each sale as the owner
                eventCodes.forEach(async (code, index) => {
                    RobinosGovernanceTokenLuckyDraw.methods.endSaleNow(code)
                        .send({
                            from: accounts[0],
                            gas: '10000000000'
                        });

                });
            })
            .then(async () => {
                // Resulting sales array should have 0 entries
                let sales = await RobinosGovernanceTokenLuckyDraw.methods.getAllSales().call({
                    from: accounts[0]
                });
                assert.strictEqual(sales.length, 0);
            });

        try {
            userStaked = await RobinosGovernanceTokenLuckyDraw.methods.getTotalStaked(nonExistingEvent).call({
                from: accounts[0]
            });
        } catch (error) {
            errorMessage = Object.values(error.results)[0].reason;
        }
        assert.strictEqual(errorMessage, expectedError);
    });

    it("allows owner to transfer NFTs", () => {
        const account = accounts[0];
        const tokenIds = [1, 2, 3, 4, 5];

        RobinosGovernanceToken.methods
            // We mint the tokens in one batch
            .mintBatch(account, tokenIds, batchName)
            .send({
                from: accounts[0],
                gas: '1000000000'
            })
            .then(() => {
                return Promise.all(tokenIds.map(id =>
                    Promise.resolve(
                        // Transfer each token to the lucky draw contract address
                        RobinosGovernanceToken.methods
                        .safeTransferFrom(account, RobinosGovernanceTokenLuckyDraw.options.address, id)
                        .send({
                            from: accounts[0],
                            gas: '1000000000'
                        }))));

            })
            .then(async () => {
                const availableTokens = await RobinosGovernanceTokenLuckyDraw.methods.availableTokens().call({
                    from: accounts[0]
                });
                // We read the total number of tokens in the contract and compare the amount
                assert.strictEqual(parseInt(availableTokens), tokenIds.length);
            });
    });

    it("allows users to stake standard token & unstake after a certain period of time", () => {
        const accountsSliced =
            accounts.slice(1, 7)
            .map(account => ({
                address: account,
                stakeAmount: randomInt(100, 250),
            }));
        const eventName = "tokenSale";

        RobinosGovernanceTokenLuckyDraw.methods
            // The owner must first initialize a sale for users to be able to stake their tokens
            .setSaleStartEnd(eventName, 0, secondsInTheFuture(120))
            .send({
                from: accounts[0],
                gas: '10000000000'
            })
            .then(() => {
                return Promise.all(
                    accountsSliced.map(account => Promise.resolve(
                        TetherToken.methods
                        // We send a random number of tokens to a number of accounts
                        .transfer(account.address, account.stakeAmount)
                        .send({
                            from: accounts[0]
                        })
                    ))
                );
            })
            .then(() => {
                return Promise.all(
                    accountsSliced.map(account => Promise.resolve(
                        TetherToken.methods
                        // Each account must approve their standard tokens to be transfered by the lucky draw contract
                        .approve(RobinosGovernanceTokenLuckyDraw.options.address, account.stakeAmount)
                        .send({
                            from: account.address,
                            gas: '10000000000'
                        })
                    ))
                );
            })
            .then(() => {
                return Promise.all(
                    accountsSliced.map(account => Promise.resolve(
                        RobinosGovernanceTokenLuckyDraw.methods
                        // Each user will call the stake function on the lucky draw contract
                        .stake(eventName, account.stakeAmount)
                        .send({
                            from: account.address,
                            gas: '10000000000'
                        })
                    ))
                );
            })
            .then(async () => {
                accountsSliced.map(async account => {
                    const userStaked = await RobinosGovernanceTokenLuckyDraw.methods
                        // We read the amount staked by each user and compare the numbers to local variables
                        .getUserStakeAmount(eventName, account.address)
                        .call({
                            from: accounts[0],
                            gas: '10000000000'
                        });


                    assert.strictEqual(parseInt(userStaked), account.stakeAmount);
                });
            })
            .then(async () => {
                // For now we just get the amount of ms from stakeDuration and multiply by 1.5 just to be safe
                // The JS and Solidity timestampts don't always match 100%
                const waitDuration = stakeDuration * 1000 * 1.5;
                setTimeout(() => {
                    return Promise.all(
                            accountsSliced.map(account => Promise.resolve(
                                RobinosGovernanceTokenLuckyDraw.methods
                                // After the stake duration has passed, the users can all safely unstake their standard tokens
                                .unstake(eventName)
                                .send({
                                    from: account.address,
                                    gas: '10000000000'
                                })
                            ))
                        )
                        .then(async () => {
                            const tetherBalance = await TetherToken.methods
                                // Since all users have unstaked their standard tokens, we excpect to have a balance of 0 standard tokens
                                .balanceOf(RobinosGovernanceTokenLuckyDraw.options.address)
                                .call({
                                    from: accounts[0]
                                });
                            assert.strictEqual(parseInt(tetherBalance), 0);
                        });
                }, waitDuration);
            });
    });
});