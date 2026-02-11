import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Script from "next/script";
import Image from "next/image";

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
    uri: string;
    image: string;
    description: string;
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
    const now = Date.now();
    const created = parseInt(createdAt) * 1000;
    const diff = Math.floor((now - created) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }, []);

  const formatNumber = useCallback((num: string | number): string => {
    const n = typeof num === "string" ? parseFloat(num) : num;
    if (isNaN(n)) return "0";
    if (n === 0) return "0";

    if (n < 0.000001) {
      const str = n.toFixed(20);
      return str.replace(/\.?0+$/, "");
    }

    if (n < 1) return n.toFixed(10).replace(/\.?0+$/, "");
    return n.toFixed(8).replace(/\.?0+$/, "");
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
            {/* ── Header with Risk Score ── */}
            <div
              style={{
                background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
                borderRadius: 16,
                padding: "12px",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "stretch",
                }}
              >
                {/* Token Image */}
                <div
                  style={{
                    width: 95,
                    height: 95,
                    borderRadius: 14,
                    background: data.curve.image ? "#000" : `linear-gradient(135deg, ${color}33, ${color}11)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    fontWeight: 700,
                    color,
                    flexShrink: 0,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {data.curve.image ? (
                    <img
                      alt={data.curve.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      src={data.curve.image}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = data.curve.symbol.slice(0, 2);
                      }}
                    />
                  ) : (
                    data.curve.symbol.slice(0, 2)
                  )}
                </div>

                {/* Token Info */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
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
                    <div
                      style={{
                        fontSize: 11,
                        color: "#666",
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontFamily: "monospace", color: "#888" }}>{data.curve.symbol}</span>
                      <span style={{ color: "#444" }}>•</span>
                      <span style={{ fontFamily: "monospace", color: "#888" }}>
                        {data.curve.token.slice(0, 6)}...{data.curve.token.slice(-4)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#666",
                        marginTop: 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <span>by: <span style={{ fontFamily: "monospace", color: "#888" }}>{data.curve.creator.slice(-6)}</span></span>
                      <span style={{ color: "#444" }}>•</span>
                      <span>{formatAge(data.curve.createdAt)}</span>
                      {data.curve.graduated && (
                        <>
                          <span style={{ color: "#444" }}>•</span>
                          <span style={{ color: "#0ecb81", fontSize: 10, fontWeight: 600 }}>GRADUATED</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Price */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: 4,
                      fontSize: 24,
                      fontWeight: 700,
                      color: "#0ecb81",
                    }}
                  >
                    ${formatNumber(data.curve.lastPriceUsd)}
                  </div>
                </div>

                {/* Risk Score - Right Side */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 90,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#666",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    Risk Score
                  </div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color,
                      lineHeight: 1,
                      marginBottom: 10,
                    }}
                  >
                    {data.risk.score}<span style={{ fontSize: 16, color: "#666", fontWeight: 400 }}>/100</span>
                  </div>
                  <div
                    style={{
                      padding: "4px 12px",
                      borderRadius: 12,
                      background: `${color}22`,
                      color,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {data.risk.level.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Metrics ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {[
                {
                  label: "Volume (24h)",
                  value: `${parseFloat(data.curve.totalVolumeEth).toFixed(3)} ETH`,
                },
                { label: "Trades", value: data.curve.tradeCount },
                {
                  label: "Unique Traders",
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
                    padding: "12px",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "#666", fontWeight: 400 }}>{m.label}: </span>
                  <span style={{ fontWeight: 600 }}>
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
                  </span>
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
                  fontSize: 13,
                  fontWeight: 700,
                  margin: "0 0 14px",
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
                      padding: "12px 0",
                      borderTop: i > 0 ? "1px solid #ffffff08" : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            background: impactColor,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          {f.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: impactColor,
                        }}
                      >
                        {f.value}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#888",
                        margin: 0,
                        lineHeight: 1.5,
                        paddingLeft: 14,
                      }}
                    >
                      {f.detail}
                    </p>
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
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 2L2 7L12 12L22 7L12 2Z"
                      stroke="#000"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 17L12 22L22 17"
                      stroke="#000"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 12L12 17L22 12"
                      stroke="#000"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    margin: 0,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: "#000",
                  }}
                >
                  AI Analysis
                </h3>
              </div>
              <div style={{ lineHeight: 1.7, fontSize: 14 }}>
                {data.analysis.split("\n").map((line, i) => {
                  if (!line.trim()) return null;

                  const trimmedLine = line.trim();
                  const upperLine = trimmedLine.toUpperCase();

                  // Check if this is a Verdict line
                  const isVerdictLine = trimmedLine.startsWith("Verdict") || /^3\.\s*Verdict/i.test(trimmedLine);

                  // Bold lines that start with a number or main headings
                  const isBold = /^\d+\./.test(trimmedLine) || trimmedLine.startsWith("**");
                  const cleaned = line.replace(/\*\*/g, "");

                  // Handle verdict line specially
                  if (isVerdictLine) {
                    const parts = cleaned.split(":");
                    if (parts.length >= 2) {
                      const label = parts[0];
                      const verdict = parts.slice(1).join(":").trim();
                      let verdictColor = "#000";

                      const upperVerdict = verdict.toUpperCase();
                      if (upperVerdict.includes("SAFE")) {
                        verdictColor = "#0ecb81";
                      } else if (upperVerdict.includes("CAUTION") || upperVerdict.includes("AVOID")) {
                        verdictColor = "#f6465d";
                      }

                      return (
                        <p
                          key={i}
                          style={{
                            margin: "6px 0",
                            fontWeight: 700,
                            color: "#000",
                          }}
                        >
                          {label}: <span style={{ color: verdictColor }}>{verdict}</span>
                        </p>
                      );
                    }
                  }

                  return (
                    <p
                      key={i}
                      style={{
                        margin: "6px 0",
                        fontWeight: isBold ? 700 : 400,
                        color: isBold ? "#000" : "#333",
                      }}
                    >
                      {cleaned}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
