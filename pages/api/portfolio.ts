import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

interface Holding {
  curveId: string;
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  totalCost: number;
}

interface TradeRecord {
  id: string;
  timestamp: number;
  type: "trade" | "limit_order" | "strategy" | "reserve";
  symbol: string;
  side: "buy" | "sell";
  amount: number;
  price: number;
}

interface Portfolio {
  userId: number;
  walletAddress: string;
  usdcBalance: number;
  holdings: Holding[];
  trades: TradeRecord[];
  createdAt: number;
  updatedAt: number;
}

const portfolios = new Map<number, Portfolio>();

function generateWallet(userId: number): string {
  const hash = crypto
    .createHash("sha256")
    .update(`easya_${userId}`)
    .digest("hex");
  return `0x${hash.slice(0, 40)}`;
}

function getOrCreatePortfolio(userId: number): Portfolio {
  let portfolio = portfolios.get(userId);
  if (!portfolio) {
    portfolio = {
      userId,
      walletAddress: generateWallet(userId),
      usdcBalance: 100,
      holdings: [],
      trades: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    portfolios.set(userId, portfolio);
  }
  return portfolio;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    const userId = parseInt(req.query.userId as string);
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }
    const portfolio = getOrCreatePortfolio(userId);
    return res.status(200).json(portfolio);
  }

  if (req.method === "POST") {
    const { userId, type, symbol, curveId, name, side, amount, price } =
      req.body;

    if (!userId || !symbol || !side || !amount || !price) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const portfolio = getOrCreatePortfolio(userId);
    const tradeAmount = parseFloat(amount);
    const tradePrice = parseFloat(price);

    // Reserve funds for limit orders — deduct balance but don't create holdings
    if (type === "reserve") {
      if (portfolio.usdcBalance < tradeAmount) {
        return res.status(400).json({
          error: "Insufficient balance",
          available: portfolio.usdcBalance,
        });
      }

      portfolio.usdcBalance -= tradeAmount;

      portfolio.trades.unshift({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: "reserve",
        symbol,
        side: "buy",
        amount: tradeAmount,
        price: tradePrice,
      });

      if (portfolio.trades.length > 50) {
        portfolio.trades = portfolio.trades.slice(0, 50);
      }
      portfolio.updatedAt = Date.now();
      return res.status(200).json(portfolio);
    }

    if (side === "buy") {
      if (portfolio.usdcBalance < tradeAmount) {
        return res.status(400).json({
          error: "Insufficient balance",
          available: portfolio.usdcBalance,
        });
      }

      portfolio.usdcBalance -= tradeAmount;

      // Calculate token quantity from USD amount and price
      const quantity = tradePrice > 0 ? tradeAmount / tradePrice : 0;

      // Update or create holding
      const existing = portfolio.holdings.find((h) => h.curveId === curveId);
      if (existing) {
        const newTotalCost = existing.totalCost + tradeAmount;
        const newQuantity = existing.quantity + quantity;
        existing.avgBuyPrice =
          newQuantity > 0 ? newTotalCost / newQuantity : tradePrice;
        existing.quantity = newQuantity;
        existing.totalCost = newTotalCost;
      } else {
        portfolio.holdings.push({
          curveId: curveId || symbol,
          symbol,
          name: name || symbol,
          quantity,
          avgBuyPrice: tradePrice,
          totalCost: tradeAmount,
        });
      }
    } else {
      // Sell — add back to balance
      portfolio.usdcBalance += tradeAmount;

      const existing = portfolio.holdings.find((h) => h.curveId === curveId);
      if (existing) {
        const sellQuantity = tradePrice > 0 ? tradeAmount / tradePrice : 0;
        existing.quantity = Math.max(0, existing.quantity - sellQuantity);
        existing.totalCost = Math.max(0, existing.totalCost - tradeAmount);
        if (existing.quantity <= 0) {
          portfolio.holdings = portfolio.holdings.filter(
            (h) => h.curveId !== curveId
          );
        }
      }
    }

    // Record trade
    portfolio.trades.unshift({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: (type as TradeRecord["type"]) || "trade",
      symbol,
      side,
      amount: tradeAmount,
      price: tradePrice,
    });

    // Keep last 50 trades
    if (portfolio.trades.length > 50) {
      portfolio.trades = portfolio.trades.slice(0, 50);
    }

    portfolio.updatedAt = Date.now();

    return res.status(200).json(portfolio);
  }

  res.status(405).json({ error: "Method not allowed" });
}
