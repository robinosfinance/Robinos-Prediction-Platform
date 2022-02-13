const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(
  ganache.provider({
    gasLimit: 1000000000000,
  })
);

const contracts = require('../compile');

const tokenContract = contracts['RBNV2Token.sol'].RBNV2Token;

const tether = require('../compiled/tether.json');

let accounts, RBNToken, TetherToken, getBalance;

const name = 'Robinos Token V2';
const symbol = 'RBNv2';
const initialSupply = 100000000;
const taxPercentage = 20;
const withTax = (amount) => (amount / (100 - taxPercentage)) * 100;

const tetherInitialSupply = 100000000;

beforeEach(async () => {
  accounts = await web3.eth.getAccounts();

  RBNToken = await new web3.eth.Contract(tokenContract.abi)
    .deploy({
      data: tokenContract.evm.bytecode.object,
      arguments: [name, symbol, initialSupply, accounts[0], taxPercentage],
    })
    .send({
      from: accounts[0],
      gas: '1000000000',
    });

  TetherToken = await new web3.eth.Contract(tether.abi)
    .deploy({
      data: tether.bytecode,
      arguments: [tetherInitialSupply, 'Tether', 'USDT', 18],
    })
    .send({
      from: accounts[0],
      gas: '1000000000',
    });

  getBalance = async (account) =>
    RBNToken.methods.balanceOf(account).call({
      from: accounts[0],
      gas: '10000000000',
    });
});

describe('TetherToken', () => {
  it('deploys successfully', () => {
    assert.ok(TetherToken.options.address);
  });
});

describe('RBNV2Token', () => {
  it('deploys successfully', () => {
    assert.ok(RBNToken.options.address);
  });

  it('takes tax and allows owner to tag tax free addresses', async () => {
    const transferAmount = 1000;
    const expectedTax = (transferAmount * taxPercentage) / 100;
    let balanceBeforeTransfer, balanceAfterTransfer;

    return RBNToken.methods
      .transfer(accounts[1], withTax(transferAmount))
      .send({
        from: accounts[0],
        gas: '10000000000',
      })
      .then(async () => {
        const requestInstance = getBalance(accounts[0]);
        balanceBeforeTransfer = parseInt(await requestInstance);
        return requestInstance;
      })
      .then(() =>
        RBNToken.methods.transfer(accounts[2], transferAmount).send({
          from: accounts[1],
          gas: '10000000000',
        })
      )
      .then(async () => {
        const requestInstance = getBalance(accounts[0]);
        balanceAfterTransfer = parseInt(await requestInstance);
        const taxGained = balanceAfterTransfer - balanceBeforeTransfer;
        assert.strictEqual(taxGained, expectedTax);
      })
      .then(() => {
        return RBNToken.methods
          .setTaxFreeAddress(accounts[2], true)
          .send({
            from: accounts[0],
            gas: '10000000000',
          })
          .then(() =>
            RBNToken.methods
              .transfer(accounts[1], withTax(transferAmount))
              .send({
                from: accounts[0],
                gas: '10000000000',
              })
          )
          .then(async () => {
            const requestInstance = getBalance(accounts[0]);
            balanceBeforeTransfer = parseInt(await requestInstance);
            return requestInstance;
          })
          .then(() =>
            RBNToken.methods.transfer(accounts[2], transferAmount).send({
              from: accounts[1],
              gas: '10000000000',
            })
          )
          .then(async () => {
            const requestInstance = getBalance(accounts[0]);
            balanceAfterTransfer = parseInt(await requestInstance);
            assert.strictEqual(balanceAfterTransfer, balanceBeforeTransfer);
          });
      });
  });

  it('allows owner to toggle tax on/off', () => {
    const transferAmount = 1000;
    let balanceBeforeTransfer, balanceAfterTransfer;

    return RBNToken.methods
      .setShouldTax(false)
      .send({
        from: accounts[0],
        gas: '10000000000',
      })
      .then(() =>
        RBNToken.methods.transfer(accounts[1], transferAmount).send({
          from: accounts[0],
          gas: '10000000000',
        })
      )
      .then(async () => {
        const requestInstance = getBalance(accounts[0]);
        balanceBeforeTransfer = parseInt(await requestInstance);
        return requestInstance;
      })
      .then(() =>
        RBNToken.methods.transfer(accounts[2], transferAmount).send({
          from: accounts[1],
          gas: '10000000000',
        })
      )
      .then(async () => {
        const requestInstance = getBalance(accounts[0]);
        balanceAfterTransfer = parseInt(await requestInstance);
        assert.strictEqual(balanceAfterTransfer, balanceBeforeTransfer);
      });
  });
});
