import { network } from "hardhat";

const { ethers } = await network.connect({
    network: "baseSepolia",
    chainType: "l1",
});

async function main() {
    console.log("Deploying Mock USDC to Base Sepolia...");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const ERC20 = await ethers.getContractFactory("ERC20");

    // Deploy with name "USD Coin", symbol "USDC", 6 decimals, initial supply 0 (users will mint)
    const usdc = await ERC20.deploy("USD Coin", "USDC", 6, 0);
    await usdc.waitForDeployment();

    const address = await usdc.getAddress();
    console.log("Mock USDC deployed to:", address);
    console.log("\nUpdate your networkConfig with this address:");
    console.log(`MOCK_USDC_ADDRESS: "${address}"`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
