// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface StandardToken {


    function transferFrom(address _from, address _to, uint _value) external;

    function transfer(address _to, uint256 _value) external;

    function approve(address _spender, uint _value) external;

    function allowance(address _owner, address _spender) external view returns (uint256);

    function balanceOf(address _owner) external returns (uint256);
}