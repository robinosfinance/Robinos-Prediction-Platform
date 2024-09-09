// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AddressArrayUtils} from "../libraries/AddressArrayUtils.sol";

abstract contract LoggingUsers {
    using AddressArrayUtils for address[];

    event NewUniqueWallet(address wallet);

    // Mapping to keep track of whether an address has interacted with the contract
    mapping(address => bool) private userHasInteracted;

    // Array to store all unique wallet addresses
    address[] private uniqueWallets;

    function _logUser(address wallet) internal {
        if (userHasInteracted[wallet]) return;

        userHasInteracted[wallet] = true;
        uniqueWallets.push(wallet);

        emit NewUniqueWallet(wallet);
    }

    function getUniqueWalletCount() external view returns (uint256) {
        return uniqueWallets.length;
    }

    function getAllUniqueWallets(uint256 maxCount) external view returns (address[] memory) {
        return uniqueWallets.reverse().subArray(maxCount);
    }
}
