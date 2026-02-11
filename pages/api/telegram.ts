import type { NextApiRequest, NextApiResponse } from "next";
import { Telegraf } from "telegraf";
import { fetchCurves } from "@/lib/subgraph";
import { computeRiskScore } from "@/lib/risk";

const bot = new Telegraf(process.env.BOT_TOKEN!);

// /start command
bot.start((ctx) => {
  ctx.reply(
    "Welcome to the Trading Bot! 🚀\n\n" +
      "/trade — Open the trading panel\n" +
      "/tokens — Browse tokens with risk analysis"
  );
});

// /trade command — opens the Mini App
bot.command("trade", (ctx) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  ctx.reply("Open the trading panel:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📈 Open Trade Panel",
            web_app: { url: `${appUrl}/trade` },
          },
        ],
      ],
    },
  });
});

// /tokens command — list tokens with risk levels
bot.command("tokens", async (ctx) => {
  try {
    await ctx.reply("Fetching tokens...");

    const curves = await fetchCurves(20);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    // Build inline keyboard — 1 button per row, showing name + risk emoji
    const buttons = curves.map((curve) => {
      const risk = computeRiskScore(curve);
      const vol = parseFloat(curve.totalVolumeEth).toFixed(3);
      return [
        {
          text: `${risk.emoji} ${curve.symbol} — ${vol} ETH vol — Risk: ${risk.score}/100`,
          web_app: { url: `${appUrl}/analyze?id=${curve.id}` },
        },
      ];
    });

    await ctx.reply("📊 Latest Tokens (tap to analyze):", {
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (error) {
    console.error("Error fetching tokens:", error);
    ctx.reply("❌ Failed to fetch tokens. Try again later.");
  }
});

// Handle data sent back from the Mini App
bot.on("web_app_data", (ctx) => {
  try {
    const data = JSON.parse(ctx.message.web_app_data.data);
    const { pair, side, amount, entry, takeProfit, stopLoss } = data;

    ctx.reply(
      `✅ Trade Submitted!\n\n` +
        `Pair: ${pair}\n` +
        `Side: ${side.toUpperCase()}\n` +
        `Amount: ${amount}\n` +
        `Entry: ${entry}\n` +
        `Take Profit: ${takeProfit}\n` +
        `Stop Loss: ${stopLoss}`
    );
  } catch {
    ctx.reply("❌ Failed to process trade data.");
  }
});

// Webhook handler for Next.js API route
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Error handling update:", error);
      res.status(500).json({ error: "Failed to handle update" });
    }
  } else {
    res.status(200).json({ status: "Telegram bot webhook is active" });
  }
}
