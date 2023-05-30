// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.4;

import { console } from "hardhat/console.sol";

contract Power {
    uint public power;

    constructor(uint _power) {
        power = _power;
    }

    function pow(uint _n) external view returns (uint) {
        return _n ** power;
    }

    function setPower(uint _power) external {
        power = _power;
    }

    function payableSetPower(uint _power) external payable {
        require(msg.value == 1 ether, "Price is 1 ether");
        power = _power;
    }
}
