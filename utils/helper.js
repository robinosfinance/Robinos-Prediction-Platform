const { formatArgs } = require('./debug');
const { mapObject, filterObject } = require('./objects');

class AssertFailError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertFailError';
  }
}

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

  const saveToState = (data) => {
    if (data === undefined) return;

    for (const key in data) {
      state[key] = data[key];
    }
  };

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
        onEvent,
        assertFail = false,
      } = typeof methods[methodIndex] === 'function'
        ? methods[methodIndex](state)
        : methods[methodIndex];

      const errorText = `Account ${account} Calling method ${method}${formatArgs(
        args
      )}`;

      if (wait) {
        const waitPromise = new Promise((resolve) => {
          setTimeout(() => resolve(), wait);
        });
        return recursiveFunction(methodIndex + 1, waitPromise);
      }

      if (then) {
        const result = await then(await previousReturnValue);
        saveToState(result);

        return recursiveFunction(methodIndex + 1, Promise.resolve());
      }

      if (!contractInstance.methods[method])
        throw new Error(`Unknown method called ${method}`);

      // console.log(errorText);

      const requestInstance = contractInstance.methods[method](...args)
        [onReturn ? 'call' : 'send']({
          from: account,
          gas: '1000000000',
        })
        .catch(() =>
          contractInstance.methods[method](...args)
            .call({ from: account })
            .catch((err) => {
              const reason = err.message.split(': revert ')[1];

              if (!catchCallback) {
                throw new Error(`${errorText} ${reason}`);
              }

              catchCallback(reason, err.data);

              if (assertFail) throw err;
            })
        );

      if (assertFail) {
        try {
          await requestInstance;
          throw new AssertFailError(
            `${errorText} succeeded but should have failed`
          );
        } catch (err) {
          if (err instanceof AssertFailError) throw err;

          return recursiveFunction(methodIndex + 1, Promise.resolve());
        }
      }

      if (onReturn) {
        const result = await onReturn(
          await requestInstance,
          await previousReturnValue
        );

        saveToState(result);
      }

      if (onEvent) {
        await requestInstance.then((result) => {
          const events = mapObject(result.events, ([key, value]) => [
            key,
            filterObject(value.returnValues, ([key]) => !/^\d+$/.test(key)),
          ]);

          return onEvent(events);
        });
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

const getBalancesOfUsers = async (TokenContract, accounts) => {
  const balances = await Promise.all(
    accounts.map((account) => getBalanceOfUser(TokenContract, account))
  );

  return balances;
};

const valuesWithin = (a, b, delta) => Math.abs(a - b) <= delta;

const getTaxFunction = (taxPercentage) => (amount) =>
  Math.round((amount / (100 - taxPercentage)) * 100);

const valuesWithinPercentage = (value1, value2, percentage) => {
  const diff = Math.abs(value1 - value2);
  const maxDiff = Math.max(value1, value2) * (percentage / 100);

  return diff <= maxDiff;
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
  getBalancesOfUsers,
  valuesWithin,
  getTaxFunction,
  valuesWithinPercentage,
};
