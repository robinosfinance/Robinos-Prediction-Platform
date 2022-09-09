const { formatArgs } = require('./debug');

const secondsInTheFuture = (seconds) => Math.floor(Date.now() / 1000) + seconds;

const randomInt = (min, max) => {
  const diff = max - min;
  return Math.ceil(Math.random() * diff) + min;
};

const idsFrom = (fromId, length) => {
  const idsArray = [];
  for (let i = 0; i < length; i++) {
    idsArray.push(fromId + i);
  }
  return idsArray;
};

const timeInSecs = () => Math.round(Date.now() / 1000);

const useMethodsOn = (contractInstance, methodArgs) => {
  const methods = Array.isArray(methodArgs) ? methodArgs : [methodArgs];

  if (methods.length === 0) return Promise.resolve();

  const recursiveFunction = (methodIndex, promise) =>
    promise.then(async (previousReturnValue) => {
      if (!methods[methodIndex]) return previousReturnValue;

      const {
        method,
        args = [],
        account,
        onReturn,
        wait = null,
        then = null,
        catch: catchCallback,
      } = methods[methodIndex];

      if (wait) {
        const waitPromise = new Promise((resolve) => {
          setTimeout(() => resolve(), wait);
        });
        return recursiveFunction(methodIndex + 1, waitPromise);
      }

      if (then) {
        then(await previousReturnValue);
        return recursiveFunction(methodIndex + 1, Promise.resolve());
      }

      if (!contractInstance.methods[method])
        throw new Error(`Unknown method called ${method}`);

      const requestInstance = contractInstance.methods[method](...args)
        [onReturn ? 'call' : 'send']({
          from: account,
          gas: '1000000000',
        })
        .catch((err) => {
          if (!catchCallback) {
            throw new Error(
              `Calling method ${method}${formatArgs(args)} ${err}`
            );
          }
          catchCallback(Object.values(err.results)[0].reason);
        });

      onReturn && onReturn(await requestInstance, await previousReturnValue);
      return recursiveFunction(methodIndex + 1, requestInstance);
    });

  return recursiveFunction(0, Promise.resolve());
};

const getDeploy =
  (web3) =>
  ({ abi, evm, bytecode }, args, account) =>
    new web3.eth.Contract(abi)
      .deploy({
        data: evm ? evm.bytecode.object : bytecode,
        arguments: args,
      })
      .send({
        from: account,
        gas: '1000000000',
      });

const zeroOrOne = () => randomInt(0, 2) - 1;

const newArray = (length, callback) => {
  const array = [];
  for (let i = 0; i < length; i++) array.push(callback(i));
  return array;
};

const getBalanceOfUser = async (TokenContract, account) => {
  const balance = await useMethodsOn(TokenContract, {
    method: 'balanceOf',
    args: [account],
    onReturn: () => {},
    account,
  });

  return parseInt(balance);
};

module.exports = {
  secondsInTheFuture,
  randomInt,
  idsFrom,
  timeInSecs,
  useMethodsOn,
  zeroOrOne,
  newArray,
  getDeploy,
  getBalanceOfUser,
};
