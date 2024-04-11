const assert = require('assert');
const contracts = require('../compile');
const {
  useMethodsOn,
  newArray,
  randomInt,
  valuesWithinPercentage,
  zeroOrOne,
  valuesWithin,
} = require('../utils/helper');
const { getAccounts, deploy } = require('../utils/useWeb3');

const tokenContract = contracts['MinoDao.sol'].MinoDao;
const salesContract = contracts['MinoDaoSales.sol'].MinoDaoSales;
const rewardsContract = contracts['MinoDaoRewards.sol'].MinoDaoRewards;
const rbnContract = contracts['RBNV2Token.sol'].RBNV2Token;

describe('MinoDao tests', () => {
  let accounts, MinoDao, MinoDaoSales, MinoDaoRewards, RBNToken, RewardToken;

  const tokenName = 'MinoDao';
  const tokenSymbol = 'MD';
  const baseUri = 'http://mino_dao/';
  const rbnTaxPercentage = 10;
  const withoutTax = (amount) =>
    Math.round(amount * (1 - rbnTaxPercentage / 100));

  const SaleStatus = {
    Unitialized: 0,
    Active: 1,
    Sold: 2,
  };

  // Generates random data for creating MinoDao sales
  const generateSalesData = (numOfSales) =>
    newArray(numOfSales, (i) => ({
      tokenId: i + 1,
      price: randomInt(200, 500),
      account: accounts[i + 1],
    }));

  // Prepares sales and transfer all participating user
  // funds to their wallet, allowing them to make purchases
  // immediately after
  const prepareSales = (salesParameters) =>
    useMethodsOn(
      RBNToken,
      salesParameters.flatMap(({ price, account }) => [
        {
          // We transfer the funds needed for the MinoDao
          // purchase to the designated user
          method: 'transfer',
          args: [account, price],
          account: accounts[0],
        },
        {
          // And the user approves the funds towards our sales contract
          method: 'approve',
          args: [MinoDaoSales.options.address, price],
          account,
        },
      ])
    )
      .then(() =>
        useMethodsOn(
          MinoDao,
          salesParameters.flatMap(({ tokenId }) => [
            {
              // We mint each of the tokens we plan to add for sale
              method: 'mint',
              args: [tokenId],
              account: accounts[0],
            },
            {
              // And approve them towards the sales contract
              method: 'approve',
              args: [MinoDaoSales.options.address, tokenId],
              account: accounts[0],
            },
          ])
        )
      )
      .then(() =>
        useMethodsOn(
          MinoDaoSales,
          salesParameters.flatMap(({ tokenId, price }) => [
            {
              // And we create a sale for each one of the tokens and set the price
              method: 'createSale',
              args: [tokenId, price],
              account: accounts[0],
            },
          ])
        )
      );

  // After the sale preparation, also executes the user purchase
  // so we should expect the tokens are inside users' wallets
  const prepareSalesAndUserPurchases = (salesParameters) =>
    prepareSales(salesParameters).then(() =>
      useMethodsOn(
        MinoDaoSales,
        salesParameters.map(({ tokenId, account }) => ({
          method: 'purchaseTokenFromSale',
          args: [tokenId],
          account,
        }))
      )
    );

  beforeEach(async () => {
    accounts = await getAccounts();
    MinoDao = await deploy(
      tokenContract,
      [tokenName, tokenSymbol, baseUri],
      accounts[0]
    );
    RBNToken = await deploy(
      rbnContract,
      ['Robinos Token V2', 'RBNv2', 100000000, accounts[0], rbnTaxPercentage],
      accounts[0]
    );
    MinoDaoSales = await deploy(
      salesContract,
      [MinoDao.options.address, RBNToken.options.address],
      accounts[0]
    );
    RewardToken = await deploy(
      rbnContract,
      ['Robinos Token V2', 'RBNv2', 10000000000, accounts[0], 0],
      accounts[0]
    );
    MinoDaoRewards = await deploy(
      rewardsContract,
      [MinoDao.options.address, RewardToken.options.address],
      accounts[0]
    );

    // We want to prevent taxes on instances where we transfer the required funds
    // to participating users and when the owner withdraws the funds from the sales
    // contract
    await useMethodsOn(RBNToken, [
      {
        method: 'setTaxFreeAddress',
        args: [accounts[0], true],
        account: accounts[0],
      },
    ]);
  });

  describe('MinoDao', () => {
    const tokenId = 1;
    const getTokenMintData = (numOfUsers) =>
      newArray(numOfUsers, (i) => ({
        tokenId: i + 1,
        account: accounts[i + 1],
        honorary: !!zeroOrOne(),
      }));

    it('deploys successfully', () => {
      assert.ok(MinoDao.options.address);
    });

    it('allows owner to mint tokens', () =>
      useMethodsOn(MinoDao, [
        {
          method: 'mint',
          args: [tokenId],
          account: accounts[0],
        },
        {
          method: 'ownerOf',
          args: [tokenId],
          account: accounts[0],
          onReturn: (owner) => {
            // We check if the minted token is in owner's wallet
            assert.strictEqual(owner, accounts[0]);
          },
        },
      ]));

    it('allows owner to set honorary status', () =>
      useMethodsOn(MinoDao, [
        {
          // We mint the token
          method: 'mint',
          args: [tokenId],
          account: accounts[0],
        },
        {
          // And the owner sets the honorary flag on the token to true
          method: 'setHonorary',
          args: [tokenId, true],
          account: accounts[0],
        },
        {
          method: 'isHonorary',
          args: [tokenId],
          account: accounts[0],
          onReturn: (isHonorary) => {
            // Then we just check if the honorary flag on the token is correct
            assert.ok(isHonorary);
          },
        },
      ]));

    it('reverts if non owner tries to set honorary status', () =>
      useMethodsOn(MinoDao, [
        {
          method: 'mint',
          args: [tokenId],
          account: accounts[0],
        },
        {
          method: 'setHonorary',
          args: [tokenId, true],
          account: accounts[1],
          catch: (err) => {
            // Only owner should be able to set the honorary flag
            assert.strictEqual(err, 'Ownable: caller is not the owner');
          },
        },
        {
          method: 'isHonorary',
          args: [tokenId],
          account: accounts[0],
          onReturn: (isHonorary) => {
            // The honorary flag should be intact
            assert.ok(!isHonorary);
          },
        },
      ]));

    it('records tokenIds', () => {
      const numOfOwners = 3;
      return useMethodsOn(MinoDao, [
        ...newArray(numOfOwners, (i) => {
          const tokenId = i + 1;
          const userIndex = tokenId;
          return [
            {
              method: 'mint',
              args: [tokenId],
              account: accounts[0],
            },
            {
              method: 'safeTransferFrom',
              args: [accounts[0], accounts[userIndex], tokenId],
              account: accounts[0],
            },
          ];
        }).flat(),
        {
          // We get all the minted token IDs
          method: 'getTokenIds',
          account: accounts[0],

          onReturn: (tokenIds) => {
            // And check if we have the correct IDs
            assert.deepStrictEqual(
              tokenIds.map((v) => parseInt(v)),
              newArray(numOfOwners, (i) => i + 1)
            );
          },
        },
      ]);
    });

    it('records honorary tokenIds', () => {
      const numOfOwners = 5;
      const honoraryMembersIndeces = [0, 1];

      return useMethodsOn(MinoDao, [
        ...newArray(numOfOwners, (i) => {
          const tokenId = i + 1;
          const userIndex = tokenId;
          const isHonoraryMember = honoraryMembersIndeces.includes(i);
          return [
            {
              method: 'mint',
              args: [tokenId],
              account: accounts[0],
            },
            {
              method: 'setHonorary',
              args: [tokenId, isHonoraryMember],
              account: accounts[0],
            },
            {
              method: 'safeTransferFrom',
              args: [accounts[0], accounts[userIndex], tokenId],
              account: accounts[0],
            },
          ];
        }).flat(),
        {
          // We get all the honorary token IDs
          method: 'getHonoraryTokenIds',
          account: accounts[0],

          onReturn: (tokenIds) => {
            assert.deepStrictEqual(
              // And check if we got the correct IDs
              tokenIds.map((v) => parseInt(v)),
              honoraryMembersIndeces.map((i) => i + 1)
            );
          },
        },
      ]);
    });

    it('prints all token data', () => {
      const numOfOwners = 5;
      const tokenMintData = getTokenMintData(numOfOwners);
      return useMethodsOn(MinoDao, [
        ...tokenMintData.flatMap(({ account, tokenId, honorary }) => [
          {
            method: 'mint',
            args: [tokenId],
            account: accounts[0],
          },
          {
            method: 'setHonorary',
            args: [tokenId, honorary],
            account: accounts[0],
          },
          {
            method: 'safeTransferFrom',
            args: [accounts[0], account, tokenId],
            account: accounts[0],
          },
        ]),
        {
          method: 'getAllTokensData',
          account: accounts[0],
          onReturn: (tokensData) => {
            tokensData.forEach(({ tokenId, owner, honorary }, i) => {
              // For each minted token we should get:
              // tokenId
              assert.strictEqual(parseInt(tokenId), tokenMintData[i].tokenId);
              // owner address
              assert.strictEqual(owner, tokenMintData[i].account);
              // and the honorary flag
              assert.strictEqual(honorary, tokenMintData[i].honorary);
            });
          },
        },
      ]);
    });
  });

  describe('MinoDaoSales', () => {
    it('deploys successfully', () => {
      assert.ok(MinoDaoSales.options.address);
    });

    it('allows owner to create token sales', () => {
      const saleData = generateSalesData(3);

      return prepareSales(saleData).then(() =>
        useMethodsOn(MinoDaoSales, {
          method: 'getAllSales',
          account: accounts[0],
          onReturn: (sales) => {
            sales.forEach(({ tokenId, status, price }, i) => {
              // We check if we have recorded the sale and if the data is correct
              assert.strictEqual(parseInt(tokenId), saleData[i].tokenId);
              assert.strictEqual(parseInt(status), SaleStatus.Active);
              assert.strictEqual(parseInt(price), saleData[i].price);
            });
          },
        })
      );
    });

    it('allows users to purchase tokens from active sales', () => {
      const saleData = generateSalesData(5);

      return (
        prepareSalesAndUserPurchases(saleData)
          // After all the sales are prepared and the users purchase tokens
          .then(() =>
            useMethodsOn(MinoDaoSales, {
              method: 'getAllSales',
              account: accounts[0],
              onReturn: (sales) => {
                sales.forEach(({ tokenId, status, price }, i) => {
                  // We check that all sales have been checked as 'Sold'
                  assert.strictEqual(parseInt(tokenId), saleData[i].tokenId);
                  assert.strictEqual(parseInt(status), SaleStatus.Sold);
                  assert.strictEqual(parseInt(price), saleData[i].price);
                });
              },
            })
          )
          .then(() =>
            useMethodsOn(
              MinoDao,
              saleData.map(({ tokenId, account }) => ({
                method: 'ownerOf',
                args: [tokenId],
                account: accounts[0],
                onReturn: (owner) => {
                  // And we check if all the tokens put for sale
                  // are in the purchasing user's wallet
                  assert.strictEqual(owner, account);
                },
              }))
            )
          )
          .then(() =>
            useMethodsOn(RBNToken, {
              method: 'balanceOf',
              args: [MinoDaoSales.options.address],
              account: accounts[0],
              onReturn: (balance) => {
                const priceSum = saleData.reduce(
                  (total, { price }) => total + price,
                  0
                );
                // And we check that all the funds from all the sales
                // are on our sales contract's address
                assert.ok(
                  valuesWithinPercentage(
                    parseInt(balance),
                    // Since RBNToken taxes transactions to non-tax-free addresses
                    // we must check that the amount without tax is on our sales contract.
                    // Also, since this calculation cannot be perfect after multiple purchases
                    // and tax calculations, we expect the values are within 1% of each other
                    withoutTax(priceSum),
                    1
                  )
                );
              },
            })
          )
      );
    });

    it('reverts if user tries to purchase from a closed sale', () => {
      const saleData = generateSalesData(1);
      const [{ tokenId, price, account }] = saleData;

      return prepareSales(saleData)
        .then(() =>
          useMethodsOn(RBNToken, [
            {
              method: 'transfer',
              args: [account, price],
              account: accounts[0],
            },
            {
              method: 'approve',
              args: [MinoDaoSales.options.address, price],
              account,
            },
          ])
        )
        .then(() =>
          useMethodsOn(MinoDaoSales, [
            {
              method: 'purchaseTokenFromSale',
              args: [tokenId],
              account,
            },
            {
              method: 'purchaseTokenFromSale',
              args: [tokenId],
              account,
              catch: (err) => {
                // Method should revert if the sale is closed
                assert.strictEqual(
                  err,
                  'GeneratingTokenSales: sale is not active'
                );
              },
            },
          ])
        );
    });

    it('allows only owner to withdraw all funds', () => {
      const state = { balance: 0 };
      const fundsToSend = 10000;

      return useMethodsOn(RBNToken, [
        {
          method: 'transfer',
          args: [MinoDaoSales.options.address, fundsToSend],
          account: accounts[0],
        },
        {
          method: 'balanceOf',
          args: [accounts[0]],
          account: accounts[0],
          onReturn: (balance) => {
            state.balance = parseInt(balance);
          },
        },
      ])
        .then(() =>
          useMethodsOn(MinoDaoSales, [
            {
              method: 'withdrawAllFunds',
              account: accounts[1],
              catch: (err) => {
                // Method should revert if a non-owner tries to execute
                assert.strictEqual(err, 'Ownable: caller is not the owner');
              },
            },
            {
              // The owner withdraws all funds to their wallet
              method: 'withdrawAllFunds',
              account: accounts[0],
            },
          ])
        )
        .then(() =>
          useMethodsOn(RBNToken, {
            method: 'balanceOf',
            args: [accounts[0]],
            account: accounts[0],
            onReturn: (balance) => {
              // We check that all the funds are on the owner's wallet
              assert.strictEqual(
                parseInt(balance) - state.balance,
                // Since we disabled tax when transfering funds from/to
                // owner's address, we can expect the full amount to be
                // on the owner's address
                fundsToSend
              );
            },
          })
        );
    });
  });

  describe('MinoDaoRewards', () => {
    it('deploys successfully', () => {
      assert.ok(MinoDaoRewards.options.address);
    });

    it('distributes rewards to all users', () => {
      const numOfUsers = 5;
      const salesData = generateSalesData(numOfUsers);
      const totalReward = 10000;
      const perUserReward = Math.round(totalReward / numOfUsers);

      return prepareSalesAndUserPurchases(salesData)
        .then(() =>
          useMethodsOn(RewardToken, {
            // We approve the funds we want to use as reward
            method: 'approve',
            args: [MinoDaoRewards.options.address, totalReward],
            account: accounts[0],
          })
        )
        .then(() =>
          useMethodsOn(MinoDaoRewards, {
            // The owner distributes the reward to all token holders
            method: 'distributeReward',
            args: [totalReward],
            account: accounts[0],
          })
        )
        .then(() =>
          useMethodsOn(
            RewardToken,
            salesData.map(({ account }) => ({
              method: 'balanceOf',
              args: [account],
              account: accounts[0],
              onReturn: (balance) => {
                assert.ok(
                  // We check if the user reward is in their wallet.
                  // Since there is manual rounding of individual rewards,
                  // We check if the values are close enough
                  valuesWithin(parseInt(balance), perUserReward, 1)
                );
              },
            }))
          )
        );
    });

    it('distributes rewards to honorary users', () => {
      const numOfUsers = 5;
      const honoraryIndeces = [0, 2];
      const salesData = generateSalesData(numOfUsers);
      const totalReward = 10000;
      const perUserReward = Math.round(totalReward / honoraryIndeces.length);

      return prepareSalesAndUserPurchases(salesData)
        .then(() =>
          useMethodsOn(RewardToken, {
            // We approve the funds we want to use as reward
            method: 'approve',
            args: [MinoDaoRewards.options.address, totalReward],
            account: accounts[0],
          })
        )
        .then(() =>
          useMethodsOn(
            MinoDao,
            honoraryIndeces.map((i) => ({
              // We set the honorary flag on designated tokens
              method: 'setHonorary',
              args: [salesData[i].tokenId, true],
              account: accounts[0],
            }))
          )
        )
        .then(() =>
          useMethodsOn(MinoDaoRewards, {
            // The owner distributes the reward to all honorary token holders
            method: 'distributeHonoraryReward',
            args: [totalReward],
            account: accounts[0],
          })
        )
        .then(() =>
          useMethodsOn(
            RewardToken,
            salesData.map(({ account }, i) => ({
              method: 'balanceOf',
              args: [account],
              account: accounts[0],
              onReturn: (balance) => {
                if (!honoraryIndeces.includes(i)) {
                  // If the user does not hold an honorary token,
                  // they shouldn't have any reward in their wallet
                  assert.strictEqual(parseInt(balance), 0);
                  return;
                }

                assert.ok(
                  // We check if the honorary user reward is in their wallet.
                  // Since there is manual rounding of individual rewards,
                  // We check if the values are close enough
                  valuesWithin(parseInt(balance), perUserReward, 1)
                );
              },
            }))
          )
        );
    });

    it('records sales', () => {
      const numOfUsers = 5;
      const honoraryIndeces = [0, 2];
      const salesData = generateSalesData(numOfUsers);
      const rewards = [
        { prize: 100000, honorary: true },
        { prize: 50000, honorary: false },
        { prize: 2100, honorary: true },
      ];
      const totalPrize = rewards.reduce((total, { prize }) => total + prize, 0);

      return prepareSalesAndUserPurchases(salesData)
        .then(() =>
          useMethodsOn(RewardToken, {
            method: 'approve',
            args: [MinoDaoRewards.options.address, totalPrize],
            account: accounts[0],
          })
        )
        .then(() =>
          useMethodsOn(
            MinoDao,
            honoraryIndeces.map((i) => ({
              method: 'setHonorary',
              args: [salesData[i].tokenId, true],
              account: accounts[0],
            }))
          )
        )
        .then(() =>
          useMethodsOn(MinoDaoRewards, [
            ...rewards.map(({ prize, honorary }) => ({
              method: honorary
                ? 'distributeHonoraryReward'
                : 'distributeReward',
              args: [prize],
              account: accounts[0],
            })),
            {
              method: 'getAllRewards',
              account: accounts[0],
              onReturn: (sales) => {
                sales.forEach(({ prize, honorary, winningMembers }, i) => {
                  const expectedWinners = honorary
                    ? honoraryIndeces.map((i) => accounts[i + 1])
                    : newArray(numOfUsers, (i) => accounts[i + 1]);

                  // We check all the rewards initialized on the contract.
                  // Each should have the correct:
                  // prize
                  assert.strictEqual(parseInt(prize), rewards[i].prize);
                  // honorary flag
                  assert.strictEqual(honorary, rewards[i].honorary);
                  // array of winners
                  assert.deepStrictEqual(winningMembers, expectedWinners);
                });
              },
            },
          ])
        );
    });
  });
});
