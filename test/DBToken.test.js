const assert = require('assert');
const contracts = require('../compile');
const {
  secondsInTheFuture,
  randomInt,
  zeroOrOne,
  useMethodsOn,
  newArray,
  getBalanceOfUser,
} = require('../utils/helper');
const tether = require('../compiled/tether.json');
const {
  getAccounts,
  deploy,
  getDeployedContract,
} = require('../utils/useWeb3');

const tokenContract = contracts['DBToken.sol'].DBToken;
const eventContract = contracts['DBTokenEvent.sol'].DBTokenEvent;
const salesContract = contracts['DBTokenSaleV2.sol'].DBTokenSale;
const rewardContract = contracts['DBTokenRewardV2.sol'].DBTokenReward;
const sideBetContract = contracts['DBTokenSideBet.sol'].DBTokenSideBet;

describe('DBToken tests', () => {
  let accounts,
    DBTokenSale,
    DBTokenEvent,
    DBTokens,
    TetherToken,
    DBTokenReward,
    DBTokenSideBet;

  // Teams and event code default info for testing
  const teamTokenParams = [
    {
      name: 'DBToken',
      symbol: 'DBT',
      teamName: 'Manchester',
    },
    {
      name: 'DBToken',
      symbol: 'DBT',
      teamName: 'Liverpool',
    },
    {
      name: 'DBToken',
      symbol: 'DBT',
      teamName: 'Arsenal',
    },
  ];
  const eventCode = 'EPL';
  const totalSupply = 1 * 10 ** 12;
  const rateComplex = [1, 2]; // 1 / 2
  const rate = rateComplex[0] / rateComplex[1];

  beforeEach(async () => {
    accounts = await getAccounts();
    DBTokens = [];

    DBTokenEvent = await deploy(
      eventContract,
      [teamTokenParams.map((params) => params.teamName), eventCode],
      accounts[0]
    );

    useMethodsOn(
      DBTokenEvent,
      teamTokenParams.map((teamParams) => ({
        method: 'getTeamTokenAddress',
        args: [teamParams.teamName],
        onReturn: (tokenAddress) => {
          DBTokens.push(getDeployedContract(tokenContract.abi, tokenAddress));
        },
      }))
    );

    // Local USDT instance. Address accounts[0] is the owner of the contract
    // and is immediately minted totalSupply amount of tokens on initialization
    TetherToken = await deploy(
      tether,
      [totalSupply, 'Tether', 'USDT', 18],
      accounts[0]
    );

    DBTokenSale = await deploy(
      salesContract,
      [TetherToken.options.address, accounts[1]],
      accounts[0]
    );

    DBTokenReward = await deploy(
      rewardContract,
      [TetherToken.options.address],
      accounts[0]
    );

    DBTokenSideBet = await deploy(
      sideBetContract,
      [
        DBTokens[0].options.address,
        DBTokens[1].options.address,
        TetherToken.options.address,
      ],
      accounts[0]
    );
  });

  describe('DBTokens', () => {
    it('all deployed successfully', () => {
      DBTokens.forEach(async (DBToken, index) => {
        const tokenTeamName = await DBToken.methods.teamName().call({
          from: accounts[0],
        });
        assert.ok(DBToken.options.address); // Check the address
        assert.strictEqual(tokenTeamName, teamTokenParams[index].teamName); // Compare the team names from the tokens with the given team names in the array above
      });
    });
  });

  describe('TetherToken', () => {
    it('deploys successfully', () => {
      assert.ok(TetherToken.options.address);
    });

    it('allows user to approve funds for transfer', () => {
      const approveAmount = 200;
      // This test is required to work for the DBTokenSale purchase to work below
      return useMethodsOn(TetherToken, [
        {
          method: 'approve',
          args: [DBTokenSale.options.address, approveAmount],
          account: accounts[0],
        },
        {
          method: 'allowance',
          args: [accounts[0], DBTokenSale.options.address],
          account: accounts[0],
          onReturn: (allowance) => {
            assert.strictEqual(parseInt(allowance), approveAmount);
          },
        },
      ]);
    });
  });

  describe('DBTokenSale', () => {
    beforeEach(() =>
      useMethodsOn(DBTokenEvent, {
        method: 'transferOwnershipOfEventAndTokens',
        args: [DBTokenSale.options.address],
        account: accounts[0],
      })
    );

    it('deploys successfully', () => {
      assert.ok(DBTokenSale.options.address);
    });

    it('accepts DBToken references', async () =>
      Promise.all(
        DBTokens.map((DBToken, index) =>
          // Each DBToken instance is passed as a reference to the DBTokenSale contract.
          // Arguments eventCode and teamName are used for security purposes

          useMethodsOn(DBTokenSale, [
            {
              method: 'addDBTokenReference',
              args: [
                DBToken.options.address,
                eventCode,
                teamTokenParams[index].teamName,
              ],
              account: accounts[0],
            },
            {
              method: 'getToken',
              args: [eventCode, teamTokenParams[index].teamName],
              account: accounts[0],
              onReturn: (tokenAddress) => {
                assert.ok(tokenAddress);
              },
            },
          ])
        )
      ));

    it('allows to start, end and read sale time', () =>
      // We have 3 tests for checking the sale status. This functions are available for any account to use.
      useMethodsOn(DBTokenSale, [
        {
          // Sale start and end times have not yet been defined. We expect sale not to be active.
          method: 'isSaleOn',
          args: [eventCode],
          account: accounts[0],
          catch: (err) => {
            assert.ok(err);
          },
        },
        {
          method: 'setSaleStartEnd',
          args: [eventCode, 0, secondsInTheFuture(60)],
          account: accounts[0],
        },
        {
          // Sale start set as 0. This means the sale will start immediately and
          // we expect the sale update time to be a timestamp in the future
          method: 'isSaleOn',
          args: [eventCode],
          account: accounts[0],
          onReturn: (data) => {
            assert(data.saleActive);
            assert(parseInt(data.saleEnd) >= secondsInTheFuture(0));
          },
        },
        {
          method: 'endSaleNow',
          args: [eventCode],
          account: accounts[0],
        },
        {
          // Sale has been prematurely ended by the owner of DBTokenSale contract.
          // We expect the sale not to be active and saleUpdateTime to be 0 since
          // there is not future sale update time
          method: 'isSaleOn',
          args: [eventCode],
          account: accounts[0],
          onReturn: (data) => {
            assert(!data.saleActive);
            assert(parseInt(data.saleEnd) <= secondsInTheFuture(0));
          },
        },
      ]));

    it('allows having multiple sales', () => {
      const eventCodes = [
        'EPL',
        'Champs',
        'Fifa',
        'Junior',
        'Senior',
        'London',
      ];

      return useMethodsOn(DBTokenSale, [
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

    it('allows to extend existing sale events and set different rates', () => {
      const saleDuration = 3;
      const firstRate = [1, 2];
      const secondRate = [1, 1];

      return useMethodsOn(DBTokenSale, [
        {
          method: 'setSaleStartEnd',
          args: [eventCode, 0, secondsInTheFuture(saleDuration)],
          account: accounts[0],
        },
        {
          method: 'setRate',
          args: [eventCode, ...firstRate],
          account: accounts[0],
        },
        {
          method: 'getRate',
          args: [eventCode],
          onReturn: (rate) => {
            const { numerator, denominator } = rate;
            assert.strictEqual(parseInt(numerator), firstRate[0]);
            assert.strictEqual(parseInt(denominator), firstRate[1]);
          },
          account: accounts[0],
        },
        {
          wait: saleDuration * 1000,
        },
        {
          method: 'setSaleStartEnd',
          args: [eventCode, 0, secondsInTheFuture(10)],
          account: accounts[0],
        },
        {
          method: 'setRate',
          args: [eventCode, ...secondRate],
          account: accounts[0],
        },
        {
          method: 'getRate',
          args: [eventCode],
          onReturn: (rate) => {
            const { numerator, denominator } = rate;
            assert.strictEqual(parseInt(numerator), secondRate[0]);
            assert.strictEqual(parseInt(denominator), secondRate[1]);
          },
          account: accounts[0],
        },
      ]);
    });

    it('allows exchange of DBTokens <> USDT and withdrawal of contract funds', () => {
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

      const teamName = teamTokenParams[0].teamName;
      const DBToken = DBTokens[0];
      const purchaseUSDTFunds = 200;
      const purchaseDBTfunds = purchaseUSDTFunds * rate;

      const getTetherBalance = async (address) =>
        await TetherToken.methods.balanceOf(address).call({
          from: accounts[0],
        });

      const getDBTokenBalance = async (address) =>
        await DBToken.methods.balanceOf(address).call({
          from: accounts[0],
        });

      return useMethodsOn(TetherToken, [
        {
          method: 'approve',
          args: [DBTokenSale.options.address, purchaseUSDTFunds],
          account: accounts[0],
        },
      ])
        .then(() =>
          useMethodsOn(DBTokenSale, [
            {
              method: 'addDBTokenReference',
              args: [DBToken.options.address, eventCode, teamName],
              account: accounts[0],
            },
            {
              method: 'setSaleStartEnd',
              args: [eventCode, 0, secondsInTheFuture(60)],
              account: accounts[0],
            },
            {
              method: 'setRate',
              args: [eventCode, ...rateComplex],
              account: accounts[0],
            },
            {
              method: 'buyTokens',
              args: [eventCode, teamName, purchaseDBTfunds],
              account: accounts[0],
            },
          ])
        )
        .then(async () => {
          const promises = [
            getTetherBalance(DBTokenSale.options.address),
            getDBTokenBalance(DBTokenSale.options.address),
            getDBTokenBalance(accounts[0]),
          ];
          const contractUSDTBalance = parseInt(await promises[0]);
          const contractDBBalance = parseInt(await promises[1]);
          const userDBBalance = parseInt(await promises[2]);

          // Variables purchaseUSDTFunds and purchaseDBTfunds can be different only if DBTokenSale.getRate() != 1
          assert.strictEqual(contractUSDTBalance, purchaseUSDTFunds);
          assert.strictEqual(contractDBBalance, 0);
          assert.strictEqual(userDBBalance, purchaseDBTfunds);
          return Promise.all(promises);
        })
        .then(() =>
          useMethodsOn(DBTokenSale, [
            {
              method: 'withdraw',
              args: [purchaseUSDTFunds],
              account: accounts[0],
            },
          ])
        )
        .then(async () => {
          const promise = getTetherBalance(accounts[1]);
          // We expect the withdrawn funds to be on accounts[1] as that was set as the withdrawable address in the DBTokenSale constructor
          const safeUSDTBalance = parseInt(await promise);
          assert.strictEqual(safeUSDTBalance, purchaseUSDTFunds);
          return promise;
        });
    });

    it('allows owner to record sold supply and mint 1% at the end of sale', () => {
      const usdtTokenAmount = 100000;
      const dbTokenAmount = usdtTokenAmount * rate;
      let tokenBalances;

      const tokenBalancesEqual = async (checkAmount = null) =>
        new Promise((resolve) => {
          let equal = true;
          let _amount;
          useMethodsOn(
            DBTokenSale,
            teamTokenParams.map(({ teamName }) => ({
              method: 'balanceOf',
              args: [eventCode, teamName, accounts[0]],
              account: accounts[0],
              onReturn: (amountSt, previousAmountSt) => {
                const amount = parseInt(amountSt);
                const previousAmount = parseInt(previousAmountSt);
                if (
                  (checkAmount && amount !== checkAmount) ||
                  (previousAmount && amount !== previousAmount)
                )
                  equal = false;
                _amount = amount;
              },
            }))
          ).then(() => {
            if (!equal) resolve(null);
            else resolve(_amount);
          });
        });

      return useMethodsOn(TetherToken, [
        {
          method: 'approve',
          args: [
            DBTokenSale.options.address,
            usdtTokenAmount * DBTokens.length,
          ],
          account: accounts[0],
        },
      ]).then(() =>
        useMethodsOn(DBTokenSale, [
          {
            method: 'setSaleStartEnd',
            args: [eventCode, 0, secondsInTheFuture(60)],
            account: accounts[0],
          },
          {
            method: 'setRate',
            args: [eventCode, ...rateComplex],
            account: accounts[0],
          },
          ...newArray(DBTokens.length, (i) => ({
            method: 'addDBTokenReference',
            args: [
              DBTokens[i].options.address,
              eventCode,
              teamTokenParams[i].teamName,
            ],
            account: accounts[0],
          })),
          ...newArray(DBTokens.length, (i) => ({
            method: 'buyTokens',
            args: [eventCode, teamTokenParams[i].teamName, dbTokenAmount],
            account: accounts[0],
          })),
          {
            then: async () => {
              tokenBalances = await tokenBalancesEqual();
            },
          },
          {
            method: 'endSaleNow',
            args: [eventCode],
            account: accounts[0],
          },
          {
            // While there are no sales active, the owner can use mintOnePercentToOwner()
            // function to withdraw tokens received
            method: 'mintOnePercentToOwner',
            account: accounts[0],
          },
          {
            method: 'tokensSold',
            account: accounts[0],
            onReturn: async (tokensSold) => {
              tokenBalances = await tokenBalancesEqual(
                tokenBalances + dbTokenAmount / 100
              );
              assert.ok(tokenBalances);
              assert(!tokensSold.length);
            },
          },
        ])
      );
    });
  });

  describe('DBTokenReward', () => {
    beforeEach(() => {
      useMethodsOn(DBTokenEvent, {
        method: 'transferOwnershipOfEventAndTokens',
        args: [DBTokenSale.options.address],
        account: accounts[0],
      });
    });

    it('allows rewards and stores standard tokens received per event', () => {
      const rate = [4, 5];
      const purchaseAmount = 500;
      const stAmount = (purchaseAmount * rate[1]) / rate[0];
      const numOfTeams = teamTokenParams.length;
      const rewardRates = [
        [5, 1],
        [2, 1],
        [3, 2],
      ];
      const totalUsdtNeeded = rewardRates.reduce(
        (total, [num, dem]) => total + Math.round((num / dem) * stAmount),
        0
      );

      return useMethodsOn(
        TetherToken,
        newArray(numOfTeams, (index) => [
          {
            // Owner initially sends each of the users participating
            // usdt funds necessary to compete
            method: 'transfer',
            args: [accounts[index + 1], stAmount],
            account: accounts[0],
          },
          {
            // Each user approves the set amount of funds towards the sale contract
            method: 'approve',
            args: [DBTokenSale.options.address, stAmount],
            account: accounts[index + 1],
          },
        ]).flat()
      )
        .then(() =>
          useMethodsOn(DBTokenSale, [
            ...teamTokenParams.map(({ teamName }, index) => ({
              // The owner adds each DBToken reference in the DBTokenSale contract
              // that is available for purchase
              method: 'addDBTokenReference',
              args: [DBTokens[index].options.address, eventCode, teamName],
              account: accounts[0],
            })),
            {
              // The owner must set the rate for each coin before they are distributed
              method: 'setRate',
              args: [eventCode, ...rate],
              account: accounts[0],
            },
            {
              // The sale starts on the DBTokenSale contract
              method: 'setSaleStartEnd',
              args: [eventCode, 0, secondsInTheFuture(60)],
              account: accounts[0],
            },
            ...teamTokenParams.map(({ teamName }, index) => ({
              // Each user buys tokens in the DBTokenSale contract
              method: 'buyTokens',
              args: [eventCode, teamName, purchaseAmount],
              account: accounts[index + 1],
            })),
            {
              // Sale ends
              method: 'endSaleNow',
              args: [eventCode],
              account: accounts[0],
            },
            {
              // We check the total amount of standard tokens received in the
              // DBTokenSale contract
              method: 'getStandardTokensReceived',
              args: [eventCode],
              account: accounts[0],
              onReturn: (tokensReceived) => {
                assert.strictEqual(
                  parseInt(tokensReceived),
                  stAmount * numOfTeams
                );
              },
            },
          ])
        )
        .then(() =>
          useMethodsOn(TetherToken, [
            {
              // The owner sends the usdt funds towards the DBTokenReward contract
              // required for user rewards
              method: 'transfer',
              args: [DBTokenReward.options.address, totalUsdtNeeded],
              account: accounts[0],
            },
          ])
        )
        .then(() =>
          Promise.all(
            DBTokens.map((DBToken, index) =>
              useMethodsOn(DBToken, [
                {
                  // Each user must approve the bought amount of DBToken
                  // funds towards the DBTokenReward contract. This step can be done also
                  // immediately after the user buys the tokens from the DBTokenSale contract
                  method: 'approve',
                  args: [DBTokenReward.options.address, purchaseAmount],
                  account: accounts[index + 1],
                },
              ])
            )
          )
        )
        .then(() =>
          useMethodsOn(DBTokenReward, [
            {
              // After the sale has finished, the owner can pass the reference
              // to the DBTokenSale contract and sale event
              method: 'addSaleReference',
              args: [DBTokenSale.options.address, eventCode],
              account: accounts[0],
            },
            ...teamTokenParams.map(({ teamName }, index) => ({
              // The owner must set the rate for each token in the added sale
              method: 'setRate',
              args: [eventCode, teamName, ...rewardRates[index]],
              account: accounts[0],
            })),
          ])
        )
        .then(async () => {
          for (let i = 0; i < numOfTeams; i++) {
            const dbTokenBalance = await getBalanceOfUser(
              DBTokens[i],
              accounts[i + 1]
            );
            const usdtBalance = await getBalanceOfUser(
              TetherToken,
              accounts[i + 1]
            );

            // We check that each participating user has the purchased DBToken funds
            assert.strictEqual(dbTokenBalance, purchaseAmount);
            assert.strictEqual(usdtBalance, 0);
          }
        })
        .then(() =>
          useMethodsOn(DBTokenReward, {
            // The user can call this method after they set the rate for each DBToken in the event
            method: 'exchangeUserTokens',
            args: [eventCode],
            account: accounts[0],
          })
        )
        .then(async () => {
          for (let i = 0; i < numOfTeams; i++) {
            const dbTokenBalance = await getBalanceOfUser(
              DBTokens[i],
              accounts[i + 1]
            );
            const usdtBalance = await getBalanceOfUser(
              TetherToken,
              accounts[i + 1]
            );

            const [num, dem] = rewardRates[i];
            const expectedStReward = (purchaseAmount * num) / dem;
            // Now we check that each user doesn't have any DBTokens in their wallet
            assert.strictEqual(dbTokenBalance, 0);
            // And that they have the expected amount of reward tokens
            assert.strictEqual(usdtBalance, expectedStReward);
          }
        });
    });
  });

  describe('DBTokenEvent', () => {
    it('deploys successfully', () => {
      assert.ok(DBTokenEvent.options.address);
    });

    it('creates multiple tokens', () =>
      Promise.all(
        DBTokens.map((DBToken, index) =>
          useMethodsOn(DBToken, [
            {
              method: 'teamName',
              account: accounts[0],
              onReturn: (tokenTeamName) => {
                const teamName = teamTokenParams[index].teamName;
                assert.strictEqual(tokenTeamName, teamName);
              },
            },
          ])
        )
      ));
  });

  describe('DBTokenSideBet', () => {
    it('deploys successfully', () => {
      assert.ok(DBTokenSideBet.options.address);
    });

    it('allows owner to deposit reward & select winners and users to stake & unstake', () => {
      const saleDuration = 15;
      const minStake = 500;
      const maxStake = 150000;
      const winningTeamIndex = zeroOrOne();
      const numOfUsers = 10;
      const eventName = 'Man vs. Liv';
      const totalReward = randomInt(10000, 100000);
      const stakingParams = newArray(numOfUsers, (i) => ({
        account: accounts[i],
        teamIndex: zeroOrOne(),
        amount: randomInt(minStake, maxStake),
      }));
      const teamNames = [
        teamTokenParams[0].teamName,
        teamTokenParams[1].teamName,
      ];
      let winningAccountIndex = 0;
      let biggestReward;
      let totalCalculatedReward = 0;

      return useMethodsOn(
        DBTokenEvent,
        stakingParams.map(({ teamIndex, account, amount }) => ({
          method: 'mintTeamToken',
          args: [teamNames[teamIndex], account, amount],
          account: accounts[0],
        }))
      )
        .then(() =>
          useMethodsOn(TetherToken, [
            {
              // The owner approves stardard token for the reward deposit
              method: 'approve',
              args: [DBTokenSideBet.options.address, totalReward],
              account: accounts[0],
            },
          ])
        )
        .then(() =>
          useMethodsOn(DBTokenSideBet, [
            {
              // The owner initializes a sale and sets start and end time
              method: 'setSaleStartEnd',
              args: [eventName, 0, secondsInTheFuture(saleDuration)],
              account: accounts[0],
            },
            {
              // The owner deposits the reward for this event
              method: 'depositReward',
              args: [eventName, totalReward],
              account: accounts[0],
            },
          ])
        )
        .then(() =>
          Promise.all(
            stakingParams.map(({ teamIndex, account, amount }) =>
              useMethodsOn(DBTokens[teamIndex], [
                {
                  // Each user approves the amount of DBTokens for their prefered team towards the side bet contract
                  method: 'approve',
                  args: [DBTokenSideBet.options.address, amount],
                  account,
                },
              ])
            )
          )
        )
        .then(() =>
          useMethodsOn(DBTokenSideBet, [
            ...stakingParams.map(({ teamIndex, account, amount }) => ({
              // Each user then stakes their DBTokens for their chosen team
              method: 'stake',
              args: [eventName, DBTokens[teamIndex].options.address, amount],
              account,
            })),
            ...stakingParams.map(({ teamIndex, account, amount }) => ({
              // We check how much each user has staked
              method: 'getUserStaked',
              args: [eventName, account, DBTokens[teamIndex].options.address],
              account,
              onReturn: (userStaked) => {
                // And compare the value returned with local
                assert.strictEqual(parseInt(userStaked), amount);
              },
            })),
            {
              wait: saleDuration * 1000,
            },
            {
              method: 'selectWinningTeam',
              args: [eventName, DBTokens[winningTeamIndex].options.address],
              account: accounts[0],
            },
            ...stakingParams.map(({ account }, index) => ({
              // We check how many standard tokens each user will be rewarded
              method: 'getUserReward',
              args: [eventName, account],
              account: accounts[0],
              onReturn: (_userReward) => {
                const userReward = parseInt(_userReward);
                // console.log('userReward', index, userReward);
                if (!biggestReward || biggestReward < userReward) {
                  biggestReward = userReward;
                  winningAccountIndex = index;
                }

                // We sum up all the rewards
                totalCalculatedReward += userReward;
              },
            })),
            {
              then: () => {
                // And we expect the total reward is equal to the local reward. Every single token must be distributed
                assert.strictEqual(totalCalculatedReward, totalReward);
                // console.log('winningAccountIndex', winningAccountIndex);
                // console.log(stakingParams);
                // console.log('writing something');
              },
            },
            {
              // The user with the biggest reward will unstake
              method: 'unstake',
              args: [
                eventName,
                DBTokens[stakingParams[winningAccountIndex].teamIndex].options
                  .address,
              ],
              account: accounts[winningAccountIndex],
            },
          ])
        )
        .then(() =>
          useMethodsOn(TetherToken, [
            {
              // And check their standard token balance for the reward
              method: 'balanceOf',
              args: [accounts[winningAccountIndex]],
              account: accounts[0],
              onReturn: (winnerReward) => {
                // We check if the exact amount of standard token has been transfered
                assert.strictEqual(parseInt(winnerReward), biggestReward);
              },
            },
          ])
        );
    });
  });
});
