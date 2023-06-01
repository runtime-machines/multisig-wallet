import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import type { MultiSigWallet } from "../types/MultiSigWallet";
import type { MultiSigWalletSchnorr } from "../types/MultiSigWalletSchnorr";
import { Secp256k1Operations } from "../types/Secp256k1Operations";

declare module "mocha" {
  export interface Context {
    signers: SignerWithAddress[];
    wallet: MultiSigWallet;
    walletSchnorr: MultiSigWalletSchnorr;
    secp256k1: Secp256k1Operations;
    G: [BigNumber, BigNumber];
    PKs: [BigNumber, BigNumber][];
    SKs: BigNumber[];
    N: BigNumber;
  }
}
