import { BigNumber } from "ethers";
import { ethers } from "hardhat";

import { Secp256k1 } from "../../types/Secp256k1";

export async function pk_naive(secp256k1: Secp256k1, PKs: [BigNumber, BigNumber][]) {
  let X: [BigNumber, BigNumber] = PKs[0];
  for (let i = 1; i < PKs.length; i++) {
    X = await secp256k1.ecAdd(...X, ...PKs[i]);
  }
  return X;
}

export async function sign_naive(
  secp256k1: Secp256k1,
  X: [BigNumber, BigNumber],
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

  const c = ethers.utils.keccak256(encoder.encode(["uint[2]", "uint", "uint", "bytes"], [X, R_tot[0], R_tot[1], m]));
  const s = SKs.map((sk, i) => sk.mul(c).add(r[i]).mod(N));
  const s_tot = s.reduce((a, b) => a.add(b)).mod(N);

  return [R_tot, s_tot];
}
