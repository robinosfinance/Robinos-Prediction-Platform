// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library StringUtils {
    function matchStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function hashStr(string memory str) internal pure returns (bytes32) {
        return bytes32(keccak256(bytes(str)));
    }
}
