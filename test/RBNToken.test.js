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
const {
  useMethodsOn,
  deploy
} = require('../helper');

describe('RBNToken tests', () => {
  let accounts, RBNToken, TetherToken;

  const name = 'Robinos Token V2';
  const symbol = 'RBNv2';
  const initialSupply = 100000000;
  const taxPercentage = 20;
  const withTax = (amount) => (amount / (100 - taxPercentage)) * 100;

  const tetherInitialSupply = 100000000;

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    RBNToken = await deploy(tokenContract, [
      name,
      symbol,
      initialSupply,
      accounts[0],
      taxPercentage
    ], web3, accounts[0]);

    TetherToken = await new web3.eth.Contract(tether.abi)
      .deploy({
        data: tether.bytecode,
        arguments: [tetherInitialSupply, 'Tether', 'USDT', 18],
      })
      .send({
        from: accounts[0],
        gas: '1000000000',
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
      return useMethodsOn(RBNToken, [{
          method: 'transfer',
          args: [accounts[1], withTax(transferAmount)],
          account: accounts[0],
        },
        {
          method: 'balanceOf',
          args: [accounts[0]],
          account: accounts[0],
          onReturn: (amount) => {
            balanceBeforeTransfer = parseInt(amount);
          },
        },
        {
          method: 'transfer',
          args: [accounts[2], transferAmount],
          account: accounts[1],
        },
        {
          method: 'balanceOf',
          args: [accounts[0]],
          account: accounts[0],
          onReturn: (amount) => {
            balanceAfterTransfer = parseInt(amount);
            const taxGained = balanceAfterTransfer - balanceBeforeTransfer;
            assert.strictEqual(taxGained, expectedTax);
          },
        },
        {
          method: 'setTaxFreeAddress',
          args: [accounts[2], true],
          account: accounts[0],
        },
        {
          method: 'transfer',
          args: [accounts[1], withTax(transferAmount)],
          account: accounts[0],
        },
        {
          method: 'balanceOf',
          args: [accounts[0]],
          account: accounts[0],
          onReturn: (amount) => {
            balanceBeforeTransfer = parseInt(amount);
          },
        },
        {
          method: 'transfer',
          args: [accounts[2], transferAmount],
          account: accounts[1],
        },
        {
          method: 'balanceOf',
          args: [accounts[0]],
          account: accounts[0],
          onReturn: (amount) => {
            balanceAfterTransfer = parseInt(amount);
            assert.strictEqual(balanceAfterTransfer, balanceBeforeTransfer);
          },
        },
      ]);
    });

    it('allows owner to toggle tax on/off', () => {
      const transferAmount = 1000;
      let balanceBeforeTransfer, balanceAfterTransfer;

      return useMethodsOn(RBNToken, [{
          method: 'setShouldTax',
          args: [false],
          account: accounts[0],
        },
        {
          method: 'transfer',
          args: [accounts[1], transferAmount],
          account: accounts[0],
        },
        {
          method: 'balanceOf',
          args: [accounts[0]],
          account: accounts[0],
          onReturn: (amount) => {
            balanceBeforeTransfer = parseInt(amount);
          },
        },
        {
          method: 'transfer',
          args: [accounts[2], transferAmount],
          account: accounts[1],
        },
        {
          method: 'balanceOf',
          args: [accounts[0]],
          account: accounts[0],
          onReturn: (amount) => {
            balanceAfterTransfer = parseInt(amount);
            assert.strictEqual(balanceAfterTransfer, balanceBeforeTransfer);
          },
        },
      ]);
    });
  });
});