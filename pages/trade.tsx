import { useState, useEffect } from "react";
import Head from "next/head";
import Script from "next/script";

interface TradeData {
  pair: string;
  side: "buy" | "sell";
  amount: string;
  entry: string;
  takeProfit: string;
  stopLoss: string;
}

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        ready: () => void;
        sendData: (data: string) => void;
        close: () => void;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        HapticFeedback: {
          impactOccurred: (style: string) => void;
        };
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
      };
    };
  }
}

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT", "DOGE/USDT"];

export default function TradePage() {
  const [trade, setTrade] = useState<TradeData>({
    pair: "BTC/USDT",
    side: "buy",
    amount: "",
    entry: "",
    takeProfit: "",
    stopLoss: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState("");

  const getUserId = (): number => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      return window.Telegram.WebApp.initDataUnsafe.user.id;
    }
    return 12345;
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
    }
    // Fetch balance
    fetch(`/api/portfolio?userId=${getUserId()}`)
      .then((r) => r.json())
      .then((data) => setBalance(data.usdcBalance))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBalanceError("");

    const tradeAmount = parseFloat(trade.amount);
    if (trade.side === "buy" && balance !== null && tradeAmount > balance) {
      setBalanceError(`Insufficient balance. Available: $${balance.toFixed(2)}`);
      return;
    }

    // Update portfolio
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: getUserId(),
          type: "trade",
          symbol: trade.pair.split("/")[0],
          curveId: trade.pair,
          name: trade.pair.split("/")[0],
          side: trade.side,
          amount: trade.amount,
          price: trade.entry,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setBalanceError(err.error || "Trade failed");
        return;
      }
      const updated = await res.json();
      setBalance(updated.usdcBalance);
    } catch {
      // continue anyway for demo
    }

    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.sendData(JSON.stringify(trade));
      setSubmitted(true);
      setTimeout(() => window.Telegram.WebApp.close(), 1500);
    }
  };

  const updateField = (field: keyof TradeData, value: string) => {
    setTrade((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Head>
        <title>Trade Panel</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />

      <div style={styles.container}>
        {submitted ? (
          <div style={styles.success}>
            <p style={{ fontSize: 48 }}>&#10003;</p>
            <p>Trade submitted!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <h2 style={styles.title}>New Trade</h2>

            {balance !== null && (
              <div style={{ textAlign: "center", fontSize: 13, color: "#888", marginBottom: 8 }}>
                Available: <span style={{ color: "#0ecb81", fontWeight: 600, fontFamily: "monospace" }}>${balance.toFixed(2)}</span>
              </div>
            )}

            {balanceError && (
              <div style={{ background: "#f6465d22", border: "1px solid #f6465d44", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#f6465d", textAlign: "center" }}>
                {balanceError}
              </div>
            )}

            {/* Pair selector */}
            <label style={styles.label}>Pair</label>
            <select
              value={trade.pair}
              onChange={(e) => updateField("pair", e.target.value)}
              style={styles.select}
            >
              {PAIRS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* Buy / Sell toggle */}
            <label style={styles.label}>Side</label>
            <div style={styles.toggleGroup}>
              <button
                type="button"
                onClick={() => updateField("side", "buy")}
                style={{
                  ...styles.toggleBtn,
                  ...(trade.side === "buy" ? styles.buyActive : {}),
                }}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => updateField("side", "sell")}
                style={{
                  ...styles.toggleBtn,
                  ...(trade.side === "sell" ? styles.sellActive : {}),
                }}
              >
                SELL
              </button>
            </div>

            {/* Amount */}
            <label style={styles.label}>Amount (USDT)</label>
            <input
              type="number"
              step="any"
              placeholder="100"
              value={trade.amount}
              onChange={(e) => updateField("amount", e.target.value)}
              required
              style={styles.input}
            />

            {/* Entry price */}
            <label style={styles.label}>Entry Price</label>
            <input
              type="number"
              step="any"
              placeholder="Entry price"
              value={trade.entry}
              onChange={(e) => updateField("entry", e.target.value)}
              required
              style={styles.input}
            />

            {/* Take Profit */}
            <label style={styles.label}>Take Profit</label>
            <input
              type="number"
              step="any"
              placeholder="Take profit price"
              value={trade.takeProfit}
              onChange={(e) => updateField("takeProfit", e.target.value)}
              style={styles.input}
            />

            {/* Stop Loss */}
            <label style={styles.label}>Stop Loss</label>
            <input
              type="number"
              step="any"
              placeholder="Stop loss price"
              value={trade.stopLoss}
              onChange={(e) => updateField("stopLoss", e.target.value)}
              style={styles.input}
            />

            <button type="submit" style={styles.submitBtn}>
              Submit Trade
            </button>
          </form>
        )}
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    backgroundColor: "var(--tg-theme-bg-color, #1a1a2e)",
    color: "var(--tg-theme-text-color, #e0e0e0)",
    padding: 16,
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  },
  form: {
    maxWidth: 400,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  title: {
    textAlign: "center",
    margin: "8px 0 16px",
    fontSize: 20,
    fontWeight: 600,
  },
  label: {
    fontSize: 13,
    color: "var(--tg-theme-hint-color, #888)",
    marginTop: 4,
  },
  select: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #333",
    backgroundColor: "var(--tg-theme-secondary-bg-color, #16213e)",
    color: "var(--tg-theme-text-color, #e0e0e0)",
    fontSize: 15,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #333",
    backgroundColor: "var(--tg-theme-secondary-bg-color, #16213e)",
    color: "var(--tg-theme-text-color, #e0e0e0)",
    fontSize: 15,
  },
  toggleGroup: {
    display: "flex",
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    padding: "10px 0",
    borderRadius: 8,
    border: "1px solid #333",
    backgroundColor: "var(--tg-theme-secondary-bg-color, #16213e)",
    color: "var(--tg-theme-text-color, #e0e0e0)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  buyActive: {
    backgroundColor: "#0ecb81",
    color: "#fff",
    border: "1px solid #0ecb81",
  },
  sellActive: {
    backgroundColor: "#f6465d",
    color: "#fff",
    border: "1px solid #f6465d",
  },
  submitBtn: {
    marginTop: 16,
    padding: "12px 0",
    borderRadius: 8,
    border: "none",
    backgroundColor: "var(--tg-theme-button-color, #2481cc)",
    color: "var(--tg-theme-button-text-color, #fff)",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  success: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "60vh",
    fontSize: 20,
    color: "#0ecb81",
  },
};
