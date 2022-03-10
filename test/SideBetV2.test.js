const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(
  ganache.provider({
    gasLimit: 1000000000000,
  })
);

const contracts = require('../compile');

const sideBetContract = contracts['SideBetV2.sol'].SideBetV2;

// Local instance of the USDT contract used for testing
const tether = require('../compiled/tether.json');
const {
  useMethodsOn,
  secondsInTheFuture,
  zeroOrOne,
  newArray,
} = require('../helper');

describe('SideBetV2 tests', () => {
  let accounts, SideBetV2, TetherToken;

  const totalSupply = 100000000;
  const sides = ['Machester', 'Liverpool'];
  const eventCode = 'Man v. Liv';
  const saleDuration = 8;
  const ownerPercent = 5;

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts();

    // Local USDT instance. Address accounts[0] is the 
    // owner of the contract and is immediately minted totalSupply
    // amount of tokens on initialization
    TetherToken = await new web3.eth.Contract(tether.abi)
      .deploy({
        data: tether.bytecode,
        arguments: [totalSupply, 'Tether', 'USDT', 18],
      })
      .send({
        from: accounts[0],
        gas: '1000000000',
      });

    SideBetV2 = await new web3.eth.Contract(sideBetContract.abi)
      .deploy({
        data: sideBetContract.evm.bytecode.object,
        arguments: [
          TetherToken.options.address,
          sides[0],
          sides[1],
          eventCode,
          0,
          secondsInTheFuture(saleDuration),
          ownerPercent,
        ],
      })
      .send({
        from: accounts[0],
        gas: '1000000000',
      });
  });

  describe('SideBetV2', () => {
    it('deploys successfully', () => {
      assert.ok(SideBetV2.options.address);
    });

    it('allows users to deposit, owner to select winning side and distribute rewards', () => {
      const transferAmount = 10000;
      const numOfUsersToDeposit = 7;
      const sideToDepositFor = newArray(numOfUsersToDeposit, () => zeroOrOne());
      const winningSide = zeroOrOne();
      const totalReward = transferAmount * numOfUsersToDeposit;
      const usersVotedForWinner = sideToDepositFor.reduce(
        (totalReward, side) =>
        side === winningSide ? totalReward + 1 : totalReward,
        0
      );
      const rewardPerUser = Math.floor((totalReward * (1 - (ownerPercent / 100))) / usersVotedForWinner);
      const expectedOwnerCut = transferAmount * numOfUsersToDeposit * ownerPercent / 100;
      let ownerBalance;

      return useMethodsOn(TetherToken, [
          // We first transfer some amount of USDT to 
          // each user participating
          ...newArray(numOfUsersToDeposit, (i) => ({
            method: 'transfer',
            args: [accounts[i + 1], transferAmount],
            account: accounts[0],
          })),
          // Each user must approve the USDT tokens they want 
          // to deposit towards the SideBet contract
          ...newArray(numOfUsersToDeposit, (i) => ({
            method: 'approve',
            args: [SideBetV2.options.address, transferAmount],
            account: accounts[i + 1],
          })),
          {
            method: 'balanceOf',
            args: [accounts[0]],
            account: accounts[0],
            onReturn: (amount) => {
              ownerBalance = parseInt(amount);
            },
          },
        ])
        .then(() =>
          useMethodsOn(SideBetV2, [
            // Each user will deposit their USDT and choose 
            // which side they are betting on
            ...newArray(numOfUsersToDeposit, (i) => ({
              method: 'deposit',
              args: [sideToDepositFor[i], transferAmount],
              account: accounts[i + 1],
            })),
            {
              method: 'getEventDepositData',
              args: [],
              account: accounts[0],
              onReturn: (data) => {
                // We check that the total amount deposited for this event
                // is equal to the expected amount
                const totalDeposited = parseInt(data[0]) + parseInt(data[1]);
                const expectedDeposit = transferAmount * numOfUsersToDeposit;
                assert.strictEqual(totalDeposited, expectedDeposit);
              },
            },
          ])
        )
        .then(() => {
          const waitDuration = saleDuration * 1000;
          return new Promise((resolve) => {
            setTimeout(() => {
              useMethodsOn(SideBetV2, [{
                  // After the sale ends, the owner 
                  // must select the winning side
                  method: 'selectWinningSide',
                  args: [winningSide],
                  account: accounts[0],
                },
                // Only after the owner has selected the winning side, each user can
                // withdraw the funds they deposited for their bet
                ...newArray(numOfUsersToDeposit, (i) => ({
                  method: 'withdraw',
                  args: [],
                  account: accounts[i + 1],
                })),
              ]).then(() =>
                useMethodsOn(
                  TetherToken,
                  [{
                      method: 'balanceOf',
                      args: [accounts[0]],
                      account: accounts[0],
                      onReturn: (amount) => {
                        assert.strictEqual(parseInt(amount), ownerBalance + expectedOwnerCut);
                      },
                    },
                    ...newArray(numOfUsersToDeposit, (i) => ({
                      method: 'balanceOf',
                      args: [accounts[i + 1]],
                      account: accounts[0],
                      onReturn: (amount) => {
                        // We check if each user has received their expected reward
                        const expectedReward =
                          sideToDepositFor[i] === winningSide ? rewardPerUser : 0;
                        assert.strictEqual(parseInt(amount), expectedReward);
                      },
                    }))
                  ]).then(() => {
                  resolve();
                })
              );
            }, waitDuration);
          });
        });
    });
  });
});