import type { NextApiRequest, NextApiResponse } from "next";

// Mock wallet connection — stores nothing, just returns success
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { encryptedKey } = req.body;
    if (!encryptedKey) {
      return res.status(400).json({ error: "Missing encrypted key" });
    }

    // Mock: pretend we stored the encrypted key
    return res.status(200).json({
      success: true,
      walletAddress: "0x2345a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d33690",
      message: "Wallet connected successfully",
    });
  }

  res.status(405).json({ error: "Method not allowed" });
}
