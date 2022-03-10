// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

abstract contract Debugger {
    event LogUint(string message, uint256 num, address sender);
    event LogString(string message, string str, address sender);
    event LogBool(string message, bool boolean, address sender);
    event LogAddress(string message, address addr, address sender);
    event Log(string message, address sender);

    string constant MESSAGE_PREFIX = "Debugger: ";

    function logUint(string memory message, uint256 num) internal {
        emit LogUint(concatStrings(MESSAGE_PREFIX, message), num, msg.sender);
    }

    function logString(string memory message, string memory str) internal {
        emit LogString(concatStrings(MESSAGE_PREFIX, message), str, msg.sender);
    }

    function logBool(string memory message, bool boolean) internal {
        emit LogBool(concatStrings(MESSAGE_PREFIX, message), boolean, msg.sender);
    }

    function logAddress(string memory message, address addr) internal {
        emit LogAddress(concatStrings(MESSAGE_PREFIX, message), addr, msg.sender);
    }

    function log(string memory message) internal {
        emit Log(concatStrings(MESSAGE_PREFIX, message), msg.sender);
    }

    function concatStrings(string memory a, string memory b) private pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }
}
