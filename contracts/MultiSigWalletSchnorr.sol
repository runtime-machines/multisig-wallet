// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.17;

import "./Secp256k1.sol";
import { console } from "hardhat/console.sol";

contract MultiSigWalletSchnorr is Secp256k1 {
    uint256[2][] public owners;

    // We use counters so that it is not possible
    // to reuse the same signature twice
    uint paymentCounter = 0;
    uint extCallCounter = 0;

    constructor(uint256[2][] memory _owners) {
        require(_owners.length >= 1, "Must have at least one owner");
        owners = _owners;
    }

    function deposit() external payable {}

    function pay(uint _amount, address payable _to, uint256[3] memory _signature) external {
        bytes memory m = abi.encode("pay", _amount, _to, paymentCounter);
        require(_verifySignature(m, _signature), "Invalid signature");
        paymentCounter++;
        _to.transfer(_amount);
    }

    function externalCall(
        address _contract,
        bytes memory _call,
        uint _value,
        uint256[3] memory _signature
    ) external returns (bool, bytes memory) {
        bytes memory m = abi.encode("extCall", _contract, _call, _value, extCallCounter);
        require(_verifySignature(m, _signature), "Invalid signature");
        extCallCounter++;

        (bool success, bytes memory data) = _contract.call{ value: _value }(_call);
        if (success == false) {
            // Correctly propagate reverts from called function
            assembly {
                revert(add(data, 32), mload(data))
            }
        }

        return (success, data);
    }

    function _verifySignature(bytes memory _m, uint256[3] memory _signature) internal view returns (bool) {
        uint256[2] memory X = [owners[0][0], owners[0][1]];
        for (uint i = 1; i < owners.length; i++) {
            (X[0], X[1]) = ecAdd(X[0], X[1], owners[i][0], owners[i][1]);
        }
        bytes32 c = keccak256(abi.encode(X, _signature[0], _signature[1], _m));

        uint256[2] memory gs;
        (gs[0], gs[1]) = ecMul(_signature[2], GX, GY);

        uint256[2] memory cx;
        (cx[0], cx[1]) = ecMul(uint256(c), X[0], X[1]);

        uint256[2] memory rcx;
        (rcx[0], rcx[1]) = ecAdd(cx[0], cx[1], _signature[0], _signature[1]);

        return gs[0] == rcx[0] && gs[1] == rcx[1];
    }
}
