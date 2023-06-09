// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.17;

import { EllipticCurve } from "./EllipticCurve.sol";

contract Secp256k1 {
    uint256 public constant GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798;
    uint256 public constant GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8;
    uint256 public constant AA = 0;
    uint256 public constant BB = 7;
    uint256 public constant PP = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F;
    uint256 public constant N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function ecMul(uint256 _k, uint256 _x, uint256 _y) public pure returns (uint256, uint256) {
        return EllipticCurve.ecMul(_k, _x, _y, AA, PP);
    }

    function ecAdd(uint256 _x1, uint256 _y1, uint256 _x2, uint256 _y2) public pure returns (uint256, uint256) {
        return EllipticCurve.ecAdd(_x1, _y1, _x2, _y2, AA, PP);
    }

    function G() public pure returns (uint256, uint256) {
        return (GX, GY);
    }
}
