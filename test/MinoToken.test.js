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
    { name: 'Legend', availableTokens: 7 },
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

    it('allows adding rarity levels', () => {
      const rarityLevelsToAdd = [
        ...rarityLevels,
        { name: 'Number One', availableTokens: 1 },
        { name: 'Best of the Year', availableTokens: 3 },
      ];

      return useMethodsOn(
        MinoToken,
        rarityLevelsToAdd.flatMap(({ name, availableTokens }) => [
          {
            // Owner can add a new rarity level by providing a
            // level name and num of available tokens
            method: 'addNewRarityLevel',
            args: [seriesName, name, availableTokens],
            account: accounts[0],
          },
          {
            // And we can search for the num of available tokens with the level name
            method: 'getRarityLevelMintsPerSeries',
            args: [seriesName, name],
            onReturn: (rarityLevelAvailableMints) => {
              assert.strictEqual(
                parseInt(rarityLevelAvailableMints),
                availableTokens
              );
            },
            account: accounts[0],
          },
        ])
      );
    });

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
          args: [seriesName, name, availableTokens],
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

      const totalAvailableMints = mintableTokens.reduce((total, token) => {
        const rarityLevel = rarityLevels[token.rarityLevelIndex];
        return total + rarityLevel.availableTokens;
      }, 0);

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
          args: [seriesName, name, availableTokens],
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
              {
                method: 'getTokenData',
                args: [tokenId],
                onReturn: (data) => {
                  const localTokenData = mintableTokens.find(
                    (token) => token.name === data.name
                  );

                  assert.ok(localTokenData);

                  assert.strictEqual(data.name, localTokenData.name);
                  assert.strictEqual(data.sport, localTokenData.sport);
                  assert.strictEqual(data.tokenUri, localTokenData.tokenUri);
                  assert.strictEqual(data.series, seriesName);

                  const localRarityLevel = rarityLevels.find(
                    (level) => level.name === data.rarityLevel
                  );

                  assert.ok(localRarityLevel);

                  assert.strictEqual(data.rarityLevel, localRarityLevel.name);
                  assert.strictEqual(
                    parseInt(data.totalAvailable),
                    localRarityLevel.availableTokens
                  );

                  // We save the tokenId -> tokenUri map
                  return { [`token-${tokenId}`]: data.tokenUri };
                },
                account: accounts[0],
              },
              (state) => ({
                // We query the tokenURI for the same tokenId
                method: 'tokenURI',
                args: [tokenId],
                account: accounts[index],
                onReturn: (tokenURI) => {
                  // And check if the returned uri is correct
                  assert.strict(
                    tokenURI,
                    `${baseUri}${state[`token-${tokenId}`]}`
                  );
                },
              }),
              {
                method: 'getSeriesMintData',
                args: [seriesName],
                account: accounts[index],
                onReturn: (mintData) => {
                  assert.strictEqual(
                    parseInt(mintData.totalAvailableMints),
                    totalAvailableMints
                  );
                  assert.strictEqual(
                    parseInt(mintData.mintedInSeries),
                    tokenId
                  );
                },
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

    it('records all user token data', () => {
      const userTokenIdAttr = (index) => `firstTokenId-user-${index}`;
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
          args: [seriesName, name, availableTokens],
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
        ...usersMintsPerSeries.flatMap((mintsPerSeries, index) => {
          return [
            ...newArray(mintsPerSeries, () => ({
              // Each user can mint up to the allowed times per series
              method: 'mintToken',
              args: [seriesName],
              account: accounts[index],
            })),
            {
              // We check the data for all user tokens
              method: 'getAllUserTokens',
              args: [accounts[index]],
              onReturn: (tokens) => {
                const { tokenId } = tokens[0];

                // And we save the first user tokenId
                return { [userTokenIdAttr(index)]: tokenId };
              },
              account: accounts[index],
            },
            (state) => ({
              // The user that just minted the token transfers it
              // to another user who does not mint in the series
              method: 'transferFrom',
              args: [
                accounts[index],
                accounts[usersMintsPerSeries.length],
                state[userTokenIdAttr(index)],
              ],
              account: accounts[index],
            }),
            (state) => ({
              method: 'getAllUserTokens',
              args: [accounts[index]],
              onReturn: (tokens) => {
                const ownsFirstMintedToken = tokens.some(
                  ({ tokenId }) => tokenId === state[userTokenIdAttr(index)]
                );

                // We expect that the user who minted the original token
                // doesn't hold the token in their wallet any longer
                assert.ok(!ownsFirstMintedToken);
              },
              account: accounts[index],
            }),
            (state) => ({
              method: 'getAllUserTokens',
              args: [accounts[usersMintsPerSeries.length]],
              onReturn: (tokens) => {
                const ownsFirstMintedToken = tokens.some(
                  ({ tokenId }) => tokenId === state[userTokenIdAttr(index)]
                );

                // And the user to whom it was sent should have it in their wallet
                assert.ok(ownsFirstMintedToken);
              },
              account: accounts[index],
            }),
          ];
        }),
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
        ...Object.entries(seriesMintableTokens).flatMap(
          // We initialize and create tokens for multiple series
          ([seriesName, mintableTokens]) => [
            ...rarityLevels.map(({ name, availableTokens }) => ({
              method: 'addNewRarityLevel',
              args: [seriesName, name, availableTokens],
              account: accounts[0],
            })),
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
