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

module.exports = {
  secondsInTheFuture,
  randomInt,
  idsFrom,
  timeInSecs,
};
