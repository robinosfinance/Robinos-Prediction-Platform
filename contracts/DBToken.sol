// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./Context.sol";

contract DBToken is IERC20, IERC20Metadata, Ownable {
    address public _owner;

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
     * @param totalSupply_ Initialy total supply of the tokens
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory eventCode_,
        string memory teamName_,
        uint256 totalSupply_
    ) Ownable() {
        _name = name_;
        _symbol = symbol_;
        _eventCode = eventCode_;
        _teamName = teamName_;
        _totalSupply = totalSupply_;
        _balances[_owner] = totalSupply_;
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

    function balanceOf(address account)
        external
        view
        override
        returns (uint256)
    {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount)
        external
        override
        returns (bool)
    {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function allowance(address owner, address spender)
        external
        view
        override
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount)
        external
        override
        returns (bool)
    {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external override returns (bool) {
        require(
            _allowances[sender][_msgSender()] >= amount,
            "DBToken: transfer amount exceeds allowance"
        );
        _transfer(sender, recipient, amount);

        unchecked {
            _approve(
                sender,
                _msgSender(),
                _allowances[sender][_msgSender()] - amount
            );
        }

        return true;
    }

    function _mint(address account, uint256 amount)
        external
        onlyOwner
        returns (bool)
    {
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
        require(
            sender != address(0),
            "DBToken: transfer from the zero address"
        );
        require(
            recipient != address(0),
            "DBToken: transfer to the zero address"
        );

        uint256 senderBalance = _balances[sender];
        require(
            senderBalance >= amount,
            "DBToken: transfer amount exceeds balance"
        );

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
