import { network } from "hardhat";

const { ethers } = await network.connect({
    network: "baseSepolia",
    chainType: "l1",
});

// CoinBattle contract from networkConfig
const COIN_BATTLE = "0x0FA69EaDa5b2211B9E217C5C63b639B3a58bD3c0";

// CoinBattle ABI
const COIN_BATTLE_ABI = [
    "function createBattle(string calldata _coinA, string calldata _coinB, uint256 _duration) external returns (uint256)",
    "function battleCount() external view returns (uint256)",
    "function getBattle(uint256 _battleId) external view returns (tuple(string coinA, string coinB, uint256 endTime, uint256 totalPoolA, uint256 totalPoolB, uint8 winner, uint8 status))",
    "function owner() external view returns (address)",
];

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const coinBattle = new ethers.Contract(COIN_BATTLE, COIN_BATTLE_ABI, deployer);

    // Check owner
    const owner = await coinBattle.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error("ERROR: Deployer is not the contract owner.");
        process.exit(1);
    }

    // Check current battle count
    const count = await coinBattle.battleCount();
    console.log("Current battle count:", count.toString());

    if (count > 0n) {
        // Check if the latest battle is open
        const latestId = count - 1n;
        const battle = await coinBattle.getBattle(latestId);
        const isOpen = battle.status === 0n;
        const isNotExpired = Number(battle.endTime) > Math.floor(Date.now() / 1000);

        if (isOpen && isNotExpired) {
            console.log(`\nBattle #${latestId} is already OPEN.`);
            console.log(`  ${battle.coinA} vs ${battle.coinB}`);
            console.log(`  Ends: ${new Date(Number(battle.endTime) * 1000).toLocaleString()}`);
            console.log("\n⚠️ Skipping creation to avoid duplicates.");
            return;
        }
    }

    // Create battle if none open
    const coinA = "PEPE";
    const coinB = "WIF";
    const duration = 86400; // 24 hours
    console.log(`\nCreating NEW battle: ${coinA} vs ${coinB} (${duration}s)...`);

    const tx = await coinBattle.createBattle(coinA, coinB, duration);
    console.log("Tx hash:", tx.hash);
    await tx.wait();
    console.log("✅ Battle created!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
