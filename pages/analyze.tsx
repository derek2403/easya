import { useState, useEffect } from "react";
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
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load analysis");
        setLoading(false);
      });
  }, [id]);

  const riskColor =
    data?.risk.level === "low"
      ? "#0ecb81"
      : data?.risk.level === "medium"
        ? "#f0b90b"
        : "#f6465d";

  const formatAge = (createdAt: string) => {
    const seconds = Date.now() / 1000 - parseInt(createdAt);
    const hours = seconds / 3600;
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  return (
    <>
      <Head>
        <title>Token Analysis</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />

      <div style={styles.container}>
        {loading && (
          <div style={styles.center}>
            <p style={{ fontSize: 18 }}>Analyzing token...</p>
            <p style={{ color: "#888", marginTop: 8 }}>
              Running AI risk analysis
            </p>
          </div>
        )}

        {error && (
          <div style={styles.center}>
            <p style={{ color: "#f6465d" }}>{error}</p>
          </div>
        )}

        {data && (
          <div style={styles.content}>
            {/* Header */}
            <div style={styles.header}>
              <h1 style={styles.tokenName}>
                {data.curve.name}{" "}
                <span style={{ color: "#888", fontWeight: 400 }}>
                  ${data.curve.symbol}
                </span>
              </h1>
              <p style={{ fontSize: 12, color: "#666", wordBreak: "break-all" }}>
                {data.curve.token}
              </p>
            </div>

            {/* Risk Gauge */}
            <div style={{ ...styles.card, borderColor: riskColor }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ fontSize: 13, color: "#888" }}>Risk Score</p>
                  <p
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      color: riskColor,
                      margin: "4px 0",
                    }}
                  >
                    {data.risk.score}
                    <span style={{ fontSize: 16 }}>/100</span>
                  </p>
                </div>
                <div
                  style={{
                    ...styles.badge,
                    backgroundColor: riskColor + "22",
                    color: riskColor,
                  }}
                >
                  {data.risk.emoji}{" "}
                  {data.risk.level.toUpperCase()}
                </div>
              </div>

              {/* Risk bar */}
              <div style={styles.barBg}>
                <div
                  style={{
                    ...styles.barFill,
                    width: `${data.risk.score}%`,
                    backgroundColor: riskColor,
                  }}
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div style={styles.grid}>
              <div style={styles.metric}>
                <p style={styles.metricLabel}>Price</p>
                <p style={styles.metricValue}>
                  ${parseFloat(data.curve.lastPriceUsd).toExponential(2)}
                </p>
              </div>
              <div style={styles.metric}>
                <p style={styles.metricLabel}>Volume</p>
                <p style={styles.metricValue}>
                  {parseFloat(data.curve.totalVolumeEth).toFixed(3)} ETH
                </p>
              </div>
              <div style={styles.metric}>
                <p style={styles.metricLabel}>Trades</p>
                <p style={styles.metricValue}>{data.curve.tradeCount}</p>
              </div>
              <div style={styles.metric}>
                <p style={styles.metricLabel}>Age</p>
                <p style={styles.metricValue}>
                  {formatAge(data.curve.createdAt)}
                </p>
              </div>
              <div style={styles.metric}>
                <p style={styles.metricLabel}>Traders</p>
                <p style={styles.metricValue}>
                  {data.tradeSummary.uniqueTraders}
                </p>
              </div>
              <div style={styles.metric}>
                <p style={styles.metricLabel}>Buy/Sell</p>
                <p style={styles.metricValue}>
                  <span style={{ color: "#0ecb81" }}>
                    {data.tradeSummary.buys}
                  </span>
                  /
                  <span style={{ color: "#f6465d" }}>
                    {data.tradeSummary.sells}
                  </span>
                </p>
              </div>
            </div>

            {/* Risk Factors */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Risk Factors</h3>
              {data.risk.factors.map((f, i) => (
                <div key={i} style={styles.factorRow}>
                  <span style={styles.factorIcon}>
                    {f.impact === "positive"
                      ? "✅"
                      : f.impact === "negative"
                        ? "❌"
                        : "⚠️"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {f.name}
                      </span>
                      <span style={{ color: "#888", fontSize: 13 }}>
                        {f.value}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                      {f.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Analysis */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>AI Analysis</h3>
              <div style={styles.aiBox}>
                {data.analysis.split("\n").map((line, i) => (
                  <p key={i} style={{ margin: "4px 0", fontSize: 14 }}>
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* Graduated badge */}
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <span
                style={{
                  ...styles.badge,
                  backgroundColor: data.curve.graduated
                    ? "#0ecb8122"
                    : "#f6465d22",
                  color: data.curve.graduated ? "#0ecb81" : "#f6465d",
                }}
              >
                {data.curve.graduated
                  ? "✅ Graduated"
                  : "⏳ Not Graduated"}
              </span>
            </div>
          </div>
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
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "60vh",
  },
  content: {
    maxWidth: 480,
    margin: "0 auto",
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  tokenName: {
    fontSize: 22,
    fontWeight: 700,
    margin: "0 0 4px",
  },
  card: {
    backgroundColor: "var(--tg-theme-secondary-bg-color, #16213e)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    border: "1px solid #333",
  },
  badge: {
    display: "inline-block",
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
  },
  barBg: {
    height: 6,
    backgroundColor: "#333",
    borderRadius: 3,
    marginTop: 12,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.5s ease",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    marginBottom: 12,
  },
  metric: {
    backgroundColor: "var(--tg-theme-secondary-bg-color, #16213e)",
    borderRadius: 10,
    padding: "10px 12px",
    textAlign: "center",
  },
  metricLabel: {
    fontSize: 11,
    color: "#888",
    margin: 0,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: 600,
    margin: "4px 0 0",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    margin: "0 0 10px",
  },
  factorRow: {
    display: "flex",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid #ffffff10",
  },
  factorIcon: {
    fontSize: 16,
    marginTop: 2,
  },
  aiBox: {
    backgroundColor: "var(--tg-theme-secondary-bg-color, #16213e)",
    borderRadius: 10,
    padding: 14,
    lineHeight: 1.5,
    border: "1px solid #333",
  },
};
