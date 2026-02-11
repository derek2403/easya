import type { NextApiRequest, NextApiResponse } from "next";

export interface LimitOrder {
  id: string;
  symbol: string;
  curveId: string;
  side: "buy" | "sell";
  triggerPrice: string;
  amount: string;
  currentPrice: string;
  status: "pending" | "filled" | "cancelled";
  createdAt: number;
}

// In-memory store (demo only — resets on server restart)
const orders: Map<string, LimitOrder> = new Map();

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { symbol, curveId, side, triggerPrice, amount, currentPrice } =
      req.body;

    if (!symbol || !curveId || !side || !triggerPrice || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const id = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const order: LimitOrder = {
      id,
      symbol,
      curveId,
      side,
      triggerPrice,
      amount,
      currentPrice: currentPrice || "0",
      status: "pending",
      createdAt: Date.now(),
    };

    orders.set(id, order);
    return res.status(201).json(order);
  }

  if (req.method === "GET") {
    const all = Array.from(orders.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
    return res.status(200).json(all);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (typeof id === "string" && orders.has(id)) {
      const order = orders.get(id)!;
      order.status = "cancelled";
      return res.status(200).json(order);
    }
    return res.status(404).json({ error: "Order not found" });
  }

  res.status(405).json({ error: "Method not allowed" });
}
