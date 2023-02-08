// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @dev Interface for the optional metadata functions from the ERC20 standard.
 *
 * _Available since v4.1._
 */
interface IERC20Metadata is IERC20 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
}

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

abstract contract Pausable {
    bool private _paused = false;

    modifier whileNotPaused() {
        require(!_paused, "Pausable: contract must be paused");
        _;
    }

    modifier whilePaused() {
        require(_paused, "Pausable: contract must not be paused");
        _;
    }

    function pause() public virtual whileNotPaused returns (bool) {
        _paused = true;
        return _paused;
    }

    function unPause() public virtual whileNotPaused returns (bool) {
        _paused = true;
        return _paused;
    }

    function isPaused() public view returns (bool) {
        return _paused;
    }
}

contract DBToken is IERC20, IERC20Metadata, Ownable {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;
    string private _eventCode;
    string private _teamName;

    /**
     * @dev Next to the regular name and symbol params, constructor takes an event code and team name
     * @param name_ Name of the token. Generally "DBToken"
     * @param symbol_ Symbol of the token. Generally "DBT"
     * @param eventCode_ Event code of the token. Later could be used in the DBTokenSale contract to end the tokens under given event
     * @param teamName_ Name of the team the token is representing
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory eventCode_,
        string memory teamName_
    ) Ownable() {
        _name = name_;
        _symbol = symbol_;
        _eventCode = eventCode_;
        _teamName = teamName_;
        _totalSupply = 0;
    }

    function name() external view override returns (string memory) {
        return _name;
    }

    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    function eventCode() external view returns (string memory) {
        return _eventCode;
    }

    function teamName() external view returns (string memory) {
        return _teamName;
    }

    function decimals() external pure override returns (uint8) {
        return 6;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external override returns (bool) {
        require(_allowances[sender][_msgSender()] >= amount, "DBToken: transfer amount exceeds allowance");
        _transfer(sender, recipient, amount);

        unchecked {
            _approve(sender, _msgSender(), _allowances[sender][_msgSender()] - amount);
        }

        return true;
    }

    function _mint(address account, uint256 amount) external onlyOwner returns (bool) {
        require(account != address(0), "DBToken: mint to the zero address");

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
        return true;
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) private {
        require(sender != address(0), "DBToken: transfer from the zero address");
        require(recipient != address(0), "DBToken: transfer to the zero address");

        uint256 senderBalance = _balances[sender];
        require(senderBalance >= amount, "DBToken: transfer amount exceeds balance");

        unchecked {
            _balances[sender] = senderBalance - amount;
        }
        _balances[recipient] += amount;

        emit Transfer(sender, recipient, amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) private {
        require(owner != address(0), "DBToken: approve from the zero address");
        require(spender != address(0), "DBToken: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
}

struct ArrayElRef {
    bool status;
    uint256 arrayIndex;
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

/***********************************************************************
 ***********************************************************************
 *****************        DB TOKEN SIDE BET       **********************
 ***********************************************************************
 **********************************************************************/

contract DBTokenSideBetV2 is SaleFactory {
    enum TeamTokenIndex {
        First,
        Second
    }

    struct SideBet {
        DBToken[2] teamTokens;
        StandardToken standardToken;
        uint256 totalEventReward;
        bool winnerSet;
        TeamTokenIndex winningIndex;
        bool rewardDistributed;
        bool cancelled;
        address[][2] eventStakingUsers;
        mapping(address => uint256[2]) userStakedTokens;
        mapping(address => bool[2]) userUnstaked;
        uint256[2] totalTokensStaked;
    }

    mapping(bytes32 => SideBet) private sideBets;

    modifier winnerIsSet(string memory eventCode) {
        require(getSideBet(eventCode).winnerSet, "DBTokenSideBetV2: winning team index not selected");
        _;
    }

    modifier sideBetActive(string memory eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);
        require(!sideBet.rewardDistributed, "DBTokenSideBetV2: reward is already distributed");
        require(!sideBet.cancelled, "DBTokenSideBetV2: side bet has been cancelled");
        _;
    }

    function getSideBet(string memory eventCode) private view returns (SideBet storage) {
        SideBet storage sideBet = sideBets[hashStr(eventCode)];
        require(
            address(sideBet.teamTokens[0]) != address(0) && address(sideBet.teamTokens[1]) != address(0),
            "DBTokenSideBetV2: side bet is not initialized"
        );
        return sideBet;
    }

    /**
     * @dev Returns all data for the selected side bet. Method will revert if the side bet has not been initialized.
     * Indices of {uint256[][2]} userStakedTokens and {bool[][2]} usersUnstaked correspond to indices in
     * {address[][2]} eventStakingUsers. Meaning that userStakedTokens[0][3] corresponds to user eventStakingUsers[0][3]
     * as does usersUnstaked[0][3].
     */
    function getSideBetData(string memory eventCode)
        public
        view
        returns (
            address[2] memory teamTokenAddresses,
            address standardTokenAddress,
            uint256 totalEventReward,
            bool winnerSet,
            TeamTokenIndex winningIndex,
            bool rewardDistributed,
            bool cancelled,
            address[][2] memory eventStakingUsers,
            uint256[][2] memory userStakedTokens,
            bool[][2] memory usersUnstaked,
            uint256[2] memory totalTokensStaked
        )
    {
        SideBet storage sideBet = getSideBet(eventCode);

        teamTokenAddresses = [address(sideBet.teamTokens[0]), address(sideBet.teamTokens[1])];
        standardTokenAddress = address(sideBet.standardToken);
        totalEventReward = sideBet.totalEventReward;
        winnerSet = sideBet.winnerSet;
        winningIndex = sideBet.winningIndex;
        rewardDistributed = sideBet.rewardDistributed;
        cancelled = sideBet.cancelled;
        eventStakingUsers = sideBet.eventStakingUsers;
        totalTokensStaked = sideBet.totalTokensStaked;

        userStakedTokens = [new uint256[](eventStakingUsers[0].length), new uint256[](eventStakingUsers[1].length)];
        usersUnstaked = [new bool[](eventStakingUsers[0].length), new bool[](eventStakingUsers[1].length)];

        for (uint256 teamIndex = 0; teamIndex < 2; teamIndex++) {
            for (uint256 i = 0; i < eventStakingUsers[teamIndex].length; i++) {
                address user = eventStakingUsers[teamIndex][i];
                userStakedTokens[teamIndex][i] = sideBet.userStakedTokens[user][teamIndex];
                usersUnstaked[teamIndex][i] = sideBet.userUnstaked[user][teamIndex];
            }
        }
    }

    function getUserTokensStaked(string memory eventCode, address user) public view returns (uint256[2] memory) {
        SideBet storage sideBet = getSideBet(eventCode);

        return sideBet.userStakedTokens[user];
    }

    function userHasStaked(
        SideBet storage sideBet,
        TeamTokenIndex index,
        address user
    ) private view returns (bool) {
        return sideBet.userStakedTokens[user][uint8(index)] != 0;
    }

    /**
     * @dev Allows owner to simultaneously initialize a side bet, start a sale and deposit the bet reward.
     * Owner must approve the required amount of standard tokens before triggering this method, otherwise
     * the method will revert.
     *
     * @param eventCode of the side bet to be initialized
     * @param teamTokenA first DBToken instance
     * @param teamTokenB second DBToken instance
     * @param standardToken contract instance used as a reward token
     * @param totalEventReward total amount to be deposited to this contract as side bet reward
     * @param saleStart unix time for sale start. Same as in setSaleStartEnd
     * @param saleEnd unix time for sale end
     */
    function initializeSideBetAndDepositReward(
        string memory eventCode,
        DBToken teamTokenA,
        DBToken teamTokenB,
        StandardToken standardToken,
        uint256 totalEventReward,
        uint256 saleStart,
        uint256 saleEnd
    ) public onlyOwner {
        require(
            address(teamTokenA) != address(0) &&
                address(teamTokenB) != address(0) &&
                address(standardToken) != address(0),
            "DBTokenSideBetV2: address zero supplied"
        );
        require(totalEventReward != 0, "DBTokenSideBetV2: event reward must be greater than zero");

        SideBet storage sideBet = sideBets[hashStr(eventCode)];
        require(
            address(sideBet.teamTokens[0]) == address(0) && address(sideBet.teamTokens[1]) == address(0),
            "DBTokenSideBetV2: side bet is already initialized"
        );

        uint256 allowance = standardToken.allowance(_msgSender(), address(this));
        require(allowance >= totalEventReward, "DBTokenSideBetV2: insufficient allowance for transfer");
        standardToken.transferFrom(_msgSender(), address(this), totalEventReward);

        setSaleStartEnd(eventCode, saleStart, saleEnd);

        sideBet.teamTokens = [teamTokenA, teamTokenB];
        sideBet.standardToken = standardToken;
        sideBet.totalEventReward = totalEventReward;
    }

    function returnAllStakedTokens(string memory eventCode) private {
        SideBet storage sideBet = getSideBet(eventCode);

        for (uint256 teamTokenIndex = 0; teamTokenIndex < 2; teamTokenIndex++) {
            DBToken teamToken = sideBet.teamTokens[teamTokenIndex];
            address[] storage stakingUsers = sideBet.eventStakingUsers[teamTokenIndex];

            for (uint256 i = 0; i < stakingUsers.length; i++) {
                address user = stakingUsers[i];
                uint256 userStaked = sideBet.userStakedTokens[user][teamTokenIndex];

                teamToken.transfer(user, userStaked);
            }
        }
    }

    function returnRewardToOwner(string memory eventCode) private {
        SideBet storage sideBet = getSideBet(eventCode);
        StandardToken stToken = sideBet.standardToken;
        uint256 totalReward = sideBet.totalEventReward;

        stToken.transfer(owner(), totalReward);
    }

    function setSideBetCancelled(string memory eventCode) private {
        SideBet storage sideBet = getSideBet(eventCode);

        sideBet.cancelled = true;
    }

    /**
     * @dev Allows owner to cancel the side bet, refund all staked tokens to participating
     * users and refund the deposited standard tokens
     *
     * @param eventCode of the sale you want to cancel
     */
    function cancelBetAndRefundTokens(string memory eventCode) public onlyOwner sideBetActive(eventCode) {
        setSideBetCancelled(eventCode);
        returnAllStakedTokens(eventCode);
        returnRewardToOwner(eventCode);
    }

    /**
     * @dev Allows owner to select a winning team only after the sale ends
     *
     * @param eventCode of the sale you finalize
     * @param index index of the DBToken proclaimed as a winner
     */
    function selectWinningTeam(string memory eventCode, TeamTokenIndex index)
        public
        onlyOwner
        outsideOfSale(eventCode)
        sideBetActive(eventCode)
    {
        SideBet storage sideBet = getSideBet(eventCode);

        sideBet.winnerSet = true;
        sideBet.winningIndex = index;
    }

    /**
     * @dev If the winner has been selected by the owner, allows anyone to see the
     * users who've staked the winning team tokens and their corresponding rewards
     */
    function getWinningUsersAndUserRewards(string memory eventCode)
        public
        view
        winnerIsSet(eventCode)
        sideBetActive(eventCode)
        returns (address[] memory winningUsers, uint256[] memory userRewards)
    {
        SideBet storage sideBet = getSideBet(eventCode);

        TeamTokenIndex winningIndex = sideBet.winningIndex;
        winningUsers = sideBet.eventStakingUsers[uint8(winningIndex)];
        userRewards = new uint256[](winningUsers.length);
        uint256 totalEventReward = sideBet.totalEventReward;
        uint256 totalWinningTokensStaked = sideBet.totalTokensStaked[uint8(winningIndex)];

        uint256 totalRewardDistributed = 0;

        for (uint256 i = 0; i < winningUsers.length; i++) {
            uint256 userStaked = sideBet.userStakedTokens[winningUsers[i]][uint8(winningIndex)];
            uint256 userReward = (userStaked * totalEventReward) / totalWinningTokensStaked;

            userRewards[i] = userReward;
            totalRewardDistributed += userReward;
        }

        uint256 userIndex = 0;
        for (uint256 i = 0; i < totalEventReward - totalRewardDistributed; i++) {
            userRewards[userIndex] += 1;
            userIndex = userIndex == userRewards.length - 1 ? 0 : userIndex + 1;
        }
    }

    /**
     * @dev Allows owner to distribute the calculated rewards to all users
     * who've staked the winning team tokens only once after the winner has
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
        StandardToken stToken = sideBet.standardToken;

        for (uint256 i = 0; i < winningUsers.length; i++) {
            address user = winningUsers[i];
            uint256 userReward = userRewards[i];

            stToken.transfer(user, userReward);
        }

        sideBet.rewardDistributed = true;
    }

    /**
     * Allows users to stake during a sale from one of the 2 given teamTokens
     * @param eventCode of the sale you want to stake for
     * @param index of the DBToken you are staking
     * @param amount of DBTokens you want to stake
     */
    function stake(
        string memory eventCode,
        TeamTokenIndex index,
        uint256 amount
    ) public duringSale(eventCode) sideBetActive(eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);
        DBToken teamToken = sideBet.teamTokens[uint8(index)];
        uint256 allowance = teamToken.allowance(_msgSender(), address(this));
        require(allowance >= amount, "DBTokenSideBetV2: insufficient allowance for transfer");

        if (!userHasStaked(sideBet, index, _msgSender())) sideBet.eventStakingUsers[uint8(index)].push(_msgSender());

        sideBet.totalTokensStaked[uint8(index)] += amount;
        sideBet.userStakedTokens[_msgSender()][uint8(index)] += amount;

        teamToken.transferFrom(_msgSender(), address(this), amount);
    }

    /**
     * Allows users unstake their DBTokens only the winner has been selected.
     *
     * @param eventCode of the sale you want to unstake from
     * @param index of the DBToken you want to unstake
     */
    function unstake(string memory eventCode, TeamTokenIndex index) public winnerIsSet(eventCode) {
        SideBet storage sideBet = getSideBet(eventCode);
        DBToken teamToken = sideBet.teamTokens[uint8(index)];
        uint256 userStakedTokens = sideBet.userStakedTokens[_msgSender()][uint8(index)];
        require(
            !sideBet.userUnstaked[_msgSender()][uint8(index)],
            "DBTokenSideBetV2: user has already unstaked selected tokens"
        );

        teamToken.transfer(_msgSender(), userStakedTokens);
        sideBet.userUnstaked[_msgSender()][uint8(index)] = true;
    }
}
