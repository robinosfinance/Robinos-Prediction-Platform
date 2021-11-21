const assert = require("assert");
const ganache = require("ganache-cli");
const Web3 = require("web3");
const web3 = new Web3(ganache.provider({
    gasLimit: 1000000000000
}));

const contracts = require("../compile");

const tokenContract = contracts["RobinosGovernanceToken.sol"].RobinosGovernanceToken;

let RobinosGovernanceToken, accounts;

const tokenName = "RobinosGovernanceToken";
const baseURI = "http://robinos_governance_token/";
const tokenSymbol = "RGT";
const batchName = "TestBatchOfNFTs";

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
});

describe("RobinosGovernanceToken", () => {
    it("deployed successfully", () => {
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