import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

declare module "mocha" {
  export interface Context {
    signers: SignerWithAddress[];
  }
}
