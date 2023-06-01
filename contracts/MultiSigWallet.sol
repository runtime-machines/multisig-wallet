// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.17;

import { console } from "hardhat/console.sol";

struct Payment {
    uint amount;
    address payable to;
    bool exists;
}

struct ExternalCall {
    address contractAddress;
    bytes encodedCall;
    uint value;
    bool exists;
}

contract MultiSigWallet {
    address[] public owners;

    constructor(address[] memory _owners) {
        require(_owners.length >= 1, "Must have at least one owner");
        owners = _owners;
    }

    function deposit() external payable {}

    modifier onlyAnOwner() {
        bool exists = false;
        for (uint i = 0; i < owners.length; i++) {
            if (owners[i] == msg.sender) {
                exists = true;
                break;
            }
        }

        require(exists, "Not an owner");
        _;
    }

    mapping(uint => Payment) paymentsWaiting;
    mapping(uint => address[]) paymentsApprovals;
    uint paymentCounter = 0;

    function pay(uint _amount, address payable _to) external onlyAnOwner returns (bool, uint) {
        uint paymentId = paymentCounter++;
        paymentsWaiting[paymentId] = Payment(_amount, _to, true);

        return (_paymentApproveAndPerform(paymentId), paymentId);
    }

    function payApprove(uint _paymentId) external onlyAnOwner returns (bool) {
        return _paymentApproveAndPerform(_paymentId);
    }

    function _paymentApproveAndPerform(uint _paymentId) internal returns (bool) {
        require(paymentsWaiting[_paymentId].exists, "No waiting payments with this id");
        Payment memory payment = paymentsWaiting[_paymentId];

        for (uint i = 0; i < paymentsApprovals[_paymentId].length; i++) {
            if (paymentsApprovals[_paymentId][i] == msg.sender) {
                revert("Already approved");
            }
        }

        paymentsApprovals[_paymentId].push(msg.sender);

        if (paymentsApprovals[_paymentId].length == owners.length) {
            payment.to.transfer(payment.amount);
            delete paymentsWaiting[_paymentId];
            delete paymentsApprovals[_paymentId];
            return true;
        }

        return false;
    }

    mapping(uint => ExternalCall) externalCallsWaiting;
    mapping(uint => address[]) externalCallsApprovals;
    uint externalCallCounter = 0;

    function externalCall(
        address _contract,
        bytes memory _call,
        uint _value
    ) external onlyAnOwner returns (bool, bytes memory, uint) {
        uint externalCallId = externalCallCounter++;
        externalCallsWaiting[externalCallId] = ExternalCall(_contract, _call, _value, true);

        (bool success, bytes memory data) = _extCallApproveAndPerform(externalCallId);
        return (success, data, externalCallId);
    }

    function externalCallApprove(uint _extCallId) external onlyAnOwner returns (bool, bytes memory) {
        return _extCallApproveAndPerform(_extCallId);
    }

    function _extCallApproveAndPerform(uint _externalCallId) internal returns (bool, bytes memory) {
        require(externalCallsWaiting[_externalCallId].exists, "No waiting calls with this id");
        ExternalCall memory extCall = externalCallsWaiting[_externalCallId];

        for (uint i = 0; i < externalCallsApprovals[_externalCallId].length; i++) {
            if (externalCallsApprovals[_externalCallId][i] == msg.sender) {
                revert("Already approved");
            }
        }

        externalCallsApprovals[_externalCallId].push(msg.sender);

        if (externalCallsApprovals[_externalCallId].length == owners.length) {
            (bool success, bytes memory data) = extCall.contractAddress.call{ value: extCall.value }(
                extCall.encodedCall
            );
            if (success == false) {
                // Correctly propagate reverts from called function
                assembly {
                    revert(add(data, 32), mload(data))
                }
            }

            delete externalCallsWaiting[_externalCallId];
            delete externalCallsApprovals[_externalCallId];
            return (success, data);
        }

        return (false, "");
    }
}
