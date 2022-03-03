const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(
  ganache.provider({
    gasLimit: 1000000000000,
  })
);

const contracts = require('../compile');
const {
  secondsInTheFuture,
  randomInt,
  idsFrom,
  useMethodsOn,
} = require('../helper');

const tokenContract =
  contracts['RobinosGovernanceToken.sol'].RobinosGovernanceToken;
const luckyDrawContract =
  contracts['RobinosGovernanceTokenLuckyDraw.sol']
  .RobinosGovernanceTokenLuckyDraw;
const nftStakeContract =
  contracts['RobinosGovernanceTokenNFTStake.sol']
  .RobinosGovernanceTokenNFTStake;
const dbTokenEventContract = contracts['DBTokenEvent.sol'].DBTokenEvent;

// Local instance of the USDT contract used for testing
const tether = require('../compiled/tether.json');

let RobinosGovernanceToken,
  RobinosGovernanceTokenLuckyDraw,
  RobinosGovernanceTokenNFTStake,
  DBToken,
  DBTokenEvent,
  TetherToken,
  accounts;

const tokenName = 'RobinosGovernanceToken';
const baseURI = 'http://robinos_governance_token/';
const tokenSymbol = 'RGT';
const batchName = 'TestBatchOfNFTs';
const totalSupply = 1 * 10 ** 12;
// Stake period can be any of the following ["seconds", "minutes", "hours", "days", "weeks"]
// The stake period is multiplied by stake duration when deploying the lucky draw contract to get the stake cool-off period
// For the sake of testing we will use small periods, but should work the same way with longer periods
const stakeDuration = 2;
const stakePeriod = 'seconds';

const dbTokenTeamName = 'Manchester';
const dbTokenEventName = 'EPL';
const dbTokenTotalSupply = 2 * 10 ** 12;

beforeEach(async () => {
  accounts = await web3.eth.getAccounts();

  RobinosGovernanceToken = await new web3.eth.Contract(tokenContract.abi)
    .deploy({
      data: tokenContract.evm.bytecode.object,
      arguments: [tokenName, tokenSymbol, baseURI],
    })
    .send({
      from: accounts[0],
      gas: '1000000000',
    });

  /**
   *  @dev Local USDT instance. Address accounts[0] is the owner of the contract and is immediately minted totalSupply amount of tokens on initialization
   */
  TetherToken = await new web3.eth.Contract(tether.abi)
    .deploy({
      data: tether.bytecode,
      arguments: [totalSupply, 'Tether', 'USDT', 18],
    })
    .send({
      from: accounts[0],
      gas: '1000000000',
    });

  RobinosGovernanceTokenLuckyDraw = await new web3.eth.Contract(
      luckyDrawContract.abi
    )
    .deploy({
      data: luckyDrawContract.evm.bytecode.object,
      arguments: [
        RobinosGovernanceToken.options.address,
        TetherToken.options.address,
        stakePeriod,
        stakeDuration,
      ],
    })
    .send({
      from: accounts[0],
      gas: '1000000000',
    });

  DBTokenEvent = await new web3.eth.Contract(dbTokenEventContract.abi)
    .deploy({
      data: dbTokenEventContract.evm.bytecode.object,
      arguments: [
        [dbTokenTeamName], dbTokenEventName
      ],
    })
    .send({
      from: accounts[0],
      gas: '1000000000',
    });

  const tokenAddress = await DBTokenEvent.methods
    .getTeamTokenAddress(dbTokenTeamName)
    .call({
      from: accounts[0],
      gas: '10000000000',
    });
  DBToken = new web3.eth.Contract(tokenContract.abi, tokenAddress);

  DBTokenEvent.methods
    .mintTeamToken(dbTokenTeamName, accounts[0], dbTokenTotalSupply)
    .send({
      from: accounts[0],
      gas: '1000000000',
    });

  RobinosGovernanceTokenNFTStake = await new web3.eth.Contract(
      nftStakeContract.abi
    )
    .deploy({
      data: nftStakeContract.evm.bytecode.object,
      arguments: [
        RobinosGovernanceToken.options.address,
        DBToken.options.address,
        stakePeriod,
        stakeDuration,
      ],
    })
    .send({
      from: accounts[0],
      gas: '1000000000',
    });
});

describe('RobinosGovernanceToken', () => {
  it('deploys successfully', () => {
    assert.ok(RobinosGovernanceToken.options.address); // Check the address
  });

  it('has name and symbol', async () => {
    const deployedName = await RobinosGovernanceToken.methods.name().call({
      from: accounts[0],
      gas: '1000000000',
    });
    const deployedSymbol = await RobinosGovernanceToken.methods.symbol().call({
      from: accounts[0],
      gas: '1000000000',
    });
    assert.strictEqual(deployedName, tokenName);
    assert.strictEqual(deployedSymbol, tokenSymbol);
  });

  it('mints NFT tokens', async () => {
    const account = accounts[0];
    const tokenId = 1;
    RobinosGovernanceToken.methods
      .mint(account, tokenId, batchName)
      .send({
        from: accounts[0],
        gas: '1000000000',
      })
      .then(async () => {
        const owner = await RobinosGovernanceToken.methods
          .ownerOf(tokenId)
          .call({
            from: accounts[0],
            gas: '1000000000',
          });

        const tokenURI = await RobinosGovernanceToken.methods
          .tokenURI(tokenId)
          .call({
            from: accounts[0],
            gas: '1000000000',
          });
        // We mint one token and check if the owner and tokenURI are correct
        assert.strictEqual(owner, account);
        assert.strictEqual(tokenURI, `${baseURI}${tokenId}`);
      });
  });

  it('mints NFT tokens in batches', async () => {
    // Test parameters
    const totalBatches = 5;
    const idsPerBatch = 7;

    const account = accounts[0];
    const batches = (() => {
      const array = [];
      for (let i = 0; i < totalBatches; i++) {
        array.push({
          name: `TestBatch${i + 1}`,
          tokenIds: idsFrom(i * idsPerBatch + 1, idsPerBatch),
        });
      }
      return array;
    })();

    Promise.all(
        // First we wait until all batches are fully minted
        batches.map((batch) =>
          Promise.resolve(
            RobinosGovernanceToken.methods
            .mintBatch(account, batch.tokenIds, batch.name)
            .send({
              from: accounts[0],
              gas: '1000000000',
            })
          )
        )
      )
      // After all promises are finished, we will inspect contract storage
      .then(async () => {
        const numOfBatches = await RobinosGovernanceToken.methods
          .numOfBatches()
          .call({
            from: accounts[0],
            gas: '1000000000',
          });
        // We check if the total number of batches is correct
        assert.strictEqual(parseInt(numOfBatches), batches.length);

        batches.forEach(async (batch) => {
          const batchData = await RobinosGovernanceToken.methods
            .getBatchData(batch.name)
            .call({
              from: accounts[0],
              gas: '1000000000',
            });
          const [deployedBatchName, deployedNumOfTokens] =
          Object.values(batchData);
          // Then for each local batch we check if the storage batch name and num of tokens is correct
          assert.strictEqual(deployedBatchName, batch.name);
          assert.strictEqual(
            parseInt(deployedNumOfTokens),
            batch.tokenIds.length
          );
        });
      });
  });

  it('allows owner to create polls & whitelisted users to vote', async () => {
    const polls = [{
        question: 'Is George W. Bush a former US president?',
        answers: ['Yes', 'No', 'Maybe', "I don't know"],
        correctAnswerIndex: 0,
      },
      {
        question: 'What should we do today?',
        answers: ['Just work', 'Work & relax', 'Just relax'],
        correctAnswerIndex: 1,
      },
    ];

    polls.forEach(async (poll) => {
      // As the owner we will create a new poll with given question and array of answers
      RobinosGovernanceToken.methods
        .createNewPoll(poll.question, poll.answers)
        .send({
          from: accounts[0],
          gas: '1000000000',
        })
        .then(async () => {
          const pollData = await RobinosGovernanceToken.methods
            .getPoll(poll.question, poll.answers)
            .call({
              from: accounts[0],
              gas: '1000000000',
            });
          // Each created poll should have store the original question, given answers, votes per each answer and total number of votes
          const [, , answerVotes, totalVotes] = Object.values(pollData);
          // We expect the initial votes for each answer and total amount of votes to be 0
          assert(answerVotes.every((answerPoll) => parseInt(answerPoll) === 0));
          assert.strictEqual(parseInt(totalVotes), 0);
        });
    });

    RobinosGovernanceToken.methods
      // For any user to be able to vote, they have to be whitelisted by the owner of the contract
      .whitelistAddress(accounts[1])
      .send({
        from: accounts[0],
        gas: '1000000000',
      })
      .then(() => {
        polls.forEach((poll) => {
          RobinosGovernanceToken.methods
            // Now that user has been whitelisted, they can vote by selecting poll question and poll answers
            // to match the poll signature and they need to select the index of the correct answer which is
            // within the poll answers array
            .vote(poll.question, poll.answers, poll.correctAnswerIndex)
            .send({
              from: accounts[1],
              gas: '1000000000',
            })
            .then(async () => {
              const pollData = await RobinosGovernanceToken.methods
                .getPoll(poll.question, poll.answers)
                .call({
                  from: accounts[0],
                  gas: '1000000000',
                });
              const [, , answerVotes, totalVotes] = Object.values(pollData);
              // Once the user has voted, we expect the total number of votes and votes for correct answer to be 1
              assert.strictEqual(
                parseInt(answerVotes[poll.correctAnswerIndex]),
                1
              );
              assert.strictEqual(parseInt(totalVotes), 1);
            });
        });
      });
  });
});
describe('TetherToken', () => {
  it('deploys successfully', () => {
    assert.ok(TetherToken.options.address);
  });
});

describe('RobinosGovernanceTokenLuckyDraw', () => {
  it('deploys successfully', () => {
    assert.ok(RobinosGovernanceTokenLuckyDraw.options.address);
  });

  it('allows having multiple sales', () => {
    const eventCodes = ['EPL', 'Champs', 'Fifa', 'Junior', 'Senior', 'London'];

    return useMethodsOn(RobinosGovernanceTokenLuckyDraw, [{
        method: 'isSaleOn',
        args: ['SomeEvent'],
        account: accounts[0],
        catch: (err) => {
          assert.strictEqual(err, 'SaleFactory: sale not initialized');
        },
      },
      ...eventCodes.map((code) => ({
        method: 'setSaleStartEnd',
        args: [code, 0, secondsInTheFuture(60)],
        account: accounts[0],
      })),
      ...eventCodes.map((code) => ({
        method: 'endSaleNow',
        args: [code],
        account: accounts[0],
      })),
      {
        method: 'getAllSales',
        args: [],
        account: accounts[0],
        onReturn: (sales) => {
          assert.strictEqual(sales.length, 0);
        },
      },
    ]);
  });

  it('allows owner to transfer NFTs', () => {
    const account = accounts[0];
    const tokenIds = idsFrom(1, 5);

    RobinosGovernanceToken.methods
      // We mint the tokens in one batch
      .mintBatch(account, tokenIds, batchName)
      .send({
        from: accounts[0],
        gas: '1000000000',
      })
      .then(() => {
        return Promise.all(
          tokenIds.map((id) =>
            Promise.resolve(
              // Transfer each token to the lucky draw contract address
              RobinosGovernanceToken.methods
              .safeTransferFrom(
                account,
                RobinosGovernanceTokenLuckyDraw.options.address,
                id
              )
              .send({
                from: accounts[0],
                gas: '1000000000',
              })
            )
          )
        );
      })
      .then(async () => {
        const numOfAvailableTokens =
          await RobinosGovernanceTokenLuckyDraw.methods
          .numOfAvailableTokens()
          .call({
            from: accounts[0],
          });
        // We read the total number of tokens in the contract and compare the amount
        assert.strictEqual(parseInt(numOfAvailableTokens), tokenIds.length);
      });
  });

  it('allows users to stake standard token & unstake to receive awards', (done) => {
    const minimumStake = 100;
    const maximumStake = 100000;
    const numOfRewardTokens = 64;
    // Minimum number of contestants should match minAddressesForRandomSequence constant
    // in the GeneratingRandomNumbers contract
    const numOfContestants = 10;
    const eventName = 'tokenSale';

    const accountsSliced = accounts
      .slice(0, numOfContestants)
      .map((account) => ({
        address: account,
        stakeAmount: randomInt(minimumStake, maximumStake),
      }));
    const tokenIds = idsFrom(1, numOfRewardTokens);

    RobinosGovernanceTokenLuckyDraw.methods
      // The owner must first initialize a sale for users to be able to stake their tokens
      .setSaleStartEnd(eventName, 0, secondsInTheFuture(1200))
      .send({
        from: accounts[0],
        gas: '10000000000',
      })
      .then(() =>
        Promise.all(
          accountsSliced.map((account) =>
            Promise.resolve(
              TetherToken.methods
              // We send a random number of tokens to a number of accounts
              .transfer(account.address, account.stakeAmount)
              .send({
                from: accounts[0],
              })
            )
          )
        )
      )
      .then(() =>
        RobinosGovernanceToken.methods
        // We mint the tokens in one batch
        .mintBatch(accounts[0], tokenIds, batchName)
        .send({
          from: accounts[0],
          gas: '1000000000',
        })
        .then(() =>
          Promise.all(
            tokenIds.map((id) =>
              Promise.resolve(
                // Transfer each token to the lucky draw contract address
                RobinosGovernanceToken.methods
                .safeTransferFrom(
                  accounts[0],
                  RobinosGovernanceTokenLuckyDraw.options.address,
                  id
                )
                .send({
                  from: accounts[0],
                  gas: '1000000000',
                })
              )
            )
          ).then(async () => {
            const availableTokens =
              await RobinosGovernanceTokenLuckyDraw.methods
              // Since we transfered the whole batch to the lucky draw contract
              // we want to check if the number of available tokens for reward
              // matches the amount of minted tokens
              .numOfAvailableTokens()
              .call({
                from: accounts[0],
                gas: '10000000000',
              });
            assert.strictEqual(parseInt(availableTokens), tokenIds.length);
          })
        )
      )
      .then(() =>
        Promise.all(
          accountsSliced.map((account) =>
            Promise.resolve(
              TetherToken.methods
              // Each account must approve their standard tokens to be transfered by the lucky draw contract
              .approve(
                RobinosGovernanceTokenLuckyDraw.options.address,
                account.stakeAmount
              )
              .send({
                from: account.address,
                gas: '10000000000',
              })
            )
          )
        )
      )
      .then(() =>
        Promise.all(
          accountsSliced.map((account) =>
            Promise.resolve(
              RobinosGovernanceTokenLuckyDraw.methods
              // Each user will call the stake function on the lucky draw contract
              .stake(eventName, account.stakeAmount)
              .send({
                from: account.address,
                gas: '10000000000',
              })
            )
          )
        )
      )
      .then(async () => {
        accountsSliced.forEach(async (account) => {
          const userStaked = await RobinosGovernanceTokenLuckyDraw.methods
            // We read the amount staked by each user and compare the numbers to local variables
            .getUserStakeAmount(eventName, account.address)
            .call({
              from: accounts[0],
              gas: '10000000000',
            });

          assert.strictEqual(parseInt(userStaked), account.stakeAmount);
        });
      })
      .then(() =>
        RobinosGovernanceTokenLuckyDraw.methods
        // Each user will call the stake function on the lucky draw contract
        .selectWinners(eventName)
        .send({
          from: accounts[0],
          gas: '10000000000',
        })
      )
      .then(async () => {
        // For now we just get the amount of ms from stakeDuration and multiply by 1.5 just to be safe
        // The JS and Solidity timestampts don't always match 100%
        const waitDuration = stakeDuration * 1000 * 1.5;

        setTimeout(
          () =>
          Promise.all(
            accountsSliced.map((account) =>
              Promise.resolve(
                RobinosGovernanceTokenLuckyDraw.methods
                // After the stake duration has passed, the users can all safely unstake their standard tokens
                .unstake(eventName)
                .send({
                  from: account.address,
                  gas: '10000000000',
                })
              )
            )
          ).then(() =>
            Promise.all(
              accountsSliced.map((account) =>
                Promise.resolve(
                  RobinosGovernanceToken.methods
                  // We will check the balance of NFTs of each user after unstaking.
                  // We expect all NFTs have been already distributed as rewards and
                  // check if the total balance is equal to the amount of minted NFTs
                  .balanceOf(account.address)
                  .call({
                    from: accounts[0],
                    gas: '10000000000',
                  })
                )
              )
            ).then(async (values) => {
              const totalTokensWon = values.reduce(
                (total, value) => total + parseInt(value),
                0
              );
              const availableTokens =
                await RobinosGovernanceTokenLuckyDraw.methods
                .numOfAvailableTokens()
                .call({
                  from: accounts[0],
                  gas: '10000000000',
                });

              // We expect all the tokens to be in the totalTokensWon counter and the number
              // of available tokens to be 0, since they were all marked as sold
              assert.strictEqual(totalTokensWon, tokenIds.length);
              assert.strictEqual(parseInt(availableTokens), 0);
              done();
            })
          ),
          waitDuration
        );
      });
  });
});

describe('RobinosGovernanceTokenNFTStake', () => {
  it('deploys successfully', () => {
    assert.ok(RobinosGovernanceTokenNFTStake.options.address); // Check the address
  });

  it('allows staking and unstaking', (done) => {
    const tokensPerUser = 5; // Num of tokens each user will stake
    const numOfUsers = 3; // Total users to stake
    const userToUnstake = 1; // Index of the user which will unstake at the end of test
    const totalReward = 100000;
    /* Returns an array of arrays of token IDs for each user
     * e.g. numOfUsers = 3 & tokensPerUser = 5: [
     *        [1, 2, 3, 4, 5],
     *        [6, 7, 8, 9, 10],
     *        [11, 12, 13, 14, 15],
     *      ]
     */
    const tokensForStakingPerUser = (() => {
      const arr = [];
      for (let i = 0; i < numOfUsers; i++)
        arr.push(idsFrom(i * tokensPerUser + 1, tokensPerUser));

      return arr;
    })();
    const eventName = 'tokenSale';

    Promise.all(
        tokensForStakingPerUser.map((tokenIds, index) =>
          Promise.resolve(
            RobinosGovernanceToken.methods
            // First the owner will mint a batch for each of the prepared users and directly deposit them to their address
            .mintBatch(accounts[index], tokenIds, batchName)
            .send({
              from: accounts[0],
              gas: '1000000000',
            })
          )
        )
      )
      .then(() =>
        DBToken.methods
        // The owner then approves their ERC20 tokens for the NFT stake contract to be able to deposit them later
        .approve(RobinosGovernanceTokenNFTStake.options.address, totalReward)
        .send({
          from: accounts[0],
          gas: '1000000000',
        })
      )
      .then(() =>
        RobinosGovernanceTokenNFTStake.methods
        // The owner initiates a sale on the NFT stake contract
        .setSaleStartEnd(eventName, 0, secondsInTheFuture(120))
        .send({
          from: accounts[0],
          gas: '1000000000',
        })
      )
      .then(() =>
        RobinosGovernanceTokenNFTStake.methods
        // The owner deposits the pre-approved ERC20 tokens which will serve as a reward for staking users
        .depositEventReward(eventName, totalReward)
        .send({
          from: accounts[0],
          gas: '1000000000',
        })
      )
      .then(() =>
        Promise.all(
          tokensForStakingPerUser
          .map((tokenIds, userIndex) =>
            tokenIds.map((tokenId) =>
              Promise.resolve(
                RobinosGovernanceToken.methods
                // Each of the users must individually approve their ERC721 tokens for transfer to the staking contract
                .approve(
                  RobinosGovernanceTokenNFTStake.options.address,
                  tokenId
                )
                .send({
                  from: accounts[userIndex],
                  gas: '1000000000',
                })
              )
            )
          )
          .flat()
        )
      )
      .then(() =>
        Promise.all(
          tokensForStakingPerUser
          .map((tokenIds, userIndex) =>
            tokenIds.map((tokenId) =>
              Promise.resolve(
                RobinosGovernanceTokenNFTStake.methods
                // Each of the users stakes their tokens individually
                .stake(eventName, tokenId)
                .send({
                  from: accounts[userIndex],
                  gas: '1000000000',
                })
              )
            )
          )
          .flat()
        )
      )
      .then(async () => {
        const stakedTokens = await RobinosGovernanceTokenNFTStake.methods
          // We retrive a list of all the staked token IDs for this event
          .getEventStakedTokens(eventName)
          .call({
            from: accounts[0],
            gas: '1000000000',
          });
        // We assert that all the available tokens are staked and retreived in a list in the previous call
        assert.deepStrictEqual(
          stakedTokens.map((token) => parseInt(token)),
          tokensForStakingPerUser.flat()
        );
      })
      .then(async () => {
        const waitDuration = stakeDuration * 1000 * 1.5;
        // After the min staking period has passed, the users are free to unstake their tokens
        setTimeout(() => {
          RobinosGovernanceTokenNFTStake.methods
            // Only one user marked with userToUnstake will unstake their tokens
            .unstake(eventName)
            .send({
              from: accounts[userToUnstake],
              gas: '1000000000',
            })
            .then(async () => {
              const stakedTokens = await RobinosGovernanceTokenNFTStake.methods
                .getEventStakedTokens(eventName)
                .call({
                  from: accounts[0],
                  gas: '1000000000',
                });
              const expectedTokens = tokensForStakingPerUser.reduce(
                (expected, current, index) =>
                index !== userToUnstake ? expected.concat(current) : expected,
                []
              );
              // We then assert that all the tokens are still staked on the stake contract except the
              // tokens belonging to the user which just unstaked
              assert.deepStrictEqual(
                stakedTokens.map((token) => parseInt(token)),
                expectedTokens
              );
              done();
            });
        }, waitDuration);
      });
  });
});