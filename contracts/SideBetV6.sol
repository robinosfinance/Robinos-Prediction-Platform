// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";
import {Ownable} from "./openzeppelin/Ownable.sol";
import {StringUtils} from "./libraries/StringUtils.sol";
import {SaleFactory} from "./SaleFactory.sol";
import {TeamIndex} from "./enums/SideBet.sol";
import {SideBet, UserSideBetData} from "./structs/SideBet.sol";

contract SideBetV6 is SaleFactory {
    using StringUtils for string;

    event Deposited(string indexed eventCode, uint256 amount, TeamIndex teamIndex, address from, address token);
    event SideBetEventInitialized(
        string indexed eventCode,
        string teamA,
        string teamB,
        address standardToken,
        uint256 startTime,
        uint256 endTime
    );
    event RewardDistributed(string indexed eventCode, uint256[] rewards, address[] users);
    event WinningTeamSelected(string indexed eventCode, TeamIndex teamIndex);
    event BetCancelledAndTokensRefunded(string indexed eventCode);
    event NewUniqueWallet(address indexed wallet);

    uint256 constant OWNER_CUT_PERCENT = 5;

    mapping(bytes32 => SideBet) private sideBets;
    mapping(address => bytes32[]) private userSideBets;

    // Mapping to keep track of whether an address has interacted with the contract
    mapping(address => bool) private userHasInteracted;

    // Array to store all unique wallet addresses
    address[] private uniqueWallets;

    // Mapping to track total token spent for each specific token
    mapping(address => uint256) private totalTokenSpent;

    modifier winnerIsSet(string memory eventCode) {
        require(getSideBet(eventCode).winnerSet, "SideBetV6: winning team index not selected");
        _;
    }

    modifier sideBetActive(string memory eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);
        require(!sideBet.rewardDistributed, "SideBetV6: reward is already distributed");
        require(!sideBet.cancelled, "SideBetV6: side bet has been cancelled");
        _;
    }

    function getSideBet(string memory eventCode) private view returns (SideBet storage) {
        SideBet storage sideBet = sideBets[eventCode.hashStr()];
        require(
            !StringUtils.matchStrings(sideBet.teamNames[0], "") && !StringUtils.matchStrings(sideBet.teamNames[1], ""),
            "SideBetV6: side bet is not initialized"
        );
        return sideBet;
    }

    function _calculateTotalRewardAndOwnerCut(
        SideBet storage sideBet
    ) private view returns (uint256 totalReward, uint256 ownerCut) {
        uint256 totalDeposited = sideBet.totalTokensDeposited[0] + sideBet.totalTokensDeposited[1];
        ownerCut = (totalDeposited * OWNER_CUT_PERCENT) / 100;
        totalReward = totalDeposited - ownerCut;
    }

    /**
     * @dev Returns all data for the selected side bet. Method will revert if the side bet has not been initialized.
     * Indices of {uint256[][2]} userTokens correspond to indices in {address[][2]} eventUsers
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
            bool rewardDistributed,
            bool cancelled,
            address[][2] memory eventUsers,
            uint256[][2] memory userTokens,
            uint256[2] memory totalTokensDeposited,
            address owner
        )
    {
        SideBet storage sideBet = getSideBet(eventCode);

        teamNames = sideBet.teamNames;
        standardTokenAddress = address(sideBet.standardToken);
        winnerSet = sideBet.winnerSet;
        winningIndex = sideBet.winningIndex;
        rewardDistributed = sideBet.rewardDistributed;
        cancelled = sideBet.cancelled;
        eventUsers = sideBet.eventUsers;
        totalTokensDeposited = sideBet.totalTokensDeposited;
        owner = sideBet.owner;

        userTokens = [new uint256[](eventUsers[0].length), new uint256[](eventUsers[1].length)];

        for (uint256 teamIndex = 0; teamIndex < 2; teamIndex++) {
            for (uint256 i = 0; i < eventUsers[teamIndex].length; i++) {
                address user = eventUsers[teamIndex][i];
                userTokens[teamIndex][i] = sideBet.userTokens[user][teamIndex];
            }
        }
    }

    function getUserTokensDeposited(string memory eventCode, address user) external view returns (uint256[2] memory) {
        SideBet storage sideBet = getSideBet(eventCode);

        return sideBet.userTokens[user];
    }

    function userHasDeposited(SideBet storage sideBet, TeamIndex index, address user) private view returns (bool) {
        return sideBet.userTokens[user][uint8(index)] != 0;
    }

    /**
     * @dev Allows a user simultaneously initialize a side bet and start a sale.
     * Owner must approve the required amount of standard tokens before triggering this method, otherwise
     * the method will revert.
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
    ) external {
        require(address(standardToken) != address(0), "SideBetV6: address zero supplied");
        require(
            !StringUtils.matchStrings(teamNameA, "") && !StringUtils.matchStrings(teamNameB, ""),
            "SideBetV6: empty team name provided"
        );

        SideBet storage sideBet = sideBets[eventCode.hashStr()];
        require(
            StringUtils.matchStrings(sideBet.teamNames[0], "") && StringUtils.matchStrings(sideBet.teamNames[1], ""),
            "SideBetV6: side bet is already initialized"
        );

        _setSaleStartEnd(eventCode, saleStart, saleEnd);

        sideBet.eventCode = eventCode;
        sideBet.teamNames = [teamNameA, teamNameB];
        sideBet.standardToken = standardToken;
        sideBet.owner = _msgSender();

        emit SideBetEventInitialized(eventCode, teamNameA, teamNameB, standardToken, saleStart, saleEnd);
    }

    /**
     * @dev Allows owner to cancel the side bet and refund all deposited tokens to participating users
     *
     * @param eventCode of the sale you want to cancel
     */
    function cancelBetAndRefundTokens(string memory eventCode) external onlyOwner sideBetActive(eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);

        for (uint256 teamIndex = 0; teamIndex < 2; teamIndex++) {
            address standardToken = sideBet.standardToken;
            address[] storage stakingUsers = sideBet.eventUsers[teamIndex];

            for (uint256 i = 0; i < stakingUsers.length; i++) {
                address user = stakingUsers[i];
                uint256 userDeposited = sideBet.userTokens[user][teamIndex];

                IERC20(standardToken).transfer(user, userDeposited);
            }
        }

        emit BetCancelledAndTokensRefunded(eventCode);
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

        sideBet.winnerSet = true;
        sideBet.winningIndex = index;

        emit WinningTeamSelected(eventCode, index);
    }

    function calculateTotalRewardAndOwnerCut(
        string memory eventCode
    ) public view returns (uint256 totalReward, uint256 ownerCut) {
        return _calculateTotalRewardAndOwnerCut(getSideBet(eventCode));
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
        string memory eventCode
    )
        public
        view
        winnerIsSet(eventCode)
        sideBetActive(eventCode)
        returns (address[] memory winningUsers, uint256[] memory userRewards, uint256 totalRewardDistributed)
    {
        SideBet storage sideBet = getSideBet(eventCode);

        TeamIndex winningIndex = sideBet.winningIndex;
        winningUsers = sideBet.eventUsers[uint8(winningIndex)];
        userRewards = new uint256[](winningUsers.length);

        uint256 totalWinningTokensDeposited = sideBet.totalTokensDeposited[uint8(winningIndex)];

        if (totalWinningTokensDeposited == 0) return (winningUsers, userRewards, 0);

        for (uint256 i = 0; i < winningUsers.length; i++) {
            uint256 userReward = calculateUserReward(sideBet, winningUsers[i]);

            userRewards[i] = userReward;
            totalRewardDistributed += userReward;
        }
    }

    /**
     * @dev Allows owner to distribute the calculated rewards to all users
     * who've deposited the tokens for the winning team only once after the winner has
     * been selected
     */
    function distributeReward(
        string memory eventCode
    ) external onlyOwner winnerIsSet(eventCode) sideBetActive(eventCode) {
        (address[] memory winningUsers, uint256[] memory userRewards, ) = getWinningUsersAndUserRewards(eventCode);
        SideBet storage sideBet = getSideBet(eventCode);
        address standardToken = sideBet.standardToken;

        for (uint256 i = 0; i < winningUsers.length; i++) {
            address user = winningUsers[i];
            uint256 userReward = userRewards[i];

            IERC20(standardToken).transfer(user, userReward);
        }

        sideBet.rewardDistributed = true;

        (, uint256 ownerCut) = _calculateTotalRewardAndOwnerCut(sideBet);
        IERC20(standardToken).transfer(owner(), ownerCut);
        emit RewardDistributed(eventCode, userRewards, winningUsers);
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
        address standardToken = sideBet.standardToken;
        uint256 allowance = IERC20(standardToken).allowance(sender, address(this));

        require(amount > 0, "SideBetV6: must deposit at least 1 token");
        require(allowance >= amount, "SideBetV6: insufficient allowance for transfer");

        if (
            !userHasDeposited(sideBet, TeamIndex.First, sender) && !userHasDeposited(sideBet, TeamIndex.Second, sender)
        ) {
            userSideBets[sender].push(eventCode.hashStr());
        }

        if (!userHasDeposited(sideBet, index, sender)) sideBet.eventUsers[uintIndex].push(sender);

        sideBet.totalTokensDeposited[uintIndex] += amount;
        sideBet.userTokens[sender][uintIndex] += amount;

        if (!userHasInteracted[sender]) {
            userHasInteracted[sender] = true;
            uniqueWallets.push(sender);
            emit NewUniqueWallet(sender);
        }

        // Update the total token spent for the specific token
        totalTokenSpent[address(sideBet.standardToken)] += amount;

        IERC20(standardToken).transferFrom(sender, address(this), amount);
        emit Deposited(eventCode, amount, index, sender, address(sideBet.standardToken));
    }

    function getUserSideBets(address user) external view returns (bytes32[] memory) {
        return userSideBets[user];
    }

    function getUserSideBetData(address user, uint256 maxSideBets) external view returns (UserSideBetData[] memory) {
        bytes32[] memory userSideBetHashes = userSideBets[user];
        uint256 resultLength = maxSideBets < userSideBetHashes.length ? maxSideBets : userSideBetHashes.length;
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

    // Function to return the total number of unique wallets
    function getUniqueWalletCount() external view returns (uint256) {
        return uniqueWallets.length;
    }

    // Function to return all unique wallet addresses that interacted
    function getAllUniqueWallets() external view returns (address[] memory) {
        return uniqueWallets;
    }

    // Function to return the total token spent for a specific token
    function getTotalTokenSpent(address tokenAddress) external view returns (uint256) {
        return totalTokenSpent[tokenAddress];
    }
}
