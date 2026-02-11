import type { Curve } from "./subgraph";

export interface RiskResult {
  score: number; // 0-100, higher = riskier
  level: "low" | "medium" | "high";
  emoji: string;
  factors: RiskFactor[];
}

export interface RiskFactor {
  name: string;
  value: string;
  impact: "positive" | "neutral" | "negative";
  detail: string;
}

export function computeRiskScore(curve: Curve): RiskResult {
  const factors: RiskFactor[] = [];
  let riskPoints = 0;

  // 1. Volume (higher volume = lower risk)
  const volumeEth = parseFloat(curve.totalVolumeEth);
  if (volumeEth === 0) {
    riskPoints += 25;
    factors.push({
      name: "Volume",
      value: "0 ETH",
      impact: "negative",
      detail: "No trading volume — completely untested liquidity",
    });
  } else if (volumeEth < 0.1) {
    riskPoints += 20;
    factors.push({
      name: "Volume",
      value: `${volumeEth.toFixed(4)} ETH`,
      impact: "negative",
      detail: "Very low volume — high slippage risk",
    });
  } else if (volumeEth < 1) {
    riskPoints += 10;
    factors.push({
      name: "Volume",
      value: `${volumeEth.toFixed(4)} ETH`,
      impact: "neutral",
      detail: "Moderate volume — some liquidity established",
    });
  } else {
    riskPoints += 0;
    factors.push({
      name: "Volume",
      value: `${volumeEth.toFixed(4)} ETH`,
      impact: "positive",
      detail: "Healthy volume — good liquidity",
    });
  }

  // 2. Trade count (more trades = lower risk)
  const tradeCount = parseInt(curve.tradeCount);
  if (tradeCount === 0) {
    riskPoints += 25;
    factors.push({
      name: "Trade Count",
      value: "0",
      impact: "negative",
      detail: "No trades — zero market interest",
    });
  } else if (tradeCount < 5) {
    riskPoints += 15;
    factors.push({
      name: "Trade Count",
      value: String(tradeCount),
      impact: "negative",
      detail: "Very few trades — limited price discovery",
    });
  } else if (tradeCount < 20) {
    riskPoints += 5;
    factors.push({
      name: "Trade Count",
      value: String(tradeCount),
      impact: "neutral",
      detail: "Some trading activity",
    });
  } else {
    riskPoints += 0;
    factors.push({
      name: "Trade Count",
      value: String(tradeCount),
      impact: "positive",
      detail: "Active trading — good price discovery",
    });
  }

  // 3. Age (older = lower risk)
  const ageSeconds = Date.now() / 1000 - parseInt(curve.createdAt);
  const ageHours = ageSeconds / 3600;
  if (ageHours < 1) {
    riskPoints += 20;
    factors.push({
      name: "Age",
      value: `${Math.round(ageHours * 60)} min`,
      impact: "negative",
      detail: "Brand new token — extremely high rug risk",
    });
  } else if (ageHours < 24) {
    riskPoints += 10;
    factors.push({
      name: "Age",
      value: `${Math.round(ageHours)} hours`,
      impact: "neutral",
      detail: "Less than a day old — still very early",
    });
  } else {
    const ageDays = Math.round(ageHours / 24);
    riskPoints += 0;
    factors.push({
      name: "Age",
      value: `${ageDays} days`,
      impact: "positive",
      detail: "Survived multiple days — some resilience shown",
    });
  }

  // 4. Graduation status
  if (curve.graduated) {
    riskPoints -= 10; // bonus for graduating
    factors.push({
      name: "Graduated",
      value: "Yes",
      impact: "positive",
      detail: "Graduated from bonding curve — reached liquidity threshold",
    });
  } else {
    riskPoints += 10;
    factors.push({
      name: "Graduated",
      value: "No",
      impact: "negative",
      detail: "Still on bonding curve — has not reached liquidity threshold",
    });
  }

  // 5. Activity recency
  if (!curve.lastTradeAt) {
    riskPoints += 15;
    factors.push({
      name: "Last Trade",
      value: "Never",
      impact: "negative",
      detail: "No trades recorded — dead token",
    });
  } else {
    const lastTradeAge =
      (Date.now() / 1000 - parseInt(curve.lastTradeAt)) / 3600;
    if (lastTradeAge > 24) {
      riskPoints += 10;
      factors.push({
        name: "Last Trade",
        value: `${Math.round(lastTradeAge / 24)}d ago`,
        impact: "negative",
        detail: "No recent trading activity — potentially abandoned",
      });
    } else {
      factors.push({
        name: "Last Trade",
        value: `${Math.round(lastTradeAge)}h ago`,
        impact: "positive",
        detail: "Recently traded — active market",
      });
    }
  }

  // Clamp score 0-100
  const score = Math.max(0, Math.min(100, riskPoints));

  let level: RiskResult["level"];
  let emoji: string;
  if (score <= 30) {
    level = "low";
    emoji = "🟢";
  } else if (score <= 60) {
    level = "medium";
    emoji = "🟡";
  } else {
    level = "high";
    emoji = "🔴";
  }

  return { score, level, emoji, factors };
}
