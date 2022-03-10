const path = require('path');
const fs = require('fs');
const solc = require('solc');
const files = require('./contracts');
const {
  formatCompileErrors
} = require('./utils/debug');

const input = {
  language: 'Solidity',
  sources: {},
  settings: {
    outputSelection: {
      '*': {
        '*': ['*'],
      },
    },
  },
};

files.forEach((file) => {
  const pathToFile = path.resolve(__dirname, 'contracts', file);
  const source = fs.readFileSync(pathToFile, 'utf8');

  input.sources[file] = {
    content: source,
  };
});

const compiledInfo = JSON.parse(solc.compile(JSON.stringify(input)));
if (compiledInfo.errors) console.error(formatCompileErrors(compiledInfo));

module.exports = compiledInfo.contracts;