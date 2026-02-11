import { useState, useEffect } from "react";
import Head from "next/head";
import Script from "next/script";

interface Token {
  id: string;
  name: string;
  symbol: string;
  lastPriceUsd: string;
  totalVolumeEth: string;
}

interface Order {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  triggerPrice: string;
  amount: string;
  status: string;
  createdAt: number;
}

type View = "form" | "orders" | "success";

export default function LimitOrderPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [view, setView] = useState<View>("form");
  const [loading, setLoading] = useState(true);

  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
    }

    // Fetch tokens from subgraph via our analyze endpoint won't work,
    // so we fetch directly
    fetch("/api/strategy?tier=conservative")
      .then((r) => r.json())
      .then((data) => {
        if (data.allTokens) {
          setTokens(data.allTokens);
          if (data.allTokens.length > 0) setSelectedToken(data.allTokens[0]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    loadOrders();
  }, []);

  const loadOrders = () => {
    fetch("/api/limit-order")
      .then((r) => r.json())
      .then(setOrders)
      .catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedToken || !triggerPrice || !amount) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/limit-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: selectedToken.symbol,
          curveId: selectedToken.id,
          side,
          triggerPrice,
          amount,
          currentPrice: selectedToken.lastPriceUsd,
        }),
      });

      if (res.ok) {
        setView("success");
        if (typeof window !== "undefined" && window.Telegram?.WebApp) {
          window.Telegram.WebApp.sendData(
            JSON.stringify({
              type: "limit_order",
              symbol: selectedToken.symbol,
              side,
              triggerPrice,
              amount,
            })
          );
        }
        setTimeout(() => {
          setView("form");
          setTriggerPrice("");
          setAmount("");
          loadOrders();
        }, 2000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOrder = async (id: string) => {
    await fetch(`/api/limit-order?id=${id}`, { method: "DELETE" });
    loadOrders();
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>Limit Order</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <div style={s.container}>
          <div style={s.center}>
            <div style={s.spinner} />
            <p style={{ color: "#888", marginTop: 12 }}>Loading tokens...</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Limit Order</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />

      <div style={s.container}>
        <div style={s.content}>
          {/* Tab switcher */}
          <div style={s.tabs}>
            <button
              onClick={() => setView("form")}
              style={{
                ...s.tab,
                ...(view === "form" || view === "success" ? s.tabActive : {}),
              }}
            >
              New Order
            </button>
            <button
              onClick={() => {
                setView("orders");
                loadOrders();
              }}
              style={{ ...s.tab, ...(view === "orders" ? s.tabActive : {}) }}
            >
              My Orders ({orders.filter((o) => o.status === "pending").length})
            </button>
          </div>

          {/* Success */}
          {view === "success" && (
            <div style={{ ...s.center, height: "50vh" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  background: "#0ecb8122",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  color: "#0ecb81",
                }}
              >
                &#10003;
              </div>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#0ecb81",
                }}
              >
                Order placed!
              </p>
            </div>
          )}

          {/* Order Form */}
          {view === "form" && (
            <form onSubmit={handleSubmit}>
              {/* Token selector */}
              <label style={s.label}>Token</label>
              <select
                value={selectedToken?.id || ""}
                onChange={(e) => {
                  const t = tokens.find((tk) => tk.id === e.target.value);
                  if (t) setSelectedToken(t);
                }}
                style={s.select}
              >
                {tokens.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.symbol} — ${parseFloat(t.lastPriceUsd).toExponential(2)}
                  </option>
                ))}
              </select>

              {/* Current price info */}
              {selectedToken && (
                <div style={s.priceInfo}>
                  <span style={{ color: "#666" }}>Current price</span>
                  <span style={{ fontWeight: 600, fontFamily: "monospace" }}>
                    ${parseFloat(selectedToken.lastPriceUsd).toExponential(4)}
                  </span>
                </div>
              )}

              {/* Side toggle */}
              <label style={s.label}>Side</label>
              <div style={s.toggleRow}>
                <button
                  type="button"
                  onClick={() => setSide("buy")}
                  style={{
                    ...s.toggleBtn,
                    ...(side === "buy"
                      ? { background: "#0ecb81", color: "#fff", border: "1px solid #0ecb81" }
                      : {}),
                  }}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setSide("sell")}
                  style={{
                    ...s.toggleBtn,
                    ...(side === "sell"
                      ? { background: "#f6465d", color: "#fff", border: "1px solid #f6465d" }
                      : {}),
                  }}
                >
                  SELL
                </button>
              </div>

              {/* Trigger price */}
              <label style={s.label}>
                Trigger Price (USD)
                <span style={{ color: "#666", fontWeight: 400 }}>
                  {" "}
                  — {side === "buy" ? "buy when price drops to" : "sell when price rises to"}
                </span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.0000035"
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                required
                style={s.input}
              />

              {/* Amount */}
              <label style={s.label}>Amount (USDT)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                style={s.input}
              />

              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...s.submitBtn,
                  background: side === "buy" ? "#0ecb81" : "#f6465d",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting
                  ? "Placing..."
                  : `Place ${side.toUpperCase()} Limit Order`}
              </button>
            </form>
          )}

          {/* Orders list */}
          {view === "orders" && (
            <div>
              {orders.length === 0 && (
                <div style={{ ...s.center, height: "40vh" }}>
                  <p style={{ color: "#666" }}>No orders yet</p>
                </div>
              )}
              {orders.map((o) => (
                <div key={o.id} style={s.orderCard}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background:
                            o.status === "pending"
                              ? "#f0b90b"
                              : o.status === "filled"
                                ? "#0ecb81"
                                : "#666",
                        }}
                      />
                      <span style={{ fontWeight: 700, fontSize: 15 }}>
                        {o.symbol}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        padding: "3px 10px",
                        borderRadius: 10,
                        fontWeight: 600,
                        background:
                          o.side === "buy" ? "#0ecb8122" : "#f6465d22",
                        color: o.side === "buy" ? "#0ecb81" : "#f6465d",
                      }}
                    >
                      {o.side.toUpperCase()}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 8,
                      fontSize: 13,
                      color: "#888",
                    }}
                  >
                    <span>
                      Trigger: ${o.triggerPrice}
                    </span>
                    <span>{o.amount} USDT</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "#555",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {o.status}
                    </span>
                    {o.status === "pending" && (
                      <button
                        onClick={() => cancelOrder(o.id)}
                        style={s.cancelBtn}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "var(--tg-theme-bg-color, #0f1117)",
    color: "var(--tg-theme-text-color, #e4e4e7)",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  content: { maxWidth: 480, margin: "0 auto", padding: "12px 16px 32px" },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid #333",
    borderTopColor: "#2481cc",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  tabs: { display: "flex", gap: 4, marginBottom: 20 },
  tab: {
    flex: 1,
    padding: "10px 0",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#888",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  tabActive: {
    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    color: "var(--tg-theme-text-color, #e4e4e7)",
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "#888",
    marginTop: 14,
    marginBottom: 6,
  },
  select: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #ffffff12",
    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    color: "var(--tg-theme-text-color, #e4e4e7)",
    fontSize: 14,
    appearance: "none" as const,
  },
  priceInfo: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    fontSize: 13,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #ffffff12",
    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    color: "var(--tg-theme-text-color, #e4e4e7)",
    fontSize: 15,
    boxSizing: "border-box" as const,
  },
  toggleRow: { display: "flex", gap: 8 },
  toggleBtn: {
    flex: 1,
    padding: "10px 0",
    borderRadius: 10,
    border: "1px solid #ffffff12",
    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    color: "#888",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  submitBtn: {
    width: "100%",
    marginTop: 20,
    padding: "14px 0",
    borderRadius: 12,
    border: "none",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  orderCard: {
    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  cancelBtn: {
    padding: "4px 14px",
    borderRadius: 8,
    border: "1px solid #f6465d44",
    background: "transparent",
    color: "#f6465d",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
};
