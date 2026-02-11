import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Script from "next/script";

interface RiskFactor {
  name: string;
  value: string;
  impact: "positive" | "neutral" | "negative";
  detail: string;
}

interface AnalysisData {
  curve: {
    id: string;
    name: string;
    symbol: string;
    token: string;
    creator: string;
    createdAt: string;
    graduated: boolean;
    lastPriceUsd: string;
    lastPriceEth: string;
    totalVolumeEth: string;
    tradeCount: string;
    lastTradeAt: string | null;
  };
  risk: {
    score: number;
    level: "low" | "medium" | "high";
    emoji: string;
    factors: RiskFactor[];
  };
  tradeSummary: {
    uniqueTraders: number;
    buys: number;
    sells: number;
    recentVolume: string;
  };
  analysis: string;
}

const RISK_COLORS = {
  low: "#0ecb81",
  medium: "#f0b90b",
  high: "#f6465d",
} as const;

export default function AnalyzePage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/analyze?id=${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load analysis");
        setLoading(false);
      });
  }, [id]);

  const formatAge = useCallback((createdAt: string) => {
    const hours = (Date.now() / 1000 - parseInt(createdAt)) / 3600;
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  }, []);

  const color = data ? RISK_COLORS[data.risk.level] : "#888";

  return (
    <>
      <Head>
        <title>
          {data ? `${data.curve.symbol} Analysis` : "Token Analysis"}
        </title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />

      <div
        style={{
          minHeight: "100vh",
          background: "var(--tg-theme-bg-color, #0f1117)",
          color: "var(--tg-theme-text-color, #e4e4e7)",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Loading */}
        {loading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: "3px solid #333",
                borderTopColor: "#2481cc",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p style={{ fontSize: 15, color: "#888" }}>
              Running AI analysis...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
            }}
          >
            <p style={{ color: "#f6465d", fontSize: 16 }}>{error}</p>
          </div>
        )}

        {/* Content */}
        {data && (
          <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 16px 32px" }}>
            {/* ── Header ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {/* Icon circle */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${color}33, ${color}11)`,
                  border: `1px solid ${color}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 700,
                  color,
                  flexShrink: 0,
                }}
              >
                {data.curve.symbol.slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {data.curve.name}
                </h1>
                <p
                  style={{
                    fontSize: 13,
                    color: "#888",
                    margin: "2px 0 0",
                  }}
                >
                  ${data.curve.symbol}
                  {data.curve.graduated && (
                    <span
                      style={{
                        marginLeft: 8,
                        color: "#0ecb81",
                        fontSize: 11,
                      }}
                    >
                      GRADUATED
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* ── Risk Score Card ── */}
            <div
              style={{
                background: `linear-gradient(135deg, ${color}11, ${color}05)`,
                border: `1px solid ${color}33`,
                borderRadius: 16,
                padding: "20px 20px 16px",
                marginBottom: 12,
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
                      fontSize: 12,
                      color: "#888",
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Risk Score
                  </p>
                  <p
                    style={{
                      fontSize: 44,
                      fontWeight: 800,
                      color,
                      margin: "4px 0 0",
                      lineHeight: 1,
                    }}
                  >
                    {data.risk.score}
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 400,
                        color: "#666",
                      }}
                    >
                      /100
                    </span>
                  </p>
                </div>
                <div
                  style={{
                    padding: "6px 16px",
                    borderRadius: 20,
                    background: `${color}22`,
                    color,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                  }}
                >
                  {data.risk.level.toUpperCase()}
                </div>
              </div>

              {/* Bar */}
              <div
                style={{
                  height: 6,
                  background: "#ffffff12",
                  borderRadius: 3,
                  marginTop: 16,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${data.risk.score}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                    borderRadius: 3,
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
            </div>

            {/* ── Metrics ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {[
                {
                  label: "Price",
                  value: `$${parseFloat(data.curve.lastPriceUsd).toExponential(1)}`,
                },
                {
                  label: "Volume",
                  value: `${parseFloat(data.curve.totalVolumeEth).toFixed(3)} E`,
                },
                { label: "Trades", value: data.curve.tradeCount },
                { label: "Age", value: formatAge(data.curve.createdAt) },
                {
                  label: "Traders",
                  value: String(data.tradeSummary.uniqueTraders),
                },
                {
                  label: "Buy / Sell",
                  value: `${data.tradeSummary.buys} / ${data.tradeSummary.sells}`,
                  color: true,
                },
              ].map((m, i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
                    borderRadius: 12,
                    padding: "12px 10px",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      color: "#666",
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                    }}
                  >
                    {m.label}
                  </p>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      margin: "6px 0 0",
                    }}
                  >
                    {"color" in m && m.color ? (
                      <>
                        <span style={{ color: "#0ecb81" }}>
                          {data.tradeSummary.buys}
                        </span>
                        <span style={{ color: "#666" }}> / </span>
                        <span style={{ color: "#f6465d" }}>
                          {data.tradeSummary.sells}
                        </span>
                      </>
                    ) : (
                      m.value
                    )}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Risk Factors ── */}
            <div
              style={{
                background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
                borderRadius: 16,
                padding: "16px",
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  margin: "0 0 12px",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: "#888",
                }}
              >
                Risk Breakdown
              </h3>
              {data.risk.factors.map((f, i) => {
                const impactColor =
                  f.impact === "positive"
                    ? "#0ecb81"
                    : f.impact === "negative"
                      ? "#f6465d"
                      : "#f0b90b";
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
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: impactColor,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          {f.name}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: impactColor,
                          }}
                        >
                          {f.value}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: 12,
                          color: "#666",
                          margin: "3px 0 0",
                          lineHeight: 1.4,
                        }}
                      >
                        {f.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── AI Analysis ── */}
            <div
              style={{
                background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
                borderRadius: 16,
                padding: "16px",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background:
                      "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "#fff",
                  }}
                >
                  AI
                </div>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    margin: 0,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: "#888",
                  }}
                >
                  AI Analysis
                </h3>
              </div>
              <div style={{ lineHeight: 1.6, fontSize: 14, color: "#ccc" }}>
                {data.analysis.split("\n").map((line, i) => {
                  if (!line.trim()) return <br key={i} />;
                  // Bold lines that start with a number or "Verdict"
                  const isBold =
                    /^\d+\./.test(line.trim()) ||
                    line.trim().startsWith("Verdict") ||
                    line.trim().startsWith("**");
                  const cleaned = line.replace(/\*\*/g, "");
                  return (
                    <p
                      key={i}
                      style={{
                        margin: "4px 0",
                        fontWeight: isBold ? 600 : 400,
                        color: isBold ? "#e4e4e7" : "#aaa",
                      }}
                    >
                      {cleaned}
                    </p>
                  );
                })}
              </div>
            </div>

            {/* ── Contract Info ── */}
            <div
              style={{
                background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
                borderRadius: 16,
                padding: "14px 16px",
                marginBottom: 20,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  color: "#666",
                  margin: "0 0 4px",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                Contract
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "#888",
                  margin: 0,
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                }}
              >
                {data.curve.token}
              </p>
              <p
                style={{
                  fontSize: 10,
                  color: "#666",
                  margin: "10px 0 4px",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                Creator
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "#888",
                  margin: 0,
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                }}
              >
                {data.curve.creator}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
