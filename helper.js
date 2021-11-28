const secondsInTheFuture = seconds => Math.floor(Date.now() / 1000) + seconds;

const randomInt = (min, max) => {
    const diff = max - min;
    return Math.ceil(Math.random() * diff) + min;
};

module.exports = {
    secondsInTheFuture,
    randomInt,
};