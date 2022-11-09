const assert = require('assert');
const contracts = require('../compile');
const { useMethodsOn, newArray } = require('../utils/helper');
const { getAccounts, deploy } = require('../utils/useWeb3');

const tokenContract = contracts['MinoToken.sol'].MinoToken;
const rngContract = contracts['MinoToken.sol'].RandomNumberGenerator;
const rewardContract = contracts['MinoTokenReward.sol'].MinoTokenReward;
const erc20tokenContract = contracts['DBToken.sol'].DBToken;

describe('MinoToken tests', () => {
  let accounts, MinoToken, MinoTokenReward, DBToken, RandomNumberGenerator;

  const tokenName = 'MinoToken';
  const tokenSymbol = 'MT';
  const baseUri = 'http://mino_token/';
  const seriesName = 'EPL';

  const rarityLevels = [
    { name: 'GOAT', availableTokens: 1 },
    { name: 'Hall of Famer', availableTokens: 3 },
    { name: 'Legend ', availableTokens: 7 },
  ];

  const mintableTokens = [
    {
      name: 'Ronaldo',
      tokenUri: 'ronaldo',
      rarityLevelIndex: 0,
      sport: 'Football',
    },
    {
      name: 'Rooney',
      tokenUri: 'rooney',
      rarityLevelIndex: 1,
      sport: 'Football',
    },
    {
      name: 'Jovetic',
      tokenUri: 'jovetic',
      rarityLevelIndex: 2,
      sport: 'Football',
    },
  ];

  const usersMintsPerSeries = [2, 2, 3, 3, 1];

  beforeEach(async () => {
    accounts = await getAccounts();
    RandomNumberGenerator = await deploy(rngContract, [], accounts[0]);
    MinoToken = await deploy(
      tokenContract,
      [tokenName, tokenSymbol, baseUri, RandomNumberGenerator.options.address],
      accounts[0]
    );
    MinoTokenReward = await deploy(
      rewardContract,
      [MinoToken.options.address],
      accounts[0]
    );
    DBToken = await deploy(
      erc20tokenContract,
      ['DBToken', 'DBT', seriesName, seriesName],
      accounts[0]
    );
  });

  describe('MinoToken', () => {
    it('deploys successfully', () => {
      assert.ok(MinoToken.options.address);
    });

    it('allows initializing and opening series for minting', () =>
      useMethodsOn(MinoToken, [
        {
          method: 'getSeriesFlags',
          args: [seriesName],
          onReturn: ({ initialized, mintingIsOpen }) => {
            // If the series hasn't been initialized yet, both flags should be false.
            assert.ok(!initialized);
            assert.ok(!mintingIsOpen);
          },
          account: accounts[0],
        },
        {
          // The owner initializes a new series
          method: 'initializeSeries',
          args: [seriesName],
          account: accounts[0],
        },
        {
          method: 'getSeriesFlags',
          args: [seriesName],
          onReturn: ({ initialized, mintingIsOpen }) => {
            // Initialized flag should be set to true now
            assert.ok(initialized);
            assert.ok(!mintingIsOpen);
          },
          account: accounts[0],
        },
        {
          // The owner sets the minting for the series to open
          method: 'setSeriesMintingIsOpen',
          args: [seriesName, true],
          account: accounts[0],
        },
        {
          method: 'getSeriesFlags',
          args: [seriesName],
          onReturn: ({ initialized, mintingIsOpen }) => {
            // Now both flags should be set to true
            assert.ok(initialized);
            assert.ok(mintingIsOpen);
          },
          account: accounts[0],
        },
      ]));

    it('allows adding rarity levels', () =>
      useMethodsOn(
        MinoToken,
        rarityLevels.flatMap(({ name, availableTokens }) => [
          {
            // Owner can add a new rarity level by providing a
            // level name and num of available tokens
            method: 'addNewRarityLevel',
            args: [name, availableTokens],
            account: accounts[0],
          },
          {
            // We should be able to serach for the rarity name with the num of available tokens
            method: 'getRarityLevelName',
            args: [availableTokens],
            onReturn: (rarityLevelName) => {
              assert.strictEqual(rarityLevelName, name);
            },
            account: accounts[0],
          },
          {
            // And we can search for the num of available tokens with the level name
            method: 'getRarityLevelMintsPerSeries',
            args: [name],
            onReturn: (rarityLevelAvailableMints) => {
              assert.strictEqual(
                parseInt(rarityLevelAvailableMints),
                availableTokens
              );
            },
            account: accounts[0],
          },
        ])
      ));

    it('allows owner to set individual user mints per series', () =>
      useMethodsOn(
        MinoToken,
        usersMintsPerSeries.flatMap((mintsPerSeries, index) => [
          {
            // The owner can set mints for series for each individual user
            method: 'setUserMints',
            args: [accounts[index], seriesName, mintsPerSeries],
            account: accounts[0],
          },
          {
            // We then check if the correct mints for series has been set for the user
            // on the contract
            method: 'getUserMintsForSeries',
            args: [accounts[index], seriesName],
            onReturn: (userMintsPerSeries) => {
              assert.strictEqual(parseInt(userMintsPerSeries), mintsPerSeries);
            },
            account: accounts[0],
          },
        ])
      ));

    it('allows owner to add mintable tokens', () =>
      useMethodsOn(MinoToken, [
        {
          // The owner must first initialize a new series
          method: 'initializeSeries',
          args: [seriesName],
          account: accounts[0],
        },
        ...rarityLevels.map(({ name, availableTokens }) => ({
          // Add at least one rarity level
          method: 'addNewRarityLevel',
          args: [name, availableTokens],
          account: accounts[0],
        })),
        ...mintableTokens.flatMap(
          ({ name, sport, tokenUri, rarityLevelIndex }) => [
            {
              // Then add mintable tokens in the initialized series and
              // link them with the already added rarity levels
              method: 'addNewMintableToken',
              args: [
                name,
                sport,
                tokenUri,
                rarityLevels[rarityLevelIndex].name,
                seriesName,
              ],
              account: accounts[0],
            },
            {
              // Then we get data for the added tokens and check if the
              // num of available tokens is correct
              method: 'getTokenMintData',
              args: [name, seriesName],
              onReturn: ({ totalAvailableMints, mintedInSeries }) => {
                const rarityLevelAvailableMints =
                  rarityLevels[rarityLevelIndex].availableTokens;

                assert.strictEqual(
                  parseInt(totalAvailableMints),
                  rarityLevelAvailableMints
                );
                // Minted in series should be 0 since no user has minted tokens yet
                assert.strictEqual(parseInt(mintedInSeries), 0);
              },
              account: accounts[0],
            },
          ]
        ),
      ]));

    it('allows whitelisted users to mint tokens', () => {
      let currentId = 0;
      const getId = () => {
        currentId++;
        return currentId;
      };

      return useMethodsOn(MinoToken, [
        {
          // The owner initializes a new series
          method: 'initializeSeries',
          args: [seriesName],
          account: accounts[0],
        },
        ...usersMintsPerSeries.map((mintsPerSeries, index) => ({
          // Assigns each user a allowed mints for series
          method: 'setUserMints',
          args: [accounts[index], seriesName, mintsPerSeries],
          account: accounts[0],
        })),
        ...rarityLevels.map(({ name, availableTokens }) => ({
          // Adds new rarity levels
          method: 'addNewRarityLevel',
          args: [name, availableTokens],
          account: accounts[0],
        })),
        ...mintableTokens.map(
          ({ name, sport, tokenUri, rarityLevelIndex }) => ({
            // Adds new tokens in the series and links them to the
            // already provided rarity levels
            method: 'addNewMintableToken',
            args: [
              name,
              sport,
              tokenUri,
              rarityLevels[rarityLevelIndex].name,
              seriesName,
            ],
            account: accounts[0],
          })
        ),
        {
          // Opens up minting for the series
          method: 'setSeriesMintingIsOpen',
          args: [seriesName, true],
          account: accounts[0],
        },
        ...usersMintsPerSeries.flatMap((mintsPerSeries, index) =>
          newArray(mintsPerSeries, () => {
            // getId creates an incremented number each time it is called
            const tokenId = getId();
            return [
              {
                // Each user can mint up to the allowed times per series
                method: 'mintToken',
                args: [seriesName],
                account: accounts[index],
              },
              {
                // Each time a user mints a token, we check if the user is the actual owner of the token
                method: 'ownerOf',
                args: [tokenId],
                onReturn: (owner) => {
                  // Since tokenId is incremeted by 1 on each call, here we also test if the
                  // AutoIncrementingTokenId functionality is working
                  assert.strictEqual(owner, accounts[index]);
                },
                account: accounts[index],
              },
            ];
          }).flat()
        ),
        ...usersMintsPerSeries.map((mintsPerSeries, index) => ({
          // We check for each user how many times they minted throught the series
          method: 'userMintedInSeries',
          args: [accounts[index], seriesName],
          onReturn: (userMintedInSeries) => {
            // If the retrieved value is equal to the allowed user mints per series,
            // the user can no longer mint in this series
            assert.ok(parseInt(userMintedInSeries) === mintsPerSeries);
          },
          account: accounts[0],
        })),
      ]);
    });
  });

  describe('MinoTokenReward', () => {
    it('deploys successfully', () => {
      assert.ok(MinoTokenReward.options.address);
    });

    it('allows owner to add rewards', () => {
      const seriesMintableTokens = {
        firstSeries: mintableTokens,
        secondSeries: mintableTokens,
      };
      const rewardName = 'Footballer of the year';
      const winningToken = Object.values(seriesMintableTokens)[0][0];
      const rewardPerUser = 10000;
      const rewardableTokens = Object.values(seriesMintableTokens)
        .flat()
        .reduce((totalAvailable, token) => {
          const isWinningToken =
            token.name === winningToken.name &&
            token.sport === winningToken.sport;

          if (!isWinningToken) return totalAvailable;

          return (
            totalAvailable +
            rarityLevels[token.rarityLevelIndex].availableTokens
          );
        }, 0);
      const totalReward = rewardPerUser * rewardableTokens;

      return useMethodsOn(MinoToken, [
        ...rarityLevels.map(({ name, availableTokens }) => ({
          method: 'addNewRarityLevel',
          args: [name, availableTokens],
          account: accounts[0],
        })),
        ...Object.entries(seriesMintableTokens).flatMap(
          // We initialize and create tokens for multiple series
          ([seriesName, mintableTokens]) => [
            ...usersMintsPerSeries.map((mintsPerSeries, index) => ({
              method: 'setUserMints',
              args: [accounts[index], seriesName, mintsPerSeries],
              account: accounts[0],
            })),
            {
              method: 'initializeSeries',
              args: [seriesName],
              account: accounts[0],
            },
            ...mintableTokens.map(
              ({ name, sport, tokenUri, rarityLevelIndex }) => ({
                method: 'addNewMintableToken',
                args: [
                  name,
                  sport,
                  tokenUri,
                  rarityLevels[rarityLevelIndex].name,
                  seriesName,
                ],
                account: accounts[0],
              })
            ),
            {
              method: 'setSeriesMintingIsOpen',
              args: [seriesName, true],
              account: accounts[0],
            },
            // Each user can mint same number of times per series
            ...usersMintsPerSeries.flatMap((mintsPerSeries, index) =>
              newArray(mintsPerSeries, () => ({
                method: 'mintToken',
                args: [seriesName],
                account: accounts[index],
              }))
            ),
          ]
        ),
        {
          method: 'getAllTokensByNameAndSport',
          args: [winningToken.name, winningToken.sport],
          account: accounts[0],
          onReturn: (tokens) => {
            // We check that there are the correct number
            // of rewardable tokens. This includes all the tokens
            // with the above player name and sport
            assert.strictEqual(tokens.length, rewardableTokens);
          },
        },
      ])
        .then(() =>
          useMethodsOn(DBToken, {
            // We use DBToken as the rewardable ERC20 token,
            // so we just send the required reward to the
            // reward contract address
            method: '_mint',
            args: [MinoTokenReward.options.address, totalReward],
            account: accounts[0],
          })
        )
        .then(() =>
          useMethodsOn(MinoTokenReward, [
            {
              // The owner creates a new reward for the
              // chosen player and sport
              method: 'newReward',
              args: [
                rewardName,
                winningToken.name,
                winningToken.sport,
                DBToken.options.address,
                rewardPerUser,
              ],
              account: accounts[0],
            },
            {
              method: 'getAllRewards',
              account: accounts[0],
              onReturn: ([reward]) => {
                // We check that the first and only reward currently
                // stored is the one we just created
                assert.strictEqual(reward.rewardName, rewardName);
              },
            },
            {
              method: 'getRewardWinners',
              args: [rewardName, winningToken.name],
              account: accounts[0],
              onReturn: (winners) => {
                // Even if the same user won the same reward twice
                // they would appear once for each reward won
                assert.strictEqual(winners.length, rewardableTokens);
              },
            },
          ])
        );
    });
  });
});
