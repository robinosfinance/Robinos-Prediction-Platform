const assert = require('assert');
const contracts = require('../compile');
const {
  useMethodsOn,
  secondsInTheFuture,
  newArray,
  getBalanceOfUser,
  getBalancesOfUsers,
} = require('../utils/helper');

const { deploy, getAccounts } = require('../utils/useWeb3');
const { ZERO_ADDRESS } = require('../utils/variables');
const { uniqueValues } = require('../utils/arrays');

const sideBetContract = contracts['SideBetV6.sol'].SideBetV6;
const testToken = contracts['TestToken.sol'].TestToken;
const blacklistToken = contracts['BlacklistTestToken.sol'].BlacklistTestToken;

const TOTAL_SUPPLY = 100000000;
const SIDES = ['Machester', 'Liverpool'];
const EVENT_CODE = 'Man v. Liv';
const SALE_DURATION = 10;
const MAX_USERS = 1000;
const BALANCE_AMOUNT = 100000;
const OWNER_CUT_PERCENTAGE = 5;

describe('SideBetV6 tests', () => {
  let accounts, SideBetV6, TestToken;

  const getUserEventData = (userDepositData) => ({
    allUsers: uniqueValues(
      userDepositData.map(({ account }) => account)
    ).sort(),
    eventUsers: [0, 1].map((teamIndex) =>
      uniqueValues(
        userDepositData
          .filter(({ teamIndex: tIndex }) => tIndex === teamIndex)
          .map(({ account }) => account)
          .sort()
      )
    ),
    userTokens: [0, 1].map((teamIndex) =>
      userDepositData
        .filter(({ teamIndex: tIndex }) => tIndex === teamIndex)
        .map(({ amount }) => amount)
        .sort()
    ),
    totalTokensDeposited: [0, 1].map((teamIndex) =>
      userDepositData
        .filter(({ teamIndex: tIndex }) => tIndex === teamIndex)
        .reduce((acc, { amount }) => acc + amount, 0)
    ),
  });

  const distributeTokens = (TokenContract, userDepositData) =>
    useMethodsOn(TokenContract, [
      ...userDepositData
        .filter(({ account }) => account !== accounts[0])
        .map(({ account, amount }) => ({
          method: 'transfer',
          args: [account, amount],
          account: accounts[0],
        })),
      ...userDepositData.map(({ account, amount }) => ({
        method: 'approve',
        args: [SideBetV6.options.address, amount],
        account,
      })),
    ]);

  beforeEach(async () => {
    accounts = await getAccounts();
    // Local USDT instance. Address accounts[0] is the
    // owner of the contract and is immediately minted totalSupply
    // amount of tokens on initialization
    TestToken = await deploy(testToken, [TOTAL_SUPPLY], accounts[0]);
    SideBetV6 = await deploy(sideBetContract, [], accounts[0]);
  });

  describe('SideBetV6', () => {
    it('deploys successfully', () => {
      assert.ok(SideBetV6.options.address);
    });

    describe('initializeSideBet', () => {
      it('initializes a side bet with the correct parameters', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'initializeSideBet',
            args: [
              EVENT_CODE,
              SIDES[0],
              SIDES[1],
              TestToken.options.address,
              0,
              secondsInTheFuture(SALE_DURATION),
            ],
            account: accounts[0],
          },
          {
            method: 'getSideBetData',
            args: [EVENT_CODE],
            onReturn: (sideBet) => {
              // And check if the data matches the parameters
              assert.deepStrictEqual(sideBet.teamNames, SIDES);
            },
          },
        ]);
      });

      it('reverts if caller is not the owner', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'initializeSideBet',
            args: [
              EVENT_CODE,
              SIDES[0],
              SIDES[1],
              TestToken.options.address,
              0,
              secondsInTheFuture(SALE_DURATION),
            ],
            account: accounts[1],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'Ownable: caller is not the owner');
            },
          },
        ]);
      });

      it('reverts if standard token address is zero', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'initializeSideBet',
            args: [
              EVENT_CODE,
              SIDES[0],
              SIDES[1],
              ZERO_ADDRESS,
              0,
              secondsInTheFuture(SALE_DURATION),
            ],
            account: accounts[0],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'AZ');
            },
          },
        ]);
      });

      it('reverts if team names are empty', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'initializeSideBet',
            args: [
              EVENT_CODE,
              '',
              '',
              TestToken.options.address,
              0,
              secondsInTheFuture(SALE_DURATION),
            ],
            account: accounts[0],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'empty team name');
            },
          },
        ]);
      });

      it('reverts if sale is already initialized', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'initializeSideBet',
            args: [
              EVENT_CODE,
              SIDES[0],
              SIDES[1],
              TestToken.options.address,
              0,
              secondsInTheFuture(SALE_DURATION),
            ],
            account: accounts[0],
          },
          {
            method: 'initializeSideBet',
            args: [
              EVENT_CODE,
              SIDES[0],
              SIDES[1],
              TestToken.options.address,
              0,
              secondsInTheFuture(SALE_DURATION),
            ],
            account: accounts[0],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'already initialized');
            },
          },
        ]);
      });

      it('reverts if sale duration is 0', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'initializeSideBet',
            args: [
              EVENT_CODE,
              SIDES[0],
              SIDES[1],
              TestToken.options.address,
              secondsInTheFuture(100),
              secondsInTheFuture(100),
            ],
            account: accounts[0],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(
                error,
                'sale end time needs to be greater than start time'
              );
            },
          },
        ]);
      });

      it('emits an event', () => {
        const endTime = secondsInTheFuture(SALE_DURATION);

        return useMethodsOn(SideBetV6, [
          {
            method: 'initializeSideBet',
            args: [
              EVENT_CODE,
              SIDES[0],
              SIDES[1],
              TestToken.options.address,
              0,
              endTime,
            ],
            account: accounts[0],
            onEvent: ({ SideBetEventInitialized }) => {
              assert.deepStrictEqual(SideBetEventInitialized, {
                eventCode: EVENT_CODE,
                teamA: SIDES[0],
                teamB: SIDES[1],
                standardToken: TestToken.options.address,
                startTime: '0',
                endTime: endTime.toString(),
              });
            },
          },
        ]);
      });
    });

    describe('cancelSideBet', () => {
      beforeEach(() => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'initializeSideBet',
            args: [
              EVENT_CODE,
              SIDES[0],
              SIDES[1],
              TestToken.options.address,
              0,
              secondsInTheFuture(SALE_DURATION),
            ],
            account: accounts[0],
          },
        ]);
      });

      it('cancels a side bet', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'cancelSideBet',
            args: [EVENT_CODE],
            account: accounts[0],
          },
          {
            method: 'getSideBetData',
            args: [EVENT_CODE],
            onReturn: (sideBet) => {
              assert.strictEqual(sideBet.cancelled, true);
            },
          },
        ]);
      });

      it('reverts if caller is not the owner', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'cancelSideBet',
            args: [EVENT_CODE],
            account: accounts[1],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'Ownable: caller is not the owner');
            },
          },
        ]);
      });

      it('reverts if side bet is already cancelled', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'cancelSideBet',
            args: [EVENT_CODE],
            account: accounts[0],
          },
          {
            method: 'cancelSideBet',
            args: [EVENT_CODE],
            account: accounts[0],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'cancelled');
            },
          },
        ]);
      });

      it('emits an event', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'cancelSideBet',
            args: [EVENT_CODE],
            account: accounts[0],
            onEvent: ({ SideBetCancelled }) => {
              assert.deepStrictEqual(SideBetCancelled, {
                eventCode: EVENT_CODE,
              });
            },
          },
        ]);
      });
    });

    describe('selectWinningTeam', () => {
      beforeEach(() => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'initializeSideBet',
            args: [
              EVENT_CODE,
              SIDES[0],
              SIDES[1],
              TestToken.options.address,
              0,
              secondsInTheFuture(SALE_DURATION),
            ],
            account: accounts[0],
          },
          {
            method: 'endSaleNow',
            args: [EVENT_CODE],
            account: accounts[0],
          },
        ]);
      });

      it('selects the winning team', () => {
        const winningIndex = 0;

        return useMethodsOn(SideBetV6, [
          {
            method: 'selectWinningTeam',
            args: [EVENT_CODE, winningIndex],
            account: accounts[0],
          },
          {
            method: 'getSideBetData',
            args: [EVENT_CODE],
            onReturn: (sideBet) => {
              assert.strictEqual(sideBet.winnerSet, true);
              assert.strictEqual(Number(sideBet.winningIndex), winningIndex);
            },
          },
        ]);
      });

      it('reverts if caller is not the owner', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'selectWinningTeam',
            args: [EVENT_CODE, 0],
            account: accounts[1],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'Ownable: caller is not the owner');
            },
          },
        ]);
      });

      it('reverts if side bet is not ended', () => {
        const newEventCode = 'Liv v. Che';

        return useMethodsOn(SideBetV6, [
          {
            method: 'initializeSideBet',
            args: [
              newEventCode,
              SIDES[0],
              SIDES[1],
              TestToken.options.address,
              0,
              secondsInTheFuture(SALE_DURATION),
            ],
            account: accounts[0],
          },
          {
            method: 'selectWinningTeam',
            args: [newEventCode, 0],
            account: accounts[0],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'sale has not ended yet');
            },
          },
        ]);
      });

      it('reverts if winner is already set', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'selectWinningTeam',
            args: [EVENT_CODE, 0],
            account: accounts[0],
          },
          {
            method: 'selectWinningTeam',
            args: [EVENT_CODE, 0],
            account: accounts[0],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'winning team selected');
            },
          },
        ]);
      });

      it('emits an event', () => {
        const winningIndex = 0;

        return useMethodsOn(SideBetV6, [
          {
            method: 'selectWinningTeam',
            args: [EVENT_CODE, winningIndex],
            account: accounts[0],
            onEvent: ({ WinningTeamSelected }) => {
              assert.deepStrictEqual(WinningTeamSelected, {
                eventCode: EVENT_CODE,
                teamIndex: winningIndex.toString(),
              });
            },
          },
        ]);
      });
    });

    describe('deposit', () => {
      beforeEach(() => {
        const userDepositData = newArray(5, (i) => ({
          account: accounts[i],
          amount: BALANCE_AMOUNT,
        }));

        return distributeTokens(TestToken, userDepositData).then(() =>
          useMethodsOn(SideBetV6, [
            {
              method: 'initializeSideBet',
              args: [
                EVENT_CODE,
                SIDES[0],
                SIDES[1],
                TestToken.options.address,
                0,
                secondsInTheFuture(SALE_DURATION),
              ],
              account: accounts[0],
            },
          ])
        );
      });

      it('deposits tokens to the side bet contract', () => {
        const amount = 1000;

        return useMethodsOn(SideBetV6, [
          {
            method: 'deposit',
            args: [EVENT_CODE, 0, amount],
            account: accounts[0],
          },
          {
            then: async () => {
              const balance = await getBalanceOfUser(
                TestToken,
                SideBetV6.options.address
              );

              assert.strictEqual(balance, amount);
            },
          },
        ]);
      });

      it('updates side bet data', () => {
        const amount = 1000;
        const teamIndex = 1;
        const user = accounts[0];

        return useMethodsOn(SideBetV6, [
          {
            method: 'deposit',
            args: [EVENT_CODE, teamIndex, amount],
            account: user,
          },
          {
            method: 'getSideBetDepositData',
            args: [EVENT_CODE, MAX_USERS],
            onReturn: (sideBet) => {
              assert.deepStrictEqual(sideBet.allUsers, [user]);
              assert.deepStrictEqual(sideBet.eventUsers[teamIndex], [user]);
              assert.strictEqual(
                Number(sideBet.totalTokensDeposited[teamIndex]),
                amount
              );
              assert.strictEqual(
                Number(sideBet.userTokens[teamIndex][0]),
                amount
              );
            },
          },
        ]);
      });

      it('updates side bet data with multiple users', () => {
        const userDepositData = [
          { account: accounts[0], teamIndex: 0, amount: 1000 },
          { account: accounts[1], teamIndex: 0, amount: 1000 },
          { account: accounts[2], teamIndex: 1, amount: 2000 },
          { account: accounts[3], teamIndex: 0, amount: 3000 },
          { account: accounts[4], teamIndex: 1, amount: 4000 },
        ];

        const { allUsers, eventUsers, userTokens, totalTokensDeposited } =
          getUserEventData(userDepositData);

        return useMethodsOn(SideBetV6, [
          ...userDepositData.map(({ account, teamIndex, amount }) => ({
            method: 'deposit',
            args: [EVENT_CODE, teamIndex, amount],
            account,
          })),
          {
            method: 'getSideBetDepositData',
            args: [EVENT_CODE, MAX_USERS],
            onReturn: (sideBet) => {
              const sortedAllUsers = [...sideBet.allUsers].sort();
              const sortedEventUsers = sideBet.eventUsers.map((a) =>
                [...a].sort()
              );
              const sortedUserTokens = sideBet.userTokens.map((t) =>
                t.map(Number).sort()
              );

              assert.deepStrictEqual(sortedAllUsers, allUsers);
              assert.deepStrictEqual(sortedEventUsers, eventUsers);
              assert.deepStrictEqual(sortedUserTokens, userTokens);
              assert.deepStrictEqual(
                sideBet.totalTokensDeposited.map(Number),
                totalTokensDeposited
              );
            },
          },
        ]);
      });

      it('reverts if user has insufficient balance', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'deposit',
            args: [EVENT_CODE, 0, BALANCE_AMOUNT * 2],
            account: accounts[1],
            assertFail: true,
          },
        ]);
      });

      it('reverts if amount deposited is 0', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'deposit',
            args: [EVENT_CODE, 0, 0],
            account: accounts[1],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'AZ');
            },
          },
        ]);
      });

      it('reverts if event is not initialized', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'deposit',
            args: ['Tot v. Che', 0, BALANCE_AMOUNT],
            account: accounts[1],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'sale not initialized');
            },
          },
        ]);
      });

      it('reverts if sale has ended', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'endSaleNow',
            args: [EVENT_CODE],
            account: accounts[0],
          },
          {
            method: 'deposit',
            args: [EVENT_CODE, 0, BALANCE_AMOUNT],
            account: accounts[1],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'sale not active');
            },
          },
        ]);
      });

      it('emits an event', () => {
        const user = accounts[1];
        const teamIndex = 0;

        return useMethodsOn(SideBetV6, [
          {
            method: 'deposit',
            args: [EVENT_CODE, teamIndex, BALANCE_AMOUNT],
            account: user,
            onEvent: ({ Deposited }) => {
              assert.deepStrictEqual(Deposited, {
                eventCode: EVENT_CODE,
                from: user,
                amount: BALANCE_AMOUNT.toString(),
                token: TestToken.options.address,
                teamIndex: teamIndex.toString(),
              });
            },
          },
        ]);
      });

      it('logs new user wallet address', () => {
        const user = accounts[1];

        return useMethodsOn(SideBetV6, [
          {
            method: 'deposit',
            args: [EVENT_CODE, 0, BALANCE_AMOUNT],
            account: user,
          },
          {
            method: 'getAllUniqueWallets',
            args: [MAX_USERS],
            onReturn: (wallets) => {
              assert.deepStrictEqual(wallets, [user]);
            },
          },
        ]);
      });

      it('emits new unique wallet event', () => {
        const user = accounts[1];

        return useMethodsOn(SideBetV6, [
          {
            method: 'deposit',
            args: [EVENT_CODE, 0, BALANCE_AMOUNT],
            account: user,
            onEvent: ({ NewUniqueWallet }) => {
              assert.deepStrictEqual(NewUniqueWallet, { wallet: user });
            },
          },
        ]);
      });

      it('reverts if invalid team index is provided', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'deposit',
            args: [EVENT_CODE, 3, BALANCE_AMOUNT],
            account: accounts[1],
            assertFail: true,
          },
        ]);
      });
    });

    describe('distributeReward', () => {
      const winningIndex = 0;
      const depositData = [
        { teamIndex: 0, amount: 1000 },
        { teamIndex: 0, amount: 1000 },
        { teamIndex: 0, amount: 2000 },
        { teamIndex: 1, amount: 3000 },
        { teamIndex: 1, amount: 4000 },
      ];

      beforeEach(() => {
        const userDepositData = depositData.map((data, i) => ({
          account: accounts[i],
          ...data,
        }));

        return distributeTokens(TestToken, userDepositData).then(() =>
          useMethodsOn(SideBetV6, [
            {
              method: 'initializeSideBet',
              args: [
                EVENT_CODE,
                SIDES[0],
                SIDES[1],
                TestToken.options.address,
                0,
                secondsInTheFuture(SALE_DURATION),
              ],
              account: accounts[0],
            },
            ...userDepositData.map(({ account, teamIndex, amount }) => ({
              method: 'deposit',
              args: [EVENT_CODE, teamIndex, amount],
              account,
            })),
            {
              method: 'endSaleNow',
              args: [EVENT_CODE],
              account: accounts[0],
            },
            {
              method: 'selectWinningTeam',
              args: [EVENT_CODE, winningIndex],
              account: accounts[0],
            },
          ])
        );
      });

      it('distributes rewards to users', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'getWinningUsersAndUserRewards',
            args: [EVENT_CODE, 0, MAX_USERS],
            onReturn: async ({ winningUsers, userRewards }) => {
              const balances = await getBalancesOfUsers(
                TestToken,
                winningUsers
              );

              return Object.fromEntries(
                winningUsers.map((user, i) => [
                  user,
                  { balance: balances[i], reward: parseInt(userRewards[i]) },
                ])
              );
            },
          },
          {
            method: 'distributeReward',
            args: [EVENT_CODE, 0, MAX_USERS],
            account: accounts[0],
          },
          (state) => ({
            then: async () => {
              const winningUsers = Object.keys(state);
              const newBalances = await getBalancesOfUsers(
                TestToken,
                winningUsers
              );
              const result = Object.values(state).map(
                ({ balance, reward }) => balance + reward
              );

              assert.deepStrictEqual(newBalances, result);
            },
          }),
        ]);
      });

      it('does not redistribute rewards to same users if called again', () => {
        const users = newArray(depositData.length, (i) => accounts[i]);

        return useMethodsOn(SideBetV6, [
          {
            method: 'distributeReward',
            args: [EVENT_CODE, 0, MAX_USERS],
            account: accounts[0],
          },
          {
            then: async () => ({
              balances: await getBalancesOfUsers(TestToken, users),
            }),
          },
          {
            method: 'distributeReward',
            args: [EVENT_CODE, 0, MAX_USERS],
            account: accounts[0],
          },
          ({ balances }) => ({
            then: async () => {
              const newBalances = await getBalancesOfUsers(TestToken, users);

              assert.deepStrictEqual(newBalances, balances);
            },
          }),
        ]);
      });

      it('distributes rewards in batches', () => {
        const newEventCode = 'Tot v. Che';
        const nonWinningIndex = 0;
        const winningIndex = 1;
        const userDepositData = accounts.map((account, i) => ({
          account,
          teamIndex: i === 0 ? nonWinningIndex : winningIndex,
          amount: BALANCE_AMOUNT,
        }));
        const winningUsers = userDepositData
          .filter(({ teamIndex }) => teamIndex === winningIndex)
          .map(({ account }) => account);

        const rewardPerUser = Math.floor(
          (userDepositData.length *
            BALANCE_AMOUNT *
            ((100 - OWNER_CUT_PERCENTAGE) / 100)) /
            winningUsers.length
        );

        return distributeTokens(TestToken, userDepositData).then(() =>
          useMethodsOn(SideBetV6, [
            {
              method: 'initializeSideBet',
              args: [
                newEventCode,
                SIDES[0],
                SIDES[1],
                TestToken.options.address,
                0,
                secondsInTheFuture(SALE_DURATION),
              ],
              account: accounts[0],
            },
            ...userDepositData.map(({ account, teamIndex, amount }) => ({
              method: 'deposit',
              args: [newEventCode, teamIndex, amount],
              account,
            })),
            {
              method: 'endSaleNow',
              args: [newEventCode],
              account: accounts[0],
            },
            {
              method: 'selectWinningTeam',
              args: [newEventCode, 1],
              account: accounts[0],
            },
            ...winningUsers
              .slice(0, winningUsers.length - 2)
              .flatMap((_, i) => [
                {
                  method: 'distributeReward',
                  args: [newEventCode, i, i + 1],
                  account: accounts[0],
                },
                {
                  then: async () => {
                    const balances = await getBalancesOfUsers(TestToken, [
                      winningUsers[i],
                      winningUsers[i + 1],
                    ]);

                    assert.deepStrictEqual(balances, [rewardPerUser, 0]);
                  },
                },
              ]),
          ])
        );
      });

      it('flags users which received a reward', () => {
        const winningUsers = depositData
          .filter(({ teamIndex }) => teamIndex === winningIndex)
          .map((_, i) => accounts[i]);

        return useMethodsOn(SideBetV6, [
          {
            method: 'getUsersRewardsClaimedStatuses',
            args: [EVENT_CODE, 0, MAX_USERS],
            onReturn: ({ usersRewardsClaimed }) => {
              const expectedStatuses = winningUsers.map(() => false);

              assert.deepStrictEqual(usersRewardsClaimed, expectedStatuses);
            },
          },
          {
            method: 'distributeReward',
            args: [EVENT_CODE, 0, winningUsers.length - 1],
            account: accounts[0],
          },
          {
            method: 'getUsersRewardsClaimedStatuses',
            args: [EVENT_CODE, 0, MAX_USERS],
            onReturn: ({ usersRewardsClaimed }) => {
              const expectedStatuses = winningUsers.map(
                (_, i) => winningUsers.length - 1 !== i
              );

              assert.deepStrictEqual(usersRewardsClaimed, expectedStatuses);
            },
          },

          {
            method: 'distributeReward',
            args: [EVENT_CODE, 0, winningUsers.length],
            account: accounts[0],
          },
          {
            method: 'getUsersRewardsClaimedStatuses',
            args: [EVENT_CODE, 0, MAX_USERS],
            onReturn: ({ usersRewardsClaimed }) => {
              const expectedStatuses = winningUsers.map(() => true);

              assert.deepStrictEqual(usersRewardsClaimed, expectedStatuses);
            },
          },
        ]);
      });

      it('reverts if caller is not the owner', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'distributeReward',
            args: [EVENT_CODE, 0, MAX_USERS],
            account: accounts[1],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'Ownable: caller is not the owner');
            },
          },
        ]);
      });

      it('reverts if winner is not set', () => {
        const newEventCode = 'Tot v. Che';
        const newSides = ['Tottenham', 'Chelsea'];
        const userDepositData = depositData.map((data, i) => ({
          account: accounts[i],
          ...data,
        }));

        return distributeTokens(TestToken, userDepositData).then(() =>
          useMethodsOn(SideBetV6, [
            {
              method: 'initializeSideBet',
              args: [
                newEventCode,
                newSides[0],
                newSides[1],
                TestToken.options.address,
                0,
                secondsInTheFuture(SALE_DURATION),
              ],
              account: accounts[0],
            },
            ...userDepositData.map(({ account, teamIndex, amount }) => ({
              method: 'deposit',
              args: [newEventCode, teamIndex, amount],
              account,
            })),
            {
              method: 'endSaleNow',
              args: [newEventCode],
              account: accounts[0],
            },
            {
              method: 'distributeReward',
              args: [newEventCode, 0, MAX_USERS],
              account: accounts[0],
              assertFail: true,
              catch: (error) => {
                assert.strictEqual(error, 'winning team not selected');
              },
            },
          ])
        );
      });

      it('reverts if side bet is cancelled', () => {
        const newEventCode = 'Tot v. Che';
        const newSides = ['Tottenham', 'Chelsea'];
        const userDepositData = depositData.map((data, i) => ({
          account: accounts[i],
          ...data,
        }));

        return distributeTokens(TestToken, userDepositData).then(() =>
          useMethodsOn(SideBetV6, [
            {
              method: 'initializeSideBet',
              args: [
                newEventCode,
                newSides[0],
                newSides[1],
                TestToken.options.address,
                0,
                secondsInTheFuture(SALE_DURATION),
              ],
              account: accounts[0],
            },
            ...userDepositData.map(({ account, teamIndex, amount }) => ({
              method: 'deposit',
              args: [newEventCode, teamIndex, amount],
              account,
            })),
            {
              method: 'cancelSideBet',
              args: [newEventCode],
              account: accounts[0],
            },
            {
              method: 'distributeReward',
              args: [newEventCode, 0, MAX_USERS],
              account: accounts[0],
              assertFail: true,
              catch: (error) => {
                assert.strictEqual(error, 'winning team not selected');
              },
            },
          ])
        );
      });

      it('continues distribution if one of users is blacklisted', async () => {
        const BlacklistTestToken = await deploy(
          blacklistToken,
          [TOTAL_SUPPLY],
          accounts[0]
        );
        const newEventCode = 'Tot v. Che';
        const newSides = ['Tottenham', 'Chelsea'];
        const userDepositData = depositData.map((data, i) => ({
          account: accounts[i],
          ...data,
        }));
        const blacklistedUser = accounts[1];

        return distributeTokens(BlacklistTestToken, userDepositData)
          .then(() =>
            useMethodsOn(BlacklistTestToken, {
              method: 'setBlacklist',
              args: [blacklistedUser, true],
              account: accounts[0],
            })
          )
          .then(() =>
            useMethodsOn(SideBetV6, [
              {
                method: 'initializeSideBet',
                args: [
                  newEventCode,
                  newSides[0],
                  newSides[1],
                  BlacklistTestToken.options.address,
                  0,
                  secondsInTheFuture(SALE_DURATION),
                ],
                account: accounts[0],
              },
              ...userDepositData.map(({ account, teamIndex, amount }) => ({
                method: 'deposit',
                args: [newEventCode, teamIndex, amount],
                account,
              })),
              {
                method: 'endSaleNow',
                args: [newEventCode],
                account: accounts[0],
              },
              {
                method: 'selectWinningTeam',
                args: [newEventCode, winningIndex],
                account: accounts[0],
              },
              {
                method: 'distributeReward',
                args: [newEventCode, 0, MAX_USERS],
                account: accounts[0],
              },

              {
                method: 'getUsersRewardsClaimedStatuses',
                args: [newEventCode, 0, MAX_USERS],
                onReturn: ({ users, usersRewardsClaimed }) => {
                  const expectedStatuses = users.map(
                    (user) => user !== blacklistedUser
                  );

                  assert.deepStrictEqual(usersRewardsClaimed, expectedStatuses);
                },
              },
            ])
          );
      });

      it('emits an event', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'getWinningUsersAndUserRewards',
            args: [EVENT_CODE, 0, MAX_USERS],
            onReturn: ({ winningUsers, userRewards }) => ({
              winningUsers,
              userRewards,
            }),
          },
          ({ winningUsers, userRewards }) => ({
            method: 'distributeReward',
            args: [EVENT_CODE, 0, MAX_USERS],
            account: accounts[0],
            onEvent: ({ RewardDistributed }) => {
              assert.deepStrictEqual(RewardDistributed, {
                eventCode: EVENT_CODE,
                winningUsers,
                userRewards,
              });
            },
          }),
        ]);
      });
    });

    describe('transferOwnerCut', () => {
      const winningIndex = 0;
      const depositData = [
        { teamIndex: 0, amount: 1000 },
        { teamIndex: 0, amount: 1000 },
        { teamIndex: 0, amount: 2000 },
        { teamIndex: 1, amount: 3000 },
        { teamIndex: 1, amount: 4000 },
      ];
      const totalDeposited = depositData.reduce(
        (acc, { amount }) => acc + amount,
        0
      );
      const ownerCut = Math.floor(
        (totalDeposited * OWNER_CUT_PERCENTAGE) / 100
      );

      beforeEach(() => {
        const userDepositData = depositData.map((data, i) => ({
          account: accounts[i],
          ...data,
        }));

        return distributeTokens(TestToken, userDepositData).then(() =>
          useMethodsOn(SideBetV6, [
            {
              method: 'initializeSideBet',
              args: [
                EVENT_CODE,
                SIDES[0],
                SIDES[1],
                TestToken.options.address,
                0,
                secondsInTheFuture(SALE_DURATION),
              ],
              account: accounts[0],
            },
            ...userDepositData.map(({ account, teamIndex, amount }) => ({
              method: 'deposit',
              args: [EVENT_CODE, teamIndex, amount],
              account,
            })),
            {
              method: 'endSaleNow',
              args: [EVENT_CODE],
              account: accounts[0],
            },
            {
              method: 'selectWinningTeam',
              args: [EVENT_CODE, winningIndex],
              account: accounts[0],
            },
          ])
        );
      });

      it('transfers owner cut to owner', async () => {
        const ownerBalance = await getBalanceOfUser(TestToken, accounts[0]);

        return useMethodsOn(SideBetV6, [
          {
            method: 'transferOwnerCut',
            args: [EVENT_CODE],
            account: accounts[0],
          },
          {
            then: async () => {
              const balance = await getBalanceOfUser(TestToken, accounts[0]);

              assert.strictEqual(balance, ownerCut + ownerBalance);
            },
          },
        ]);
      });

      it('flags owner cut as transferred', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'transferOwnerCut',
            args: [EVENT_CODE],
            account: accounts[0],
          },
          {
            method: 'getSideBetData',
            args: [EVENT_CODE],
            onReturn: (sideBet) => {
              assert.strictEqual(sideBet.ownerCutWithdrawn, true);
            },
          },
        ]);
      });

      it('reverts if owner cut is already transferred', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'transferOwnerCut',
            args: [EVENT_CODE],
            account: accounts[0],
          },
          {
            method: 'transferOwnerCut',
            args: [EVENT_CODE],
            account: accounts[0],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'owner cut withdrawn');
            },
          },
        ]);
      });

      it('reverts if caller is not the owner', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'transferOwnerCut',
            args: [EVENT_CODE],
            account: accounts[1],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'Ownable: caller is not the owner');
            },
          },
        ]);
      });

      it('reverts if winner is not set', () => {
        const newEventCode = 'Tot v. Che';
        const newSides = ['Tottenham', 'Chelsea'];
        const userDepositData = depositData.map((data, i) => ({
          account: accounts[i],
          ...data,
        }));

        return distributeTokens(TestToken, userDepositData).then(() =>
          useMethodsOn(SideBetV6, [
            {
              method: 'initializeSideBet',
              args: [
                newEventCode,
                newSides[0],
                newSides[1],
                TestToken.options.address,
                0,
                secondsInTheFuture(SALE_DURATION),
              ],
              account: accounts[0],
            },
            ...userDepositData.map(({ account, teamIndex, amount }) => ({
              method: 'deposit',
              args: [newEventCode, teamIndex, amount],
              account,
            })),
            {
              method: 'endSaleNow',
              args: [newEventCode],
              account: accounts[0],
            },
            {
              method: 'transferOwnerCut',
              args: [newEventCode],
              account: accounts[0],
              assertFail: true,
              catch: (error) => {
                assert.strictEqual(error, 'winning team not selected');
              },
            },
          ])
        );
      });

      it('emits an event', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'transferOwnerCut',
            args: [EVENT_CODE],
            account: accounts[0],
            onEvent: ({ OwnerCutTransferred }) => {
              assert.deepStrictEqual(OwnerCutTransferred, {
                eventCode: EVENT_CODE,
                ownerCut: ownerCut.toString(),
              });
            },
          },
        ]);
      });
    });

    describe('refundTokens', () => {
      const depositData = [
        { teamIndex: 0, amount: 1000 },
        { teamIndex: 0, amount: 1000 },
        { teamIndex: 0, amount: 2000 },
        { teamIndex: 1, amount: 3000 },
        { teamIndex: 1, amount: 4000 },
      ];

      beforeEach(() => {
        const userDepositData = depositData.map((data, i) => ({
          account: accounts[i],
          ...data,
        }));

        return distributeTokens(TestToken, userDepositData).then(() =>
          useMethodsOn(SideBetV6, [
            {
              method: 'initializeSideBet',
              args: [
                EVENT_CODE,
                SIDES[0],
                SIDES[1],
                TestToken.options.address,
                0,
                secondsInTheFuture(SALE_DURATION),
              ],
              account: accounts[0],
            },
            ...userDepositData.map(({ account, teamIndex, amount }) => ({
              method: 'deposit',
              args: [EVENT_CODE, teamIndex, amount],
              account,
            })),
            {
              method: 'cancelSideBet',
              args: [EVENT_CODE],
              account: accounts[0],
            },
          ])
        );
      });

      it('refunds tokens to users', async () => {
        const users = depositData.map((_, i) => accounts[i]);
        const initialBalances = await getBalancesOfUsers(TestToken, users);

        return useMethodsOn(SideBetV6, [
          {
            method: 'refundTokens',
            args: [EVENT_CODE, 0, MAX_USERS],
            account: accounts[0],
          },
          {
            then: async () => {
              const newBalances = await getBalancesOfUsers(TestToken, users);
              const expectedBalances = initialBalances.map(
                (balance, i) => balance + depositData[i].amount
              );

              assert.deepStrictEqual(newBalances, expectedBalances);
            },
          },
        ]);
      });

      it('does not refund tokens to same users if called again', () => {
        const users = depositData.map((_, i) => accounts[i]);

        return useMethodsOn(SideBetV6, [
          {
            method: 'refundTokens',
            args: [EVENT_CODE, 0, MAX_USERS],
            account: accounts[0],
          },
          {
            then: async () => ({
              balances: await getBalancesOfUsers(TestToken, users),
            }),
          },
          {
            method: 'refundTokens',
            args: [EVENT_CODE, 0, MAX_USERS],
            account: accounts[0],
          },
          ({ balances }) => ({
            then: async () => {
              const newBalances = await getBalancesOfUsers(TestToken, users);

              assert.deepStrictEqual(newBalances, balances);
            },
          }),
        ]);
      });

      it('refunds tokens in batches', () => {
        const newEventCode = 'Tot v. Che';
        const userDepositData = accounts.map((account, i) => ({
          account,
          teamIndex: i % 2,
          amount: BALANCE_AMOUNT,
        }));

        const users = userDepositData.map(({ account }) => account);

        return distributeTokens(TestToken, userDepositData).then(() =>
          useMethodsOn(SideBetV6, [
            {
              method: 'initializeSideBet',
              args: [
                newEventCode,
                SIDES[0],
                SIDES[1],
                TestToken.options.address,
                0,
                secondsInTheFuture(SALE_DURATION),
              ],
              account: accounts[0],
            },
            ...userDepositData.map(({ account, teamIndex, amount }) => ({
              method: 'deposit',
              args: [newEventCode, teamIndex, amount],
              account,
            })),
            {
              method: 'cancelSideBet',
              args: [newEventCode],
              account: accounts[0],
            },
            {
              then: async () => ({
                initialBalances: await getBalancesOfUsers(TestToken, users),
              }),
            },
            ...users.slice(0, users.length - 2).flatMap((_, i) => [
              {
                method: 'refundTokens',
                args: [newEventCode, i, i + 1],
                account: accounts[0],
              },
              ({ initialBalances }) => ({
                then: async () => {
                  const balances = await getBalancesOfUsers(TestToken, [
                    users[i],
                    users[i + 1],
                  ]);
                  const userDeposit = userDepositData[i].amount;

                  assert.deepStrictEqual(balances, [
                    initialBalances[i] + userDeposit,
                    initialBalances[i + 1],
                  ]);
                },
              }),
            ]),
          ])
        );
      });

      it('flags users which received a refund', () => {
        const users = depositData.map((_, i) => accounts[i]);

        return useMethodsOn(SideBetV6, [
          {
            method: 'getUsersRewardsClaimedStatuses',
            args: [EVENT_CODE, 0, MAX_USERS],
            onReturn: ({ usersRewardsClaimed }) => {
              const expectedStatuses = users.map(() => false);

              assert.deepStrictEqual(usersRewardsClaimed, expectedStatuses);
            },
          },
          {
            method: 'refundTokens',
            args: [EVENT_CODE, 0, users.length - 1],
            account: accounts[0],
          },
          {
            method: 'getUsersRewardsClaimedStatuses',
            args: [EVENT_CODE, 0, MAX_USERS],
            onReturn: ({ usersRewardsClaimed }) => {
              const expectedStatuses = users.map(
                (_, i) => users.length - 1 !== i
              );

              assert.deepStrictEqual(usersRewardsClaimed, expectedStatuses);
            },
          },

          {
            method: 'refundTokens',
            args: [EVENT_CODE, 0, users.length],
            account: accounts[0],
          },
          {
            method: 'getUsersRewardsClaimedStatuses',
            args: [EVENT_CODE, 0, MAX_USERS],
            onReturn: ({ usersRewardsClaimed }) => {
              const expectedStatuses = users.map(() => true);

              assert.deepStrictEqual(usersRewardsClaimed, expectedStatuses);
            },
          },
        ]);
      });

      it('reverts if caller is not the owner', () => {
        return useMethodsOn(SideBetV6, [
          {
            method: 'refundTokens',
            args: [EVENT_CODE, 0, MAX_USERS],
            account: accounts[1],
            assertFail: true,
            catch: (error) => {
              assert.strictEqual(error, 'Ownable: caller is not the owner');
            },
          },
        ]);
      });

      it('reverts if side bet is not cancelled', () => {
        const newEventCode = 'Tot v. Che';
        const newSides = ['Tottenham', 'Chelsea'];
        const userDepositData = depositData.map((data, i) => ({
          account: accounts[i],
          ...data,
        }));

        return distributeTokens(TestToken, userDepositData).then(() =>
          useMethodsOn(SideBetV6, [
            {
              method: 'initializeSideBet',
              args: [
                newEventCode,
                newSides[0],
                newSides[1],
                TestToken.options.address,
                0,
                secondsInTheFuture(SALE_DURATION),
              ],
              account: accounts[0],
            },
            ...userDepositData.map(({ account, teamIndex, amount }) => ({
              method: 'deposit',
              args: [newEventCode, teamIndex, amount],
              account,
            })),
            {
              method: 'refundTokens',
              args: [newEventCode, 0, MAX_USERS],
              account: accounts[0],
              assertFail: true,
              catch: (error) => {
                assert.strictEqual(error, 'not cancelled');
              },
            },
          ])
        );
      });

      it('reverts if winner is selected', () => {
        const newEventCode = 'Tot v. Che';
        const newSides = ['Tottenham', 'Chelsea'];
        const userDepositData = depositData.map((data, i) => ({
          account: accounts[i],
          ...data,
        }));

        return distributeTokens(TestToken, userDepositData).then(() =>
          useMethodsOn(SideBetV6, [
            {
              method: 'initializeSideBet',
              args: [
                newEventCode,
                newSides[0],
                newSides[1],
                TestToken.options.address,
                0,
                secondsInTheFuture(SALE_DURATION),
              ],
              account: accounts[0],
            },
            ...userDepositData.map(({ account, teamIndex, amount }) => ({
              method: 'deposit',
              args: [newEventCode, teamIndex, amount],
              account,
            })),
            {
              method: 'endSaleNow',
              args: [newEventCode],
              account: accounts[0],
            },
            {
              method: 'selectWinningTeam',
              args: [newEventCode, 0],
              account: accounts[0],
            },
            {
              method: 'refundTokens',
              args: [newEventCode, 0, MAX_USERS],
              account: accounts[0],
              assertFail: true,
              catch: (error) => {
                assert.strictEqual(error, 'not cancelled');
              },
            },
          ])
        );
      });

      it('continues distribution if one of users is blacklisted', async () => {
        const BlacklistTestToken = await deploy(
          blacklistToken,
          [TOTAL_SUPPLY],
          accounts[0]
        );
        const newEventCode = 'Tot v. Che';
        const newSides = ['Tottenham', 'Chelsea'];
        const userDepositData = depositData.map((data, i) => ({
          account: accounts[i],
          ...data,
        }));
        const blacklistedUser = accounts[1];

        return distributeTokens(BlacklistTestToken, userDepositData)
          .then(() =>
            useMethodsOn(BlacklistTestToken, {
              method: 'setBlacklist',
              args: [blacklistedUser, true],
              account: accounts[0],
            })
          )
          .then(() =>
            useMethodsOn(SideBetV6, [
              {
                method: 'initializeSideBet',
                args: [
                  newEventCode,
                  newSides[0],
                  newSides[1],
                  BlacklistTestToken.options.address,
                  0,
                  secondsInTheFuture(SALE_DURATION),
                ],
                account: accounts[0],
              },
              ...userDepositData.map(({ account, teamIndex, amount }) => ({
                method: 'deposit',
                args: [newEventCode, teamIndex, amount],
                account,
              })),
              {
                method: 'cancelSideBet',
                args: [newEventCode],
                account: accounts[0],
              },
              {
                method: 'refundTokens',
                args: [newEventCode, 0, MAX_USERS],
                account: accounts[0],
              },

              {
                method: 'getUsersRewardsClaimedStatuses',
                args: [newEventCode, 0, MAX_USERS],
                onReturn: ({ users, usersRewardsClaimed }) => {
                  const expectedStatuses = users.map(
                    (user) => user !== blacklistedUser
                  );

                  assert.deepStrictEqual(usersRewardsClaimed, expectedStatuses);
                },
              },
            ])
          );
      });

      it('emits an event', () => {
        const userRefunds = depositData.map(({ amount }) => amount);
        const users = depositData.map((_, i) => accounts[i]);

        return useMethodsOn(SideBetV6, [
          {
            method: 'refundTokens',
            args: [EVENT_CODE, 0, MAX_USERS],
            account: accounts[0],
            onEvent: ({ RefundDistributed }) => {
              assert.deepStrictEqual(RefundDistributed, {
                eventCode: EVENT_CODE,
                users,
                userRefunds: userRefunds.map(String),
              });
            },
          },
        ]);
      });
    });
  });
});
