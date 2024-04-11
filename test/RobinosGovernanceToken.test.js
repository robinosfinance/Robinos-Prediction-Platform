const assert = require('assert');
const contracts = require('../compile');
const {
  secondsInTheFuture,
  randomInt,
  idsFrom,
  useMethodsOn,
  newArray,
} = require('../utils/helper');
const tether = require('../compiled/tether.json');
const {
  getAccounts,
  deploy,
  getDeployedContract,
} = require('../utils/useWeb3');

const tokenContract =
  contracts['RobinosGovernanceToken.sol'].RobinosGovernanceToken;
const luckyDrawContract =
  contracts['RobinosGovernanceTokenLuckyDraw.sol']
    .RobinosGovernanceTokenLuckyDraw;
const nftStakeContract =
  contracts['RobinosGovernanceTokenNFTStake.sol']
    .RobinosGovernanceTokenNFTStake;
const dbTokenEventContract = contracts['DBTokenEvent.sol'].DBTokenEvent;
const nftSubscription =
  contracts['RobinosGovernanceTokenNFTSubscription.sol']
    .RobinosGovernanceTokenNFTSubscription;

describe('RobinosGovernanceToken tests', () => {
  let RobinosGovernanceToken,
    RobinosGovernanceTokenLuckyDraw,
    RobinosGovernanceTokenNFTStake,
    RobinosGovernanceTokenNFTSubscription,
    DBTokens,
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

  const dbTokenTeamNames = ['Manchester', 'Liverpool'];
  const dbTokenEventName = 'EPL';
  const dbTokenTotalSupply = 2 * 10 ** 12;

  beforeEach(async () => {
    accounts = await getAccounts();

    RobinosGovernanceToken = await deploy(
      tokenContract,
      [tokenName, tokenSymbol, baseURI],
      accounts[0]
    );

    // Local USDT instance. Address accounts[0] is the owner of the
    // contract and is immediately minted totalSupply amount of tokens on initialization
    TetherToken = await deploy(
      tether,
      [totalSupply, 'Tether', 'USDT', 18],
      accounts[0]
    );

    RobinosGovernanceTokenLuckyDraw = await deploy(
      luckyDrawContract,
      [
        RobinosGovernanceToken.options.address,
        TetherToken.options.address,
        stakePeriod,
        stakeDuration,
      ],
      accounts[0]
    );

    DBTokenEvent = await deploy(
      dbTokenEventContract,
      [dbTokenTeamNames, dbTokenEventName],
      accounts[0]
    );

    const mintAndGetContract = async (index) => {
      const tokenAddress = await useMethodsOn(DBTokenEvent, [
        {
          method: 'mintTeamToken',
          args: [dbTokenTeamNames[index], accounts[0], dbTokenTotalSupply],
          account: accounts[0],
        },
        {
          method: 'getTeamTokenAddress',
          args: [dbTokenTeamNames[index]],
          account: accounts[0],
          onReturn: () => {},
        },
      ]);

      return getDeployedContract(tokenContract.abi, tokenAddress);
    };

    DBTokens = [];
    DBToken = DBTokens[0] = await mintAndGetContract(0);
    DBTokens[1] = await mintAndGetContract(1);

    RobinosGovernanceTokenNFTStake = await deploy(
      nftStakeContract,
      [
        RobinosGovernanceToken.options.address,
        DBToken.options.address,
        stakePeriod,
        stakeDuration,
      ],
      accounts[0]
    );

    RobinosGovernanceTokenNFTSubscription = await deploy(
      nftSubscription,
      [RobinosGovernanceToken.options.address, DBToken.options.address],
      accounts[0]
    );
  });

  describe('RobinosGovernanceToken', () => {
    it('deploys successfully', () => {
      assert.ok(RobinosGovernanceToken.options.address); // Check the address
    });

    it('has name and symbol', () =>
      useMethodsOn(RobinosGovernanceToken, [
        {
          method: 'name',
          account: accounts[0],
          onReturn: (name) => {
            assert.strictEqual(name, tokenName);
          },
        },
        {
          method: 'symbol',
          account: accounts[0],
          onReturn: (symbol) => {
            assert.strictEqual(symbol, tokenSymbol);
          },
        },
      ]));

    it('mints NFT tokens', () => {
      const account = accounts[0];
      const tokenId = 1;

      return useMethodsOn(RobinosGovernanceToken, [
        {
          method: 'mint',
          args: [account, tokenId, batchName],
          account: accounts[0],
        },
        {
          method: 'ownerOf',
          args: [tokenId],
          account: accounts[0],
          onReturn: (owner) => {
            // We mint one token and check if the owner and tokenURI are correct
            assert.strictEqual(owner, account);
          },
        },
        {
          method: 'tokenURI',
          args: [tokenId],
          account: accounts[0],
          onReturn: (tokenURI) => {
            assert.strictEqual(tokenURI, `${baseURI}${tokenId}`);
          },
        },
      ]);
    });

    it('mints NFT tokens in batches', () => {
      // Test parameters
      const totalBatches = 5;
      const idsPerBatch = 7;

      const account = accounts[0];
      const batches = newArray(totalBatches, (i) => ({
        name: `TestBatch${i + 1}`,
        tokenIds: idsFrom(i * idsPerBatch + 1, idsPerBatch),
      }));

      return useMethodsOn(RobinosGovernanceToken, [
        ...batches.map(({ name, tokenIds }) => ({
          // First we wait until all batches are fully minted
          method: 'mintBatch',
          args: [account, tokenIds, name],
          account: accounts[0],
        })),
        {
          // After all promises are finished, we will inspect contract storage
          method: 'numOfBatches',
          account: accounts[0],
          onReturn: (numOfBatches) => {
            // We check if the total number of batches is correct
            assert.strictEqual(parseInt(numOfBatches), batches.length);
          },
        },
        ...batches.map(({ name, tokenIds }) => ({
          method: 'getBatchData',
          args: [name],
          account: accounts[0],
          onReturn: (batchData) => {
            const [deployedBatchName, deployedNumOfTokens] =
              Object.values(batchData);
            // Then for each local batch we check if the
            // storage batch name and num of tokens is correct
            assert.strictEqual(deployedBatchName, name);
            assert.strictEqual(parseInt(deployedNumOfTokens), tokenIds.length);
          },
        })),
      ]);
    });

    it('allows owner to create polls & whitelisted users to vote', () => {
      const polls = [
        {
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

      return useMethodsOn(RobinosGovernanceToken, [
        ...polls.flatMap(({ question, answers }) => [
          {
            // As the owner we will create a new poll
            // with given question and array of answers
            method: 'createNewPoll',
            args: [question, answers],
            account: accounts[0],
          },
          {
            method: 'getPoll',
            args: [question, answers],
            account: accounts[0],
            onReturn: (pollData) => {
              // Each created poll should have store the original question, given
              // answers, votes per each answer and total number of votes
              const [, , answerVotes, totalVotes] = Object.values(pollData);
              // We expect the initial votes for each answer and total amount of votes to be 0
              assert(
                answerVotes.every((answerPoll) => parseInt(answerPoll) === 0)
              );
              assert.strictEqual(parseInt(totalVotes), 0);
            },
          },
        ]),
        {
          // For any user to be able to vote, they have
          // to be whitelisted by the owner of the contract
          method: 'whitelistAddress',
          args: [accounts[1]],
          account: accounts[0],
        },
        ...polls.flatMap(({ question, answers, correctAnswerIndex }) => [
          {
            // Now that user has been whitelisted, they can vote by selecting poll question and poll answers
            // to match the poll signature and they need to select the index of the correct answer which is
            // within the poll answers array
            method: 'vote',
            args: [question, answers, correctAnswerIndex],
            account: accounts[1],
          },
          {
            method: 'getPoll',
            args: [question, answers],
            account: accounts[0],
            onReturn: (pollData) => {
              const [, , answerVotes, totalVotes] = Object.values(pollData);
              // Once the user has voted, we expect the total number of votes and votes for correct answer to be 1
              assert.strictEqual(parseInt(answerVotes[correctAnswerIndex]), 1);
              assert.strictEqual(parseInt(totalVotes), 1);
            },
          },
        ]),
      ]);
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
      const eventCodes = [
        'EPL',
        'Champs',
        'Fifa',
        'Junior',
        'Senior',
        'London',
      ];

      return useMethodsOn(RobinosGovernanceTokenLuckyDraw, [
        {
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

      return useMethodsOn(RobinosGovernanceToken, [
        {
          // We mint the tokens in one batch
          method: 'mintBatch',
          args: [account, tokenIds, batchName],
          account: accounts[0],
        },
        ...tokenIds.map((id) => ({
          // Transfer each token to the lucky draw contract address
          method: 'safeTransferFrom',
          args: [account, RobinosGovernanceTokenLuckyDraw.options.address, id],
          account: accounts[0],
        })),
      ]).then(() =>
        useMethodsOn(RobinosGovernanceTokenLuckyDraw, {
          method: 'numOfAvailableTokens',
          account: accounts[0],
          onReturn: (numOfAvailableTokens) => {
            // We read the total number of tokens in the contract and compare the amount
            assert.strictEqual(parseInt(numOfAvailableTokens), tokenIds.length);
          },
        })
      );
    });

    it('allows users to stake standard token & unstake to receive awards', () => {
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

      return useMethodsOn(RobinosGovernanceTokenLuckyDraw, {
        // The owner must first initialize a sale for users to be able to stake their tokens
        method: 'setSaleStartEnd',
        args: [eventName, 0, secondsInTheFuture(1200)],
        account: accounts[0],
      })
        .then(() =>
          useMethodsOn(
            TetherToken,
            accountsSliced.map(({ address, stakeAmount }) => ({
              // We send a random number of tokens to a number of accounts
              method: 'transfer',
              args: [address, stakeAmount],
              account: accounts[0],
            }))
          )
        )
        .then(() =>
          useMethodsOn(RobinosGovernanceToken, [
            {
              // We mint the tokens in one batch
              method: 'mintBatch',
              args: [accounts[0], tokenIds, batchName],
              account: accounts[0],
            },
            ...tokenIds.map((id) => ({
              // Transfer each token to the lucky draw contract address
              method: 'safeTransferFrom',
              args: [
                accounts[0],
                RobinosGovernanceTokenLuckyDraw.options.address,
                id,
              ],
              account: accounts[0],
            })),
          ])
        )
        .then(() =>
          useMethodsOn(RobinosGovernanceTokenLuckyDraw, {
            // Since we transfered the whole batch to the lucky draw contract
            // we want to check if the number of available tokens for reward
            // matches the amount of minted tokens
            method: 'numOfAvailableTokens',
            account: accounts[0],
            onReturn: (availableTokens) => {
              assert.strictEqual(parseInt(availableTokens), tokenIds.length);
            },
          })
        )
        .then(() =>
          useMethodsOn(
            TetherToken,
            accountsSliced.map(({ stakeAmount, address }) => ({
              // Each account must approve their standard tokens to be transfered by the lucky draw contract
              method: 'approve',
              args: [
                RobinosGovernanceTokenLuckyDraw.options.address,
                stakeAmount,
              ],
              account: address,
            }))
          )
        )
        .then(() =>
          useMethodsOn(RobinosGovernanceTokenLuckyDraw, [
            ...accountsSliced.flatMap(({ address, stakeAmount }) => [
              {
                // Each user will call the stake function on the lucky draw contract
                method: 'stake',
                args: [eventName, stakeAmount],
                account: address,
              },
              {
                // We read the amount staked by each user and compare the numbers to local variables
                method: 'getUserStakeAmount',
                args: [eventName, address],
                account: accounts[0],
                onReturn: (userStaked) => {
                  assert.strictEqual(parseInt(userStaked), stakeAmount);
                },
              },
            ]),
            {
              // Each user will call the stake function on the lucky draw contract
              method: 'selectWinners',
              args: [eventName],
              account: accounts[0],
            },
          ])
        )
        .then(() => {
          // For now we just get the amount of ms from stakeDuration and multiply by 1.5 just to be safe
          // The JS and Solidity timestampts don't always match 100%
          const waitDuration = stakeDuration * 1000 * 1.5;
          let totalRewards = 0;

          return new Promise((resolve) => {
            setTimeout(
              () =>
                useMethodsOn(RobinosGovernanceTokenLuckyDraw, [
                  ...accountsSliced.map(({ address }) => ({
                    // After the stake duration has passed, the users can all safely unstake their standard tokens
                    method: 'unstake',
                    args: [eventName],
                    account: address,
                  })),
                  {
                    // We will check the balance of NFTs of each user after unstaking.
                    // We expect all NFTs have been already distributed as rewards and
                    // check if the total balance is equal to the amount of minted NFTs
                    method: 'numOfAvailableTokens',
                    account: accounts[0],
                    onReturn: (availableTokens) => {
                      assert.strictEqual(parseInt(availableTokens), 0);
                    },
                  },
                ])
                  .then(() =>
                    useMethodsOn(
                      RobinosGovernanceToken,
                      accountsSliced.map(({ address }) => ({
                        method: 'balanceOf',
                        args: [address],
                        account: accounts[0],
                        onReturn: (amount) => {
                          totalRewards += parseInt(amount);
                        },
                      }))
                    )
                  )
                  .then(() => {
                    // We expect all the tokens to be in the totalTokensWon counter and the number
                    // of available tokens to be 0, since they were all marked as sold
                    assert.strictEqual(totalRewards, tokenIds.length);
                    resolve();
                  }),
              waitDuration
            );
          });
        });
    });
  });

  describe('RobinosGovernanceTokenNFTStake', () => {
    it('deploys successfully', () => {
      assert.ok(RobinosGovernanceTokenNFTStake.options.address); // Check the address
    });

    it('allows staking and unstaking', () => {
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
      const tokensForStakingPerUser = newArray(numOfUsers, (i) =>
        idsFrom(i * tokensPerUser + 1, tokensPerUser)
      );
      const eventName = 'tokenSale';

      return useMethodsOn(
        RobinosGovernanceToken,
        tokensForStakingPerUser.map((tokenIds, index) => ({
          // First the owner will mint a batch for each of the prepared users and directly deposit them to their address
          method: 'mintBatch',
          args: [accounts[index], tokenIds, batchName],
          account: accounts[0],
        }))
      )
        .then(() =>
          useMethodsOn(DBToken, {
            // The owner then approves their ERC20 tokens for the NFT stake contract to be able to deposit them later
            method: 'approve',
            args: [RobinosGovernanceTokenNFTStake.options.address, totalReward],
            account: accounts[0],
          })
        )
        .then(() =>
          useMethodsOn(RobinosGovernanceTokenNFTStake, [
            {
              // The owner initiates a sale on the NFT stake contract
              method: 'setSaleStartEnd',
              args: [eventName, 0, secondsInTheFuture(120)],
              account: accounts[0],
            },
            {
              // The owner deposits the pre-approved ERC20 tokens which will serve as a reward for staking users
              method: 'depositEventReward',
              args: [eventName, totalReward],
              account: accounts[0],
            },
          ])
        )
        .then(() =>
          useMethodsOn(
            RobinosGovernanceToken,
            tokensForStakingPerUser.flatMap((tokenIds, userIndex) =>
              tokenIds.map((tokenId) => ({
                // Each of the users must individually approve their ERC721 tokens for transfer to the staking contract
                method: 'approve',
                args: [RobinosGovernanceTokenNFTStake.options.address, tokenId],
                account: accounts[userIndex],
              }))
            )
          )
        )
        .then(() =>
          useMethodsOn(RobinosGovernanceTokenNFTStake, [
            ...tokensForStakingPerUser.flatMap((tokenIds, userIndex) =>
              tokenIds.map((tokenId) => ({
                // Each of the users stakes their tokens individually
                method: 'stake',
                args: [eventName, tokenId],
                account: accounts[userIndex],
              }))
            ),
            {
              // We retrive a list of all the staked token IDs for this event
              method: 'getEventStakedTokens',
              args: [eventName],
              account: accounts[0],
              onReturn: (stakedTokens) => {
                // We assert that all the available tokens are staked and retreived in a list in the previous call
                assert.deepStrictEqual(
                  stakedTokens.map((token) => parseInt(token)),
                  tokensForStakingPerUser.flat()
                );
              },
            },
          ])
        )
        .then(() => {
          // After the min staking period has passed, the users are free to unstake their tokens
          const waitDuration = stakeDuration * 1000 * 1.5;
          return new Promise((resolve) => {
            setTimeout(
              () =>
                useMethodsOn(RobinosGovernanceTokenNFTStake, [
                  {
                    // Only one user marked with userToUnstake will unstake their tokens
                    method: 'unstake',
                    args: [eventName],
                    account: accounts[userToUnstake],
                  },
                  {
                    method: 'getEventStakedTokens',
                    args: [eventName],
                    account: accounts[0],
                    onReturn: (stakedTokens) => {
                      const expectedTokens = tokensForStakingPerUser.reduce(
                        (expected, current, index) =>
                          index !== userToUnstake
                            ? expected.concat(current)
                            : expected,
                        []
                      );
                      // We then assert that all the tokens are still staked on the stake contract except the
                      // tokens belonging to the user which just unstaked
                      assert.deepStrictEqual(
                        stakedTokens.map((token) => parseInt(token)),
                        expectedTokens
                      );
                      resolve();
                    },
                  },
                ]),
              waitDuration
            );
          });
        });
    });
  });

  describe('RobinosGovernanceTokenNFTSubscription', () => {
    it('deploys successfully', () => {
      assert.ok(RobinosGovernanceTokenNFTSubscription.options.address);
    });

    it('allows owner to create events to which users can subscribe to rewards', () => {
      const saleDuration = 3;
      const numOfUsers = 5;
      const idsPerBatch = 5;
      const eventCode = 'SomeEvent';
      const batches = newArray(numOfUsers, (i) => ({
        name: `TestBatch${i + 1}`,
        tokenIds: idsFrom(i * idsPerBatch + 1, idsPerBatch),
      }));
      const reward = 5000;

      return useMethodsOn(
        RobinosGovernanceToken,
        batches.map(({ name, tokenIds }, i) => ({
          method: 'mintBatch',
          args: [accounts[i], tokenIds, name],
          account: accounts[0],
        }))
      )
        .then(() =>
          useMethodsOn(DBToken, {
            // Owner approves amount for contract reward
            method: 'approve',
            args: [
              RobinosGovernanceTokenNFTSubscription.options.address,
              reward,
            ],
            account: accounts[0],
          })
        )
        .then(() =>
          useMethodsOn(RobinosGovernanceTokenNFTSubscription, [
            {
              method: 'setSaleStartEnd',
              args: [eventCode, 0, secondsInTheFuture(saleDuration)],
              account: accounts[0],
            },
            {
              // Owner deposits the pre-approved amount for reward
              method: 'depositEventReward',
              args: [eventCode, reward],
              account: accounts[0],
            },
            ...newArray(numOfUsers, (i) => ({
              // Each user subscribes after the event has been
              // started and the event reward has been deposited
              method: 'subscribe',
              args: [eventCode],
              account: accounts[i],
            })),
            {
              // We check how many tokens are in all the subscribed wallets
              method: 'tokensInEvent',
              args: [eventCode],
              account: accounts[0],
              onReturn: (tokensInEvent) => {
                // And compare that we have the calculated total amount of tokens
                assert.strictEqual(
                  parseInt(tokensInEvent),
                  numOfUsers * idsPerBatch
                );
              },
            },
          ])
        )
        .then(() => {
          const waitDuration = saleDuration * 1000;
          return new Promise((resolve) => {
            setTimeout(() => {
              useMethodsOn(
                RobinosGovernanceTokenNFTSubscription,
                newArray(numOfUsers - 1, (i) => ({
                  // After the sale ends, each user can claim their reward
                  method: 'claimReward',
                  args: [eventCode],
                  account: accounts[i],
                }))
              )
                .then(() =>
                  useMethodsOn(
                    DBToken,
                    newArray(numOfUsers - 1, (i) => ({
                      method: 'balanceOf',
                      args: [accounts[i]],
                      account: accounts[0],
                      onReturn: (amount) => {
                        // We check that each user has some reward available in their wallet
                        assert(parseInt(amount) > 0);
                      },
                    }))
                  )
                )
                .then(() =>
                  useMethodsOn(RobinosGovernanceTokenNFTSubscription, {
                    // The owner can update the reward token instance on the contract
                    method: 'setRewardToken',
                    args: [DBTokens[1].options.address],
                    account: accounts[0],
                  })
                )
                .then(() =>
                  useMethodsOn(RobinosGovernanceTokenNFTSubscription, {
                    // And users can still claim the reward from the old reward
                    // contract instance which was bound to the {eventCode} sale
                    method: 'claimReward',
                    args: [eventCode],
                    account: accounts[numOfUsers - 1],
                  })
                )
                .then(() =>
                  useMethodsOn(DBToken, {
                    method: 'balanceOf',
                    args: [accounts[numOfUsers - 1]],
                    account: accounts[0],
                    onReturn: (amount) => {
                      // We check that the last user has some reward in their pocket
                      assert(parseInt(amount) > 0);
                    },
                  })
                )
                .then(() => {
                  resolve();
                });
            }, waitDuration);
          });
        });
    });
  });
});
