import { network } from "hardhat";

const { ethers } = await network.connect({
    network: "baseSepolia",
    chainType: "l1",
});

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const ERC20 = await ethers.getContractFactory("ERC20");

    // Deploy CBA token
    console.log("\nDeploying CBA token...");
    const cba = await ERC20.deploy("CBA Token", "CBA", 18, 0);
    await cba.waitForDeployment();
    const cbaAddress = await cba.getAddress();
    console.log("CBA deployed to:", cbaAddress);

    // Deploy ZERO token
    console.log("\nDeploying ZERO token...");
    const zero = await ERC20.deploy("Zero Token", "ZERO", 18, 0);
    await zero.waitForDeployment();
    const zeroAddress = await zero.getAddress();
    console.log("ZERO deployed to:", zeroAddress);

    console.log("\n--- Update networkConfig ---");
    console.log(`CBA: "${cbaAddress}"`);
    console.log(`ZERO: "${zeroAddress}"`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
