import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

import { MultiSigWalletSchnorr } from "../../types/MultiSigWalletSchnorr";
import { Power } from "../../types/Power";
import { Secp256k1 } from "../../types/Secp256k1";
import { MultiSigWalletSchnorr__factory } from "../../types/factories/MultiSigWalletSchnorr__factory";
import { Power__factory } from "../../types/factories/Power__factory";
import { Secp256k1__factory } from "../../types/factories/Secp256k1__factory";
import { pk_musig, sign_musig } from "./musig_schnorr";
import { pk_naive, sign_naive } from "./naive_schnorr";

describe("MultiSigWalletSchnorr contract", function () {
  const N_owners = 3;

  let signers: SignerWithAddress[];
  let secp256k1: Secp256k1;
  let PKs: [BigNumber, BigNumber][];
  let SKs: BigNumber[];
  let G: [BigNumber, BigNumber];

  before(async function () {
    signers = await ethers.getSigners();

    const secp256k1Factory: Secp256k1__factory = <Secp256k1__factory>await ethers.getContractFactory("Secp256k1");
    secp256k1 = await secp256k1Factory.deploy();
    await secp256k1.deployed();

    // Keys setup
    G = await secp256k1.G();
    SKs = Array.from(Array(N_owners), () => BigNumber.from(ethers.utils.randomBytes(32)));
    PKs = await Promise.all(SKs.map(async (sk) => await secp256k1.ecMul(sk, ...G)));
  });

  [
    { title: "Naive multi-signature scheme", sign_fn: sign_naive, pk_fn: pk_naive },
    { title: "MuSig scheme", sign_fn: sign_musig, pk_fn: pk_musig },
  ].forEach(({ title, pk_fn, sign_fn }) =>
    describe(title, async function () {
      const amount = ethers.utils.parseEther("1");
      let payment_signature: [[BigNumber, BigNumber], BigNumber];
      let encodedCall: string;
      let external_call_signature: [[BigNumber, BigNumber], BigNumber];
      let power: Power;
      let wallet: MultiSigWalletSchnorr;
      let X: [BigNumber, BigNumber];

      before(async function () {
        const encoder = new ethers.utils.AbiCoder();
        X = await pk_fn(secp256k1, PKs);

        // Wallet setup
        const walletFactory: MultiSigWalletSchnorr__factory = <MultiSigWalletSchnorr__factory>(
          await ethers.getContractFactory("MultiSigWalletSchnorr")
        );
        wallet = await walletFactory.deploy(X);
        await wallet.deployed();

        // Power setup
        const powerFactory: Power__factory = <Power__factory>await ethers.getContractFactory("Power");
        power = await powerFactory.deploy(2);
        await power.deployed();

        // Signature for payments
        payment_signature = await sign_fn(
          secp256k1,
          X,
          SKs,
          PKs,
          encoder.encode(["string", "uint", "address", "uint"], ["pay", amount, signers[1].address, 0]),
        );

        // Signature for external call
        encodedCall = power.interface.encodeFunctionData("payableSetPower", [3]);
        external_call_signature = await sign_fn(
          secp256k1,
          X,
          SKs,
          PKs,
          new ethers.utils.AbiCoder().encode(
            ["string", "address", "bytes", "uint", "uint"],
            ["extCall", power.address, encodedCall, amount, 0],
          ),
        );
      });

      it("can receive funds", async function () {
        expect(await ethers.provider.getBalance(wallet.address)).to.equal(0);
        await wallet.deposit({ value: 1000 });
        expect(await ethers.provider.getBalance(wallet.address)).to.equal(1000);
      });

      it("should allow payments approved by all owners", async function () {
        const [R, s] = payment_signature;

        const initialBalance = await ethers.provider.getBalance(signers[1].address);
        await wallet.deposit({ value: amount });

        // Invalid signature
        await expect(wallet.pay(amount, signers[1].address, [...R, s.add(1)])).to.be.revertedWith("Invalid signature");
        expect(await ethers.provider.getBalance(signers[1].address)).to.equal(initialBalance);

        // Valid signature
        await expect(wallet.pay(amount, signers[1].address, [...R, s])).not.to.be.reverted;
        expect(await ethers.provider.getBalance(signers[1].address)).to.equal(initialBalance.add(amount));
      });

      it("should allow external calls all owners", async function () {
        const [R, s] = external_call_signature;

        await wallet.deposit({ value: amount });
        expect(await power.pow(2)).to.equal(4);
        await wallet.connect(signers[1]).externalCall(power.address, encodedCall, amount, [...R, s]);
        expect(await power.pow(2)).to.equal(8);
      });
    }),
  );
});
