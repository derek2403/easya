import type { NextApiRequest, NextApiResponse } from "next";
import { fetchCurves } from "@/lib/subgraph";
import { computeRiskScore } from "@/lib/risk";

interface Allocation {
  symbol: string;
  name: string;
  curveId: string;
  weight: number; // percentage
  riskScore: number;
  riskLevel: string;
  volumeEth: string;
  tradeCount: number;
  priceUsd: string;
}

interface StrategyResult {
  tier: string;
  description: string;
  apr: { min: number; max: number };
  riskLabel: string;
  allocations: Allocation[];
  allTokens: Array<{
    id: string;
    name: string;
    symbol: string;
    lastPriceUsd: string;
    totalVolumeEth: string;
  }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const tier = (req.query.tier as string) || "balanced";

  try {
    const curves = await fetchCurves(50);

    // Score all tokens
    const scored = curves.map((c) => ({
      curve: c,
      risk: computeRiskScore(c),
      volume: parseFloat(c.totalVolumeEth),
      trades: parseInt(c.tradeCount),
    }));

    // Filter out zero-activity tokens
    const active = scored.filter((s) => s.trades > 0);
    // Sort by volume descending
    active.sort((a, b) => b.volume - a.volume);

    let selected: typeof active;
    let description: string;
    let apr: { min: number; max: number };
    let riskLabel: string;

    switch (tier) {
      case "conservative": {
        // Top tokens by volume — most established
        selected = active
          .filter((s) => s.risk.score <= 40)
          .slice(0, 5);
        if (selected.length < 3) {
          selected = active.slice(0, 5);
        }
        description =
          "Focuses on the most liquid and actively traded tokens with the lowest risk scores. Prioritizes capital preservation.";
        apr = { min: 8, max: 12 };
        riskLabel = "Low Risk";
        break;
      }
      case "aggressive": {
        // Newer tokens with high trade counts — high risk, high reward
        const highPotential = [...active].sort(
          (a, b) => b.trades - a.trades
        );
        selected = highPotential
          .filter((s) => s.risk.score >= 30)
          .slice(0, 7);
        if (selected.length < 3) {
          selected = highPotential.slice(0, 7);
        }
        description =
          "Targets high-activity tokens with strong trading momentum. Higher volatility but higher potential returns.";
        apr = { min: 30, max: 60 };
        riskLabel = "High Risk";
        break;
      }
      default: {
        // Balanced — mix of established + mid-cap
        const topVolume = active.slice(0, 3);
        const midCap = active
          .slice(3)
          .filter((s) => s.risk.score <= 55)
          .slice(0, 3);
        selected = [...topVolume, ...midCap];
        description =
          "Balanced mix of established high-volume tokens and promising mid-cap picks. Moderate risk with solid upside.";
        apr = { min: 15, max: 25 };
        riskLabel = "Medium Risk";
        break;
      }
    }

    // Calculate weights (weighted by volume)
    const totalVol = selected.reduce((sum, s) => sum + s.volume, 0);
    const allocations: Allocation[] = selected.map((s) => ({
      symbol: s.curve.symbol,
      name: s.curve.name,
      curveId: s.curve.id,
      weight:
        totalVol > 0
          ? Math.round((s.volume / totalVol) * 100)
          : Math.round(100 / selected.length),
      riskScore: s.risk.score,
      riskLevel: s.risk.level,
      volumeEth: s.volume.toFixed(4),
      tradeCount: s.trades,
      priceUsd: s.curve.lastPriceUsd,
    }));

    // Ensure weights sum to 100
    const weightSum = allocations.reduce((sum, a) => sum + a.weight, 0);
    if (allocations.length > 0 && weightSum !== 100) {
      allocations[0].weight += 100 - weightSum;
    }

    const result: StrategyResult = {
      tier,
      description,
      apr,
      riskLabel,
      allocations,
      allTokens: curves
        .filter((c) => parseInt(c.tradeCount) > 0)
        .map((c) => ({
          id: c.id,
          name: c.name,
          symbol: c.symbol,
          lastPriceUsd: c.lastPriceUsd,
          totalVolumeEth: c.totalVolumeEth,
        })),
    };

    res.status(200).json(result);
  } catch (error) {
    console.error("Strategy error:", error);
    res.status(500).json({ error: "Failed to compute strategy" });
  }
}
