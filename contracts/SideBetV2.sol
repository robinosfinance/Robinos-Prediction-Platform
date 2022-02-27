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
            require(saleIsActive(false, _eventSale[_allSales[i]]), "SaleFactory: unavailable while a sale is active");
        }
        _;
    }

    // Modifier allowing a call only if event by eventCode is currently active
    modifier duringSale(string memory eventCode) {
        Sale storage eventSale = getEventSale(eventCode);
        require(saleIsActive(true, eventSale), "SaleFactory: function can only be called during sale");
        _;
        clearExpiredSales();
    }

    // Modifier allowing a call only if event by eventCode is currently inactive
    modifier outsideOfSale(string memory eventCode) {
        // We are fetching the event directly through a hash, since getEventSale reverts if sale is not initialized
        Sale storage eventSale = _eventSale[hashStr(eventCode)];
        require(saleIsActive(false, eventSale), "SaleFactory: function can only be called outside of sale");

        _;
    }

    /**
     * @dev Function returns true if our expectations on status of sale is correct
     * @param expectActive If we expect the sale to be active set to true
     * @param sale Sale that is being inspected
     */
    function saleIsActive(bool expectActive, Sale memory sale) private view returns (bool) {
        if (expectActive) {
            return (time() >= sale.saleStart) && (time() < sale.saleEnd);
        } else {
            return (time() < sale.saleStart) || (time() >= sale.saleEnd);
        }
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
     * Can only be called if there is currently no active sale and needs to be called by the owner of the contract.
     * @param start Unix time stamp of the start of sale. Needs to be a timestamp in the future. If the start is 0, the sale will start immediately.
     * @param end Unix time stamp of the end of sale. Needs to be a timestamp after the start
     */
    function setSaleStartEnd(
        string memory eventCode,
        uint256 start,
        uint256 end
    ) public onlyOwner outsideOfSale(eventCode) returns (bool) {
        bool initialized;
        bytes32 saleHash = hashStr(eventCode);
        Sale storage eventSale = _eventSale[saleHash];
        if (eventSale.saleStart == 0 && eventSale.saleEnd == 0) {
            initialized = false;
        }

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

contract SideBetV2 is SaleFactory {

    StandardToken standardToken;

    struct SideDepositData {
        uint256 totalDeposit;
        mapping(address => uint256) userDeposit;
        address[] usersDeposited;
    }

    string sideA;
    string sideB;

    mapping(bytes32 => SideDepositData) private sideADepositData;
    mapping(bytes32 => SideDepositData) private sideBDepositData;
    mapping(bytes32 => uint256) private totalDeposited;

    struct UserHasDeposited {
        bool sideA;
        bool sideB;
    }

    enum Side {
        A,
        B
    }

    struct EventResult {
        bool eventFinished;
        Side winningSide;
        mapping(address => bool) userWithdrawn;
    }

    mapping(bytes32 => mapping(address => UserHasDeposited)) private userHasDeposited;
    mapping(bytes32 => EventResult) private eventResults;

    constructor(
        StandardToken _standardToken,
        string memory _sideA,
        string memory _sideB
    ) {
        standardToken = _standardToken;
        sideA = _sideA;
        sideB = _sideB;
    }

    modifier eventNotFinished(string memory eventCode) {
        require(!eventResults[hashStr(eventCode)].eventFinished, "SideBetV2: event is already finished");
        _;
    }

    modifier eventFinished(string memory eventCode) {
        require(eventResults[hashStr(eventCode)].eventFinished, "SideBetV2: event is not finished");
        _;
    }

    modifier userNotWithdrawn(string memory eventCode, address user) {
        require(!hasUserWithdrawn(eventCode, user), "SideBetV2: user has already withdrawn in this event");
        _;
    }

    function getUserDeposited(string memory eventCode, address user) private view returns (UserHasDeposited storage) {
        return userHasDeposited[hashStr(eventCode)][user];
    }

    function hasUserDeposited(
        string memory eventCode,
        Side side,
        address user
    ) private view returns (bool) {
        UserHasDeposited storage _userHasDeposited = getUserDeposited(eventCode, user);
        return side == Side.A ? _userHasDeposited.sideA : _userHasDeposited.sideB;
    }

    function hasUserWithdrawn(string memory eventCode, address user) private view returns (bool) {
        return eventResults[hashStr(eventCode)].userWithdrawn[user];
    }

    function setUserDeposited(
        string memory eventCode,
        Side side,
        address user
    ) private {
        UserHasDeposited storage _userHasDeposited = getUserDeposited(eventCode, user);
        string memory errorMessage = "SideBetV2: user has already deposited to this side";
        if (side == Side.A) {
            require(!_userHasDeposited.sideA, errorMessage);
            _userHasDeposited.sideA = true;
        } else {
            require(!_userHasDeposited.sideB, errorMessage);
            _userHasDeposited.sideB = true;
        }
    }

    function setUserWithdrawn(string memory eventCode, address user) private {
        eventResults[hashStr(eventCode)].userWithdrawn[user] = true;
    }

    function calculateSideReward(
        string memory eventCode,
        address user,
        Side side
    ) private view returns (uint256) {
        SideDepositData storage sideDepositData = getSideDepositData(eventCode, side);
        uint256 _totalDeposit = totalDeposited[hashStr(eventCode)];
        // If no user has deposited for the winning side, the reward is always 0
        if (sideDepositData.totalDeposit == 0) return 0;
        return (sideDepositData.userDeposit[user] * _totalDeposit) / sideDepositData.totalDeposit;
    }

    function calculateUserReward(string memory eventCode, address user) private view returns (uint256) {
        EventResult storage _eventResults = eventResults[hashStr(eventCode)];
        Side winningSide = _eventResults.winningSide;
        return calculateSideReward(eventCode, user, winningSide);
    }

    function getSideDepositData(string memory eventCode, Side side) private view returns (SideDepositData storage) {
        return side == Side.A ? sideADepositData[hashStr(eventCode)] : sideBDepositData[hashStr(eventCode)];
    }

    function recordDeposit(
        string memory eventCode,
        address user,
        Side side,
        uint256 amount
    ) private {
        SideDepositData storage sideDepositData = getSideDepositData(eventCode, side);

        if (!hasUserDeposited(eventCode, side, user)) {
            sideDepositData.usersDeposited.push(user);
            setUserDeposited(eventCode, side, user);
        }

        sideDepositData.totalDeposit += amount;
        sideDepositData.userDeposit[user] += amount;
        totalDeposited[hashStr(eventCode)] += amount;
    }

    /**
     * Allows users to check how much has been deposited towards each side in the event
     * @param eventCode for which you are getting data for
     */
    function getEventDepositData(string memory eventCode) public view returns (uint256, uint256) {
        uint256 sideATotalDeposit = getSideDepositData(eventCode, Side.A).totalDeposit;
        uint256 sideBTotalDeposit = getSideDepositData(eventCode, Side.B).totalDeposit;
        return (sideATotalDeposit, sideBTotalDeposit);
    }

    /**
     * Allows the owner to select the winning side after the sale for this event has ended
     * 
     * @param eventCode of the event you are choosing the winner for
     * @param side A or B which will be set as winner
     */
    function selectWinningSide(string memory eventCode, Side side)
        public
        onlyOwner
        outsideOfSale(eventCode)
        eventNotFinished(eventCode)
    {
        EventResult storage _eventResults = eventResults[hashStr(eventCode)];
        _eventResults.eventFinished = true;
        if (side == Side.A) _eventResults.winningSide = Side.A;
        else _eventResults.winningSide = Side.B;
    }

    /**
     * Allows users to bet on their preffered side (A or B) during a sale. Users which bet on the side
     * which is selected as winner will gain appropriate awards
     * 
     * @param eventCode of the event you are depositing for
     * @param side A or B on which you are betting
     * @param amount of standardToken you want to deposit
     */
    function deposit(
        string memory eventCode,
        Side side,
        uint256 amount
    ) public duringSale(eventCode) {
        uint256 allowance = standardToken.allowance(_msgSender(), address(this));
        require(allowance >= amount, "SideBetV2: insufficient allowance for deposit");

        standardToken.transferFrom(_msgSender(), address(this), amount);
        recordDeposit(eventCode, _msgSender(), side, amount);
    }

    /**
     * Allows users to withdraw any possible rewards after the sale has finished and the 
     * owner has selected the winning side. Only the users which have bet on the winning side
     * will receive rewards proportional to the amount they deposited
     * @param eventCode of the event which you are withdrawing from
     */
    function withdraw(string memory eventCode)
        public
        eventFinished(eventCode)
        userNotWithdrawn(eventCode, _msgSender())
    {
        uint256 reward = calculateUserReward(eventCode, _msgSender());
        if (reward != 0) standardToken.transfer(_msgSender(), reward);
        setUserWithdrawn(eventCode, _msgSender());
    }
}
