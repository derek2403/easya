import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Script from "next/script";

interface Allocation {
  symbol: string;
  name: string;
  weight: number;
  riskScore: number;
  riskLevel: string;
  volumeEth: string;
  tradeCount: number;
  priceUsd: string;
}

interface StrategyData {
  tier: string;
  description: string;
  apr: { min: number; max: number };
  riskLabel: string;
  allocations: Allocation[];
}

const TIER_COLORS: Record<string, string> = {
  conservative: "#0ecb81",
  balanced: "#f0b90b",
  aggressive: "#f6465d",
};

const TIER_ICONS: Record<string, string> = {
  conservative: "🛡️",
  balanced: "⚖️",
  aggressive: "🚀",
};

export default function StrategyPage() {
  const router = useRouter();
  const { tier: queryTier } = router.query;
  const [tier, setTier] = useState<string>((queryTier as string) || "balanced");
  const [data, setData] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [invested, setInvested] = useState(false);
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

  useEffect(() => {
    if (queryTier && typeof queryTier === "string") {
      setTier(queryTier);
    }
  }, [queryTier]);

  useEffect(() => {
    setLoading(true);
    setInvested(false);
    fetch(`/api/strategy?tier=${tier}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.error) setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tier]);

  const color = TIER_COLORS[tier] || "#f0b90b";

  const handleInvest = async () => {
    if (!depositAmount || !data) return;
    setBalanceError("");

    const investAmount = parseFloat(depositAmount);
    if (balance !== null && investAmount > balance) {
      setBalanceError(`Insufficient balance. Available: $${balance.toFixed(2)}`);
      return;
    }

    // Execute portfolio trades for each allocation
    try {
      for (const alloc of data.allocations) {
        const allocAmount = (investAmount * alloc.weight) / 100;
        if (allocAmount <= 0) continue;
        await fetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: getUserId(),
            type: "strategy",
            symbol: alloc.symbol,
            curveId: alloc.symbol,
            name: alloc.name,
            side: "buy",
            amount: allocAmount.toString(),
            price: alloc.priceUsd,
          }),
        });
      }
      // Refresh balance
      const res = await fetch(`/api/portfolio?userId=${getUserId()}`);
      const updated = await res.json();
      setBalance(updated.usdcBalance);
    } catch {
      // continue for demo
    }

    setInvested(true);

    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.sendData(
        JSON.stringify({
          type: "strategy_invest",
          tier,
          amount: depositAmount,
          allocations: data.allocations.map((a) => ({
            symbol: a.symbol,
            weight: a.weight,
          })),
        })
      );
    }
  };

  return (
    <>
      <Head>
        <title>Strategy</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />

      <div style={s.container}>
        {loading && (
          <div style={s.center}>
            <div style={s.spinner} />
            <p style={{ color: "#888", marginTop: 12 }}>
              Computing allocations...
            </p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {!loading && data && (
          <div style={s.content}>
            {/* Tier Selector */}
            <div style={s.tierRow}>
              {(["conservative", "balanced", "aggressive"] as const).map(
                (t) => (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    style={{
                      ...s.tierBtn,
                      ...(tier === t
                        ? {
                            background: TIER_COLORS[t] + "22",
                            color: TIER_COLORS[t],
                            border: `1px solid ${TIER_COLORS[t]}44`,
                          }
                        : {}),
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{TIER_ICONS[t]}</span>
                    <span style={{ fontSize: 11, textTransform: "capitalize" }}>
                      {t}
                    </span>
                  </button>
                )
              )}
            </div>

            {/* Strategy Card */}
            <div
              style={{
                ...s.card,
                background: `linear-gradient(135deg, ${color}11, ${color}05)`,
                border: `1px solid ${color}33`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#666",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      margin: 0,
                    }}
                  >
                    Expected APR
                  </p>
                  <p
                    style={{
                      fontSize: 36,
                      fontWeight: 800,
                      color,
                      margin: "4px 0 0",
                      lineHeight: 1,
                    }}
                  >
                    {data.apr.min}-{data.apr.max}
                    <span style={{ fontSize: 16, color: "#666" }}>%</span>
                  </p>
                </div>
                <div
                  style={{
                    padding: "5px 14px",
                    borderRadius: 20,
                    background: `${color}22`,
                    color,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {data.riskLabel}
                </div>
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: "#888",
                  marginTop: 12,
                  lineHeight: 1.5,
                }}
              >
                {data.description}
              </p>
            </div>

            {/* Allocation Breakdown */}
            <div style={s.card}>
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  margin: "0 0 14px",
                }}
              >
                Portfolio Allocation
              </h3>

              {/* Allocation bar */}
              <div
                style={{
                  display: "flex",
                  height: 8,
                  borderRadius: 4,
                  overflow: "hidden",
                  marginBottom: 16,
                }}
              >
                {data.allocations.map((a, i) => {
                  const colors = [
                    "#6366f1",
                    "#8b5cf6",
                    "#ec4899",
                    "#f59e0b",
                    "#0ecb81",
                    "#2481cc",
                    "#f6465d",
                  ];
                  return (
                    <div
                      key={i}
                      style={{
                        width: `${a.weight}%`,
                        background: colors[i % colors.length],
                        minWidth: 3,
                      }}
                    />
                  );
                })}
              </div>

              {/* Token list */}
              {data.allocations.map((a, i) => {
                const colors = [
                  "#6366f1",
                  "#8b5cf6",
                  "#ec4899",
                  "#f59e0b",
                  "#0ecb81",
                  "#2481cc",
                  "#f6465d",
                ];
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 0",
                      borderTop: i > 0 ? "1px solid #ffffff08" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        background: colors[i % colors.length],
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          {a.symbol}
                        </span>
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: colors[i % colors.length],
                          }}
                        >
                          {a.weight}%
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          color: "#666",
                          marginTop: 2,
                        }}
                      >
                        <span>
                          {a.volumeEth} ETH vol · {a.tradeCount} trades
                        </span>
                        <span>Risk: {a.riskScore}/100</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Deposit & Invest */}
            {!invested ? (
              <div style={s.card}>
                <h3
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    margin: "0 0 12px",
                  }}
                >
                  Deposit
                </h3>
                {balance !== null && (
                  <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
                    Available: <span style={{ color: "#0ecb81", fontWeight: 600, fontFamily: "monospace" }}>${balance.toFixed(2)}</span>
                  </div>
                )}
                {balanceError && (
                  <div style={{ background: "#f6465d22", border: "1px solid #f6465d44", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#f6465d", textAlign: "center", marginBottom: 10 }}>
                    {balanceError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Amount in USDC"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    style={{ ...s.input, flex: 1 }}
                  />
                  <button
                    onClick={handleInvest}
                    disabled={!depositAmount}
                    style={{
                      ...s.investBtn,
                      background: color,
                      opacity: depositAmount ? 1 : 0.4,
                    }}
                  >
                    Invest
                  </button>
                </div>
                {depositAmount && data && (
                  <div style={{ marginTop: 12 }}>
                    <p
                      style={{
                        fontSize: 11,
                        color: "#666",
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        margin: "0 0 6px",
                      }}
                    >
                      Allocation Preview
                    </p>
                    {data.allocations.map((a, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 13,
                          padding: "3px 0",
                          color: "#aaa",
                        }}
                      >
                        <span>{a.symbol}</span>
                        <span style={{ fontFamily: "monospace" }}>
                          $
                          {(
                            (parseFloat(depositAmount) * a.weight) /
                            100
                          ).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  ...s.card,
                  textAlign: "center",
                  background: `linear-gradient(135deg, ${color}11, ${color}05)`,
                  border: `1px solid ${color}33`,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    background: `${color}22`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    color,
                    margin: "0 auto 12px",
                  }}
                >
                  &#10003;
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color }}>
                  ${depositAmount} USDC Invested
                </p>
                <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                  {data.tier.charAt(0).toUpperCase() + data.tier.slice(1)}{" "}
                  strategy · {data.allocations.length} tokens
                </p>
              </div>
            )}
          </div>
        )}
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
    height: "100vh",
  },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid #333",
    borderTopColor: "#2481cc",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  tierRow: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
  },
  tierBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "12px 0",
    borderRadius: 12,
    border: "1px solid #ffffff12",
    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    color: "#888",
    cursor: "pointer",
    fontWeight: 600,
  },
  card: {
    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  input: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #ffffff12",
    background: "var(--tg-theme-bg-color, #0f1117)",
    color: "var(--tg-theme-text-color, #e4e4e7)",
    fontSize: 15,
    boxSizing: "border-box" as const,
  },
  investBtn: {
    padding: "12px 24px",
    borderRadius: 12,
    border: "none",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
