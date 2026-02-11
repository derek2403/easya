import type { NextApiRequest, NextApiResponse } from "next";

export interface Startup {
  id: string;
  name: string;
  symbol: string;
  logo: string; // base64 data URL
  description: string;
  socialLinks: { twitter?: string; website?: string };
  creatorId: number;
  creatorAddress: string;
  initialPurchase: number;
  lastPriceUsd: string;
  totalVolumeEth: string;
  tradeCount: string;
  createdAt: number;
}

// In-memory store (demo only — resets on server restart)
const startups: Map<string, Startup> = new Map();

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const {
      name,
      symbol,
      logo,
      description,
      socialLinks,
      creatorId,
      creatorAddress,
      initialPurchase,
    } = req.body;

    if (!name || !symbol) {
      return res.status(400).json({ error: "Name and ticker are required" });
    }

    const id = `startup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startup: Startup = {
      id,
      name,
      symbol: symbol.toUpperCase(),
      logo: logo || "",
      description: description || "",
      socialLinks: socialLinks || {},
      creatorId: creatorId || 0,
      creatorAddress: creatorAddress || "",
      initialPurchase: parseFloat(initialPurchase) || 0,
      lastPriceUsd: "0.001",
      totalVolumeEth: initialPurchase ? String(initialPurchase) : "0",
      tradeCount: initialPurchase ? "1" : "0",
      createdAt: Date.now(),
    };

    startups.set(id, startup);
    return res.status(201).json(startup);
  }

  if (req.method === "GET") {
    const all = Array.from(startups.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
    return res.status(200).json(all);
  }

  res.status(405).json({ error: "Method not allowed" });
}
