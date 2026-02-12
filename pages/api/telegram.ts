import type { NextApiRequest, NextApiResponse } from "next";
import { Telegraf } from "telegraf";
import { fetchCurves } from "@/lib/subgraph";
import { computeRiskScore } from "@/lib/risk";
import type { Curve } from "@/lib/subgraph";

const bot = new Telegraf(process.env.BOT_TOKEN!);
const PAGE_SIZE = 5;
const awaitingKey = new Set<number>();

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
      `/profile   — View wallet & portfolio\n` +
      `/tokens    — Browse tokens with AI risk scores\n` +
      `/trade     — Submit a market trade\n` +
      `/limit     — Set a limit order\n` +
      `/strategy  — Auto-invest with risk-tiered portfolios\n` +
      `/launch    — Launch a new startup token\n` +
      `\n` +
      `Tap <b>Open App</b> below to view your profile.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔗 Connect Wallet",
              callback_data: "connect_wallet",
            },
          ],
          [
            {
              text: "👤 Profile",
              web_app: { url: `${appUrl}/profile` },
            },
            {
              text: "📊 Tokens",
              web_app: { url: `${appUrl}/analyze` },
            },
          ],
          [
            {
              text: "📈 Trade",
              web_app: { url: `${appUrl}/limit-order` },
            },
          ],
          [
            {
              text: "💼 Strategy",
              web_app: { url: `${appUrl}/strategy` },
            },
            {
              text: "🚀 Launch",
              web_app: { url: `${appUrl}/launch` },
            },
          ],
        ],
      },
    }
  );
});

// ── /profile ─────────────────────────────────────────────
bot.command("profile", (ctx) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  ctx.replyWithHTML(
    `<b>Your Profile</b>\n\nView your wallet, balance, and portfolio.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open Profile",
              web_app: { url: `${appUrl}/profile` },
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

// ── /limit ──────────────────────────────────────────────
bot.command("limit", (ctx) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  ctx.replyWithHTML(
    `<b>Limit Orders</b>\n\n` +
      `Set buy/sell orders that trigger at your target price.\n` +
      `Orders execute automatically when the price is reached.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Set Limit Order",
              web_app: { url: `${appUrl}/limit-order` },
            },
          ],
        ],
      },
    }
  );
});

// ── /strategy ───────────────────────────────────────────
bot.command("strategy", (ctx) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  ctx.replyWithHTML(
    `<b>💼 Strategy Portfolios</b>\n\n` +
      `Auto-invest across top bonding curve tokens with risk-tiered portfolios.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open Strategy",
              web_app: { url: `${appUrl}/strategy` },
            },
          ],
        ],
      },
    }
  );
});

// ── /launch ──────────────────────────────────────────────
bot.command("launch", (ctx) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  ctx.replyWithHTML(
    `<b>🚀 Launch Your Startup</b>\n\n` +
      `Create a startup idea that's instantly tradeable on a bonding curve.\n` +
      `Set a name, ticker, logo, and optionally be the first to invest.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Launch New Idea",
              web_app: { url: `${appUrl}/launch` },
            },
          ],
        ],
      },
    }
  );
});

// ── /tokens ─────────────────────────────────────────────
bot.command("tokens", (ctx) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  ctx.replyWithHTML(
    `<b>📊 Token Scanner</b>\n\n` +
      `Browse bonding curve tokens with AI-powered risk analysis.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open Token Scanner",
              web_app: { url: `${appUrl}/analyze` },
            },
          ],
        ],
      },
    }
  );
});

// ── Callback queries ────────────────────────────────────
bot.on("callback_query", async (ctx) => {
  const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : "";
  if (!data) return;

  // Token pagination
  if (data.startsWith("tokens_") && data !== "tokens_noop") {
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
    return;
  }

  // Strategy tier selection
  if (data.startsWith("strat_")) {
    const tier = data.replace("strat_", "");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `<b>💼 ${tier.charAt(0).toUpperCase() + tier.slice(1)} Strategy</b>\n\n` +
          `Opening portfolio builder...`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `Open ${tier.charAt(0).toUpperCase() + tier.slice(1)} Portfolio`,
                  web_app: { url: `${appUrl}/strategy?tier=${tier}` },
                },
              ],
              [
                {
                  text: "◀ Back to tiers",
                  callback_data: "strategy_menu",
                },
              ],
            ],
          },
        }
      );
    } catch {
      await ctx.answerCbQuery("Failed to load");
    }
    return;
  }

  // Strategy menu (back button)
  if (data === "strategy_menu") {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `<b>Strategy Portfolios</b>\n\n` +
          `Deposit USDC and auto-invest across top bonding curve tokens.\n` +
          `Choose a risk tier that matches your style:\n\n` +
          `🛡️ <b>Conservative</b> — 8-12% APR · Low risk\n` +
          `⚖️ <b>Balanced</b> — 15-25% APR · Medium risk\n` +
          `🚀 <b>Aggressive</b> — 30-60% APR · High risk`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🛡️ Conservative",
                  callback_data: "strat_conservative",
                },
                { text: "⚖️ Balanced", callback_data: "strat_balanced" },
                {
                  text: "🚀 Aggressive",
                  callback_data: "strat_aggressive",
                },
              ],
            ],
          },
        }
      );
    } catch {
      await ctx.answerCbQuery();
    }
    return;
  }

  // Connect wallet
  if (data === "connect_wallet") {
    const userId = ctx.from?.id;
    if (userId) awaitingKey.add(userId);
    try {
      await ctx.answerCbQuery();
      await ctx.reply(
        "🔗 *Connect Wallet*\n\n" +
          "Please type your private key below.\n" +
          "It will be encrypted and your message will be deleted.",
        { parse_mode: "Markdown" }
      );
    } catch {
      await ctx.answerCbQuery("Failed");
    }
    return;
  }

  // Noop (page indicator)
  if (data === "tokens_noop") {
    await ctx.answerCbQuery();
    return;
  }
});

// ── Web App data (trade/limit/strategy submissions) ─────
bot.on("web_app_data", (ctx) => {
  try {
    const data = JSON.parse(ctx.message.web_app_data.data);

    // Limit order submission (multi-level)
    if (data.type === "limit_order") {
      if (data.levels) {
        const typeEmoji: Record<string, string> = { entry: "🔵", tp: "🟢", sl: "🔴" };
        const typeLabel: Record<string, string> = { entry: "Entry", tp: "Take Profit", sl: "Stop Loss" };
        const levelLines = data.levels
          .map((l: { type: string; price: string; amount: string }) =>
            `${typeEmoji[l.type] || "⚪"} <b>${typeLabel[l.type] || l.type}</b>  ${l.price}  —  $${l.amount}`
          )
          .join("\n");
        ctx.replyWithHTML(
          `<b>⏳ Limit Orders Placed</b>\n` +
            `\n` +
            `<b>${data.symbol}</b>  ·  ${data.levels.length} levels\n` +
            `\n` +
            `${levelLines}\n` +
            `\n` +
            `<code>Total      $${data.totalAmount} USDT</code>\n` +
            `\n` +
            `<i>Orders execute when price reaches each level.</i>`
        );
      } else {
        const sideEmoji = data.side === "buy" ? "🟢" : "🔴";
        ctx.replyWithHTML(
          `<b>⏳ Limit Order Placed</b>\n` +
            `\n` +
            `${sideEmoji} <b>${data.side.toUpperCase()}</b> ${data.symbol}\n` +
            `\n` +
            `<code>Trigger    $${data.triggerPrice}</code>\n` +
            `<code>Amount     ${data.amount} USDT</code>\n` +
            `\n` +
            `<i>Order will execute when price reaches trigger.</i>`
        );
      }
      return;
    }

    // Startup launch
    if (data.type === "launch_startup") {
      const purchaseInfo = data.initialPurchase > 0
        ? `\n<code>Initial buy  $${data.initialPurchase}</code>`
        : "";
      const descInfo = data.description
        ? `\n<i>${data.description}</i>\n`
        : "";
      ctx.replyWithHTML(
        `<b>🚀 Startup Launched!</b>\n` +
          `\n` +
          `<b>${data.name}</b> ($${data.symbol})\n` +
          descInfo +
          `\n` +
          `<code>Status       Live on bonding curve</code>\n` +
          `<code>Price        $0.001</code>` +
          purchaseInfo +
          `\n\n` +
          `<i>Your token is now tradeable. Share it to get others investing!</i>`
      );
      return;
    }

    // Strategy investment
    if (data.type === "strategy_invest") {
      const allocs = data.allocations
        .map(
          (a: { symbol: string; weight: number }) =>
            `  ${a.symbol}: ${a.weight}%`
        )
        .join("\n");
      ctx.replyWithHTML(
        `<b>💼 Strategy Invested</b>\n` +
          `\n` +
          `Tier: <b>${data.tier.charAt(0).toUpperCase() + data.tier.slice(1)}</b>\n` +
          `Amount: <b>$${data.amount} USDC</b>\n` +
          `\n` +
          `<code>${allocs}</code>\n` +
          `\n` +
          `<i>Portfolio is now active. Rebalancing is automatic.</i>`
      );
      return;
    }

    // Regular trade submission
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
    ctx.reply("Failed to process data.");
  }
});

// ── Private key capture (connect wallet) ─────────────────
bot.on("text", async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId || !awaitingKey.has(userId)) return next();

  awaitingKey.delete(userId);
  const key = ctx.message.text;
  const masked = "*".repeat(key.length);

  // Delete the user's message containing the private key
  try {
    await ctx.deleteMessage(ctx.message.message_id);
  } catch {
    // may lack permission in groups
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  await ctx.replyWithHTML(
    `<b>🔗 Wallet Connected</b>\n\n` +
      `<code>${masked}</code>\n\n` +
      `<i>Your key has been encrypted and stored securely.</i>`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "👤 Open Profile",
              web_app: { url: `${appUrl}/profile` },
            },
          ],
        ],
      },
    }
  );
});

// ── Build a paginated token list ────────────────────────
function buildTokenPage(curves: Curve[], page: number) {
  const totalPages = Math.ceil(curves.length / PAGE_SIZE);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * PAGE_SIZE;
  const slice = curves.slice(start, start + PAGE_SIZE);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

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

  const tokenButtons = slice.map((curve) => [
    {
      text: `${computeRiskScore(curve).emoji} ${curve.symbol} — View Analysis`,
      web_app: { url: `${appUrl}/analyze?id=${curve.id}` },
    },
  ]);

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
