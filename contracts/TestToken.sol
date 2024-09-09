// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ERC20} from "./ERC20.sol";

contract TestToken is ERC20 {
    constructor(uint256 _totalSupply) ERC20("TestToken", "TST") {
        _mint(_msgSender(), _totalSupply);
    }
}
