// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UintUtils} from "./UintUtils.sol";

library AddressArrayUtils {
    function subArray(address[] memory array, uint256 maxCount) internal pure returns (address[] memory) {
        uint256 count = UintUtils.min(maxCount, array.length);
        address[] memory result = new address[](count);

        for (uint256 i = 0; i < count; i++) {
            result[i] = array[i];
        }

        return result;
    }

    function subArray(
        address[] memory array,
        uint256 startIndex,
        uint256 endIndex
    ) internal pure returns (address[] memory) {
        require(startIndex <= endIndex, "Start index must be less than or equal to end index");
        require(startIndex < array.length, "Start index must be less than array length");

        uint256 count = UintUtils.min(endIndex - startIndex, array.length - startIndex);
        address[] memory result = new address[](count);

        for (uint256 i = 0; i < count; i++) {
            result[i] = array[startIndex + i];
        }

        return result;
    }

    function reverse(address[] memory array) internal pure returns (address[] memory) {
        address[] memory result = new address[](array.length);

        for (uint256 i = 0; i < array.length; i++) {
            result[i] = array[array.length - 1 - i];
        }

        return result;
    }
}
