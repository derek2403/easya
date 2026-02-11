import type { NextApiRequest, NextApiResponse } from "next";
import { Telegraf } from "telegraf";
import { fetchCurves } from "@/lib/subgraph";
import { computeRiskScore } from "@/lib/risk";
import type { Curve } from "@/lib/subgraph";

const bot = new Telegraf(process.env.BOT_TOKEN!);
const PAGE_SIZE = 5;

// ── /start ──────────────────────────────────────────────
bot.start((ctx) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  ctx.replyWithHTML(
    `<b>Welcome to EasyA Trading Bot</b>\n` +
      `\n` +
      `Your AI-powered crypto assistant for bonding curve tokens.\n` +
      `\n` +
      `<b>What I can do:</b>\n` +
      `\n` +
      `/tokens — Browse latest tokens with AI risk scores\n` +
      `/trade  — Open the trading panel\n` +
      `\n` +
      `Tap <b>Menu</b> below to open the app anytime.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📊 Browse Tokens",
              callback_data: "tokens_0",
            },
            {
              text: "📈 Trade",
              web_app: { url: `${appUrl}/trade` },
            },
          ],
        ],
      },
    }
  );
});

// ── /trade ──────────────────────────────────────────────
bot.command("trade", (ctx) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  ctx.replyWithHTML(
    `<b>Trading Panel</b>\n\nSubmit trades directly from Telegram.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open Trade Panel",
              web_app: { url: `${appUrl}/trade` },
            },
          ],
        ],
      },
    }
  );
});

// ── /tokens ─────────────────────────────────────────────
bot.command("tokens", async (ctx) => {
  try {
    const curves = await fetchCurves(30);
    const { text, keyboard } = buildTokenPage(curves, 0);
    await ctx.replyWithHTML(text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    console.error("Error fetching tokens:", error);
    ctx.reply("Failed to fetch tokens. Try again later.");
  }
});

// ── Pagination callback ────────────────────────────────
bot.on("callback_query", async (ctx) => {
  const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : "";
  if (!data?.startsWith("tokens_")) return;

  const page = parseInt(data.split("_")[1]);

  try {
    await ctx.answerCbQuery();
    const curves = await fetchCurves(30);
    const { text, keyboard } = buildTokenPage(curves, page);
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    console.error("Pagination error:", error);
    await ctx.answerCbQuery("Failed to load page");
  }
});

// ── Web App data (trade submission) ────────────────────
bot.on("web_app_data", (ctx) => {
  try {
    const data = JSON.parse(ctx.message.web_app_data.data);
    const { pair, side, amount, entry, takeProfit, stopLoss } = data;

    const sideEmoji = side === "buy" ? "🟢" : "🔴";
    ctx.replyWithHTML(
      `<b>Trade Submitted</b>\n` +
        `\n` +
        `${sideEmoji} <b>${side.toUpperCase()}</b> ${pair}\n` +
        `\n` +
        `<code>Amount     ${amount} USDT</code>\n` +
        `<code>Entry      ${entry}</code>\n` +
        `<code>TP         ${takeProfit || "—"}</code>\n` +
        `<code>SL         ${stopLoss || "—"}</code>`
    );
  } catch {
    ctx.reply("Failed to process trade data.");
  }
});

// ── Build a paginated token list ────────────────────────
function buildTokenPage(curves: Curve[], page: number) {
  const totalPages = Math.ceil(curves.length / PAGE_SIZE);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * PAGE_SIZE;
  const slice = curves.slice(start, start + PAGE_SIZE);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Build the formatted message
  let text = `<b>📊 Token Scanner</b>  ·  Page ${safePage + 1}/${totalPages}\n\n`;

  for (const curve of slice) {
    const risk = computeRiskScore(curve);
    const vol = parseFloat(curve.totalVolumeEth);
    const volStr = vol >= 1 ? vol.toFixed(2) : vol.toFixed(4);
    const trades = parseInt(curve.tradeCount);
    const ageHrs = (Date.now() / 1000 - parseInt(curve.createdAt)) / 3600;
    const ageStr =
      ageHrs < 1
        ? `${Math.round(ageHrs * 60)}m`
        : ageHrs < 24
          ? `${Math.round(ageHrs)}h`
          : `${Math.round(ageHrs / 24)}d`;

    text +=
      `${risk.emoji} <b>${curve.symbol}</b>  ·  ${curve.name}\n` +
      `   Vol: <code>${volStr} ETH</code>  ·  Trades: <code>${trades}</code>  ·  Age: <code>${ageStr}</code>\n` +
      `   Risk: <b>${risk.score}/100</b> ${risk.level.toUpperCase()}\n\n`;
  }

  text += `<i>Tap a token below for detailed AI analysis</i>`;

  // Token detail buttons (one per token)
  const tokenButtons = slice.map((curve) => [
    {
      text: `${computeRiskScore(curve).emoji} ${curve.symbol} — View Analysis`,
      web_app: { url: `${appUrl}/analyze?id=${curve.id}` },
    },
  ]);

  // Pagination nav
  const navRow: { text: string; callback_data: string }[] = [];
  if (safePage > 0) {
    navRow.push({ text: "◀ Prev", callback_data: `tokens_${safePage - 1}` });
  }
  navRow.push({
    text: `${safePage + 1} / ${totalPages}`,
    callback_data: "tokens_noop",
  });
  if (safePage < totalPages - 1) {
    navRow.push({ text: "Next ▶", callback_data: `tokens_${safePage + 1}` });
  }

  const keyboard = [...tokenButtons, navRow];

  return { text, keyboard };
}

// ── Webhook handler ─────────────────────────────────────
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
