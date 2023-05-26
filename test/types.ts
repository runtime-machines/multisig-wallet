import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { MultiSigWallet } from "../types/MultiSigWallet";

declare module "mocha" {
  export interface Context {
    signers: SignerWithAddress[];
    wallet: MultiSigWallet;
  }
}
