// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4;

import { console } from "hardhat/console.sol";

struct Payment {
    uint amount;
    address payable to;
    bool exists;
}

contract MultiSigWallet {
    address[] public owners;
    uint public balance;

    constructor(address[] memory _owners) {
        require(_owners.length >= 1);
        owners = _owners;
    }

    function deposit() external payable {
        balance += msg.value;
    }

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

        return (_pay_approveAndCheck(paymentId), paymentId);
    }

    function payApprove(uint _paymentId) external onlyAnOwner returns (bool) {
        return _pay_approveAndCheck(_paymentId);
    }

    function _pay_approveAndCheck(uint _paymentId) internal returns (bool) {
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
            balance -= payment.amount;
            delete paymentsWaiting[_paymentId];
            delete paymentsApprovals[_paymentId];
            return true;
        }

        return false;
    }

    // TODO:
    // - make it work with multiple signers
    // - return data?
    // - payable?
    function externalCall(
        address _contract,
        bytes memory _call
    ) external onlyAnOwner returns (bool success, bytes memory returnedData) {
        (success, returnedData) = _contract.call{ value: 0 }(_call);
    }
}
