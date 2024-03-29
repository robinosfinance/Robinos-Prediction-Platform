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
  zeroOrOne,
  useMethodsOn,
  newArray,
  getDeploy,
} = require('../utils/helper');

const tokenContract = contracts['DBToken.sol'].DBToken;
const eventContract = contracts['DBTokenEvent.sol'].DBTokenEvent;
const salesContract = contracts['DBTokenSale.sol'].DBTokenSale;
const rewardContract = contracts['DBTokenReward.sol'].DBTokenReward;
const sideBetContract = contracts['DBTokenSideBet.sol'].DBTokenSideBet;

// Local instance of the USDT contract used for testing
const tether = require('../compiled/tether.json');

describe('DBToken tests', () => {
  let accounts,
    rate,
    DBTokenSale,
    DBTokenEvent,
    DBTokens,
    TetherToken,
    DBTokenReward,
    DBTokenSideBet;

  // Teams and event code default info for testing
  const teamTokenParams = [{
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

  beforeEach(async () => {
    const deploy = getDeploy(web3);
    accounts = await web3.eth.getAccounts();
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
          DBTokens.push(new web3.eth.Contract(tokenContract.abi, tokenAddress));
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

    useMethodsOn(DBTokenSale, [{
      method: 'rate',
      account: accounts[0],
      onReturn: (_rate) => {
        rate = _rate;
      },
    }, ]);

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
      return useMethodsOn(TetherToken, [{
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
      DBTokenEvent.methods
      .transferOwnershipOfEventAndTokens(DBTokenSale.options.address)
      .send({
        from: accounts[0],
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

          useMethodsOn(DBTokenSale, [{
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
      useMethodsOn(DBTokenSale, [{
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
      const eventCodes = ['EPL', 'Champs', 'Fifa', 'Junior', 'Senior', 'London'];

      return useMethodsOn(DBTokenSale, [{
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

      return useMethodsOn(TetherToken, [{
          method: 'approve',
          args: [DBTokenSale.options.address, purchaseUSDTFunds],
          account: accounts[0],
        }, ])
        .then(() =>
          useMethodsOn(DBTokenSale, [{
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
              method: 'buyTokens',
              args: [eventCode, teamName, purchaseUSDTFunds],
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

          // Variables purchaseUSDTFunds and purchaseDBTfunds can be different only if DBTokenSale.rate() != 1
          assert.strictEqual(contractUSDTBalance, purchaseUSDTFunds);
          assert.strictEqual(contractDBBalance, 0);
          assert.strictEqual(userDBBalance, purchaseDBTfunds);
          return Promise.all(promises);
        })
        .then(() =>
          useMethodsOn(DBTokenSale, [{
            method: 'withdraw',
            args: [purchaseUSDTFunds],
            account: accounts[0],
          }, ])
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
      const tokenPurchaseAmount = 100000;
      let tokenBalances;

      const tokenBalancesEqual = async (checkAmount = null) => new Promise((resolve) => {
        let equal = true;
        let _amount;
        useMethodsOn(DBTokenSale, teamTokenParams.map(({
          teamName
        }, i) => ({
          method: 'balanceOf',
          args: [eventCode, teamName, accounts[0]],
          account: accounts[0],
          onReturn: (amountSt, previousAmountSt) => {
            const amount = parseInt(amountSt);
            const previousAmount = parseInt(previousAmountSt);
            if ((checkAmount && amount !== checkAmount) ||
              (previousAmount && amount !== previousAmount)) equal = false;
            _amount = amount;
          },
        }))).then(() => {
          if (!equal) resolve(null);
          else resolve(_amount);
        });
      });

      return useMethodsOn(TetherToken, [{
          method: 'approve',
          args: [
            DBTokenSale.options.address,
            tokenPurchaseAmount * DBTokens.length,
          ],
          account: accounts[0],
        }, ])
        .then(() =>
          useMethodsOn(DBTokenSale, [{
              method: 'setSaleStartEnd',
              args: [eventCode, 0, secondsInTheFuture(60)],
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
              args: [eventCode, teamTokenParams[i].teamName, tokenPurchaseAmount],
              account: accounts[0],
            })),
          ])
        )
        .then(async () => {
          tokenBalances = await tokenBalancesEqual();
        })
        .then(() =>
          useMethodsOn(DBTokenSale, [{
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
                  tokenBalances + tokenPurchaseAmount / 100
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
    beforeEach(() =>
      DBTokenEvent.methods
      .transferOwnershipOfEventAndTokens(DBTokenSale.options.address)
      .send({
        from: accounts[0],
      })
    );
    it('allows dynamic rates', () => {
      const DBToken = DBTokens[0];
      const teamName = teamTokenParams[0].teamName;
      const DBtokenAmount = 10000;
      const ratio = [5, 2]; // You can play with different ratios here. ratio[0] is numerator, ratio[1] is denominator

      return useMethodsOn(DBTokenReward, [{
          method: 'addDBTokenReference',
          args: [DBToken.options.address, eventCode, teamName],
          account: accounts[0],
        },
        {
          method: 'setRate',
          args: [eventCode, teamName, ratio[0], ratio[1]],
          account: accounts[0],
        },
        {
          method: 'standardTokensFor',
          args: [DBtokenAmount, eventCode, teamName],
          account: accounts[0],
          onReturn: (standardTokenAmount) => {
            assert.strictEqual(
              parseInt(standardTokenAmount),
              parseInt(DBtokenAmount * (ratio[0] / ratio[1]))
            );
          },
        },
      ]);
    });

    it('allows rewards', () => {
      const DBToken = DBTokens[0];
      const teamName = teamTokenParams[0].teamName;
      const purchaseAmount = 500;

      return useMethodsOn(TetherToken, [{
          method: 'approve',
          args: [DBTokenSale.options.address, purchaseAmount],
          account: accounts[0],
        }, ])
        .then(() =>
          useMethodsOn(DBTokenSale, [{
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
              method: 'buyTokens',
              args: [eventCode, teamName, purchaseAmount],
              account: accounts[0],
            },
            {
              method: 'endSaleNow',
              args: [eventCode],
              account: accounts[0],
            },
          ])
        )
        .then(() =>
          useMethodsOn(TetherToken, [{
            method: 'transfer',
            args: [DBTokenReward.options.address, purchaseAmount],
            account: accounts[0],
          }, ])
        )
        .then(() =>
          useMethodsOn(DBToken, [{
            method: 'approve',
            args: [DBTokenReward.options.address, purchaseAmount],
            account: accounts[0],
          }, ])
        )
        .then(() =>
          useMethodsOn(DBTokenReward, [{
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
              method: 'sellTokens',
              args: [eventCode, teamName, purchaseAmount],
              account: accounts[0],
            },
          ])
        );
    });
  });

  describe('DBTokenEvent', () => {
    it('deploys successfully', () => {
      assert.ok(DBTokenEvent.options.address);
    });

    it('creates multiple tokens', () =>
      Promise.all(
        DBTokens.map((DBToken, index) =>
          useMethodsOn(DBToken, [{
            method: 'teamName',
            account: accounts[0],
            onReturn: (tokenTeamName) => {
              const teamName = teamTokenParams[index].teamName;
              assert.strictEqual(tokenTeamName, teamName);
            },
          }, ])
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

      return useMethodsOn(
          DBTokenEvent,
          stakingParams.map(({
            teamIndex,
            account,
            amount
          }) => ({
            method: 'mintTeamToken',
            args: [teamNames[teamIndex], account, amount],
            account: accounts[0],
          }))
        )
        .then(() =>
          useMethodsOn(TetherToken, [{
            // The owner approves stardard token for the reward deposit
            method: 'approve',
            args: [DBTokenSideBet.options.address, totalReward],
            account: accounts[0],
          }, ])
        )
        .then(() =>
          useMethodsOn(DBTokenSideBet, [{
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
            stakingParams.map(({
                teamIndex,
                account,
                amount
              }) =>
              useMethodsOn(DBTokens[teamIndex], [{
                // Each user approves the amount of DBTokens for their prefered team towards the side bet contract
                method: 'approve',
                args: [DBTokenSideBet.options.address, amount],
                account,
              }, ])
            )
          )
        )
        .then(() =>
          useMethodsOn(DBTokenSideBet, [
            ...stakingParams.map(({
              teamIndex,
              account,
              amount
            }) => ({
              // Each user then stakes their DBTokens for their chosen team
              method: 'stake',
              args: [eventName, DBTokens[teamIndex].options.address, amount],
              account,
            })),
            ...stakingParams.map(({
              teamIndex,
              account,
              amount
            }) => ({
              // We check how much each user has staked
              method: 'getUserStaked',
              args: [eventName, account, DBTokens[teamIndex].options.address],
              account,
              onReturn: (userStaked) => {
                // And compare the value returned with local
                assert.strictEqual(parseInt(userStaked), amount);
              },
            })),
          ])
        )
        .then(() => {
          const waitDuration = Math.round(saleDuration * 1000);
          // To select a winning team we must wait until the sale ends
          return new Promise((resolve) => {
            setTimeout(() => {
              let winningAccountIndex;
              let biggestReward;
              let totalCalculatedReward = 0;

              useMethodsOn(DBTokenSideBet, [{
                    method: 'selectWinningTeam',
                    args: [eventName, DBTokens[winningTeamIndex].options.address],
                    account: accounts[0],
                  },
                  ...stakingParams.map(({
                    account
                  }, index) => ({
                    // We check how many standard tokens each user will be rewarded
                    method: 'getUserReward',
                    args: [eventName, account],
                    account: accounts[0],
                    onReturn: (_userReward) => {
                      const userReward = parseInt(_userReward);
                      if (!biggestReward || biggestReward < userReward) {
                        biggestReward = userReward;
                        winningAccountIndex = index;
                      }

                      // We sum up all the rewards
                      totalCalculatedReward += userReward;
                    },
                  })),
                ])
                .then(() => {
                  // And we expect the total reward is equal to the local reward. Every single token must be distributed
                  assert.strictEqual(totalCalculatedReward, totalReward);
                })
                .then(() =>
                  useMethodsOn(DBTokenSideBet, [{
                    // The user with the biggest reward will unstake
                    method: 'unstake',
                    args: [
                      eventName,
                      DBTokens[stakingParams[winningAccountIndex].teamIndex]
                      .options.address,
                    ],
                    account: accounts[winningAccountIndex],
                  }, ])
                )
                .then(() =>
                  useMethodsOn(TetherToken, [{
                    // And check their standard token balance for the reward
                    method: 'balanceOf',
                    args: [accounts[winningAccountIndex]],
                    account: accounts[0],
                    onReturn: (winnerReward) => {
                      // We check if the exact amount of standard token has been transfered
                      assert.strictEqual(parseInt(winnerReward), biggestReward);
                      resolve();
                    },
                  }, ])
                );
            }, waitDuration);
          });
        });
    });
  });
});