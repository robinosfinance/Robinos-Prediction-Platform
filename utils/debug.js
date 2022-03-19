const formatCompileErrors = (compiledInfo) => compiledInfo.errors.map(({
    formattedMessage
}) => formattedMessage);

/**
 * Prints all the logs in the contract instance created by the Debugger contract
 * 
 * @param contractInstance 
 */
const printLogs = async (contractInstance) => {
    const getLogs = async (contractInstance) => {
        return (await contractInstance.getPastEvents('allEvents')).map(({
            event,
            returnValues
        }) => {
            const log = {
                event
            };
            Object.entries(returnValues).forEach(([key, value]) => {
                if (/^\d*$/.test(key)) return;
                log[key] = value;
            });
            return log;
        }).filter(log => ({
            message
        }) => !!message && /^Debugger: /.test(message));
    };
    // eslint-disable-next-line no-console
    console.log(await getLogs(contractInstance));
};

const formatArgs = (args) =>
    args ?
    `(${args.reduce(
    (string, arg, i) => `${string}${i === 0 ? '' : ', '}${arg}`,
    ''
  )})` : '';

module.exports = {
    formatCompileErrors,
    printLogs,
    formatArgs
};