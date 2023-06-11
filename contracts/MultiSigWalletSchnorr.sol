// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.17;

import { Secp256k1 } from "./Secp256k1.sol";

contract MultiSigWalletSchnorr is Secp256k1 {
    uint[2] public X;

    // We use counters so that it is not possible
    // to reuse the same signature twice
    uint paymentCounter = 0;
    uint extCallCounter = 0;

    constructor(uint[2] memory _X) {
        X = _X;
    }

    function deposit() external payable {}

    function pay(uint _amount, address payable _to, uint[3] memory _signature) external {
        bytes memory m = abi.encode("pay", _amount, _to, paymentCounter++);
        require(_verifySignature(m, _signature), "Invalid signature");
        _to.transfer(_amount);
    }

    function externalCall(
        address _contract,
        bytes memory _call,
        uint _value,
        uint[3] memory _signature
    ) external returns (bool, bytes memory) {
        bytes memory m = abi.encode("extCall", _contract, _call, _value, extCallCounter++);
        require(_verifySignature(m, _signature), "Invalid signature");

        (bool success, bytes memory data) = _contract.call{ value: _value }(_call);
        if (success == false) {
            // Correctly propagate reverts from called function
            assembly {
                revert(add(data, 32), mload(data))
            }
        }

        return (success, data);
    }

    function _verifySignature(bytes memory _m, uint[3] memory _signature) internal view returns (bool) {
        bytes32 c = keccak256(abi.encode(X, _signature[0], _signature[1], _m));

        uint[2] memory gs;
        uint[2] memory cx;
        uint[2] memory rcx;

        (gs[0], gs[1]) = ecMul(_signature[2], GX, GY);
        (cx[0], cx[1]) = ecMul(uint(c), X[0], X[1]);
        (rcx[0], rcx[1]) = ecAdd(cx[0], cx[1], _signature[0], _signature[1]);

        return gs[0] == rcx[0] && gs[1] == rcx[1];
    }
}
