const assert = require('assert');
const contracts = require('../compile');
const tether = require('../compiled/tether.json');
const {
  useMethodsOn,
  secondsInTheFuture,
  newArray,
  zeroOrOne,
  randomInt,
  valuesWithin,
} = require('../utils/helper');

const { deploy, getAccounts } = require('../utils/useWeb3');

const sideBetContract = contracts['SideBetV5.sol'].SideBetV5;

describe('SideBetV5 tests', () => {
  let accounts, SideBetV5, TetherToken;

  const totalSupply = 100000000;
  const sides = ['Machester', 'Liverpool'];
  const eventCode = 'Man v. Liv';
  const saleDuration = 10;
  const numOfUsers = 5;
  const minDeposit = 100;
  const maxDeposit = 10000;
  const ownerPercent = 5;
  const getUserDepositParams = () =>
    newArray(numOfUsers, (i) => ({
      account: accounts[i + 1],
      teamIndex: zeroOrOne(),
      amount: randomInt(minDeposit, maxDeposit),
    }));

  beforeEach(async () => {
    accounts = await getAccounts();
    // Local USDT instance. Address accounts[0] is the
    // owner of the contract and is immediately minted totalSupply
    // amount of tokens on initialization
    TetherToken = await deploy(
      tether,
      [totalSupply, 'Tether', 'USDT', 18],
      accounts[0]
    );
    SideBetV5 = await deploy(sideBetContract, [], accounts[0]);
  });

  describe('SideBetV5', () => {
    // Owner distributes the USDT to all participating users
    // before initializing a side bet. All the users also approve
    // the necessary amount of standard tokens towards the SideBet
    // contract. Can also pass deposit params to the function, to
    // keep the reference outside of it
    const prepareSideBetAndUserTokens = (
      sideBetOwner,
      userDepositParams = getUserDepositParams()
    ) =>
      useMethodsOn(
        TetherToken,
        userDepositParams.flatMap(({ account, amount }) => [
          {
            method: 'transfer',
            args: [account, amount],
            account: accounts[0],
          },
          {
            method: 'approve',
            args: [SideBetV5.options.address, amount],
            account,
          },
        ])
      ).then(() =>
        useMethodsOn(SideBetV5, {
          method: 'initializeSideBet',
          args: [
            eventCode,
            sides[0],
            sides[1],
            TetherToken.options.address,
            0,
            secondsInTheFuture(saleDuration),
          ],
          account: sideBetOwner,
        })
      );

    it('deploys successfully', () => {
      assert.ok(SideBetV5.options.address);
    });

    it('allows user to initialize a side bet', () => {
      const sideBetOwner = accounts[1];
      return prepareSideBetAndUserTokens(sideBetOwner).then(() =>
        useMethodsOn(SideBetV5, {
          // If the side bet hasn't been initialized, this method will revert
          method: 'getSideBetData',
          args: [eventCode],
          onReturn: ({ teamNames, standardTokenAddress, owner }) => {
            // We check that the team names are correct
            assert.strictEqual(teamNames[0], sides[0]);
            assert.strictEqual(teamNames[1], sides[1]);
            // And that the USDT contract address is the one
            // we passed previously
            assert.strictEqual(
              standardTokenAddress,
              TetherToken.options.address
            );
            // And that the owner of the side bet is the one
            // who initialized it
            assert.strictEqual(owner, sideBetOwner);
          },
        })
      );
    });

    it('allows users to deposit tokens for their team', () => {
      const sideBetOwner = accounts[1];
      const userDepositParams = getUserDepositParams();

      return prepareSideBetAndUserTokens(sideBetOwner, userDepositParams).then(
        () =>
          useMethodsOn(SideBetV5, [
            ...userDepositParams.map(({ account, teamIndex, amount }) => ({
              // Each user deposits a set amount of standard tokens
              // towards their chosen team
              method: 'deposit',
              args: [eventCode, teamIndex, amount],
              account,
            })),
            {
              // Afterwards, we get the side bet data
              method: 'getSideBetData',
              args: [eventCode],
              account: accounts[0],
              onReturn: ({ eventUsers, userTokens }) => {
                userDepositParams.forEach(({ account, amount, teamIndex }) => {
                  // And check if all the users are recorded to have deposited
                  // towards the correct team
                  const userIndex = eventUsers[teamIndex].findIndex(
                    (eventUser) => eventUser === account
                  );
                  // userIndex would be -1 if user is not found in the above array
                  assert.notStrictEqual(userIndex, -1);

                  // We also check that the correct deposit amount has been recorded
                  const userDeposited = parseInt(
                    userTokens[teamIndex][userIndex]
                  );
                  assert.strictEqual(userDeposited, amount);
                });
              },
            },
          ])
      );
    });

    it('allows users to receive rewards for betting on winning team', () => {
      const sideBetOwner = accounts[1];
      const userDepositParams = getUserDepositParams();
      const winningTeamIndex = userDepositParams[0].teamIndex;
      const totalDeposited = userDepositParams.reduce(
        (total, { amount }) => total + amount,
        0
      );
      const totalDepositedForWinningTeam = userDepositParams.reduce(
        (total, { amount, teamIndex }) =>
          teamIndex === winningTeamIndex ? total + amount : total,
        0
      );
      const calculatedOwnerCut = Math.floor(
        (totalDeposited * ownerPercent) / 100
      );
      const totalReward = totalDeposited - calculatedOwnerCut;

      const calculateUserReward = (userDeposit) =>
        Math.round((userDeposit * totalReward) / totalDepositedForWinningTeam);

      const state = {};

      return prepareSideBetAndUserTokens(sideBetOwner, userDepositParams)
        .then(() =>
          useMethodsOn(SideBetV5, [
            ...userDepositParams.map(({ account, teamIndex, amount }) => ({
              // Each user deposits USDT towards their prefered team
              method: 'deposit',
              args: [eventCode, teamIndex, amount],
              account,
            })),
            {
              // The sale ends, which allows the side bet owner to select the winning team
              method: 'endSaleNow',
              args: [eventCode],
              account: accounts[0],
            },
            {
              // The owner selects the winning team using 0/1 index
              method: 'selectWinningTeam',
              args: [eventCode, winningTeamIndex],
              account: accounts[0],
            },
            {
              // We get a list of the users who've deposited towards
              // the winning team and their respective rewards
              method: 'getWinningUsersAndUserRewards',
              args: [eventCode],
              account: accounts[0],
              onReturn: ({ winningUsers, userRewards }) => {
                userDepositParams.forEach(({ account, amount, teamIndex }) => {
                  // We save the user calculated user reward
                  // so we can later check if the correct
                  // amount of USDT has been transferred
                  const stateProp = `reward-${account}`;
                  if (teamIndex !== winningTeamIndex) {
                    state[stateProp] = 0;
                    return;
                  }

                  // The user which voted for the winning team
                  // must be found within the winningUsers array
                  const userIndex = winningUsers.findIndex(
                    (eventUser) => eventUser === account
                  );
                  assert.notStrictEqual(userIndex, -1);

                  const userReward = parseInt(userRewards[userIndex]);
                  const calculatedUserReward = calculateUserReward(amount);

                  // We check if the contract calculated the correct reward
                  // for this user. Since the calculation has multiple steps
                  // and both languages deal with rounding big numbers differently
                  // we can allow reward amounts with large numbers to have an offset
                  // of 1 at most
                  assert.ok(valuesWithin(userReward, calculatedUserReward, 1));

                  state[stateProp] = calculatedUserReward;
                });

                // We calculate the total reward from all the user rewards
                state.calculatedTotalReward = userRewards.reduce(
                  (total, rew) => total + parseInt(rew),
                  0
                );
              },
            },
            {
              method: 'calculateTotalRewardAndOwnerCut',
              args: [eventCode],
              account: accounts[0],
              onReturn: ({ totalReward }) => {
                // The total reward calculated from the contract should be
                // equal to the sum of all user rewards fetched in the previous
                // method
                assert.strictEqual(
                  parseInt(totalReward),
                  state.calculatedTotalReward
                );
              },
            },
            {
              // The owner distributes the reward
              method: 'distributeReward',
              args: [eventCode],
              account: accounts[0],
            },
          ])
        )
        .then(() =>
          useMethodsOn(
            TetherToken,
            userDepositParams.map(({ account }) => ({
              method: 'balanceOf',
              args: [account],
              account: accounts[0],
              onReturn: (balance) => {
                // And we check that each participating has the
                // the correct amont of USDT in their wallet
                assert.ok(
                  valuesWithin(parseInt(balance), state[`reward-${account}`], 2)
                );
              },
            }))
          )
        );
    });
  });
});
