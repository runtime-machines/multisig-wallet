import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

// import { abi as Secp256k1_ABI } from "../../artifacts/contracts/Secp256k1.sol/Secp256k1.json";
import { MultiSigWalletSchnorr } from "../../types/MultiSigWalletSchnorr";
import { Power } from "../../types/Power";
import { Secp256k1 } from "../../types/Secp256k1";
import { MultiSigWalletSchnorr__factory } from "../../types/factories/MultiSigWalletSchnorr__factory";
import { Power__factory } from "../../types/factories/Power__factory";
import { Secp256k1__factory } from "../../types/factories/Secp256k1__factory";

async function create_signature(
  secp256k1: Secp256k1,
  PKs: [BigNumber, BigNumber][],
  SKs: BigNumber[],
  m: string,
): Promise<[[BigNumber, BigNumber], BigNumber]> {
  const encoder = new ethers.utils.AbiCoder();
  const G: [BigNumber, BigNumber] = await secp256k1.G();
  const N: BigNumber = await secp256k1.N();

  const r = SKs.map(() => ethers.utils.randomBytes(32));
  const R: [BigNumber, BigNumber][] = await Promise.all(r.map(async (n: any) => await secp256k1.ecMul(n, ...G)));

  let R_tot = R[0];
  for (let i = 1; i < R.length; i++) {
    R_tot = await secp256k1.ecAdd(...R_tot, ...R[i]);
  }

  let X: [BigNumber, BigNumber] = PKs[0];
  for (let i = 1; i < R.length; i++) {
    X = await secp256k1.ecAdd(...X, ...PKs[i]);
  }

  const c = ethers.utils.keccak256(encoder.encode(["uint[2]", "uint", "uint", "bytes"], [X, R_tot[0], R_tot[1], m]));
  const s = SKs.map((sk, i) => sk.mul(c).add(r[i]).mod(N));
  const s_tot = s.reduce((a, b) => a.add(b)).mod(N);

  return [R_tot, s_tot];
}

describe("MultiSigWalletSchnorr contract", function () {
  const N_owners = 3;

  let signers: SignerWithAddress[];
  let wallet: MultiSigWalletSchnorr;
  let secp256k1: Secp256k1;
  let power: Power;
  let PKs: [BigNumber, BigNumber][];
  let SKs: BigNumber[];
  let G: [BigNumber, BigNumber];
  const abiEncoder = new ethers.utils.AbiCoder();

  beforeEach(async function () {
    signers = await ethers.getSigners();

    const secp256k1Factory: Secp256k1__factory = <Secp256k1__factory>await ethers.getContractFactory("Secp256k1");
    secp256k1 = await secp256k1Factory.deploy();
    await secp256k1.deployed();

    // Keys setup
    G = await secp256k1.G();
    SKs = Array.from(Array(N_owners), () => BigNumber.from(ethers.utils.randomBytes(32)));
    PKs = await Promise.all(SKs.map(async (sk) => await secp256k1.ecMul(sk, ...G)));

    // Wallet setup
    const walletFactory: MultiSigWalletSchnorr__factory = <MultiSigWalletSchnorr__factory>(
      await ethers.getContractFactory("MultiSigWalletSchnorr")
    );
    wallet = await walletFactory.deploy(PKs);
    await wallet.deployed();

    // Power setup
    const powerFactory: Power__factory = <Power__factory>await ethers.getContractFactory("Power");
    power = await powerFactory.deploy(2);
    await power.deployed();
  });

  it("can receive funds", async function () {
    expect(await ethers.provider.getBalance(wallet.address)).to.equal(0);
    await wallet.deposit({ value: 1000 });
    expect(await ethers.provider.getBalance(wallet.address)).to.equal(1000);
  });

  it("should allow payments approved by all owners", async function () {
    const amount = ethers.utils.parseEther("1000");

    const m = abiEncoder.encode(["string", "uint", "address", "uint"], ["pay", amount, signers[1].address, 0]);
    const [R, s]: [[BigNumber, BigNumber], BigNumber] = await create_signature(secp256k1, PKs, SKs, m);

    expect(await ethers.provider.getBalance(signers[1].address))
      .greaterThan(ethers.utils.parseEther("9999"))
      .lessThanOrEqual(ethers.utils.parseEther("10000"));

    await wallet.deposit({ value: amount });
    await expect(
      wallet.pay(1000, signers[1].address, [BigNumber.from("1"), BigNumber.from("2"), s]),
    ).to.be.revertedWith("Invalid signature");
    await expect(wallet.pay(amount, signers[1].address, [...R, s])).not.to.be.reverted;

    expect(await ethers.provider.getBalance(signers[1].address))
      .greaterThan(ethers.utils.parseEther("10999"))
      .lessThanOrEqual(ethers.utils.parseEther("11000"));
  });

  it("should allow external calls all owners", async function () {
    const iface = new ethers.utils.Interface(["function payableSetPower(uint _power)"]);
    const encodedCall = iface.encodeFunctionData("payableSetPower", [3]);
    const amount = ethers.utils.parseEther("1");

    const m = abiEncoder.encode(
      ["string", "address", "bytes", "uint", "uint"],
      ["extCall", power.address, encodedCall, amount, 0],
    );

    const [R, s]: [[BigNumber, BigNumber], BigNumber] = await create_signature(secp256k1, PKs, SKs, m);

    await wallet.deposit({ value: amount });
    expect(await power.pow(2)).to.equal(4);
    await wallet.connect(signers[1]).externalCall(power.address, encodedCall, amount, [...R, s]);
    expect(await power.pow(2)).to.equal(8);
  });
});
