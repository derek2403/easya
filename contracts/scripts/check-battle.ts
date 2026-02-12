import { network } from "hardhat";

const { ethers } = await network.connect({
    network: "baseSepolia",
    chainType: "l1",
});

const COIN_BATTLE = "0x68b817C0056B815e9280de759B33835CDabff6C4";

const ABI = [
    "function getBattle(uint256 _battleId) external view returns (tuple(string coinA, string coinB, uint256 endTime, uint256 totalPoolA, uint256 totalPoolB, uint8 winner, uint8 status))",
    "function battleCount() external view returns (uint256)",
];

async function main() {
    const [deployer] = await ethers.getSigners();
    const coinBattle = new ethers.Contract(COIN_BATTLE, ABI, deployer);

    const count = await coinBattle.battleCount();
    console.log("Total Battles:", count.toString());

    if (count > 0n) {
        try {
            const battle0 = await coinBattle.getBattle(0);
            console.log("\nBattle #0:");
            console.log("  Coin A:", battle0.coinA);
            console.log("  Coin B:", battle0.coinB);
            console.log("  End Time:", new Date(Number(battle0.endTime) * 1000).toLocaleString());
            console.log("  Status:", battle0.status === 0n ? "Open" : "Adjusted/Closed");
            console.log("  Pool A:", battle0.totalPoolA.toString());
            console.log("  Pool B:", battle0.totalPoolB.toString());
        } catch (e) {
            console.error("Error reading battle #0:", e);
        }
    } else {
        console.log("No battles found.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
