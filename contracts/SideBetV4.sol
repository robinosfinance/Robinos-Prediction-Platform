// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface StandardToken {
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external;

    function transfer(address _to, uint256 _value) external;

    function approve(address _spender, uint256 _value) external;

    function allowance(address _owner, address _spender) external view returns (uint256);

    function balanceOf(address _owner) external returns (uint256);
}

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _setOwner(_msgSender());
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _setOwner(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _setOwner(newOwner);
    }

    function _setOwner(address newOwner) private {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

abstract contract SaleFactory is Ownable {
    // Each sale has an entry in the eventCode hash table with start and end time.
    // If both saleStart and saleEnd are 0, sale is not initialized
    struct Sale {
        uint256 saleStart;
        uint256 saleEnd;
    }
    mapping(bytes32 => Sale) private _eventSale;
    bytes32[] private _allSales;

    // Modifier allowing a call if and only if there are no active sales at the moment
    modifier noActiveSale() {
        for (uint256 i; i < _allSales.length; i++) {
            require(!saleIsActive(_eventSale[_allSales[i]]), "SaleFactory: unavailable while a sale is active");
        }
        _;
    }

    // Modifier allowing a call only if event by eventCode is currently active
    modifier duringSale(string memory eventCode) {
        Sale storage eventSale = getEventSale(eventCode);
        require(saleIsActive(eventSale), "SaleFactory: function can only be called during sale");
        _;
        clearExpiredSales();
    }

    // Modifier allowing a call only if event by eventCode is currently inactive
    modifier outsideOfSale(string memory eventCode) {
        // We are fetching the event directly through a hash, since getEventSale reverts if sale is not initialized
        Sale storage eventSale = _eventSale[hashStr(eventCode)];
        require(!saleIsActive(eventSale), "SaleFactory: function can only be called outside of sale");

        _;
    }

    function saleIsActive(Sale memory sale) private view returns (bool) {
        return (time() >= sale.saleStart) && (time() < sale.saleEnd);
    }

    // Returns all active or soon-to-be active sales in an array ordered by sale end time
    function getAllSales() public view returns (Sale[] memory) {
        uint256 length = _allSales.length;

        Sale[] memory sales = new Sale[](length);

        for (uint256 i; i < length; i++) {
            sales[i] = _eventSale[_allSales[i]];
        }
        return sales;
    }

    // Clears all sales from the _allSales array who's saleEnd time is in the past
    function clearExpiredSales() private returns (bool) {
        uint256 length = _allSales.length;
        if (length > 0 && _eventSale[_allSales[0]].saleEnd <= time()) {
            uint256 endDelete = 1;

            bytes32[] memory copyAllSales = _allSales;

            uint256 i = 1;
            while (i < length) {
                if (_eventSale[_allSales[i]].saleEnd > time()) {
                    endDelete = i;
                    break;
                }
                i++;
            }

            for (i = 0; i < length; i++) {
                if (i < length - endDelete) {
                    _allSales[i] = copyAllSales[i + endDelete];
                } else {
                    _allSales.pop();
                }
            }
        }
        return true;
    }

    // Return current timestamp
    function time() public view returns (uint256) {
        return block.timestamp;
    }

    function hashStr(string memory str) public pure returns (bytes32) {
        return bytes32(keccak256(bytes(str)));
    }

    /**
     * @dev Function inserts a sale reference in the _allSales array and orders it by saleEnd time
     * in ascending order. This means the first sale in the array will expire first.
     * @param saleHash hash reference to the sale mapping structure
     */
    function insertSale(bytes32 saleHash) private returns (bool) {
        uint256 length = _allSales.length;

        bytes32 unorderedSale = saleHash;
        bytes32 tmpSale;

        for (uint256 i; i <= length; i++) {
            if (i == length) {
                _allSales.push(unorderedSale);
            } else {
                if (_eventSale[_allSales[i]].saleEnd > _eventSale[unorderedSale].saleEnd) {
                    tmpSale = _allSales[i];
                    _allSales[i] = unorderedSale;
                    unorderedSale = tmpSale;
                }
            }
        }
        return true;
    }

    /**
     * @dev Function returns Sale struct with saleEnd and saleStart. Function reverts if event is not initialized
     * @param eventCode string code of event
     */
    function getEventSale(string memory eventCode) private view returns (Sale storage) {
        Sale storage eventSale = _eventSale[hashStr(eventCode)];
        require(eventSale.saleStart > 0 || eventSale.saleEnd > 0, "SaleFactory: sale not initialized");
        return eventSale;
    }

    /**
     * @dev Function to set the start and end time of the next sale.
     * @param start Unix time stamp of the start of sale. Needs to be a timestamp in the future. If the start is 0, the sale will start immediately.
     * @param end Unix time stamp of the end of sale. Needs to be a timestamp after the start
     */
    function setSaleStartEnd(
        string memory eventCode,
        uint256 start,
        uint256 end
    ) public onlyOwner returns (bool) {
        bytes32 saleHash = hashStr(eventCode);
        Sale storage eventSale = _eventSale[saleHash];
        bool initialized = eventSale.saleStart != 0;

        if (start != 0) {
            require(start > time(), "SaleFactory: given past sale start time");
        } else {
            start = time();
        }
        require(end > start, "SaleFactory: sale end time needs to be greater than start time");

        eventSale.saleStart = start;
        eventSale.saleEnd = end;

        if (!initialized) {
            insertSale(saleHash);
        }

        return true;
    }

    // Function can be called by the owner during a sale to end it prematurely
    function endSaleNow(string memory eventCode) public onlyOwner duringSale(eventCode) returns (bool) {
        Sale storage eventSale = getEventSale(eventCode);

        eventSale.saleEnd = time();
        return true;
    }

    /**
     * @dev Public function which provides info if there is currently any active sale and when the sale status will update.
     * Value saleActive represents if sale is active at the current moment.
     * If sale has been initialized, saleStart and saleEnd will return UNIX timestampts
     * If sale has not been initialized, function will revert.
     * @param eventCode string code of event
     */
    function isSaleOn(string memory eventCode)
        public
        view
        returns (
            bool saleActive,
            uint256 saleStart,
            uint256 saleEnd
        )
    {
        Sale storage eventSale = getEventSale(eventCode);

        if (eventSale.saleStart > time()) {
            return (false, eventSale.saleStart, eventSale.saleEnd);
        } else if (eventSale.saleEnd > time()) {
            return (true, eventSale.saleStart, eventSale.saleEnd);
        } else {
            return (false, eventSale.saleStart, eventSale.saleEnd);
        }
    }
}

abstract contract TokenHash is Ownable {
    function getTokenHash(string memory _eventCode, string memory _teamName) internal pure returns (bytes32) {
        return keccak256(bytes(abi.encodePacked(_eventCode, _teamName)));
    }
}

library StringUtils {
    function matchStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}

/***********************************************************************
 ***********************************************************************
 *********************        SIDE BET       ***************************
 ***********************************************************************
 **********************************************************************/

contract SideBetV4 is SaleFactory {
    uint256 constant MAX_OWNER_CUT_PERCENT = 80;

    enum TeamIndex {
        First,
        Second
    }

    struct SideBet {
        string[2] teamNames;
        StandardToken standardToken;
        bool winnerSet;
        TeamIndex winningIndex;
        bool rewardDistributed;
        bool cancelled;
        address[][2] eventUsers;
        mapping(address => uint256[2]) userTokens;
        uint256[2] totalTokensDeposited;
        uint256 ownerCutPercent;
    }

    mapping(bytes32 => SideBet) private sideBets;

    modifier winnerIsSet(string memory eventCode) {
        require(getSideBet(eventCode).winnerSet, "SideBetV4: winning team index not selected");
        _;
    }

    modifier sideBetActive(string memory eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);
        require(!sideBet.rewardDistributed, "SideBetV4: reward is already distributed");
        require(!sideBet.cancelled, "SideBetV4: side bet has been cancelled");
        _;
    }

    function getSideBet(string memory eventCode) private view returns (SideBet storage) {
        SideBet storage sideBet = sideBets[hashStr(eventCode)];
        require(
            !StringUtils.matchStrings(sideBet.teamNames[0], "") && !StringUtils.matchStrings(sideBet.teamNames[1], ""),
            "SideBetV4: side bet is not initialized"
        );
        return sideBet;
    }

    /**
     * @dev Returns all data for the selected side bet. Method will revert if the side bet has not been initialized.
     * Indices of {uint256[][2]} userTokens correspond to indices in {address[][2]} eventUsers
     */
    function getSideBetData(string memory eventCode)
        public
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
            uint256[2] memory totalTokensDeposited
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

        userTokens = [new uint256[](eventUsers[0].length), new uint256[](eventUsers[1].length)];

        for (uint256 teamIndex = 0; teamIndex < 2; teamIndex++) {
            for (uint256 i = 0; i < eventUsers[teamIndex].length; i++) {
                address user = eventUsers[teamIndex][i];
                userTokens[teamIndex][i] = sideBet.userTokens[user][teamIndex];
            }
        }
    }

    function userHasDeposited(
        SideBet storage sideBet,
        TeamIndex index,
        address user
    ) private view returns (bool) {
        return sideBet.userTokens[user][uint8(index)] != 0;
    }

    /**
     * @dev Allows owner to simultaneously initialize a side bet and start a sale.
     * Owner must approve the required amount of standard tokens before triggering this method, otherwise
     * the method will revert.
     *
     * @param eventCode of the side bet to be initialized
     * @param teamNameA first team name
     * @param teamNameB second team name
     * @param standardToken contract instance used as a reward token
     * @param ownerCutPercent percent points of the total deposited amount to be
     *  transferred to owner upon distributing reward. Can be 0
     * @param saleStart unix time for sale start. Same as in setSaleStartEnd
     * @param saleEnd unix time for sale end
     */
    function initializeSideBet(
        string memory eventCode,
        string memory teamNameA,
        string memory teamNameB,
        StandardToken standardToken,
        uint256 ownerCutPercent,
        uint256 saleStart,
        uint256 saleEnd
    ) public onlyOwner {
        require(address(standardToken) != address(0), "SideBetV4: address zero supplied");
        require(ownerCutPercent <= MAX_OWNER_CUT_PERCENT, "SideBetV4: owner cut percentage too high");
        require(
            !StringUtils.matchStrings(teamNameA, "") && !StringUtils.matchStrings(teamNameB, ""),
            "SideBetV4: empty team name provided"
        );

        SideBet storage sideBet = sideBets[hashStr(eventCode)];
        require(
            StringUtils.matchStrings(sideBet.teamNames[0], "") && StringUtils.matchStrings(sideBet.teamNames[1], ""),
            "SideBetV4: side bet is already initialized"
        );

        setSaleStartEnd(eventCode, saleStart, saleEnd);

        sideBet.teamNames = [teamNameA, teamNameB];
        sideBet.standardToken = standardToken;
        sideBet.ownerCutPercent = ownerCutPercent;
    }

    /**
     * @dev Allows owner to cancel the side bet and refund all deposited tokens to participating users
     *
     * @param eventCode of the sale you want to cancel
     */
    function cancelBetAndRefundTokens(string memory eventCode) public onlyOwner sideBetActive(eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);

        for (uint256 teamIndex = 0; teamIndex < 2; teamIndex++) {
            StandardToken standardToken = sideBet.standardToken;
            address[] storage stakingUsers = sideBet.eventUsers[teamIndex];

            for (uint256 i = 0; i < stakingUsers.length; i++) {
                address user = stakingUsers[i];
                uint256 userDeposited = sideBet.userTokens[user][teamIndex];

                standardToken.transfer(user, userDeposited);
            }
        }

        sideBet.cancelled = true;
    }

    /**
     * @dev Allows owner to select a winning team only after the sale ends
     *
     * @param eventCode of the sale you finalize
     * @param index of the team proclaimed as a winner
     */
    function selectWinningTeam(string memory eventCode, TeamIndex index)
        public
        onlyOwner
        outsideOfSale(eventCode)
        sideBetActive(eventCode)
    {
        SideBet storage sideBet = getSideBet(eventCode);

        sideBet.winnerSet = true;
        sideBet.winningIndex = index;
    }

    function calculateTotalRewardAndOwnerCut(SideBet storage sideBet)
        private
        view
        returns (uint256 totalReward, uint256 ownerCut)
    {
        uint256 totalDeposited = sideBet.totalTokensDeposited[0] + sideBet.totalTokensDeposited[1];
        ownerCut = (totalDeposited * sideBet.ownerCutPercent) / 100;
        totalReward = totalDeposited - ownerCut;
    }

    function calculateTotalRewardAndOwnerCut(string memory eventCode)
        public
        view
        returns (uint256 totalReward, uint256 ownerCut)
    {
        return calculateTotalRewardAndOwnerCut(getSideBet(eventCode));
    }

    /**
     * @dev If the winner has been selected by the owner, allows anyone to see the
     * users who've deposited the tokens towards the winning team and their corresponding rewards
     */
    function getWinningUsersAndUserRewards(string memory eventCode)
        public
        view
        winnerIsSet(eventCode)
        sideBetActive(eventCode)
        returns (address[] memory winningUsers, uint256[] memory userRewards)
    {
        SideBet storage sideBet = getSideBet(eventCode);

        TeamIndex winningIndex = sideBet.winningIndex;
        winningUsers = sideBet.eventUsers[uint8(winningIndex)];
        userRewards = new uint256[](winningUsers.length);

        (uint256 totalReward, ) = calculateTotalRewardAndOwnerCut(sideBet);
        uint256 totalWinningTokensDeposited = sideBet.totalTokensDeposited[uint8(winningIndex)];

        if (totalWinningTokensDeposited == 0) return (winningUsers, userRewards);

        uint256 totalRewardDistributed = 0;

        for (uint256 i = 0; i < winningUsers.length; i++) {
            uint256 userDeposited = sideBet.userTokens[winningUsers[i]][uint8(winningIndex)];
            uint256 userReward = (userDeposited * totalReward) / totalWinningTokensDeposited;

            userRewards[i] = userReward;
            totalRewardDistributed += userReward;
        }

        uint256 userIndex = 0;
        for (uint256 i = 0; i < totalReward - totalRewardDistributed; i++) {
            userRewards[userIndex] += 1;
            userIndex = userIndex == userRewards.length - 1 ? 0 : userIndex + 1;
        }
    }

    /**
     * @dev Allows owner to distribute the calculated rewards to all users
     * who've deposited the tokens for the winning team only once after the winner has
     * been selected
     */
    function distributeReward(string memory eventCode)
        public
        onlyOwner
        winnerIsSet(eventCode)
        sideBetActive(eventCode)
    {
        (address[] memory winningUsers, uint256[] memory userRewards) = getWinningUsersAndUserRewards(eventCode);
        SideBet storage sideBet = getSideBet(eventCode);
        StandardToken standardToken = sideBet.standardToken;

        for (uint256 i = 0; i < winningUsers.length; i++) {
            address user = winningUsers[i];
            uint256 userReward = userRewards[i];

            standardToken.transfer(user, userReward);
        }

        sideBet.rewardDistributed = true;

        (, uint256 ownerCut) = calculateTotalRewardAndOwnerCut(sideBet);
        standardToken.transfer(owner(), ownerCut);
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
    ) public duringSale(eventCode) sideBetActive(eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);
        StandardToken standardToken = sideBet.standardToken;
        uint256 allowance = standardToken.allowance(_msgSender(), address(this));
        require(amount > 0, "SideBetV4: must deposit at least 1 token");
        require(allowance >= amount, "SideBetV4: insufficient allowance for transfer");

        if (!userHasDeposited(sideBet, index, _msgSender())) sideBet.eventUsers[uint8(index)].push(_msgSender());

        sideBet.totalTokensDeposited[uint8(index)] += amount;
        sideBet.userTokens[_msgSender()][uint8(index)] += amount;

        standardToken.transferFrom(_msgSender(), address(this), amount);
    }
}
