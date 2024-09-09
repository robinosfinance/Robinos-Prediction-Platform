// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ERC20} from "./ERC20.sol";
import {Ownable} from "./openzeppelin/Ownable.sol";

contract BlacklistTestToken is ERC20, Ownable {
    mapping(address => bool) private _blacklist;

    constructor(uint256 _totalSupply) ERC20("BlacklistTestToken", "BLT") {
        _mint(_msgSender(), _totalSupply);
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!_blacklist[to], "BlacklistTestToken: recipient is blacklisted");

        super._update(from, to, value);
    }

    function isBlacklisted(address account) external view returns (bool) {
        return _blacklist[account];
    }

    function setBlacklist(address account, bool blacklisted) external onlyOwner {
        _blacklist[account] = blacklisted;
    }
}
