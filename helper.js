const secondsInTheFuture = seconds => Math.floor(Date.now() / 1000) + seconds;

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

module.exports = {
    secondsInTheFuture,
    randomInt,
    idsFrom,
};