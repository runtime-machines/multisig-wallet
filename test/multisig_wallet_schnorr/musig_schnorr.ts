import { BigNumber } from "ethers";
import { ethers } from "hardhat";

import { Secp256k1 } from "../../types/Secp256k1";

const encoder = new ethers.utils.AbiCoder();

export async function pk_musig(secp256k1: Secp256k1, PKs: [BigNumber, BigNumber][]) {
  const a = PKs.map((pk) => ethers.utils.keccak256(encoder.encode([`uint[2][${PKs.length}]`, "uint[2]"], [PKs, pk])));
  let X: [BigNumber, BigNumber] = [BigNumber.from(0), BigNumber.from(0)];
  for (let i = 0; i < PKs.length; i++) {
    X = await secp256k1.ecAdd(...X, ...(await secp256k1.ecMul(a[i], ...PKs[i])));
  }
  return X;
}

export async function sign_musig(
  secp256k1: Secp256k1,
  X: [BigNumber, BigNumber],
  SKs: BigNumber[],
  PKs: [BigNumber, BigNumber][],
  m: string,
): Promise<[[BigNumber, BigNumber], BigNumber]> {
  const G: [BigNumber, BigNumber] = await secp256k1.G();
  const N: BigNumber = await secp256k1.N();

  const r = SKs.map(() => ethers.utils.randomBytes(32));
  const R: [BigNumber, BigNumber][] = await Promise.all(r.map(async (n: any) => await secp256k1.ecMul(n, ...G)));

  let R_tot = R[0];
  for (let i = 1; i < R.length; i++) {
    R_tot = await secp256k1.ecAdd(...R_tot, ...R[i]);
  }

  const a = PKs.map((pk) => ethers.utils.keccak256(encoder.encode([`uint[2][${PKs.length}]`, "uint[2]"], [PKs, pk])));
  const c = ethers.utils.keccak256(encoder.encode(["uint[2]", "uint", "uint", "bytes"], [X, R_tot[0], R_tot[1], m]));
  const s = SKs.map((sk, i) => sk.mul(c).mul(a[i]).add(r[i]).mod(N));
  const s_tot = s.reduce((a, b) => a.add(b)).mod(N);

  return [R_tot, s_tot];
}
