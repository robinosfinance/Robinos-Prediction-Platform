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
const rewardContract = contracts['DBTokenReward.sol'].DBTokenReward;
const rewardV2Contract = contracts['DBTokenRewardV2.sol'].DBTokenReward;
const rewardSCContract = contracts['DBTokenRewardSC.sol'].DBTokenRewardSC;
const sideBetContract = contracts['DBTokenSideBet.sol'].DBTokenSideBet;
const sideBetV2Contract = contracts['DBTokenSideBetV2.sol'].DBTokenSideBetV2;
const tokenSellContract = contracts['DBTokenSell.sol'].DBTokenSell;
const tokenSellV2Contract = contracts['DBTokenSellV2.sol'].DBTokenSellV2;

describe('DBToken tests', () => {
  let accounts,
    DBTokenSale,
    DBTokenEvent,
    DBTokens,
    TetherToken,
    DBTokenReward,
    DBTokenRewardV2,
    DBTokenRewardSC,
    DBTokenSideBet,
    DBTokenSideBetV2,
    DBTokenSell,
    DBTokenSellV2;

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
      teamTokenParams.map((teamParams, index) => ({
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

    DBTokenRewardV2 = await deploy(
      rewardV2Contract,
      [TetherToken.options.address],
      accounts[0]
    );

    DBTokenRewardSC = await deploy(
      rewardSCContract,
      [TetherToken.options.address, DBTokenSale.options.address],
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

    DBTokenSideBetV2 = await deploy(sideBetV2Contract, [], accounts[0]);

    DBTokenSell = await deploy(
      tokenSellContract,
      [TetherToken.options.address],
      accounts[0]
    );

    DBTokenSellV2 = await deploy(
      tokenSellV2Contract,
      [TetherToken.options.address],
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

  describe('Reward contracts', () => {
    beforeEach(() => {
      useMethodsOn(DBTokenEvent, {
        method: 'transferOwnershipOfEventAndTokens',
        args: [DBTokenSale.options.address],
        account: accounts[0],
      });
    });

    describe('DBTokenReward', () => {
      it('allows dynamic rates', () => {
        const DBToken = DBTokens[0];
        const teamName = teamTokenParams[0].teamName;
        const DBtokenAmount = 10000;
        const ratio = [5, 2]; // You can play with different ratios here. ratio[0] is numerator, ratio[1] is denominator

        return useMethodsOn(DBTokenReward, [
          {
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

      it('allows rewards and stores standard tokens received per event', () => {
        const DBToken = DBTokens[0];
        const teamName = teamTokenParams[0].teamName;
        const rate = [4, 5];
        const purchaseAmount = 500;
        const stAmount = (purchaseAmount * rate[1]) / rate[0];

        return useMethodsOn(TetherToken, [
          {
            method: 'approve',
            args: [DBTokenSale.options.address, stAmount],
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
                method: 'setRate',
                args: [eventCode, ...rate],
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
              {
                method: 'getStandardTokensReceived',
                args: [eventCode],
                account: accounts[0],
                onReturn: (tokensReceived) => {
                  assert.strictEqual(parseInt(tokensReceived), stAmount);
                },
              },
            ])
          )
          .then(() =>
            useMethodsOn(TetherToken, [
              {
                method: 'transfer',
                args: [DBTokenReward.options.address, purchaseAmount],
                account: accounts[0],
              },
            ])
          )
          .then(() =>
            useMethodsOn(DBToken, [
              {
                method: 'approve',
                args: [DBTokenReward.options.address, purchaseAmount],
                account: accounts[0],
              },
            ])
          )
          .then(() =>
            useMethodsOn(DBTokenReward, [
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
                method: 'sellTokens',
                args: [eventCode, teamName, purchaseAmount],
                account: accounts[0],
              },
            ])
          );
      });
    });

    const runSaleAndPrepareRewards = (
      purchaseAmount,
      rate,
      totalRewardAmount,
      rewardContractAddress
    ) => {
      const standardTokenAmount = (purchaseAmount * rate[1]) / rate[0];

      return useMethodsOn(
        TetherToken,
        newArray(teamTokenParams.length, (index) => [
          {
            // Owner initially sends each of the users participating
            // usdt funds necessary to compete
            method: 'transfer',
            args: [accounts[index + 1], standardTokenAmount],
            account: accounts[0],
          },
          {
            // Each user approves the set amount of funds towards the sale contract
            method: 'approve',
            args: [DBTokenSale.options.address, standardTokenAmount],
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
                  standardTokenAmount * teamTokenParams.length
                );
              },
            },
          ])
        )
        .then(() =>
          useMethodsOn(TetherToken, [
            {
              // The owner sends the usdt funds towards the DBTokenRewardV2 contract
              // required for user rewards
              method: 'transfer',
              args: [rewardContractAddress, totalRewardAmount],
              account: accounts[0],
            },
          ])
        );
    };

    describe('DBTokenRewardV2', () => {
      it('allows rewards and stores standard tokens received per event', () => {
        const rate = [4, 5];
        const purchaseAmount = 500;
        const numOfTeams = teamTokenParams.length;
        const rewardRates = [
          [5, 1],
          [2, 1],
          [3, 2],
        ];
        const totalUsdtNeeded = rewardRates.reduce(
          (total, [num, dem]) =>
            total +
            Math.round((num / dem) * ((purchaseAmount * rate[1]) / rate[0])),
          0
        );

        return runSaleAndPrepareRewards(
          purchaseAmount,
          rate,
          totalUsdtNeeded,
          DBTokenRewardV2.options.address
        )
          .then(() =>
            Promise.all(
              DBTokens.map((DBToken, index) =>
                useMethodsOn(DBToken, [
                  {
                    // Each user must approve the bought amount of DBToken
                    // funds towards the DBTokenRewardV2 contract. This step can be done also
                    // immediately after the user buys the tokens from the DBTokenSale contract
                    method: 'approve',
                    args: [DBTokenRewardV2.options.address, purchaseAmount],
                    account: accounts[index + 1],
                  },
                ])
              )
            )
          )
          .then(() =>
            useMethodsOn(DBTokenRewardV2, [
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
            useMethodsOn(DBTokenRewardV2, {
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

    describe('DBTokenRewardSC', () => {
      const purchaseAmount = 1500;
      const rate = [2, 3];
      const totalUsdtReward = 200000;
      // Sum should be <= 100
      const tokenRewardPercentages = [60, 30, 10];

      beforeEach(() => {
        return runSaleAndPrepareRewards(
          purchaseAmount,
          rate,
          totalUsdtReward,
          DBTokenRewardSC.options.address
        ).then(() =>
          useMethodsOn(DBTokenRewardSC, [
            {
              // After the sale has finished, the owner can pass the reference
              // to the sale event
              method: 'addSaleReference',
              args: [eventCode],
              account: accounts[0],
            },
            ...teamTokenParams.flatMap(({ teamName }, i) => [
              {
                // The owner can set the rate for certain token
                // to equal a percentage of the total reward pool
                // sent to the reward contract
                method: 'setRateAsPercentOfTotal',
                args: [eventCode, teamName, tokenRewardPercentages[i]],
                account: accounts[0],
              },
              {
                // Then we get the rate and check if the values are correct
                method: 'getRate',
                args: [eventCode, teamName],
                account: accounts[0],
                onReturn: (rate) => {
                  const { numerator, denominator } = rate;

                  // The numerator should equal to the set percent
                  // of total reward pool
                  assert.strictEqual(
                    parseInt(numerator),
                    (totalUsdtReward * tokenRewardPercentages[i]) / 100
                  );
                  // The denominator is equal to the total amount of tokens
                  // purchased in the event
                  assert.strictEqual(parseInt(denominator), purchaseAmount);
                },
              },
            ]),
            {
              // For rewards to be distributed and verified users to
              // approve rates, the owner must set rates as finalized.
              // This flag can be reverted by the owner before the the rewards
              // are distributed
              method: 'setRatesFinalized',
              args: [eventCode, true],
              account: accounts[0],
            },
          ])
        );
      });

      it('deploys successfully', () => {
        assert.ok(DBTokenRewardSC.options.address);
      });

      it('allows rewards', () =>
        useMethodsOn(DBTokenRewardSC, {
          // The owner distributes the rewards to eligible users
          // once the rates have been set and finalized
          method: 'sendUserRewards',
          args: [eventCode],
          account: accounts[0],
        }).then(() =>
          useMethodsOn(
            TetherToken,
            newArray(teamTokenParams.length, (i) => ({
              // We then get the balance of USDT of each participating user
              method: 'balanceOf',
              args: [accounts[i + 1]],
              account: accounts[0],
              onReturn: (balance) => {
                // And check if they have the correct amount of tokens
                assert.strictEqual(
                  parseInt(balance),
                  (totalUsdtReward * tokenRewardPercentages[i]) / 100
                );
              },
            }))
          )
        ));

      it('allows verified users to approve rates', () => {
        const numOfVerifiedUsers = 3;
        const userRateApprovals = [true, true, false];

        return useMethodsOn(DBTokenRewardSC, [
          ...newArray(numOfVerifiedUsers, (i) => [
            {
              // The owner must initially verify each user willing to
              // provide rate approvals
              method: 'verifyUser',
              args: [accounts[i + 1]],
              account: accounts[0],
            },
            {
              // Then each user can cast a vote for the event rates.
              // 0: No vote, 1: Approved, 2: Not Approved
              // The user cannot vote 0, that is an initial status
              // which signals that this user hasn't voted
              method: 'approveRates',
              args: [eventCode, userRateApprovals[i] ? 1 : 2],
              account: accounts[i + 1],
            },
          ]).flat(),
          {
            // We then check all the approvals for the event
            method: 'getAllEventApprovals',
            args: [eventCode],
            account: accounts[0],
            onReturn: (eventApprovals) => {
              // And we check if each user has the expected approval status
              userRateApprovals.forEach((approved, i) => {
                assert.strictEqual(
                  parseInt(eventApprovals[i].status),
                  approved ? 1 : 2
                );
              });
            },
          },
        ]);
      });

      it('records user rewards', () =>
        useMethodsOn(DBTokenRewardSC, [
          {
            // The owner distributes the rewards
            method: 'sendUserRewards',
            args: [eventCode],
            account: accounts[0],
          },
          ...teamTokenParams.map(({ teamName }, i) => ({
            // For each user, we get a list of all rewards won
            method: 'getAllUserRewards',
            args: [accounts[i + 1]],
            account: accounts[0],
            onReturn: (userRewards) => {
              const {
                eventCode: _eventCode,
                teamName: _teamName,
                eligibleTokens,
                rewardAmount,
              } = userRewards[0];

              // In this testing, each user bought one specific token,
              // so we check that the reward token has the correct data
              assert.strictEqual(_eventCode, eventCode);
              assert.strictEqual(_teamName, teamName);
              // Amount of tokens eligible for reward
              assert.strictEqual(parseInt(eligibleTokens), purchaseAmount);
              // And that the reward amount is correct
              assert.strictEqual(
                parseInt(rewardAmount),
                (totalUsdtReward * tokenRewardPercentages[i]) / 100
              );
            },
          })),
        ]));

      it('reverts if rates are not finalized', () =>
        useMethodsOn(DBTokenRewardSC, [
          {
            method: 'setRatesFinalized',
            args: [eventCode, false],
            account: accounts[0],
          },
          {
            method: 'sendUserRewards',
            args: [eventCode],
            account: accounts[0],
            catch: (error) => {
              // Method should revert with the correct message if rates are not finalized
              assert.strictEqual(
                error,
                'DBTokenReward: rates have not been finalized'
              );
            },
          },
          {
            method: 'approveRates',
            args: [eventCode, 1],
            account: accounts[0],
            catch: (error) => {
              // And even verified users cannot vote until the rates are finalized
              assert.strictEqual(
                error,
                'DBTokenReward: rates have not been finalized'
              );
            },
          },
          {
            // We will also try to set the percent of total
            // to a value out of bounds
            method: 'setRateAsPercentOfTotal',
            args: [eventCode, teamTokenParams[0].teamName, 125],
            account: accounts[0],
            catch: (error) => {
              // And receive the proper revert messgae
              assert.strictEqual(
                error,
                'DBTokenReward: percent must be between 0 and 100'
              );
            },
          },
        ]));

      it('reverts if rates are updated after finalizing', () =>
        useMethodsOn(DBTokenRewardSC, [
          {
            method: 'setRate',
            args: [eventCode, teamTokenParams[0].teamName, 2, 1],
            account: accounts[0],
            catch: (error) => {
              // Since rates have already been finalized, updating them shouldn't
              // be allowed
              assert.strictEqual(
                error,
                'DBTokenReward: rates have already been finalized'
              );
            },
          },
          {
            method: 'setRateAsPercentOfTotal',
            args: [eventCode, teamTokenParams[0].teamName, 33],
            account: accounts[0],
            catch: (error) => {
              // The same stands for other methods for setting rates
              assert.strictEqual(
                error,
                'DBTokenReward: rates have already been finalized'
              );
            },
          },
        ]));

      it('reverts if insufficient reward amount on contract', () =>
        useMethodsOn(DBTokenRewardSC, [
          {
            method: 'setRatesFinalized',
            args: [eventCode, false],
            account: accounts[0],
          },
          ...teamTokenParams.map(({ teamName }) => ({
            // We set each token to amount to 50% of the total reward pool
            // Which totals to 150%. This combination should revert once we
            // try to send the rewards as we would have insufficient reward
            method: 'setRateAsPercentOfTotal',
            args: [eventCode, teamName, 50],
            account: accounts[0],
          })),
          {
            method: 'setRatesFinalized',
            args: [eventCode, true],
            account: accounts[0],
          },
          {
            method: 'sendUserRewards',
            args: [eventCode],
            account: accounts[0],
            catch: () => {
              // We just expect to get an error when trying to call the method
              assert.ok(true);
            },
          },
        ]));
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

  describe('DBTokenSideBetV2', () => {
    const saleDuration = 15;
    const minStake = 500;
    const maxStake = 150000;
    const winningTeamIndex = zeroOrOne();
    const numOfUsers = 10;
    const eventName = 'Man vs. Liv';
    const totalReward = randomInt(10000, 100000);
    const teamNames = [
      teamTokenParams[0].teamName,
      teamTokenParams[1].teamName,
    ];
    const getStakingParams = () =>
      newArray(numOfUsers, (i) => ({
        account: accounts[i],
        teamIndex: zeroOrOne(),
        amount: randomInt(minStake, maxStake),
      }));

    const prepareSideBet = (stakingParams = getStakingParams()) =>
      useMethodsOn(
        DBTokenEvent,
        stakingParams.map(({ teamIndex, account, amount }) => ({
          // We mint all the team tokens we plan to use for staking
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
              args: [DBTokenSideBetV2.options.address, totalReward],
              account: accounts[0],
            },
          ])
        )
        .then(() =>
          useMethodsOn(DBTokenSideBetV2, [
            {
              // The owner initializes a side bet, sale and deposits the reward
              method: 'initializeSideBetAndDepositReward',
              args: [
                eventName,
                DBTokens[0].options.address,
                DBTokens[1].options.address,
                TetherToken.options.address,
                totalReward,
                0,
                secondsInTheFuture(saleDuration),
              ],
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
                  args: [DBTokenSideBetV2.options.address, amount],
                  account,
                },
              ])
            )
          )
        );

    it('deploys successfully', () => {
      assert.ok(DBTokenSideBetV2.options.address);
    });

    it('allows owner to deposit reward & select winners and users to stake & unstake', async () => {
      const stakingParams = getStakingParams();
      let initialUserUsdtBalance;

      return prepareSideBet(stakingParams)
        .then(async () => {
          initialUserUsdtBalance = parseInt(
            await useMethodsOn(TetherToken, {
              method: 'balanceOf',
              args: [accounts[0]],
              account: accounts[0],
              onReturn: () => {},
            })
          );
        })
        .then(() =>
          useMethodsOn(DBTokenSideBetV2, [
            ...stakingParams.map(({ teamIndex, account, amount }) => ({
              // Each user then stakes their DBTokens for their chosen team
              method: 'stake',
              args: [eventName, teamIndex, amount],
              account,
            })),
            {
              method: 'endSaleNow',
              args: [eventName],
              account: accounts[0],
            },
            {
              // The owner selects the winning team index
              method: 'selectWinningTeam',
              args: [eventName, winningTeamIndex],
              account: accounts[0],
            },
            {
              // We check the side bet data
              method: 'getSideBetData',
              args: [eventName],
              account: accounts[0],
              onReturn: ({ winnerSet, winningIndex }) => {
                // We expect the winner is set correctly
                assert.strictEqual(winnerSet, true);
                assert.strictEqual(parseInt(winningIndex), winningTeamIndex);
              },
            },
            {
              // The owner distributes the rewards
              method: 'distributeReward',
              args: [eventName],
              account: accounts[0],
            },
            {
              method: 'getSideBetData',
              args: [eventName],
              account: accounts[0],
              onReturn: ({ rewardDistributed }) => {
                // The side bet should be flagged that reward has been distributed
                assert.strictEqual(rewardDistributed, true);
              },
            },
            ...stakingParams.map(({ teamIndex, account }) => ({
              // Once the winner has been selected by the owner, users can unstake
              method: 'unstake',
              args: [eventName, teamIndex],
              account,
            })),
            {
              method: 'getSideBetData',
              args: [eventName],
              account: accounts[0],
              onReturn: ({ usersUnstaked }) => {
                usersUnstaked.flat().forEach((userUnstaked) => {
                  // We check that each user has been flagged they have unstaked
                  assert.strictEqual(userUnstaked, true);
                });
              },
            },
          ])
        )
        .then(() =>
          useMethodsOn(TetherToken, [
            ...stakingParams.map(({ teamIndex }, i) => ({
              // We check the participating users' standard token balance for the reward
              method: 'balanceOf',
              args: [accounts[i]],
              account: accounts[0],
              onReturn: (balance) => {
                let reward = parseInt(balance);
                if (i === 0) reward -= initialUserUsdtBalance;
                // We just check that the users who've staked the winning team tokens
                // have usdt in their wallets
                if (teamIndex === winningTeamIndex) {
                  assert.notStrictEqual(reward, 0);
                }
              },
            })),
            {
              method: 'balanceOf',
              args: [DBTokenSideBetV2.options.address],
              account: accounts[0],
              onReturn: (balance) => {
                // And we check that all usdt has been drained from the side bet contract
                assert.strictEqual(parseInt(balance), 0);
              },
            },
          ])
        );
    });

    it('should revert if user tries to stake outside of sale', () => {
      const stakingParams = getStakingParams();

      return prepareSideBet(stakingParams).then(() =>
        useMethodsOn(DBTokenSideBetV2, [
          {
            method: 'endSaleNow',
            args: [eventName],
            account: accounts[0],
          },
          {
            method: 'stake',
            args: [eventName, 0, stakingParams[0].amount],
            account: accounts[0],
            catch: (err) => {
              assert.strictEqual(
                err,
                'SaleFactory: function can only be called during sale'
              );
            },
          },
        ])
      );
    });

    it('allows owner to cancel side bet', () => {
      const stakingParams = getStakingParams();
      const { amount, teamIndex } = stakingParams[0];
      const betCancelledError = 'DBTokenSideBetV2: side bet has been cancelled';

      return prepareSideBet(stakingParams).then(() =>
        useMethodsOn(DBTokenSideBetV2, [
          {
            method: 'cancelBetAndRefundTokens',
            args: [eventName],
            account: accounts[0],
          },
          {
            method: 'stake',
            args: [eventName, teamIndex, amount],
            account: accounts[0],
            catch: (err) => {
              assert.strictEqual(err, betCancelledError);
            },
          },
          {
            method: 'endSaleNow',
            args: [eventName],
            account: accounts[0],
          },
          {
            method: 'selectWinningTeam',
            args: [eventName, 0],
            account: accounts[0],
            catch: (err) => {
              assert.strictEqual(err, betCancelledError);
            },
          },
        ])
      );
    });
  });

  describe('DBTokenSell', () => {
    const dbtokenIndex = 0;
    const tokensToOffer = 200;
    const rate = [5, 2];
    const dbToSt = (dbAmount) => Math.round((dbAmount * rate[0]) / rate[1]);
    const stRequired = dbToSt(tokensToOffer);
    const expectedOfferId = `${eventCode}-${teamTokenParams[dbtokenIndex].teamName}-0`;

    const prepareSaleAndOffer = () =>
      useMethodsOn(DBTokenEvent, {
        // We mint the DBTokens we want to put up for offer
        method: 'mintTeamToken',
        args: [
          teamTokenParams[dbtokenIndex].teamName,
          accounts[0],
          tokensToOffer,
        ],
        account: accounts[0],
      })
        .then(() =>
          useMethodsOn(DBTokens[dbtokenIndex], {
            // The offering user approves the wanted amount of tokens towards
            // the DBTokenSell contract
            method: 'approve',
            args: [DBTokenSell.options.address, tokensToOffer],
            account: accounts[0],
          })
        )
        .then(() =>
          useMethodsOn(DBTokenSell, [
            {
              // We start the sale, allowing the users to put offers with
              // tokens belonging to this event
              method: 'setSaleStartEnd',
              args: [eventCode, 0, secondsInTheFuture(10)],
              account: accounts[0],
            },
            {
              // The offering user adds an offer to the correct event
              method: 'addOffer',
              args: [
                eventCode,
                DBTokens[dbtokenIndex].options.address,
                tokensToOffer,
                rate[0],
                rate[1],
              ],
              account: accounts[0],
            },
          ])
        );

    const prepareSaleOfferAndBuyerFunds = () =>
      prepareSaleAndOffer().then(() =>
        useMethodsOn(TetherToken, [
          {
            method: 'transfer',
            args: [accounts[1], stRequired],
            account: accounts[0],
          },
          {
            method: 'approve',
            args: [DBTokenSell.options.address, stRequired],
            account: accounts[1],
          },
        ])
      );

    it('deploys successfully', () => {
      assert.ok(DBTokenSell.options.address);
    });

    it('allows users holding DBTokens to offer them for sale', () =>
      prepareSaleAndOffer().then(() =>
        useMethodsOn(DBTokenSell, [
          {
            method: 'getAllEventOffers',
            args: [eventCode],
            account: accounts[0],
            onReturn: ([eventOffer]) => {
              // We check if the returned data for the offer is correct
              assert.strictEqual(eventOffer.offerId, expectedOfferId);

              // Status should be 1 (OfferStatus.Open)
              assert.strictEqual(parseInt(eventOffer.status), 1);
              assert.strictEqual(eventOffer.offeringUser, accounts[0]);
              assert.strictEqual(
                eventOffer.tokenInstance,
                DBTokens[dbtokenIndex].options.address
              );
              assert.strictEqual(
                parseInt(eventOffer.totalTokensOffered),
                tokensToOffer
              );
              assert.strictEqual(
                parseInt(eventOffer.tokensLeft),
                tokensToOffer
              );
              assert.strictEqual(parseInt(eventOffer.rate.numerator), rate[0]);
              assert.strictEqual(
                parseInt(eventOffer.rate.denominator),
                rate[1]
              );
            },
          },
        ])
      ));

    it('allows users to purchase tokens with the required standard token amount', () =>
      prepareSaleOfferAndBuyerFunds().then(() =>
        useMethodsOn(DBTokenSell, [
          {
            method: 'buyOfferedTokens',
            args: [eventCode, expectedOfferId, tokensToOffer],
            account: accounts[1],
          },
          {
            method: 'getAllEventOffers',
            args: [eventCode],
            account: accounts[0],
            onReturn: ([eventOffer]) => {
              // After someone buys the offered tokens, the offer
              // should have status 2 (OfferStatus.Sold)
              assert.strictEqual(parseInt(eventOffer.status), 2);
            },
          },
        ])
      ));

    it('reverts if user tries to buy outside of sale', () =>
      prepareSaleOfferAndBuyerFunds().then(() =>
        useMethodsOn(DBTokenSell, [
          {
            method: 'endSaleNow',
            args: [eventCode],
            account: accounts[0],
          },
          {
            method: 'buyOfferedTokens',
            args: [eventCode, expectedOfferId, tokensToOffer],
            account: accounts[1],
            catch: (err) => {
              assert.strictEqual(
                err,
                'SaleFactory: function can only be called during sale'
              );
            },
          },
        ])
      ));

    it('allows owner to refund all offers when sale ends', () =>
      prepareSaleOfferAndBuyerFunds().then(() =>
        useMethodsOn(DBTokenSell, [
          {
            method: 'getAllEventOffers',
            args: [eventCode],
            account: accounts[0],
            onReturn: ([{ tokensLeft }]) => {
              assert.strictEqual(parseInt(tokensLeft), tokensToOffer);
            },
          },
          {
            method: 'buyOfferedTokens',
            args: [eventCode, expectedOfferId, tokensToOffer / 2],
            account: accounts[1],
          },
          {
            method: 'getAllEventOffers',
            args: [eventCode],
            account: accounts[0],
            onReturn: ([{ tokensLeft }]) => {
              // After buying half the tokens, half should still be available
              // in the offer
              assert.strictEqual(parseInt(tokensLeft), tokensToOffer / 2);
            },
          },
          {
            method: 'endSaleNow',
            args: [eventCode],
            account: accounts[0],
          },
          {
            method: 'returnAllOfferedTokens',
            args: [eventCode],
            account: accounts[0],
          },
          {
            method: 'getAllEventOffers',
            args: [eventCode],
            account: accounts[0],
            onReturn: ([{ tokensLeft }]) => {
              // After the owner returns all offered tokens
              // each offer should have 0 available tokens left
              assert.strictEqual(parseInt(tokensLeft), 0);
            },
          },
          {
            then: async () => {
              const balance = await getBalanceOfUser(
                DBTokens[dbtokenIndex],
                accounts[0]
              );
              // We expect that the offering user has the remaining
              // DBTokens returned to their wallet after the event offers
              // have been refunded
              assert.strictEqual(balance, tokensToOffer / 2);
            },
          },
        ])
      ));

    it("reverts if user doesn't have enough funds", () =>
      prepareSaleAndOffer()
        .then(() =>
          useMethodsOn(TetherToken, [
            {
              // We send less than the requirem amount of st
              // to the buying user
              method: 'transfer',
              args: [accounts[1], stRequired - 20],
              account: accounts[0],
            },
            {
              method: 'approve',
              args: [DBTokenSell.options.address, stRequired - 20],
              account: accounts[1],
            },
          ])
        )
        .then(() =>
          useMethodsOn(DBTokenSell, {
            method: 'buyOfferedTokens',
            args: [eventCode, expectedOfferId, tokensToOffer],
            account: accounts[1],
            catch: (err) => {
              assert.strictEqual(err, 'DBTokenSell: insufficient token amount');
            },
          })
        ));

    it('transfers correct amount of funds on successful sale', () => {
      let stBalance;
      const setStBalance = (newBalance) => {
        stBalance = newBalance;
      };

      return prepareSaleOfferAndBuyerFunds()
        .then(() =>
          useMethodsOn(TetherToken, {
            method: 'balanceOf',
            args: [accounts[0]],
            account: accounts[0],
            onReturn: (balance) => setStBalance(parseInt(balance)),
          })
        )
        .then(() =>
          useMethodsOn(DBTokenSell, {
            method: 'buyOfferedTokens',
            args: [eventCode, expectedOfferId, tokensToOffer],
            account: accounts[1],
          })
        )
        .then(() =>
          useMethodsOn(DBTokens[dbtokenIndex], {
            method: 'balanceOf',
            args: [accounts[1]],
            account: accounts[0],
            onReturn: (balance) => {
              assert.strictEqual(parseInt(balance), tokensToOffer);
            },
          })
        )
        .then(() =>
          useMethodsOn(TetherToken, {
            method: 'balanceOf',
            args: [accounts[0]],
            account: accounts[0],
            onReturn: (balance) => {
              assert.strictEqual(parseInt(balance), stBalance + stRequired);
            },
          })
        );
    });

    it('allows offering user to cancel offer and withdraw tokens to wallet', () =>
      prepareSaleAndOffer()
        .then(() =>
          useMethodsOn(DBTokenSell, [
            {
              method: 'cancelOffer',
              args: [eventCode, expectedOfferId],
              account: accounts[0],
            },
            {
              method: 'getAllEventOffers',
              args: [eventCode],
              account: accounts[0],
              onReturn: ([eventOffer]) => {
                // After cancelling offer, the status should be 3 (OfferStatus.Cancelled)
                assert.strictEqual(parseInt(eventOffer.status), 3);
              },
            },
          ])
        )
        .then(() =>
          useMethodsOn(DBTokens[dbtokenIndex], {
            method: 'balanceOf',
            args: [accounts[0]],
            account: accounts[0],
            onReturn: (balance) => {
              assert.strictEqual(parseInt(balance), tokensToOffer);
            },
          })
        ));

    it('allows partial purchase', () => {
      const totalPurchases = 8;
      const partialPurchaseAmount = Math.round(tokensToOffer / totalPurchases);

      return prepareSaleAndOffer()
        .then(() =>
          useMethodsOn(TetherToken, [
            {
              // We transfer more than it is required for all the purchases,
              // since we want to try to purchase once again after and
              // receive an error message that the offer is closed
              method: 'transfer',
              args: [accounts[1], stRequired * 2],
              account: accounts[0],
            },
            {
              method: 'approve',
              args: [DBTokenSell.options.address, stRequired * 2],
              account: accounts[1],
            },
          ])
        )
        .then(() =>
          useMethodsOn(DBTokenSell, [
            ...newArray(totalPurchases, (i) => [
              {
                // We purchase a partial amount of tokens
                method: 'buyOfferedTokens',
                args: [eventCode, expectedOfferId, partialPurchaseAmount],
                account: accounts[1],
              },
              {
                method: 'getAllEventOffers',
                args: [eventCode],
                account: accounts[0],
                onReturn: ([eventOffer]) => {
                  // Each time we expect that the amount of tokens
                  // left is decreased
                  assert.strictEqual(
                    parseInt(eventOffer.tokensLeft),
                    tokensToOffer - (i + 1) * partialPurchaseAmount
                  );
                  // After the final purchase the offer status should be
                  // set to 2 (OfferStatus.Sold)
                  assert.strictEqual(
                    parseInt(eventOffer.status),
                    i === totalPurchases - 1 ? 2 : 1
                  );
                },
              },
            ]).flat(),
            {
              method: 'buyOfferedTokens',
              args: [eventCode, expectedOfferId, partialPurchaseAmount],
              account: accounts[1],
              catch: (err) => {
                assert.strictEqual(
                  err,
                  'DBTokenSell: offer is not open for purchase'
                );
              },
            },
          ])
        );
    });
  });

  describe('DBTokenSellV2', () => {
    const dbtokenIndex = 0;
    const tokensToOffer = 100;
    const minSTRequired = 120;
    const bidAmounts = [200, 300, 400];
    const expectedOfferId = `${eventCode}-${teamTokenParams[dbtokenIndex].teamName}-0`;

    const prepareSaleAndOffer = () =>
      useMethodsOn(DBTokenEvent, {
        // We mint the DBTokens we want to put up for offer
        method: 'mintTeamToken',
        args: [
          teamTokenParams[dbtokenIndex].teamName,
          accounts[0],
          tokensToOffer,
        ],
        account: accounts[0],
      })
        .then(() =>
          useMethodsOn(DBTokens[dbtokenIndex], {
            // The offering user approves the wanted amount of tokens towards
            // the DBTokenSellV2 contract
            method: 'approve',
            args: [DBTokenSellV2.options.address, tokensToOffer],
            account: accounts[0],
          })
        )
        .then(() =>
          useMethodsOn(DBTokenSellV2, [
            {
              // We start the sale, allowing the users to put offers with
              // tokens belonging to this event
              method: 'setSaleStartEnd',
              args: [eventCode, 0, secondsInTheFuture(10)],
              account: accounts[0],
            },
            {
              // The offering user adds an offer to the correct event
              method: 'addOffer',
              args: [
                eventCode,
                DBTokens[dbtokenIndex].options.address,
                tokensToOffer,
                minSTRequired,
              ],
              account: accounts[0],
            },
          ])
        );

    const prepareSaleOfferAndBids = () =>
      prepareSaleAndOffer()
        .then(() =>
          useMethodsOn(
            TetherToken,
            bidAmounts.flatMap((bidAmount, index) => [
              {
                // We transfer the tokens required for bidding
                // to each participating user
                method: 'transfer',
                args: [accounts[index + 1], bidAmount],
                account: accounts[0],
              },
              {
                // Each user must approve the amount of tokens
                // they wish to bid towards the DBTokenSellV2 contract
                method: 'approve',
                args: [DBTokenSellV2.options.address, bidAmount],
                account: accounts[index + 1],
              },
            ])
          )
        )
        .then(() =>
          useMethodsOn(
            DBTokenSellV2,
            bidAmounts.map((bidAmount, index) => ({
              // Each user then proceeds to bid on the DBTokenSellV2 contract
              method: 'bidOnOffer',
              args: [eventCode, expectedOfferId, bidAmount],
              account: accounts[index + 1],
            }))
          )
        );

    it('deploys successfully', () => {
      assert.ok(DBTokenSellV2.options.address);
    });

    it('allows users holding DBTokens to offer them for sale', () => {
      const DBToken = DBTokens[dbtokenIndex];

      return prepareSaleAndOffer().then(() =>
        useMethodsOn(DBTokenSellV2, {
          // After the sale and offer have been initialized, we get
          // an array of all offers in the given event and check if
          // offer data is correct
          method: 'getAllEventOffers',
          args: [eventCode],
          account: accounts[0],
          onReturn: ([eventOffer]) => {
            assert.strictEqual(eventOffer.offerId, expectedOfferId);

            assert.strictEqual(parseInt(eventOffer.status), 1);
            assert.strictEqual(eventOffer.offeringUser, accounts[0]);
            assert.strictEqual(
              eventOffer.tokenInstance,
              DBToken.options.address
            );
            assert.strictEqual(
              parseInt(eventOffer.tokensOffered),
              tokensToOffer
            );
            assert.strictEqual(
              parseInt(eventOffer.minStandardTokensRequested),
              minSTRequired
            );
          },
        })
      );
    });

    it('reverts if user tries to match the highest bid', () => {
      const invalidFinalBid = bidAmounts[bidAmounts.length - 1];

      return prepareSaleOfferAndBids()
        .then(() => {
          return useMethodsOn(TetherToken, [
            {
              method: 'transfer',
              args: [accounts[bidAmounts.length + 1], invalidFinalBid],
              account: accounts[0],
            },
            {
              method: 'approve',
              args: [DBTokenSellV2.options.address, invalidFinalBid],
              account: accounts[bidAmounts.length + 1],
            },
          ]);
        })
        .then(() =>
          useMethodsOn(DBTokenSellV2, {
            // Any bid placed on an offer must be higher than
            // the current highest bid
            method: 'bidOnOffer',
            args: [eventCode, expectedOfferId, invalidFinalBid],
            account: accounts[bidAmounts.length + 1],
            catch: (err) => {
              assert.strictEqual(
                err,
                'DBTokenSellV2: must bid more than the current highest bid'
              );
            },
          })
        );
    });

    it('reverts if user tries withdraw all from offer before closing sale or offer', () =>
      prepareSaleOfferAndBids().then(() =>
        useMethodsOn(DBTokenSellV2, {
          // Funds can only be withdrawn from the offer
          // once the sale ends or the offering user
          // closes the offer
          method: 'withdrawAllFromOffer',
          args: [eventCode, expectedOfferId],
          account: accounts[2],
          catch: (err) => {
            assert.strictEqual(
              err,
              'DBTokenSellV2: can withdraw only if sale or offer is closed'
            );
          },
        })
      ));

    it('allows users to place bids on offers', () => {
      return prepareSaleOfferAndBids().then(() =>
        useMethodsOn(DBTokenSellV2, {
          method: 'getAllEventOffers',
          args: [eventCode],
          account: accounts[0],
          onReturn: ([eventOffer]) => {
            // We just go through all the bids on the given offer
            // and check if the data is correct
            eventOffer.bids.forEach(
              ({ biddingUser, standardTokensOffered }, index) => {
                assert.strictEqual(biddingUser, accounts[index + 1]);
                assert.strictEqual(
                  parseInt(standardTokensOffered),
                  bidAmounts[index]
                );
              }
            );
          },
        })
      );
    });

    it('trades the tokens for standard tokens with the user with the highest bid', () => {
      let initalBalance = 0;
      const setInitialBalance = (balance) => {
        initalBalance = parseInt(balance);
      };

      return prepareSaleOfferAndBids()
        .then(() =>
          useMethodsOn(TetherToken, {
            method: 'balanceOf',
            args: [accounts[0]],
            account: accounts[0],
            // We save the initial USDT balance of the offerring user
            onReturn: (balance) => setInitialBalance(balance),
          })
        )
        .then(() =>
          useMethodsOn(DBTokenSellV2, [
            {
              method: 'finalizeOffer',
              args: [eventCode, expectedOfferId],
              account: accounts[0],
            },
            {
              method: 'withdrawAllFromOffer',
              args: [eventCode, expectedOfferId],
              account: accounts[0],
            },
          ])
        )
        .then(() =>
          useMethodsOn(TetherToken, {
            method: 'balanceOf',
            args: [accounts[0]],
            account: accounts[0],
            onReturn: (balance) => {
              const highestBid = bidAmounts[bidAmounts.length - 1];
              // We expect that the highest bid has been transferred to
              // the offerring user's wallet
              assert.strictEqual(parseInt(balance), initalBalance + highestBid);
            },
          })
        );
    });

    it('allows the owner of offer to cancel offer before any bids are placed and return the tokens', () => {
      return prepareSaleAndOffer()
        .then(() =>
          useMethodsOn(DBTokenSellV2, [
            {
              method: 'finalizeOffer',
              args: [eventCode, expectedOfferId],
              account: accounts[0],
            },
            {
              method: 'withdrawAllFromOffer',
              args: [eventCode, expectedOfferId],
              account: accounts[0],
            },
          ])
        )
        .then(() =>
          useMethodsOn(DBTokens[dbtokenIndex], {
            method: 'balanceOf',
            args: [accounts[0]],
            account: accounts[0],
            onReturn: (balance) => {
              // If no bids have been placed on the user's offer
              // then just the offered tokens are transferred back
              // to the user's wallet
              assert.strictEqual(parseInt(balance), tokensToOffer);
            },
          })
        );
    });

    it('returns all the tokens from bids that are not the highest bid', () => {
      return prepareSaleOfferAndBids()
        .then(() =>
          useMethodsOn(DBTokenSellV2, [
            {
              method: 'finalizeOffer',
              args: [eventCode, expectedOfferId],
              account: accounts[0],
            },
            {
              method: 'withdrawAllFromOffer',
              args: [eventCode, expectedOfferId],
              account: accounts[0],
            },
          ])
        )
        .then(() =>
          useMethodsOn(
            TetherToken,
            bidAmounts.map((bidAmount, index) => ({
              method: 'balanceOf',
              args: [accounts[index + 1]],
              account: accounts[0],
              onReturn: (balance) => {
                const isHighestBid = index === bidAmounts.length - 1;
                // If the user placed the highest bid, their standard tokens
                // are transferred to the user which initially offered DBTokens
                // for sale. Otherwise, their standard tokens should be transferred
                // back to their wallet
                const expectedBalance = isHighestBid ? 0 : bidAmount;

                assert.strictEqual(parseInt(balance), expectedBalance);
              },
            }))
          )
        );
    });

    it('allows users to bid multiple times and transfers only the required amount for escrow', () => {
      const highestBidAmount = bidAmounts[bidAmounts.length - 1];

      return prepareSaleOfferAndBids()
        .then(() =>
          useMethodsOn(
            TetherToken,
            bidAmounts.flatMap((_, index) => [
              {
                // Since these users are bidding for the second time, we
                // only need to transfer the difference between their
                // highest and current bid
                method: 'transfer',
                args: [accounts[index + 1], highestBidAmount],
                account: accounts[0],
              },
              {
                method: 'approve',
                args: [DBTokenSellV2.options.address, highestBidAmount],
                account: accounts[index + 1],
              },
            ])
          )
        )
        .then(() =>
          useMethodsOn(DBTokenSellV2, [
            ...bidAmounts.map((bidAmount, index) => ({
              // The users place a new higher bid
              method: 'bidOnOffer',
              args: [eventCode, expectedOfferId, bidAmount + highestBidAmount],
              account: accounts[index + 1],
            })),
            {
              method: 'getAllEventOffers',
              args: [eventCode],
              account: accounts[0],
              onReturn: ([eventOffer]) => {
                // Since all users bid twice, we expect twice as many bids
                // on the offer
                assert.strictEqual(
                  eventOffer.bids.length,
                  bidAmounts.length * 2
                );
              },
            },
          ])
        )
        .then(() =>
          useMethodsOn(DBTokenSellV2, [
            {
              method: 'finalizeOffer',
              args: [eventCode, expectedOfferId],
              account: accounts[0],
            },
            {
              method: 'withdrawAllFromOffer',
              args: [eventCode, expectedOfferId],
              account: accounts[0],
            },
          ])
        )
        .then(() =>
          useMethodsOn(
            TetherToken,
            bidAmounts.map((bidAmount, index) => ({
              method: 'balanceOf',
              args: [accounts[index + 1]],
              account: accounts[0],
              onReturn: (balance) => {
                const isHighestBid = index === bidAmounts.length - 1;
                const expectedBalance = isHighestBid
                  ? 0
                  : bidAmount + highestBidAmount;

                assert.strictEqual(parseInt(balance), expectedBalance);
              },
            }))
          )
        );
    });
  });
});
