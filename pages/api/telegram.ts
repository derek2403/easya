import type { NextApiRequest, NextApiResponse } from "next";
import { Telegraf } from "telegraf";

const bot = new Telegraf(process.env.BOT_TOKEN!);

// /start command
bot.start((ctx) => {
  ctx.reply(
    "Welcome to the Trading Bot! 🚀\n\nUse /trade to open the trading panel."
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
