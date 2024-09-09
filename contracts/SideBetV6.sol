// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "./openzeppelin/Ownable.sol";
import {IERC20} from "./openzeppelin/interfaces/IERC20.sol";
import {SafeERC20} from "./openzeppelin/libraries/SafeERC20.sol";

import {StringUtils} from "./libraries/StringUtils.sol";
import {UintUtils} from "./libraries/UintUtils.sol";
import {AddressArrayUtils} from "./libraries/AddressArrayUtils.sol";
import {SaleFactory} from "./SaleFactory.sol";
import {TeamIndex} from "./enums/SideBet.sol";
import {SideBet, UserSideBetData} from "./structs/SideBet.sol";
import {LoggingUsers} from "./utils/LoggingUsers.sol";

contract SideBetV6 is SaleFactory, LoggingUsers {
    using AddressArrayUtils for address[];
    using StringUtils for string;
    using SafeERC20 for IERC20;

    event SideBetEventInitialized(
        string eventCode,
        string teamA,
        string teamB,
        address standardToken,
        uint256 startTime,
        uint256 endTime
    );
    event Deposited(string eventCode, uint256 amount, TeamIndex teamIndex, address from, address token);
    event WinningTeamSelected(string eventCode, TeamIndex teamIndex);
    event SideBetCancelled(string eventCode);
    event RewardDistributed(string eventCode, uint256[] userRewards, address[] winningUsers);
    event RefundDistributed(string eventCode, uint256[] userRefunds, address[] users);
    event OwnerCutTransferred(string eventCode, uint256 ownerCut);

    uint256 constant OWNER_CUT_PERCENT = 5;

    mapping(bytes32 => SideBet) private sideBets;
    mapping(address => bytes32[]) private userSideBets;
    mapping(address => mapping(bytes32 => bool)) private userClaimedReward;
    mapping(address => uint256) private totalTokenSpent;

    modifier winnerIsSet(string memory eventCode) {
        require(getSideBet(eventCode).winnerSet, "winning team not selected");
        _;
    }

    modifier sideBetActive(string memory eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);
        require(!sideBet.cancelled, "cancelled");
        _;
    }

    function _calculateTotalRewardAndOwnerCut(
        SideBet storage sideBet
    ) private view returns (uint256 totalReward, uint256 ownerCut) {
        uint256 totalDeposited = sideBet.totalTokensDeposited[0] + sideBet.totalTokensDeposited[1];

        ownerCut = (totalDeposited * OWNER_CUT_PERCENT) / 100;
        totalReward = totalDeposited - ownerCut;
    }

    function getSideBet(string memory eventCode) private view returns (SideBet storage) {
        SideBet storage sideBet = sideBets[eventCode.hashStr()];

        require(
            !StringUtils.matchStrings(sideBet.teamNames[0], "") && !StringUtils.matchStrings(sideBet.teamNames[1], ""),
            "not initialized"
        );

        return sideBet;
    }

    function userHasDeposited(SideBet storage sideBet, TeamIndex index, address user) private view returns (bool) {
        return sideBet.userTokens[user][uint8(index)] != 0;
    }

    function calculateUserReward(SideBet storage sideBet, address user) private view returns (uint256) {
        if (!sideBet.winnerSet) return 0;

        uint8 winningIndex = uint8(sideBet.winningIndex);
        uint256 totalWinningTokensDeposited = sideBet.totalTokensDeposited[winningIndex];
        if (totalWinningTokensDeposited == 0) return 0;

        (uint256 totalReward, ) = _calculateTotalRewardAndOwnerCut(sideBet);
        uint256 userDeposited = sideBet.userTokens[user][winningIndex];

        return (userDeposited * totalReward) / totalWinningTokensDeposited;
    }

    /**
     * @dev If the winner has been selected by the owner, allows anyone to see the
     * users who've deposited the tokens towards the winning team and their corresponding rewards
     * and the total reward distributed
     */
    function getWinningUsersAndUserRewards(
        string memory eventCode,
        uint256 startIndex,
        uint256 endIndex
    )
        public
        view
        winnerIsSet(eventCode)
        sideBetActive(eventCode)
        returns (address[] memory winningUsers, uint256[] memory userRewards)
    {
        SideBet storage sideBet = getSideBet(eventCode);

        TeamIndex winningIndex = sideBet.winningIndex;
        winningUsers = sideBet.eventUsers[uint8(winningIndex)].subArray(startIndex, endIndex);
        userRewards = new uint256[](winningUsers.length);

        uint256 totalWinningTokensDeposited = sideBet.totalTokensDeposited[uint8(winningIndex)];

        if (totalWinningTokensDeposited == 0) return (winningUsers, userRewards);

        for (uint256 i = 0; i < winningUsers.length; i++) {
            uint256 userReward = calculateUserReward(sideBet, winningUsers[i]);

            userRewards[i] = userReward;
        }
    }

    function calculateTotalRewardAndOwnerCut(
        string memory eventCode
    ) external view returns (uint256 totalReward, uint256 ownerCut) {
        return _calculateTotalRewardAndOwnerCut(getSideBet(eventCode));
    }

    function getUserTokensDeposited(string memory eventCode, address user) external view returns (uint256[2] memory) {
        return getSideBet(eventCode).userTokens[user];
    }

    function getUserSideBets(address user) external view returns (bytes32[] memory) {
        return userSideBets[user];
    }

    function getTotalTokenSpent(address tokenAddress) external view returns (uint256) {
        return totalTokenSpent[tokenAddress];
    }

    function getUsersRewardsClaimedStatuses(
        string memory eventCode,
        uint256 startIndex,
        uint256 endIndex
    ) external view returns (address[] memory users, bool[] memory usersRewardsClaimed) {
        SideBet storage sideBet = getSideBet(eventCode);

        if (sideBet.winnerSet) {
            uint8 winningIndex = uint8(sideBet.winningIndex);
            users = sideBet.eventUsers[winningIndex].subArray(startIndex, endIndex);
        } else if (sideBet.cancelled) {
            users = sideBet.allUsers.subArray(startIndex, endIndex);
        }

        usersRewardsClaimed = new bool[](users.length);

        for (uint256 i = 0; i < users.length; i++) {
            usersRewardsClaimed[i] = userClaimedReward[users[i]][eventCode.hashStr()];
        }
    }

    /**
     * @dev Returns basic data for the selected side bet
     *
     * @param eventCode of the side bet
     */
    function getSideBetData(
        string memory eventCode
    )
        external
        view
        returns (
            string[2] memory teamNames,
            address standardTokenAddress,
            bool winnerSet,
            TeamIndex winningIndex,
            bool ownerCutWithdrawn,
            bool cancelled
        )
    {
        SideBet storage sideBet = getSideBet(eventCode);

        teamNames = sideBet.teamNames;
        standardTokenAddress = sideBet.standardToken;
        winnerSet = sideBet.winnerSet;
        winningIndex = sideBet.winningIndex;
        ownerCutWithdrawn = sideBet.ownerCutWithdrawn;
        cancelled = sideBet.cancelled;
    }

    /**
     * @dev Returns user deposit data for the selected side bet. Method will revert if the side bet has not been initialized.
     * Indices of {uint256[][2]} userTokens correspond to indices in {address[][2]} eventUsers
     *
     * @param eventCode of the side bet
     * @param maxUsers maximum number of users to return
     */
    function getSideBetDepositData(
        string memory eventCode,
        uint256 maxUsers
    )
        external
        view
        returns (
            address[] memory allUsers,
            address[][2] memory eventUsers,
            uint256[][2] memory userTokens,
            uint256[2] memory totalTokensDeposited
        )
    {
        SideBet storage sideBet = getSideBet(eventCode);
        uint256[2] memory numOfUsers = [
            UintUtils.min(sideBet.eventUsers[0].length, maxUsers),
            UintUtils.min(sideBet.eventUsers[1].length, maxUsers)
        ];

        allUsers = sideBet.allUsers;
        eventUsers = sideBet.eventUsers;
        totalTokensDeposited = sideBet.totalTokensDeposited;

        userTokens = [new uint256[](numOfUsers[0]), new uint256[](numOfUsers[1])];

        for (uint256 teamIndex = 0; teamIndex < 2; teamIndex++) {
            for (uint256 i = 0; i < numOfUsers[teamIndex]; i++) {
                address[] memory users = eventUsers[teamIndex];
                address user = users[users.length - i - 1];

                userTokens[teamIndex][userTokens[teamIndex].length - i - 1] = sideBet.userTokens[user][teamIndex];
            }
        }
    }

    /**
     * @dev Returns all side bet data for the selected user.
     *
     * @param user address of the user
     * @param maxSideBets maximum number of side bets to return. Returns all side bets if the number of side bets is less than maxSideBets
     * @return UserSideBetData[] array of user side bet data in reverse order, where the last element is the most recent side bet
     */
    function getUserSideBetData(address user, uint256 maxSideBets) external view returns (UserSideBetData[] memory) {
        bytes32[] memory userSideBetHashes = userSideBets[user];
        uint256 resultLength = UintUtils.min(userSideBetHashes.length, maxSideBets);

        UserSideBetData[] memory userSideBetData = new UserSideBetData[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            SideBet storage sideBet = sideBets[userSideBetHashes[userSideBetHashes.length - i - 1]];

            userSideBetData[i] = UserSideBetData({
                eventCode: sideBet.eventCode,
                tokenAddress: sideBet.standardToken,
                teamNames: sideBet.teamNames,
                winnerSet: sideBet.winnerSet,
                winningIndex: sideBet.winningIndex,
                userTokensDeposited: sideBet.userTokens[user],
                userReward: calculateUserReward(sideBet, user)
            });
        }

        return userSideBetData;
    }

    /**
     * @dev Initializes a new side bet event
     *
     * @param eventCode of the side bet to be initialized
     * @param teamNameA first team name
     * @param teamNameB second team name
     * @param standardToken contract instance used as a reward token
     * @param saleStart unix time for sale start. Same as in setSaleStartEnd
     * @param saleEnd unix time for sale end
     */
    function initializeSideBet(
        string memory eventCode,
        string memory teamNameA,
        string memory teamNameB,
        address standardToken,
        uint256 saleStart,
        uint256 saleEnd
    ) external onlyOwner {
        require(standardToken != address(0), "AZ");
        require(
            !StringUtils.matchStrings(teamNameA, "") && !StringUtils.matchStrings(teamNameB, ""),
            "empty team name"
        );

        SideBet storage sideBet = sideBets[eventCode.hashStr()];
        require(
            StringUtils.matchStrings(sideBet.teamNames[0], "") && StringUtils.matchStrings(sideBet.teamNames[1], ""),
            "already initialized"
        );

        _setSaleStartEnd(eventCode, saleStart, saleEnd);

        sideBet.eventCode = eventCode;
        sideBet.teamNames = [teamNameA, teamNameB];
        sideBet.standardToken = standardToken;

        emit SideBetEventInitialized(eventCode, teamNameA, teamNameB, standardToken, saleStart, saleEnd);
    }

    /**
     * @dev Allows owner to cancel the side bet
     *
     * @param eventCode of the side bet to be cancelled
     */
    function cancelSideBet(string memory eventCode) external onlyOwner sideBetActive(eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);

        emit SideBetCancelled(eventCode);

        sideBet.cancelled = true;
    }

    /**
     * @dev Allows owner to select a winning team only after the sale ends
     *
     * @param eventCode of the sale you finalize
     * @param index of the team proclaimed as a winner
     */
    function selectWinningTeam(
        string memory eventCode,
        TeamIndex index
    ) external onlyOwner saleHasEnded(eventCode) sideBetActive(eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);

        require(!sideBet.winnerSet, "winning team selected");

        sideBet.winnerSet = true;
        sideBet.winningIndex = index;

        emit WinningTeamSelected(eventCode, index);
    }

    /**
     * @dev Allows the owner to transfer the owner's cut to the owner's address
     */
    function transferOwnerCut(
        string memory eventCode
    ) external onlyOwner winnerIsSet(eventCode) sideBetActive(eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);
        require(!sideBet.ownerCutWithdrawn, "owner cut withdrawn");

        (, uint256 ownerCut) = _calculateTotalRewardAndOwnerCut(sideBet);

        IERC20(sideBet.standardToken).safeTransfer(owner(), ownerCut);

        sideBet.ownerCutWithdrawn = true;

        emit OwnerCutTransferred(eventCode, ownerCut);
    }

    /**
     * @dev Allows owner to distribute the calculated rewards to the users who deposited tokens towards the winning team
     * between the initial index and the end index. If the user has already claimed the reward, the function will skip the user.
     * Using start and end index allows the owner to distribute rewards in batches, if the number of users is too large, which
     * can prevent the transaction from running out of gas.
     *
     * @param eventCode of the sale you want to distribute rewards for
     * @param startIndex of the user array
     * @param endIndex of the user array
     *
     */
    function distributeReward(
        string memory eventCode,
        uint256 startIndex,
        uint256 endIndex
    ) external onlyOwner winnerIsSet(eventCode) sideBetActive(eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);
        bytes32 eventHash = eventCode.hashStr();

        require(startIndex < endIndex, "SGTE");

        (address[] memory winningUsers, uint256[] memory userRewards) = getWinningUsersAndUserRewards(
            eventCode,
            startIndex,
            endIndex
        );

        for (uint256 i = 0; i < winningUsers.length; i++) {
            address user = winningUsers[i];
            uint256 userReward = userRewards[i];

            if (userClaimedReward[user][eventHash]) continue;

            try IERC20(sideBet.standardToken).transfer(user, userReward) returns (bool success) {
                userClaimedReward[user][eventHash] = success;
            } catch {
                continue;
            }
        }

        emit RewardDistributed(eventCode, userRewards, winningUsers);
    }

    /**
     * @dev Allows the owner to refund the tokens to the users who deposited tokens towards the sale
     * between the initial index and the end index. If the user has already claimed the refund, the function will skip the user.
     * Using start and end index allows the owner to distribute refund in batches, if the number of users is too large, which
     * can prevent the transaction from running out of gas.
     *
     * @param eventCode of the sale you want to refund tokens for
     * @param startIndex of the user array
     * @param endIndex of the user array
     */
    function refundTokens(string memory eventCode, uint256 startIndex, uint256 endIndex) external onlyOwner {
        SideBet storage sideBet = getSideBet(eventCode);

        require(sideBet.cancelled, "not cancelled");

        address standardToken = sideBet.standardToken;
        bytes32 eventHash = eventCode.hashStr();
        address[] memory allUsers = sideBet.allUsers.subArray(startIndex, endIndex);
        uint256[] memory userDeposits = new uint256[](allUsers.length);

        for (uint256 i = 0; i < allUsers.length; i++) {
            address user = allUsers[i];

            if (userClaimedReward[user][eventHash]) continue;
            uint256 userDeposited = sideBet.userTokens[user][0] + sideBet.userTokens[user][1];

            try IERC20(standardToken).transfer(user, userDeposited) returns (bool success) {
                userClaimedReward[user][eventHash] = success;
                userDeposits[i] = userDeposited;
            } catch {
                continue;
            }
        }

        emit RefundDistributed(eventCode, userDeposits, allUsers);
    }

    /**
     * Allows users to deposit selected standard tokens
     * during a sale towards 2 of the given teams
     *
     * @param eventCode of the sale you want to deposit for
     * @param index of the team you are depositing for
     * @param amount of standard tokens you want to deposit
     */
    function deposit(
        string memory eventCode,
        TeamIndex index,
        uint256 amount
    ) external duringSale(eventCode) sideBetActive(eventCode) {
        address sender = _msgSender();
        uint8 uintIndex = uint8(index);

        SideBet storage sideBet = getSideBet(eventCode);

        require(amount > 0, "AZ");

        if (
            !userHasDeposited(sideBet, TeamIndex.First, sender) && !userHasDeposited(sideBet, TeamIndex.Second, sender)
        ) {
            userSideBets[sender].push(eventCode.hashStr());
            sideBet.allUsers.push(sender);
        }

        if (!userHasDeposited(sideBet, index, sender)) sideBet.eventUsers[uintIndex].push(sender);

        sideBet.totalTokensDeposited[uintIndex] += amount;
        sideBet.userTokens[sender][uintIndex] += amount;
        totalTokenSpent[sideBet.standardToken] += amount;

        _logUser(sender);

        IERC20(sideBet.standardToken).safeTransferFrom(sender, address(this), amount);

        emit Deposited(eventCode, amount, index, sender, sideBet.standardToken);
    }
}
