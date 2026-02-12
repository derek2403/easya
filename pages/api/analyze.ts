import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { fetchCurveById, fetchTrades } from "@/lib/subgraph";
import { computeRiskScore } from "@/lib/risk";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper function to convert IPFS URLs to HTTP URLs
const convertIpfsToHttp = (ipfsUrl: string): string => {
  if (!ipfsUrl) return "";
  if (ipfsUrl.startsWith("ipfs://")) {
    const hash = ipfsUrl.replace("ipfs://", "");
    return `https://olive-defensive-giraffe-83.mypinata.cloud/ipfs/${hash}`;
  }
  return ipfsUrl;
};

// Helper function to fetch metadata from URI
const fetchMetadata = async (
  uri: string
): Promise<{ image: string; description?: string } | null> => {
  try {
    const metadataUrl = convertIpfsToHttp(uri);
    const response = await fetch(metadataUrl);
    if (!response.ok) return null;
    const metadata = await response.json();
    return {
      image: metadata.image || "",
      description: metadata.description || metadata.name || "",
    };
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return null;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const curveId =
    req.method === "POST" ? req.body.curveId : (req.query.id as string);

  if (!curveId) {
    return res.status(400).json({ error: "Missing curveId" });
  }

  try {
    const [curve, trades] = await Promise.all([
      fetchCurveById(curveId),
      fetchTrades(curveId, 30),
    ]);

    if (!curve) {
      return res.status(404).json({ error: "Token not found" });
    }

    const risk = computeRiskScore(curve);

    // Fetch metadata to get image and description
    let imageUrl = "";
    let description = "No description";

    if (curve.uri) {
      const metadata = await fetchMetadata(curve.uri);
      if (metadata) {
        if (metadata.image) {
          imageUrl = convertIpfsToHttp(metadata.image);
        }
        if (metadata.description) {
          description = metadata.description;
        }
      }
    }

    // Build trade summary for AI
    const uniqueTraders = new Set(trades.map((t) => t.trader)).size;
    const buys = trades.filter((t) => t.side === "BUY").length;
    const sells = trades.filter((t) => t.side === "SELL").length;
    const totalTradeVolume = trades.reduce(
      (sum, t) => sum + parseFloat(t.amountEth),
      0
    );

    const prompt = `Analyze this bonding curve token for risk. Be concise (max 200 words). Give a clear verdict.

Token: ${curve.name} (${curve.symbol})
Contract: ${curve.token}
Creator: ${curve.creator}
Created: ${new Date(parseInt(curve.createdAt) * 1000).toISOString()}
Graduated: ${curve.graduated}
Price: $${curve.lastPriceUsd}
Total Volume: ${curve.totalVolumeEth} ETH
Trade Count: ${curve.tradeCount}
Last Trade: ${curve.lastTradeAt ? new Date(parseInt(curve.lastTradeAt) * 1000).toISOString() : "Never"}

Recent trades (last 30):
- Unique traders: ${uniqueTraders}
- Buys: ${buys}, Sells: ${sells}
- Recent volume: ${totalTradeVolume.toFixed(4)} ETH

Risk Score: ${risk.score}/100 (${risk.level})

Factors:
${risk.factors.map((f) => `- ${f.name}: ${f.value} (${f.impact}) — ${f.detail}`).join("\n")}

Provide:
1. Overall risk assessment (1 sentence)
2. Key red flags or positive signals (bullet points)
3. Verdict: SAFE / CAUTION / AVOID`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a crypto token risk analyst. Analyze bonding curve tokens for potential risks like rug pulls, low liquidity, and wash trading. Be direct and honest.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
    });

    const analysis = completion.choices[0].message.content;

    res.status(200).json({
      curve: {
        id: curve.id,
        name: curve.name,
        symbol: curve.symbol,
        token: curve.token,
        creator: curve.creator,
        createdAt: curve.createdAt,
        graduated: curve.graduated,
        lastPriceUsd: curve.lastPriceUsd,
        lastPriceEth: curve.lastPriceEth,
        totalVolumeEth: curve.totalVolumeEth,
        tradeCount: curve.tradeCount,
        lastTradeAt: curve.lastTradeAt,
        uri: curve.uri,
        image: imageUrl,
        description: description,
      },
      risk,
      tradeSummary: {
        uniqueTraders,
        buys,
        sells,
        recentVolume: totalTradeVolume.toFixed(4),
      },
      analysis,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Failed to analyze token" });
  }
}
