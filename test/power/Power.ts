import { ethers } from "hardhat";

const { expect } = require("chai");

describe("Power contract", function () {
  it("should compute power", async function () {
    const [admin] = await ethers.getSigners();

    const initialPower = 2;

    const powerFactory = await ethers.getContractFactory("Power");
    const power = await powerFactory.connect(admin).deploy(initialPower);
    await power.deployed();

    expect(await power.connect(admin).pow(2)).to.equal(4);
    expect(await power.connect(admin).pow(3)).to.equal(9);

    await power.setPower(3);
    expect(await power.connect(admin).pow(2)).to.equal(8);
    expect(await power.connect(admin).pow(3)).to.equal(27);
  });
});
