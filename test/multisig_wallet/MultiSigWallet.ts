import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { MultiSigWallet } from "../../types/MultiSigWallet";
import { MultiSigWallet__factory } from "../../types/factories/MultiSigWallet__factory";

describe("MultiSigWallet contract", function () {
  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const [admin] = signers;

    const walletFactory: MultiSigWallet__factory = <MultiSigWallet__factory>(
      await ethers.getContractFactory("MultiSigWallet")
    );
    const wallet: MultiSigWallet = await walletFactory.deploy([
      signers[1].address,
      signers[2].address,
      signers[3].address,
    ]);
    await wallet.deployed();

    this.wallet = wallet;
    this.admin = admin;
    this.signers = signers;

    const powerFactory = await ethers.getContractFactory("Power");
    const power = await powerFactory.deploy(2);
    await power.deployed();

    this.power = power;
  });

  it("can receive funds", async function () {
    expect(await ethers.provider.getBalance(this.wallet.address)).to.equal(0);
    await this.wallet.deposit({ value: 1000 });
    expect(await ethers.provider.getBalance(this.wallet.address)).to.equal(1000);
  });

  it("shouldn't allow payments from non owners", async function () {
    await expect(this.wallet.connect(this.signers[8]).pay(1, this.signers[9].address)).to.be.revertedWith(
      "Not an owner",
    );
  });

  it("should allow payments approved by all owners", async function () {
    const receiver = this.signers[9];
    const initialBalance = await receiver.getBalance();
    const transfer_amount = 1000;

    await this.wallet.deposit({ value: 1000 });
    await this.wallet.connect(this.signers[1]).pay(transfer_amount, receiver.address);
    expect(await receiver.getBalance()).to.equal(initialBalance);

    await this.wallet.connect(this.signers[2]).payApprove(0);
    expect(await receiver.getBalance()).to.equal(initialBalance);

    await this.wallet.connect(this.signers[3]).payApprove(0);
    expect(await receiver.getBalance()).to.equal(initialBalance.add(transfer_amount));
  });

  it("shouldn't allow an owner to approve the same payment twice", async function () {
    await this.wallet.connect(this.signers[1]).pay(1, this.signers[9].address);
    await expect(this.wallet.connect(this.signers[1]).payApprove(0)).to.be.revertedWith("Already approved");
    await expect(this.wallet.connect(this.signers[2]).payApprove(0)).not.to.be.reverted;
    await expect(this.wallet.connect(this.signers[2]).payApprove(0)).to.be.revertedWith("Already approved");

    // Another transaction with a different id
    await this.wallet.connect(this.signers[1]).pay(1, this.signers[9].address);
    await expect(this.wallet.connect(this.signers[1]).payApprove(1)).to.be.revertedWith("Already approved");
    await expect(this.wallet.connect(this.signers[2]).payApprove(1)).not.to.be.reverted;
    await expect(this.wallet.connect(this.signers[2]).payApprove(1)).to.be.revertedWith("Already approved");
  });

  it("shouldn't allow approval of a non existing transaction", async function () {
    await expect(this.wallet.connect(this.signers[1]).payApprove(0)).to.be.revertedWith(
      "No waiting payments with this id",
    );
  });

  it("should make external call", async function () {
    const iface = new ethers.utils.Interface(["function setPower(uint _power)"]);
    const encodedCall = iface.encodeFunctionData("setPower", [3]);

    expect(await this.power.pow(2)).to.equal(4);
    await this.wallet.connect(this.signers[1]).externalCall(this.power.address, encodedCall, 0);
    expect(await this.power.pow(2)).to.equal(4);
    await this.wallet.connect(this.signers[2]).externalCallApprove(0);
    expect(await this.power.pow(2)).to.equal(4);
    await this.wallet.connect(this.signers[3]).externalCallApprove(0);
    expect(await this.power.pow(2)).to.equal(8);
  });

  it("should make payable external call", async function () {
    const iface = new ethers.utils.Interface(["function payableSetPower(uint _power)"]);
    const encodedCall = iface.encodeFunctionData("payableSetPower", [3]);

    await this.wallet.deposit({ value: ethers.utils.parseUnits("2", "ether") });

    expect(await this.power.pow(2)).to.equal(4);
    await this.wallet
      .connect(this.signers[1])
      .externalCall(this.power.address, encodedCall, ethers.utils.parseUnits("1", "ether"));
    expect(await this.power.pow(2)).to.equal(4);
    await this.wallet.connect(this.signers[2]).externalCallApprove(0);
    expect(await this.power.pow(2)).to.equal(4);
    await this.wallet.connect(this.signers[3]).externalCallApprove(0);
    expect(await this.power.pow(2)).to.equal(8);
  });
});
