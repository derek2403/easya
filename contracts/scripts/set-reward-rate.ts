import { network } from "hardhat";

const { ethers } = await network.connect({
    network: "baseSepolia",
    chainType: "l1",
});

const COIN_BATTLE = "0x0FA69EaDa5b2211B9E217C5C63b639B3a58bD3c0";

const ABI = [
    "function setRewardRate(uint256 _rate) external",
    "function rewardRate() external view returns (uint256)",
];

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const coinBattle = new ethers.Contract(COIN_BATTLE, ABI, deployer);

    const currentRate = await coinBattle.rewardRate();
    console.log("Current reward rate:", currentRate.toString());

    // We want 1 CBA (1e18) for every 0.001 USDC (1000 wei) -> 1000 CBA per 1 USDC (1e6)
    // Contract logic: (amount * rate) / 1e18
    // Target: output = (amount_usdc * 1000 * 1e18) / 1e6
    // Formula: (amount * Rate) / 1e18 = amount * (1000 * 1e12)
    // Rate / 1e18 = 1000 * 1e12
    // Rate = 1000 * 1e30 = 1e33

    const RATE = BigInt("1000") * (10n ** 30n);
    console.log("Setting new rate to:", RATE.toString(), "(= 1000 CBA per 1 USDC)");

    const tx = await coinBattle.setRewardRate(RATE);
    console.log("Tx hash:", tx.hash);
    await tx.wait();

    const updatedRate = await coinBattle.rewardRate();
    console.log("✅ Updated reward rate:", updatedRate.toString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
