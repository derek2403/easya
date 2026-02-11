import { useState, useEffect } from "react";
import Head from "next/head";
import Script from "next/script";

interface Holding {
  curveId: string;
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  totalCost: number;
}

interface TradeRecord {
  id: string;
  timestamp: number;
  type: "trade" | "limit_order" | "strategy" | "reserve";
  symbol: string;
  side: "buy" | "sell";
  amount: number;
  price: number;
}

interface LimitOrder {
  id: string;
  symbol: string;
  curveId: string;
  side: "buy" | "sell";
  triggerPrice: string;
  amount: string;
  currentPrice: string;
  orderType: "entry" | "tp" | "sl";
  status: "pending" | "filled" | "cancelled";
  createdAt: number;
}

interface Portfolio {
  userId: number;
  walletAddress: string;
  usdcBalance: number;
  holdings: Holding[];
  trades: TradeRecord[];
}

interface CurvePrice {
  id: string;
  lastPriceUsd: string;
}

export default function ProfilePage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pendingOrders, setPendingOrders] = useState<LimitOrder[]>([]);

  const getUserId = (): number => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      return window.Telegram.WebApp.initDataUnsafe.user.id;
    }
    return 12345; // Fallback for dev/testing
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
    }
    loadPortfolio();
  }, []);

  const loadPortfolio = async () => {
    setLoading(true);
    try {
      const userId = getUserId();
      const [portfolioRes, pricesRes, ordersRes] = await Promise.all([
        fetch(`/api/portfolio?userId=${userId}`),
        fetch("/api/strategy?tier=conservative"),
        fetch("/api/limit-order"),
      ]);

      const portfolioData = await portfolioRes.json();
      setPortfolio(portfolioData);

      const pricesData = await pricesRes.json();
      if (pricesData.allTokens) {
        const priceMap: Record<string, number> = {};
        for (const token of pricesData.allTokens) {
          priceMap[token.id] = parseFloat(token.lastPriceUsd);
        }
        setPrices(priceMap);
      }

      const ordersData = await ordersRes.json();
      if (Array.isArray(ordersData)) {
        setPendingOrders(
          ordersData.filter(
            (o: LimitOrder) => o.status === "pending" && o.orderType === "entry"
          )
        );
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (!portfolio) return;
    navigator.clipboard.writeText(portfolio.walletAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const getHoldingValue = (h: Holding) => {
    const currentPrice = prices[h.curveId] || h.avgBuyPrice;
    return h.quantity * currentPrice;
  };

  const getHoldingPnl = (h: Holding) => {
    const currentValue = getHoldingValue(h);
    return currentValue - h.totalCost;
  };

  const getHoldingPnlPercent = (h: Holding) => {
    if (h.totalCost === 0) return 0;
    return ((getHoldingValue(h) - h.totalCost) / h.totalCost) * 100;
  };

  const getTotalPortfolioValue = () => {
    if (!portfolio) return 0;
    const holdingsValue = portfolio.holdings.reduce(
      (sum, h) => sum + getHoldingValue(h),
      0
    );
    return portfolio.usdcBalance + holdingsValue;
  };

  const getTotalPnl = () => {
    const total = getTotalPortfolioValue();
    return total - 100; // Started with $100
  };

  const getTotalPnlPercent = () => {
    const total = getTotalPortfolioValue();
    return ((total - 100) / 100) * 100;
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>Profile</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <div style={s.container}>
          <div style={s.center}>
            <div style={s.spinner} />
            <p style={{ fontSize: 15, color: "#888" }}>Loading profile...</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        </div>
      </>
    );
  }

  if (!portfolio) {
    return (
      <>
        <Head>
          <title>Profile</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <div style={s.container}>
          <div style={s.center}>
            <p style={{ color: "#666" }}>Failed to load profile</p>
          </div>
        </div>
      </>
    );
  }

  const totalValue = getTotalPortfolioValue();
  const totalPnl = getTotalPnl();
  const totalPnlPct = getTotalPnlPercent();
  const pnlColor = totalPnl >= 0 ? "#0ecb81" : "#f6465d";

  return (
    <>
      <Head>
        <title>Profile</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />

      <div style={s.container}>
        <div style={s.content}>
          {/* Wallet Card */}
          <div style={s.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    background: "#2481cc22",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                  }}
                >
                  &#128176;
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontFamily: "monospace",
                      color: "#888",
                      margin: 0,
                    }}
                  >
                    {truncateAddress(portfolio.walletAddress)}
                  </p>
                  <p
                    style={{
                      fontSize: 10,
                      color: "#666",
                      margin: "2px 0 0",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Base Network
                  </p>
                </div>
              </div>
              <button onClick={copyAddress} style={s.copyBtn}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <p
              style={{
                fontSize: 36,
                fontWeight: 800,
                margin: 0,
                lineHeight: 1,
              }}
            >
              ${totalValue.toFixed(2)}
            </p>
            <p
              style={{
                fontSize: 10,
                color: "#666",
                margin: "6px 0 0",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Total Portfolio Value
            </p>
            <div
              style={{
                display: "inline-block",
                marginTop: 8,
                padding: "4px 12px",
                borderRadius: 12,
                background: `${pnlColor}22`,
                color: pnlColor,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} (
              {totalPnl >= 0 ? "+" : ""}
              {totalPnlPct.toFixed(1)}%)
            </div>
          </div>

          {/* USDC Balance */}
          <div style={s.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    background: "#2775ca22",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#2775ca",
                  }}
                >
                  $
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                    USDC
                  </p>
                  <p style={{ fontSize: 11, color: "#666", margin: "3px 0 0" }}>
                    Available balance
                  </p>
                </div>
              </div>
              <p
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  margin: 0,
                  fontFamily: "monospace",
                }}
              >
                ${portfolio.usdcBalance.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Holdings */}
          <h3 style={s.sectionTitle}>
            Holdings{" "}
            {portfolio.holdings.length > 0 && (
              <span style={{ color: "#555" }}>
                ({portfolio.holdings.length})
              </span>
            )}
          </h3>

          {portfolio.holdings.length === 0 ? (
            <div style={{ ...s.card, textAlign: "center" }}>
              <p style={{ color: "#666", fontSize: 13, margin: 0 }}>
                No holdings yet. Start trading to build your portfolio.
              </p>
            </div>
          ) : (
            portfolio.holdings.map((h) => {
              const value = getHoldingValue(h);
              const pnl = getHoldingPnl(h);
              const pnlPct = getHoldingPnlPercent(h);
              const hColor = pnl >= 0 ? "#0ecb81" : "#f6465d";
              const currentPrice = prices[h.curveId] || h.avgBuyPrice;

              return (
                <div key={h.curveId} style={s.card}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                        {h.symbol}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: "#666",
                          margin: "3px 0 0",
                        }}
                      >
                        {h.name}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          margin: 0,
                          fontFamily: "monospace",
                        }}
                      >
                        ${value.toFixed(2)}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: hColor,
                          margin: "3px 0 0",
                          fontWeight: 700,
                        }}
                      >
                        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} (
                        {pnl >= 0 ? "+" : ""}
                        {pnlPct.toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 10,
                      fontSize: 11,
                      color: "#666",
                    }}
                  >
                    <span>
                      {h.quantity.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}{" "}
                      tokens
                    </span>
                    <span>
                      Avg: ${h.avgBuyPrice.toExponential(2)} | Now: $
                      {currentPrice.toExponential(2)}
                    </span>
                  </div>

                  {/* Mini P&L bar */}
                  <div
                    style={{
                      marginTop: 8,
                      height: 4,
                      borderRadius: 2,
                      background: "#ffffff08",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(5, 50 + pnlPct / 2))}%`,
                        background: hColor,
                        borderRadius: 2,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}

          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <>
              <h3 style={s.sectionTitle}>
                Open Orders{" "}
                <span style={{ color: "#555" }}>
                  ({pendingOrders.length})
                </span>
              </h3>
              {pendingOrders.map((order) => (
                <div key={order.id} style={s.card}>
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
                          background: "#f0b90b",
                        }}
                      />
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                          {order.side.toUpperCase()} {order.symbol}
                        </p>
                        <p style={{ fontSize: 11, color: "#666", margin: "3px 0 0" }}>
                          Trigger: ${parseFloat(order.triggerPrice) < 0.0001
                            ? parseFloat(order.triggerPrice).toExponential(2)
                            : parseFloat(order.triggerPrice).toPrecision(4)}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          margin: 0,
                          fontFamily: "monospace",
                        }}
                      >
                        ${parseFloat(order.amount).toFixed(2)}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: "#f0b90b",
                          margin: "2px 0 0",
                          fontWeight: 600,
                        }}
                      >
                        Pending
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Recent Activity */}
          {portfolio.trades.length > 0 && (
            <>
              <h3 style={s.sectionTitle}>Recent Activity</h3>
              <div style={s.card}>
                {portfolio.trades.slice(0, 10).map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      borderTop: "1px solid #ffffff08",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          background:
                            t.type === "reserve"
                              ? "#f0b90b"
                              : t.side === "buy"
                                ? "#0ecb81"
                                : "#f6465d",
                        }}
                      />
                      <div>
                        <p
                          style={{
                            fontSize: 13,
                            margin: 0,
                            fontWeight: 600,
                          }}
                        >
                          {t.type === "reserve"
                            ? `Order placed for ${t.symbol}`
                            : t.side === "buy"
                              ? `Bought ${t.symbol}`
                              : `Sold ${t.symbol}`}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: "#666",
                            margin: "2px 0 0",
                          }}
                        >
                          {t.type === "reserve"
                            ? "Limit order · Pending"
                            : t.type === "limit_order"
                              ? "Limit order"
                              : t.type === "strategy"
                                ? "Strategy"
                                : "Market trade"}{" "}
                          · {formatTime(t.timestamp)}
                        </p>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "monospace",
                        color:
                          t.type === "reserve"
                            ? "#f0b90b"
                            : t.side === "buy"
                              ? "#f6465d"
                              : "#0ecb81",
                      }}
                    >
                      {t.type === "reserve" ? "" : t.side === "buy" ? "-" : "+"}${t.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Refresh button */}
          <button onClick={loadPortfolio} style={s.refreshBtn}>
            Refresh Portfolio
          </button>

          <p
            style={{
              fontSize: 10,
              color: "#666",
              textAlign: "center",
              marginTop: 8,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
          </p>
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
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  content: { maxWidth: 480, margin: "0 auto", padding: "12px 16px 32px" },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    gap: 16,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #333",
    borderTopColor: "#2481cc",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  card: {
    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    margin: "20px 0 14px",
  },
  copyBtn: {
    padding: "4px 12px",
    borderRadius: 12,
    border: "none",
    background: "#2481cc22",
    color: "#2481cc",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  refreshBtn: {
    width: "100%",
    marginTop: 20,
    padding: "12px 0",
    borderRadius: 12,
    border: "none",
    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    color: "#888",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};
