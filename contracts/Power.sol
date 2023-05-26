// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.4;

import { console } from "hardhat/console.sol";

contract Power {
    uint public power;

    constructor(uint _power) {
        // console.log("Exponent:", _power);
        power = _power;
    }

    function pow(uint n) public view returns (uint) {
        return n ** power;
    }

    function setPower(uint _power) public {
        power = _power;
    }
}
