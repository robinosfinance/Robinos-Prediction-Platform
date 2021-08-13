// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DBToken.sol";
import "./Context.sol";
import "./StandardToken.sol";

contract DBTokenSale is Ownable {
    address private _owner;
    address private _withrawable;

    StandardToken private _standardToken;
    mapping(bytes32 => DBToken) private _dbtokens;

    uint256 private _saleStart;
    uint256 private _saleEnd;

    struct TokensSold {
        bytes32 tokenHash;
        uint256 amountSold;
    }
    TokensSold[] _currentSale;

    struct TokenSoldReference {
        bool status;
        uint256 arrayIndex;
    }
    mapping(bytes32 => TokenSoldReference) private _saleArrayMapping;

    /**
     * @param standardToken_ Standard token is the USDT contract from which the sale contract will allow income of funds from. The contract should extend the StandardToken interface
     * @param withrawable Address where the funds can be withdrawn to
     */
    constructor(StandardToken standardToken_, address withrawable) Ownable() {
        _standardToken = standardToken_;
        _withrawable = withrawable;
    }

    modifier duringSale() {
        require(
            (time() >= _saleStart) && (time() < _saleEnd),
            "DBTokenSale: function can only be called during sale"
        );
        _;
    }

    modifier outsideOfSale() {
        require(
            (time() < _saleStart) || (time() >= _saleEnd),
            "DBTokenSale: function can only be called outside of sale"
        );
        _;
    }

    /**
     * @dev This function adds DBToken references to the _dbtokens mapping. The function expects event code and team name to be supplied.
     * This is only added for additional security to check if the owner is adding the correct address.
     * @param _token Address of the DBToken you are adding
     * @param _eventCode Event code of the DBToken reference. Has to match the event code the token has been initialized with.
     * @param _teamName Same as event code. Has to match the team name the token has been initialized with
     * @param initialAmount Amount of tokens which is initially minted to contract address
     */
    function addDBTokenReference(
        DBToken _token,
        string memory _eventCode,
        string memory _teamName,
        uint256 initialAmount
    ) public onlyOwner returns (bool) {
        bytes32 tokenEventCode = keccak256(bytes(_token.eventCode()));
        bytes32 tokenTeamName = keccak256(bytes(_token.teamName()));
        bytes32 givenEventCode = keccak256(bytes(_eventCode));
        bytes32 givenTeamName = keccak256(bytes(_teamName));

        require(
            tokenEventCode == givenEventCode,
            "DBTokenSale: given event code doesn't match reference event code"
        );
        require(
            tokenTeamName == givenTeamName,
            "DBTokenSale: given team name doesn't match reference team name"
        );

        bytes32 tokenHash = getTokenHash(_eventCode, _teamName);

        _dbtokens[tokenHash] = _token;

        _dbtokens[tokenHash]._mint(address(this), initialAmount);
        return true;
    }

    // Return current timestamp
    function time() private view returns (uint256) {
        return block.timestamp;
    }

    /**
     * @dev Function to set the start and end time of the next sale.
     * Can only be called if there is currently no active sale and needs to be called by the owner of the contract.
     * @param start Unix time stamp of the start of sale. Needs to be a timestamp in the future. If the start is 0, the sale will start immediately.
     * @param end Unix time stamp of the end of sale. Needs to be a timestamp after the start
     */
    function setSaleStartEnd(uint256 start, uint256 end)
        public
        onlyOwner
        outsideOfSale
        returns (bool)
    {
        if (start != 0) {
            require(start > time(), "DBTokenSale: given past sale start time");
        } else {
            start = time();
        }
        require(
            end > start,
            "DBTokenSale: sale end time needs to be greater than start time"
        );

        _saleStart = start;
        _saleEnd = end;

        return true;
    }

    // Function can be called by the owner during a sale to end it prematurely
    function endSaleNow() public onlyOwner duringSale returns (bool) {
        _saleEnd = time();
        return true;
    }

    /**
     * @dev Public function which provides info if there is currently any active sale and when the sale status will update.
     * There are 3 possible return patterns:
     * 1) Sale isn't active and sale start time is in the future => saleActive: false, saleUpdateTime: _saleStart
     * 2) Sale is active => saleActive: true, saleUpdateTime: _saleEnd
     * 3) Sale isn't active and _saleStart isn't a timestamp in the future => saleActive: false, saleUpdateTime: 0
     */
    function isSaleOn()
        public
        view
        returns (bool saleActive, uint256 saleUpdateTime)
    {
        if (_saleStart > time()) {
            return (false, _saleStart);
        } else if (_saleEnd > time()) {
            return (true, _saleEnd);
        } else {
            return (false, 0);
        }
    }

    /**
     * Get token by event code and team name. Revert on not found
     */
    function getToken(string memory _eventCode, string memory _teamName)
        public
        view
        returns (DBToken)
    {
        bytes32 tokenHash = getTokenHash(_eventCode, _teamName);
        require(
            address(_dbtokens[tokenHash]) != address(0),
            "DBTokenSale: token doesn't exist"
        );
        return _dbtokens[tokenHash];
    }

    /**
     * @dev Public function from which users can buy token from. A requirement for this purchase is that the user has approved
     * at least the given amount of standardToken funds for transfer to contract address. The user has to input the event code
     * and the team name of the token they are looking to purchase and the amount of tokens they are looking to purchase.
     * @param _eventCode Event code of the DBToken
     * @param _teamName Team name of the DBToken
     * @param amount Amount of tokens the user wants to purchase. Has to have pre-approved amount of USDT tokens for transfer.
     */
    function buyTokens(
        string memory _eventCode,
        string memory _teamName,
        uint256 amount
    ) public duringSale returns (bool) {
        DBToken dbtoken = getToken(_eventCode, _teamName);

        require(
            dbtoken.balanceOf(address(this)) >= amount,
            "DBTokenSale: insufficient tokens in contract account"
        );

        uint256 senderAllowance = _standardToken.allowance(
            _msgSender(),
            address(this)
        );
        require(
            senderAllowance >= amount,
            "DBTokenSale: insufficient allowance for standard token transaction"
        );

        uint256 dbtokenAmount = amount * rate();
        _standardToken.transferFrom(_msgSender(), address(this), amount);
        dbtoken.transfer(_msgSender(), dbtokenAmount);

        bytes32 tokenHash = getTokenHash(_eventCode, _teamName);
        recordTokensSold(tokenHash, dbtokenAmount);

        return true;
    }

    function initTokensSold(bytes32 tokenHash, uint256 initialAmount)
        private
        returns (bool)
    {
        require(
            !_saleArrayMapping[tokenHash].status,
            "DBTokenSale: TokenSold reference already initialized"
        );

        uint256 arrayIndex = _currentSale.length;

        _currentSale.push(TokensSold(tokenHash, initialAmount));
        _saleArrayMapping[tokenHash] = TokenSoldReference(true, arrayIndex);

        return true;
    }

    function increaseTokensSold(bytes32 tokenHash, uint256 amount)
        private
        returns (bool)
    {
        require(
            _saleArrayMapping[tokenHash].status,
            "DBTokenSale: TokenSold reference is not initialized"
        );

        _currentSale[_saleArrayMapping[tokenHash].arrayIndex]
            .amountSold += amount;

        return true;
    }

    function recordTokensSold(bytes32 tokenHash, uint256 amount)
        private
        returns (bool)
    {
        if (!_saleArrayMapping[tokenHash].status) {
            initTokensSold(tokenHash, amount);
        } else {
            increaseTokensSold(tokenHash, amount);
        }

        return true;
    }

    function clearTokensSoldReference(bytes32 tokenHash)
        private
        returns (bool)
    {
        require(
            _saleArrayMapping[tokenHash].status,
            "DBTokenSale: TokenSold reference is not initialized"
        );
        _saleArrayMapping[tokenHash] = TokenSoldReference(false, 0);

        return true;
    }

    function mintOnePercentToOwner()
        public
        onlyOwner
        outsideOfSale
        returns (bool)
    {
        bytes32 tokenHash;
        uint256 amountToMint;

        for (uint256 i; i < _currentSale.length; i++) {
            tokenHash = _currentSale[i].tokenHash;
            amountToMint = _currentSale[i].amountSold / 100;

            _dbtokens[tokenHash]._mint(owner(), amountToMint);

            clearTokensSoldReference(tokenHash);
        }

        delete _currentSale;
        return true;
    }

    function tokensSold() public view onlyOwner returns (TokensSold[] memory) {
        return _currentSale;
    }

    function balanceOf(
        string memory _eventCode,
        string memory _teamName,
        address _account
    ) public view returns (uint256) {
        DBToken dbtoken = getToken(_eventCode, _teamName);
        return dbtoken.balanceOf(_account);
    }

    /**
     * @dev Allows the owner of the contract to withdraw the funds from to contract to the address in the variable withdrawable
     * @param amount Amount of tokens standardTokens the owner wants to withdraw. If the amount is more than the current balance, all tokens are withdrawn.
     */
    function withdraw(uint256 amount) public onlyOwner returns (bool) {
        require(
            _withrawable != address(0),
            "DBTokenSale: withdrawable address is zero address"
        );
        uint256 tokenBalance = _standardToken.balanceOf(address(this));
        if (amount > tokenBalance) {
            amount = tokenBalance;
        }

        _standardToken.transfer(_withrawable, amount);
        return true;
    }

    function getTokenHash(string memory _eventCode, string memory _teamName)
        private
        pure
        returns (bytes32)
    {
        return keccak256(bytes(abi.encodePacked(_eventCode, _teamName)));
    }

    // Rate represents how many DBTokens can be purchased with 1 USDT
    function rate() public pure returns (uint256) {
        return 1;
    }
}
