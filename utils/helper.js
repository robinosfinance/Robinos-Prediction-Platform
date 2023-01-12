const { formatArgs } = require('./debug');

const randomInt = (min, max) => {
  const diff = max - min;
  return Math.ceil(Math.random() * diff) + min;
};

const newArray = (length, callback) => {
  const array = [];
  for (let i = 0; i < length; i++) array.push(callback(i));
  return array;
};

const idsFrom = (fromId, length) => newArray(length, (i) => fromId + i);

const timeInSecs = () => Math.round(Date.now() / 1000);

const secondsInTheFuture = (seconds) => timeInSecs() + seconds;

const useMethodsOn = (contractInstance, methodArgs) => {
  const methods = Array.isArray(methodArgs) ? methodArgs : [methodArgs];

  if (methods.length === 0) return Promise.resolve();
  const state = {};

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
      } = typeof methods[methodIndex] === 'function'
        ? methods[methodIndex](state)
        : methods[methodIndex];

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

      if (onReturn) {
        const result = onReturn(
          await requestInstance,
          await previousReturnValue
        );

        if (result !== undefined) {
          for (const key in result) {
            state[key] = result[key];
          }
        }
      }
      return recursiveFunction(methodIndex + 1, requestInstance);
    });

  return recursiveFunction(0, Promise.resolve());
};

const zeroOrOne = () => randomInt(0, 2) - 1;

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
  getBalanceOfUser,
};
