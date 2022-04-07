const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(
  ganache.provider({
    gasLimit: 1000000000000,
  })
);

const contracts = require('../compile');

const tokenContract = contracts['MyToken.sol'].MyToken;

const {
  getDeploy
} = require('../utils/helper');

describe('MyToken tests', () => {
  let accounts, MyToken;

  beforeEach(async () => {
    const deploy = getDeploy(web3);
    accounts = await web3.eth.getAccounts();
    MyToken = await deploy(tokenContract, [], accounts[0]);

  });


  describe('MyToken', () => {
    it('deploys successfully', () => {
      assert.ok(MyToken.options.address);
    });
  });
  
});