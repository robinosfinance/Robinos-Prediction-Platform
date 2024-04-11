const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(
  ganache.provider({
    gasLimit: 1000000000000,
  })
);

const deploy = ({ abi, evm, bytecode }, args, account) =>
  new web3.eth.Contract(abi)
    .deploy({
      data: evm ? evm.bytecode.object : bytecode,
      arguments: args,
    })
    .send({
      from: account,
      gas: '1000000000',
    });

const getDeployedContract = (abi, address) =>
  new web3.eth.Contract(abi, address);

const getAccounts = () => web3.eth.getAccounts();

module.exports = {
  deploy,
  getDeployedContract,
  getAccounts,
};
