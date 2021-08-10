const path = require("path");
const fs = require("fs");
const solc = require("solc");

let files = [
	"DBToken.sol",
	"DBTokenSale.sol",
	"IERC20.sol",
	"Context.sol",
	"StandardToken.sol"
];

let pathToFile, source;

let input = {
	language: 'Solidity',
	sources: {/** Add file names in files array */},
	settings: {
		outputSelection: {
			'*': {
				'*': ['*']
			}
		}
	}
};

files.forEach(file => {
	pathToFile = path.resolve(__dirname, "contracts", file);
	source = fs.readFileSync(pathToFile, "utf8");
	
	input.sources[file] = { content: source };
});

// console.log(input);
const compiledInfo = JSON.parse(solc.compile(JSON.stringify(input)));
// console.log(JSON.stringify(compiledInfo));
module.exports = compiledInfo.contracts;