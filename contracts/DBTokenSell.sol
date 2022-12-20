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
        return 18;
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

library StringUtils {
    function hashStr(string memory str) internal pure returns (bytes32) {
        return bytes32(keccak256(bytes(str)));
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` decimal representation.
     */
    function toString(uint256 value) internal pure returns (string memory) {
        // Inspired by OraclizeAPI's implementation - MIT licence
        // https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function matchStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function concatStrings(string memory a, string memory b) private pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function concatArrayOfStrings(string[] memory strings) internal pure returns (string memory) {
        string memory finalString = "";
        for (uint256 i = 0; i < strings.length; i++) {
            finalString = concatStrings(finalString, strings[i]);
        }
        return finalString;
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
        Sale storage eventSale = _eventSale[StringUtils.hashStr(eventCode)];
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
        Sale storage eventSale = _eventSale[StringUtils.hashStr(eventCode)];
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
        bytes32 saleHash = StringUtils.hashStr(eventCode);
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

/***********************************************************************
 ***********************************************************************
 ******************         DB TOKEN SELL        ***********************
 ***********************************************************************
 **********************************************************************/

contract DBTokenSell is SaleFactory {
    enum OfferStatus {
        NotInitialized,
        Open,
        Sold,
        Cancelled
    }

    struct DBTokenOffer {
        string offerId;
        OfferStatus status;
        address offeringUser;
        DBToken tokenInstance;
        uint256 tokensOffered;
        uint256 standardTokensRequested;
    }

    mapping(bytes32 => mapping(bytes32 => DBTokenOffer)) private eventTokenOffers;
    mapping(bytes32 => bytes32[]) private allEventOffers;

    StandardToken private stdToken;

    constructor(StandardToken _stdToken) Ownable() {
        stdToken = _stdToken;
    }

    function getOffer(string memory eventCode, string memory offerId) private view returns (DBTokenOffer storage) {
        return eventTokenOffers[StringUtils.hashStr(eventCode)][StringUtils.hashStr(offerId)];
    }

    /**
     * @dev Method allowing any user holding DBTokens to put them up for bidding
     * during the appropriate sale period. The user must first approve the tokens
     * towards this contract. The tokens are immediately transferred to this address
     * as escrow.
     *
     * @param eventCode string code of event in which to add the offer
     * @param token address of the DBToken placed for offer. The event code
     *  on the token must match the given eventCode
     * @param tokensOffered amount of DBTokens being offered. The user offering
     *  must first hold enough tokens in wallet and approve the same amount towards
     *  this contract.
     * @param standardTokensRequested minimum amount of standard tokens requested for trade.
     *  All bids must offer at least this many tokens for trade.
     */
    function addOffer(
        string memory eventCode,
        DBToken token,
        uint256 tokensOffered,
        uint256 standardTokensRequested
    ) public duringSale(eventCode) {
        require(
            StringUtils.matchStrings(eventCode, token.eventCode()),
            "DBTokenSell: token does not belong to this sale"
        );
        require(tokensOffered > 0, "DBTokenSell: must offer at least 1 token");
        require(token.balanceOf(_msgSender()) >= tokensOffered, "DBTokenSell: insufficient token amount");
        require(token.allowance(_msgSender(), address(this)) >= tokensOffered, "DBTokenSell: insufficient allowance");

        string memory offerId = getNextAvailableOfferId(eventCode, token.teamName());
        bytes32 eventHash = StringUtils.hashStr(eventCode);
        bytes32 offerHash = StringUtils.hashStr(offerId);

        eventTokenOffers[eventHash][offerHash] = DBTokenOffer(
            offerId,
            OfferStatus.Open,
            _msgSender(),
            token,
            tokensOffered,
            standardTokensRequested
        );

        allEventOffers[eventHash].push(offerHash);

        token.transferFrom(_msgSender(), address(this), tokensOffered);
    }

    /**
     * @dev Allows any user to place a bid on the given offer. Bidding is only
     * allowed while the offer and sale are both open. The user must bid more
     * than the current highest bid and the minimum standard tokens requested
     * in the offer. If the user has already placed a bid on this offer, then
     * only the difference between this and the user's highest bid are transferred
     * into the contracts address for escrow.
     *
     * @param eventCode to which the offer belongs
     * @param offerId of the offer for which the user is bidding
     */
    function buyOfferedTokens(string memory eventCode, string memory offerId) public duringSale(eventCode) {
        DBTokenOffer storage offer = getOffer(eventCode, offerId);

        require(offer.status == OfferStatus.Open, "DBTokenSell: offer is not open for purchase");
        require(
            stdToken.balanceOf(_msgSender()) >= offer.standardTokensRequested,
            "DBTokenSell: insufficient token amount"
        );
        require(
            stdToken.allowance(_msgSender(), address(this)) >= offer.standardTokensRequested,
            "DBTokenSell: insufficient allowance"
        );

        stdToken.transferFrom(_msgSender(), address(this), offer.standardTokensRequested);
        offer.tokenInstance.transfer(_msgSender(), offer.tokensOffered);
        stdToken.transfer(offer.offeringUser, offer.standardTokensRequested);

        offer.status = OfferStatus.Sold;
    }

    function cancelOffer(string memory eventCode, string memory offerId) public {
        DBTokenOffer storage offer = getOffer(eventCode, offerId);

        require(offer.status == OfferStatus.Open, "DBTokenSell: offer is not open for purchase");
        require(_msgSender() == offer.offeringUser, "DBTokenSell: offer can only be cancelled by the offering user");

        offer.tokenInstance.transfer(offer.offeringUser, offer.tokensOffered);

        offer.status = OfferStatus.Cancelled;
    }

    function createOfferId(
        string memory eventCode,
        string memory teamName,
        uint256 index
    ) private pure returns (string memory) {
        string[] memory hashParams = new string[](5);
        hashParams[0] = eventCode;
        hashParams[1] = "-";
        hashParams[2] = teamName;
        hashParams[3] = "-";
        hashParams[4] = StringUtils.toString(index);

        return StringUtils.concatArrayOfStrings(hashParams);
    }

    /**
     * Returns the next available offer ID. The ID is contructed in the below way
     * {eventCode}-{teamName}-{int id 0...}
     * The int id at the end is incremented for each next offer for the same
     * event and team name.
     */
    function getNextAvailableOfferId(string memory eventCode, string memory teamName)
        private
        view
        returns (string memory)
    {
        uint256 offerIndex = 0;
        bytes32 eventHash = StringUtils.hashStr(eventCode);
        while (true) {
            string memory offerId = createOfferId(eventCode, teamName, offerIndex);
            DBTokenOffer storage offer = eventTokenOffers[eventHash][StringUtils.hashStr(offerId)];
            if (offer.status == OfferStatus.NotInitialized) return offerId;
            offerIndex++;
        }

        return "";
    }

    /**
     * @dev Returns an array of all offers for the given event. Shows all offer data including all
     * current bids placed for the offer.
     */
    function getAllEventOffers(string memory eventCode) public view returns (DBTokenOffer[] memory) {
        bytes32 eventHash = StringUtils.hashStr(eventCode);
        bytes32[] memory offerHashes = allEventOffers[eventHash];
        DBTokenOffer[] memory eventOffers = new DBTokenOffer[](offerHashes.length);

        for (uint256 i = 0; i < offerHashes.length; i++) {
            eventOffers[i] = eventTokenOffers[eventHash][offerHashes[i]];
        }

        return eventOffers;
    }
}
