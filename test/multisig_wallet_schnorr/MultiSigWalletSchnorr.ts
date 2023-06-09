import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

import { MultiSigWalletSchnorr } from "../../types/MultiSigWalletSchnorr";
import { Secp256k1 } from "../../types/Secp256k1";
import { MultiSigWalletSchnorr__factory } from "../../types/factories/MultiSigWalletSchnorr__factory";
import { Secp256k1__factory } from "../../types/factories/Secp256k1__factory";

describe("MultiSigWalletSchnorr contract", function () {
  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();

    const secp256k1Factory: Secp256k1__factory = <Secp256k1__factory>await ethers.getContractFactory("Secp256k1");
    const secp256k1: Secp256k1 = await secp256k1Factory.deploy();
    await secp256k1.deployed();

    // Keys setup
    const N_owners = 3;
    const G: [BigNumber, BigNumber] = await secp256k1.G();
    const N: BigNumber = await secp256k1.N();

    const SKs = Array.from(Array(N_owners), () => BigNumber.from(ethers.utils.randomBytes(32)));
    const PKs: [BigNumber, BigNumber][] = await Promise.all(SKs.map(async (sk) => await secp256k1.ecMul(sk, ...G)));

    // Wallet setup
    const walletFactory: MultiSigWalletSchnorr__factory = <MultiSigWalletSchnorr__factory>(
      await ethers.getContractFactory("MultiSigWalletSchnorr")
    );
    const wallet: MultiSigWalletSchnorr = await walletFactory.deploy(PKs);
    await wallet.deployed();

    this.walletSchnorr = wallet;
    this.signers = signers;
    this.secp256k1 = secp256k1;
    this.SKs = SKs;
    this.PKs = PKs;
    this.G = G;
    this.N = N;
  });

  it("can receive funds", async function () {
    expect(await ethers.provider.getBalance(this.walletSchnorr.address)).to.equal(0);
    await this.walletSchnorr.deposit({ value: 1000 });
    expect(await ethers.provider.getBalance(this.walletSchnorr.address)).to.equal(1000);
  });

  it("should allow payments approved by all owners", async function () {
    const amount = ethers.utils.parseEther("1000");

    const r = this.SKs.map(() => ethers.utils.randomBytes(32));
    const R: [BigNumber, BigNumber][] = await Promise.all(
      r.map(async (n: any) => await this.secp256k1.ecMul(n, ...this.G)),
    );

    let R_tot = R[0];
    for (let i = 1; i < R.length; i++) {
      R_tot = await this.secp256k1.ecAdd(...R_tot, ...R[i]);
    }

    let X: [BigNumber, BigNumber] = this.PKs[0];
    for (let i = 1; i < R.length; i++) {
      X = await this.secp256k1.ecAdd(...X, ...this.PKs[i]);
    }

    const encoder = new ethers.utils.AbiCoder();
    const m = encoder.encode(["string", "uint", "address", "uint"], ["pay", amount, this.signers[1].address, 0]);

    const c = ethers.utils.keccak256(encoder.encode(["uint[2]", "uint", "uint", "bytes"], [X, R_tot[0], R_tot[1], m]));
    const s = this.SKs.map((sk, i) => sk.mul(c).add(r[i]).mod(this.N));

    const s_tot = s.reduce((a, b) => a.add(b)).mod(this.N);

    expect(await ethers.provider.getBalance(this.signers[1].address))
      .greaterThan(ethers.utils.parseEther("9999"))
      .lessThanOrEqual(ethers.utils.parseEther("10000"));

    await this.walletSchnorr.deposit({ value: amount });
    await expect(
      this.walletSchnorr.pay(1000, this.signers[1].address, [BigNumber.from("1"), BigNumber.from("2"), s_tot]),
    ).to.be.revertedWith("Invalid signature");
    await expect(this.walletSchnorr.pay(amount, this.signers[1].address, [...R_tot, s_tot])).not.to.be.reverted;

    expect(await ethers.provider.getBalance(this.signers[1].address))
      .greaterThan(ethers.utils.parseEther("10999"))
      .lessThanOrEqual(ethers.utils.parseEther("11000"));
  });

  it("should allow external calls all owners", async function () {
    const powerFactory = await ethers.getContractFactory("Power");
    const power = await powerFactory.deploy(2);
    await power.deployed();
    this.power = power;
    const iface = new ethers.utils.Interface(["function payableSetPower(uint _power)"]);
    const encodedCall = iface.encodeFunctionData("payableSetPower", [3]);
    const amount = ethers.utils.parseEther("1");

    const r = this.SKs.map(() => ethers.utils.randomBytes(32));
    const R: [BigNumber, BigNumber][] = await Promise.all(
      r.map(async (n: any) => await this.secp256k1.ecMul(n, ...this.G)),
    );

    let R_tot = R[0];
    for (let i = 1; i < R.length; i++) {
      R_tot = await this.secp256k1.ecAdd(...R_tot, ...R[i]);
    }

    let X: [BigNumber, BigNumber] = this.PKs[0];
    for (let i = 1; i < R.length; i++) {
      X = await this.secp256k1.ecAdd(...X, ...this.PKs[i]);
    }

    const encoder = new ethers.utils.AbiCoder();
    const m = encoder.encode(
      ["string", "address", "bytes", "uint", "uint"],
      ["extCall", power.address, encodedCall, amount, 0],
    );

    const c = ethers.utils.keccak256(encoder.encode(["uint[2]", "uint", "uint", "bytes"], [X, R_tot[0], R_tot[1], m]));
    const s = this.SKs.map((sk, i) => sk.mul(c).add(r[i]).mod(this.N));

    const s_tot = s.reduce((a, b) => a.add(b)).mod(this.N);

    await this.walletSchnorr.deposit({ value: amount });

    expect(await this.power.pow(2)).to.equal(4);
    await this.walletSchnorr
      .connect(this.signers[1])
      .externalCall(this.power.address, encodedCall, amount, [...R_tot, s_tot]);
    expect(await this.power.pow(2)).to.equal(8);
  });
});
