// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TeamIndex} from "../enums/SideBet.sol";

struct SideBet {
    string eventCode;
    string[2] teamNames;
    address standardToken;
    bool winnerSet;
    TeamIndex winningIndex;
    bool ownerCutWithdrawn;
    bool cancelled;
    address[] allUsers;
    address[][2] eventUsers;
    mapping(address => uint256[2]) userTokens;
    uint256[2] totalTokensDeposited;
}

struct UserSideBetData {
    string eventCode;
    address tokenAddress;
    string[2] teamNames;
    bool winnerSet;
    TeamIndex winningIndex;
    uint256[2] userTokensDeposited;
    uint256 userReward;
}
