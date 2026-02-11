import type { NextApiRequest, NextApiResponse } from "next";
import { fetchTrades } from "@/lib/subgraph";
import { transformTradesToLineData } from "@/lib/chart-utils";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const curveId = req.query.curveId as string;
  const limit = parseInt((req.query.limit as string) || "100");

  if (!curveId) {
    return res.status(400).json({ error: "curveId required" });
  }

  try {
    const trades = await fetchTrades(curveId, limit);
    const chartData = transformTradesToLineData(trades);

    const prices = chartData.map((p) => p.value);
    const priceRange =
      prices.length > 0
        ? { min: Math.min(...prices), max: Math.max(...prices) }
        : { min: 0, max: 0 };

    res.status(200).json({
      chartData,
      priceRange,
      tradeCount: trades.length,
      currentPrice: prices.length > 0 ? prices[prices.length - 1] : 0,
    });
  } catch (error) {
    console.error("Chart data error:", error);
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
}
