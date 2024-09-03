const path = require('path');
const fs = require('fs');
const solc = require('solc');
const { formatCompileErrors } = require('./utils/debug');

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

function getAllFilesWithExtensions(dir, extensions) {
  const results = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results.push(...getAllFilesWithExtensions(filePath, extensions));
    } else {
      if (extensions.includes(path.extname(file))) {
        results.push(filePath);
      }
    }
  });

  return results;
}

const files = getAllFilesWithExtensions('./contracts', ['.sol']);

files.forEach((file) => {
  const pathToFile = path.resolve(__dirname, file);
  const source = fs.readFileSync(pathToFile, 'utf8');
  const fileName = file.replace('contracts\\', '').replace( '\\', '/');
  
  input.sources[fileName] = {
    content: source,
  };
});

const compiledInfo = JSON.parse(solc.compile(JSON.stringify(input)));
if (compiledInfo.errors) console.error(formatCompileErrors(compiledInfo));

module.exports = compiledInfo.contracts;
