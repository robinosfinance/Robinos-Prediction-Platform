const path = require("path");
const fs = require("fs");
const solc = require("solc");

const files = [
	"DBToken.sol",
	"DBTokenEvent.sol",
	"DBTokenSale.sol",
	"DBTokenReward.sol",
	"DBTokenSideBet.sol",
	"RobinosGovernanceToken.sol",
	"RobinosGovernanceTokenLuckyDraw.sol",
	"RobinosGovernanceTokenNFTStake.sol",
];

let pathToFile, source;

let input = {
	language: 'Solidity',
	sources: {},
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

	input.sources[file] = {
		content: source
	};
});

// console.log(input);
const compiledInfo = JSON.parse(solc.compile(JSON.stringify(input)));
// console.log(compiledInfo);
module.exports = compiledInfo.contracts;