/**
 * One-time script to register the Telegram webhook.
 *
 * Usage:
 *   npx tsx scripts/set-webhook.ts
 *
 * Make sure .env.local has BOT_TOKEN and NEXT_PUBLIC_APP_URL set.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (this script runs outside Next.js)
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
  console.error("❌ Set BOT_TOKEN in .env.local first");
  process.exit(1);
}

if (!APP_URL || APP_URL.includes("your-ngrok-url")) {
  console.error("❌ Set NEXT_PUBLIC_APP_URL in .env.local first");
  process.exit(1);
}

const webhookUrl = `${APP_URL}/api/telegram`;

async function main() {
  console.log(`Setting webhook to: ${webhookUrl}`);

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
  );
  const data = await res.json();

  if (data.ok) {
    console.log("✅ Webhook set successfully!");
    console.log(data);
  } else {
    console.error("❌ Failed to set webhook:");
    console.error(data);
  }
}

main();
