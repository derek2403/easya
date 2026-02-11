import type { Trade } from "./subgraph";

export interface ChartPoint {
  time: number; // unix seconds
  value: number; // price in USD
}

export function transformTradesToLineData(trades: Trade[]): ChartPoint[] {
  return trades
    .map((t) => ({
      time: parseInt(t.timestamp),
      value: parseFloat(t.priceUsd),
    }))
    .filter((p) => !isNaN(p.time) && !isNaN(p.value) && p.value > 0)
    .sort((a, b) => a.time - b.time);
}
