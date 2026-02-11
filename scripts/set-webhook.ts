/**
 * Sets up the Telegram bot: webhook, commands menu, and description.
 *
 * Usage:
 *   npx tsx scripts/set-webhook.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(__dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...rest] = trimmed.split("=");
  env[key] = rest.join("=");
}

const BOT_TOKEN = env.BOT_TOKEN;
const APP_URL = env.NEXT_PUBLIC_APP_URL;

if (!BOT_TOKEN || BOT_TOKEN === "your_bot_token_here") {
  console.error("Set BOT_TOKEN in .env.local first");
  process.exit(1);
}

if (!APP_URL || APP_URL.includes("your-ngrok-url")) {
  console.error("Set NEXT_PUBLIC_APP_URL in .env.local first");
  process.exit(1);
}

const api = (method: string, body?: Record<string, unknown>) =>
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());

async function main() {
  // 1. Set webhook
  console.log("Setting webhook...");
  const wh = await api("setWebhook", {
    url: `${APP_URL}/api/telegram`,
  });
  console.log(wh.ok ? "  Webhook set" : "  Webhook failed", wh);

  // 2. Set bot commands (shows in the menu)
  console.log("Setting commands...");
  const cmds = await api("setMyCommands", {
    commands: [
      { command: "start", description: "Welcome & help" },
      { command: "profile", description: "Wallet & portfolio" },
      { command: "tokens", description: "Browse tokens with AI risk scores" },
      { command: "trade", description: "Submit a market trade" },
      { command: "limit", description: "Set a limit order" },
      { command: "strategy", description: "Auto-invest portfolios" },
      { command: "launch", description: "Launch a new startup token" },
    ],
  });
  console.log(cmds.ok ? "  Commands set" : "  Commands failed", cmds);

  // 3. Set bot description (shown before user starts the bot)
  console.log("Setting description...");
  const desc = await api("setMyDescription", {
    description:
      "Your AI-powered crypto trading assistant on Robin Pump.\n\n" +
      "📊 Token Scanner — AI risk scores for every token\n" +
      "📈 Trade & Limit Orders — set entry, TP & SL levels\n" +
      "💼 Strategy Portfolios — auto-invest across risk tiers\n" +
      "🚀 Launch — create your own startup token\n" +
      "👤 Portfolio — track holdings, PnL & activity\n\n" +
      "Tap Start to begin.",
  });
  console.log(desc.ok ? "  Description set" : "  Description failed", desc);

  // 4. Set short description (shown in chat list / sharing)
  const sdesc = await api("setMyShortDescription", {
    short_description: "AI-powered crypto trading on Base — analyze, trade & launch tokens",
  });
  console.log(
    sdesc.ok ? "  Short description set" : "  Short description failed",
    sdesc
  );

  // 5. Set the Menu button to open the Mini App
  console.log("Setting menu button...");
  const menu = await api("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Open App",
      web_app: { url: `${APP_URL}/profile` },
    },
  });
  console.log(menu.ok ? "  Menu button set" : "  Menu button failed", menu);

  console.log("\nDone! Bot is fully configured.");
}

main();
