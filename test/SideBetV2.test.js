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

let accounts, SideBetV2, TetherToken;

const totalSupply = 100000000;
const sides = ['Machester', 'Liverpool'];
const eventCode = 'Man v. Liv';
const saleDuration = 4;

beforeEach(async () => {
  accounts = await web3.eth.getAccounts();

  /**
   *  @dev Local USDT instance. Address accounts[0] is the owner of the contract and is immediately minted totalSupply amount of tokens on initialization
   */
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
      arguments: [TetherToken.options.address, sides[0], sides[1]],
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

  it('allows users to deposit', async () => {
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
    const rewardPerUser = Math.floor(totalReward / usersVotedForWinner);

    return useMethodsOn(TetherToken, [
			// We first transfer some amount of USDT to each user participating
      ...newArray(numOfUsersToDeposit, (i) => ({
        method: 'transfer',
        args: [accounts[i + 1], transferAmount],
        account: accounts[0],
      })),
			// Each user must approve the USDT tokens they want to deposit towards the SideBet contract
      ...newArray(numOfUsersToDeposit, (i) => ({
        method: 'approve',
        args: [SideBetV2.options.address, transferAmount],
        account: accounts[i + 1],
      })),
    ])
      .then(() =>
        useMethodsOn(SideBetV2, [
          {
						// The owner will start the sale
            method: 'setSaleStartEnd',
            args: [eventCode, 0, secondsInTheFuture(saleDuration)],
            account: accounts[0],
          },
					// Each user will deposit their USDT and choose which side they are betting on
          ...newArray(numOfUsersToDeposit, (i) => ({
            method: 'deposit',
            args: [eventCode, sideToDepositFor[i], transferAmount],
            account: accounts[i + 1],
          })),
          {
            method: 'getEventDepositData',
            args: [eventCode],
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
            useMethodsOn(SideBetV2, [
              {
								// After the sale ends, the owner must select the winning side
                method: 'selectWinningSide',
                args: [eventCode, winningSide],
                account: accounts[0],
              },
							// Only after the owner has selected the winning side, each user can
							// withdraw the funds they deposited for their bet
              ...newArray(numOfUsersToDeposit, (i) => ({
                method: 'withdraw',
                args: [eventCode],
                account: accounts[i + 1],
              })),
            ]).then(() =>
              useMethodsOn(
                TetherToken,
                newArray(numOfUsersToDeposit, (i) => ({
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
              ).then(() => {
                resolve();
              })
            );
          }, waitDuration);
        });
      });
  });
});
