const secondsInTheFuture = seconds => Math.floor(Date.now() / 1000) + seconds; 

module.exports = {
    secondsInTheFuture,
};