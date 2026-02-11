import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import Script from "next/script";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  LineStyle,
} from "lightweight-charts";

interface Token {
  id: string;
  name: string;
  symbol: string;
  lastPriceUsd: string;
  totalVolumeEth: string;
}

interface ChartPoint {
  time: number;
  value: number;
}

interface DrawBox {
  id: string;
  // Pixel positions relative to chart container
  left: number;
  top: number;
  width: number;
  height: number;
  // Price values for order submission
  entryPrice: number; // lower price
  tpPrice: number; // upper price
  amount: string;
}

type View = "form" | "success";

function formatPrice(p: number): string {
  if (p === 0) return "$0";
  if (p < 0.0001) return `$${p.toExponential(2)}`;
  if (p < 1) return `$${p.toPrecision(4)}`;
  return `$${p.toFixed(2)}`;
}

export default function LimitOrderPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [view, setView] = useState<View>("form");
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Chart
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<
    "Line",
    import("lightweight-charts").Time
  > | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  // Box drawing
  const [boxes, setBoxes] = useState<DrawBox[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [drawCurrent, setDrawCurrent] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [defaultAmount, setDefaultAmount] = useState("5");

  // Balance
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState("");

  const getUserId = (): number => {
    if (
      typeof window !== "undefined" &&
      window.Telegram?.WebApp?.initDataUnsafe?.user?.id
    ) {
      return window.Telegram.WebApp.initDataUnsafe.user.id;
    }
    return 12345;
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
    }
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
    fetch(`/api/portfolio?userId=${getUserId()}`)
      .then((r) => r.json())
      .then((data) => setBalance(data.usdcBalance))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedToken) return;
    setChartLoading(true);
    setBoxes([]);
    fetch(`/api/chart-data?curveId=${selectedToken.id}&limit=100`)
      .then((r) => r.json())
      .then((data) => {
        if (data.chartData) {
          setChartData(data.chartData);
          setCurrentPrice(data.currentPrice || 0);
        }
        setChartLoading(false);
      })
      .catch(() => setChartLoading(false));
  }, [selectedToken]);

  // Create chart
  useEffect(() => {
    if (
      !chartContainerRef.current ||
      chartData.length === 0 ||
      view !== "form"
    )
      return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const container = chartContainerRef.current;
    const samplePrice = chartData[0]?.value || 0;
    const precision =
      samplePrice < 0.0001
        ? 10
        : samplePrice < 0.01
          ? 8
          : samplePrice < 1
            ? 6
            : 2;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 350,
      layout: {
        background: { color: "#0a0b0f" },
        textColor: "#666",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#ffffff06" },
        horzLines: { color: "#ffffff06" },
      },
      timeScale: {
        borderColor: "#ffffff10",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#ffffff10",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      localization: {
        priceFormatter: (price: number) => {
          if (price === 0) return "0";
          if (price < 0.0001) return price.toExponential(2);
          if (price < 1) return price.toPrecision(precision > 6 ? 4 : 3);
          return price.toFixed(2);
        },
      },
      crosshair: {
        mode: 0,
        horzLine: {
          color: "#ffffff30",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#2481cc",
        },
        vertLine: {
          color: "#ffffff15",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#333",
        },
      },
      handleScroll: false,
      handleScale: false,
    });

    const lineSeries = chart.addSeries(LineSeries, {
      color: "#4a90d9",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const formatted = chartData.map((p) => ({
      time: p.time as import("lightweight-charts").Time,
      value: p.value,
    }));
    lineSeries.setData(formatted);

    if (currentPrice > 0) {
      lineSeries.createPriceLine({
        price: currentPrice,
        color: "#f0b90b88",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "",
      });
    }

    // Data on the left ~20%, blank space on the right for drawing future orders
    const totalBars = chartData.length;
    chart.timeScale().setVisibleLogicalRange({
      from: 0,
      to: totalBars * 5,
    });
    chartRef.current = chart;
    seriesRef.current = lineSeries;

    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [chartData, view, currentPrice]);

  // --- Box drawing handlers ---
  const getRelativePos = useCallback(
    (e: React.PointerEvent) => {
      if (!chartContainerRef.current) return null;
      const rect = chartContainerRef.current.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const pos = getRelativePos(e);
      if (!pos) return;
      // Don't draw on the price axis (right ~50px)
      const container = chartContainerRef.current;
      if (!container) return;
      if (pos.x > container.clientWidth - 50) return;

      setDrawing(true);
      setDrawStart(pos);
      setDrawCurrent(pos);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getRelativePos]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawing) return;
      const pos = getRelativePos(e);
      if (pos) setDrawCurrent(pos);
    },
    [drawing, getRelativePos]
  );

  const onPointerUp = useCallback(() => {
    if (!drawing || !drawStart || !drawCurrent || !seriesRef.current) {
      setDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    const left = Math.min(drawStart.x, drawCurrent.x);
    const top = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);

    // Minimum size to avoid accidental taps
    if (width < 15 || height < 10) {
      setDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    // Convert y coordinates to prices
    const priceTop = seriesRef.current.coordinateToPrice(top);
    const priceBottom = seriesRef.current.coordinateToPrice(top + height);

    if (priceTop === null || priceBottom === null) {
      setDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    const high = Math.max(priceTop as number, priceBottom as number);
    const low = Math.min(priceTop as number, priceBottom as number);

    if (low <= 0) {
      setDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    const newBox: DrawBox = {
      id: `box_${Date.now()}`,
      left,
      top,
      width,
      height,
      entryPrice: low,
      tpPrice: high,
      amount: defaultAmount,
    };

    setBoxes((prev) => [...prev, newBox]);
    setDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  }, [drawing, drawStart, drawCurrent, defaultAmount]);

  const removeBox = (id: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBoxAmount = (id: string, amount: string) => {
    setBoxes((prev) =>
      prev.map((b) => (b.id === id ? { ...b, amount } : b))
    );
  };

  // Preview rectangle while drawing
  const previewRect =
    drawing && drawStart && drawCurrent
      ? {
          left: Math.min(drawStart.x, drawCurrent.x),
          top: Math.min(drawStart.y, drawCurrent.y),
          width: Math.abs(drawCurrent.x - drawStart.x),
          height: Math.abs(drawCurrent.y - drawStart.y),
        }
      : null;

  const totalAmount = boxes.reduce(
    (sum, b) => sum + (parseFloat(b.amount) || 0),
    0
  );

  const handleSubmit = async () => {
    if (!selectedToken || boxes.length === 0) return;
    setBalanceError("");

    if (balance !== null && totalAmount > balance) {
      setBalanceError(
        `Insufficient balance. Need $${totalAmount.toFixed(2)}, have $${balance.toFixed(2)}`
      );
      return;
    }

    setSubmitting(true);
    try {
      for (const box of boxes) {
        // Entry order (buy at low price)
        await fetch("/api/limit-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: selectedToken.symbol,
            curveId: selectedToken.id,
            side: "buy",
            triggerPrice: box.entryPrice.toString(),
            amount: box.amount,
            currentPrice: selectedToken.lastPriceUsd,
            orderType: "entry",
          }),
        });

        // TP order (sell at high price)
        await fetch("/api/limit-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: selectedToken.symbol,
            curveId: selectedToken.id,
            side: "sell",
            triggerPrice: box.tpPrice.toString(),
            amount: box.amount,
            currentPrice: selectedToken.lastPriceUsd,
            orderType: "tp",
          }),
        });

        // Reserve funds (don't create holdings — order is pending)
        await fetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: getUserId(),
            type: "reserve",
            symbol: selectedToken.symbol,
            curveId: selectedToken.id,
            name: selectedToken.name,
            side: "buy",
            amount: box.amount,
            price: box.entryPrice.toString(),
          }),
        });
      }

      // Refresh balance
      const pRes = await fetch(`/api/portfolio?userId=${getUserId()}`);
      const updated = await pRes.json();
      setBalance(updated.usdcBalance);

      // Send to Telegram
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        window.Telegram.WebApp.sendData(
          JSON.stringify({
            type: "limit_order",
            symbol: selectedToken.symbol,
            levels: boxes.map((b) => ({
              type: "entry",
              price: formatPrice(b.entryPrice),
              tp: formatPrice(b.tpPrice),
              amount: b.amount,
            })),
            totalAmount: totalAmount.toFixed(2),
          })
        );
      }

      setView("success");
      setTimeout(() => {
        setView("form");
        setBoxes([]);
      }, 2500);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>Limit Order</title>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
        </Head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <div style={s.container}>
          <div style={s.loadCenter}>
            <div style={s.spinner} />
            <p style={{ color: "#888", marginTop: 12 }}>Loading...</p>
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
          {/* Success */}
          {view === "success" && (
            <div style={s.loadCenter}>
              <div style={s.successIcon}>&#10003;</div>
              <p style={{ marginTop: 12, fontSize: 16, fontWeight: 600, color: "#0ecb81" }}>
                {boxes.length} order{boxes.length !== 1 ? "s" : ""} placed!
              </p>
              <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                Total: ${totalAmount.toFixed(2)} USDT
              </p>
            </div>
          )}

          {view === "form" && (
            <>
              {/* Header */}
              <div style={s.header}>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                    Limit Order
                  </h2>
                  {balance !== null && (
                    <p style={{ fontSize: 11, color: "#666", margin: "2px 0 0" }}>
                      Balance:{" "}
                      <span style={{ color: "#0ecb81", fontWeight: 600, fontFamily: "monospace" }}>
                        ${balance.toFixed(2)}
                      </span>
                    </p>
                  )}
                </div>
                <select
                  value={selectedToken?.id || ""}
                  onChange={(e) => {
                    const t = tokens.find((tk) => tk.id === e.target.value);
                    if (t) setSelectedToken(t);
                  }}
                  style={s.tokenSelect}
                >
                  {tokens.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.symbol}
                    </option>
                  ))}
                </select>
              </div>

              {balanceError && <div style={s.errorBox}>{balanceError}</div>}

              {/* Amount selector */}
              <div style={s.amountRow}>
                <span style={{ fontSize: 11, color: "#666" }}>Per box:</span>
                {["5", "10", "25", "50"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setDefaultAmount(v)}
                    style={{
                      ...s.amountChip,
                      ...(defaultAmount === v ? s.amountChipActive : {}),
                    }}
                  >
                    ${v}
                  </button>
                ))}
              </div>

              {/* Chart with drawing area */}
              <div style={s.chartWrap}>
                {chartLoading ? (
                  <div style={{ ...s.center, height: 350 }}>
                    <div style={s.spinner} />
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                ) : chartData.length === 0 ? (
                  <div style={{ ...s.center, height: 350 }}>
                    <p style={{ color: "#555", fontSize: 13 }}>
                      No trade data
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      position: "relative",
                      touchAction: "none",
                      cursor: "crosshair",
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                  >
                    <div ref={chartContainerRef} />

                    {/* Existing boxes */}
                    {boxes.map((box) => (
                      <div key={box.id}>
                        {/* Box rectangle */}
                        <div
                          style={{
                            position: "absolute",
                            left: box.left,
                            top: box.top,
                            width: box.width,
                            height: box.height,
                            background: "#2481cc18",
                            border: "1px solid #2481cc66",
                            borderRadius: 3,
                            pointerEvents: "none",
                            zIndex: 10,
                          }}
                        />
                        {/* Amount label */}
                        <div
                          style={{
                            position: "absolute",
                            left: box.left + box.width / 2,
                            top: box.top + box.height / 2,
                            transform: "translate(-50%, -50%)",
                            background: "#2481ccdd",
                            border: "1px solid #2481cc",
                            borderRadius: 4,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#fff",
                            pointerEvents: "auto",
                            cursor: "pointer",
                            zIndex: 15,
                            whiteSpace: "nowrap",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBox(box.id);
                          }}
                        >
                          ${box.amount}
                        </div>
                        {/* Entry price label (bottom edge) */}
                        <div
                          style={{
                            position: "absolute",
                            left: box.left,
                            top: box.top + box.height + 2,
                            fontSize: 9,
                            color: "#0ecb81",
                            fontFamily: "monospace",
                            pointerEvents: "none",
                            zIndex: 15,
                          }}
                        >
                          Entry {formatPrice(box.entryPrice)}
                        </div>
                        {/* TP price label (top edge) */}
                        <div
                          style={{
                            position: "absolute",
                            left: box.left,
                            top: box.top - 14,
                            fontSize: 9,
                            color: "#2481cc",
                            fontFamily: "monospace",
                            pointerEvents: "none",
                            zIndex: 15,
                          }}
                        >
                          TP {formatPrice(box.tpPrice)}
                        </div>
                      </div>
                    ))}

                    {/* Preview rectangle while drawing */}
                    {previewRect && previewRect.width > 5 && (
                      <div
                        style={{
                          position: "absolute",
                          left: previewRect.left,
                          top: previewRect.top,
                          width: previewRect.width,
                          height: previewRect.height,
                          background: "#2481cc15",
                          border: "1px dashed #2481cc88",
                          borderRadius: 3,
                          pointerEvents: "none",
                          zIndex: 20,
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Draw hint */}
                {chartData.length > 0 && boxes.length === 0 && (
                  <div style={s.hint}>
                    Draw boxes on the chart to place orders
                  </div>
                )}
              </div>

              {/* Order boxes summary */}
              {boxes.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={s.summaryHeader}>
                    <span style={s.summaryLabel}>
                      Orders ({boxes.length})
                    </span>
                    <span style={s.summaryTotal}>
                      ${totalAmount.toFixed(2)}
                    </span>
                  </div>

                  {boxes.map((box, i) => (
                    <div key={box.id} style={s.orderRow}>
                      <div style={s.orderNum}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={s.orderPrices}>
                          <span>
                            <span style={{ color: "#0ecb81" }}>Entry</span>{" "}
                            <span style={{ fontFamily: "monospace", color: "#aaa" }}>
                              {formatPrice(box.entryPrice)}
                            </span>
                          </span>
                          <span style={{ color: "#444" }}>→</span>
                          <span>
                            <span style={{ color: "#2481cc" }}>TP</span>{" "}
                            <span style={{ fontFamily: "monospace", color: "#aaa" }}>
                              {formatPrice(box.tpPrice)}
                            </span>
                          </span>
                        </div>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={box.amount}
                        onChange={(e) =>
                          updateBoxAmount(box.id, e.target.value)
                        }
                        style={s.amountInput}
                      />
                      <button
                        onClick={() => removeBox(box.id)}
                        style={s.removeBtn}
                      >
                        &#10005;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting || boxes.length === 0}
                style={{
                  ...s.submitBtn,
                  opacity: submitting || boxes.length === 0 ? 0.35 : 1,
                }}
              >
                {submitting
                  ? "Placing..."
                  : boxes.length === 0
                    ? "Draw boxes on chart to create orders"
                    : `Submit ${boxes.length} Order${boxes.length !== 1 ? "s" : ""} — $${totalAmount.toFixed(2)}`}
              </button>

              {boxes.length > 0 && (
                <button
                  onClick={() => setBoxes([])}
                  style={s.clearBtn}
                >
                  Clear All
                </button>
              )}
            </>
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
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  content: { maxWidth: 480, margin: "0 auto", padding: "10px 12px 32px" },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  loadCenter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "80vh",
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #333",
    borderTopColor: "#2481cc",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    background: "#0ecb8122",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    color: "#0ecb81",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tokenSelect: {
    padding: "7px 12px",
    borderRadius: 10,
    border: "1px solid #ffffff12",
    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    color: "var(--tg-theme-text-color, #e4e4e7)",
    fontSize: 13,
    fontWeight: 600,
    appearance: "none" as const,
    maxWidth: 140,
  },
  amountRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  amountChip: {
    padding: "5px 12px",
    borderRadius: 8,
    border: "1px solid #ffffff10",
    background: "#1a1b23",
    color: "#888",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  amountChipActive: {
    background: "#2481cc22",
    color: "#2481cc",
    border: "1px solid #2481cc55",
  },
  chartWrap: {
    background: "#0a0b0f",
    borderRadius: 14,
    overflow: "hidden",
    position: "relative" as const,
  },
  hint: {
    position: "absolute" as const,
    bottom: 10,
    left: 0,
    right: 0,
    textAlign: "center" as const,
    fontSize: 11,
    color: "#555",
    pointerEvents: "none" as const,
    zIndex: 30,
  },
  errorBox: {
    background: "#f6465d22",
    border: "1px solid #f6465d44",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    color: "#f6465d",
    textAlign: "center" as const,
    marginBottom: 8,
  },
  summaryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 11,
    color: "#666",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  summaryTotal: {
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#2481cc",
  },
  orderRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    borderRadius: 10,
    padding: "8px 10px",
    marginBottom: 4,
  },
  orderNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    background: "#2481cc22",
    color: "#2481cc",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  orderPrices: {
    display: "flex",
    gap: 6,
    fontSize: 12,
    alignItems: "center",
  },
  amountInput: {
    width: 52,
    padding: "4px 6px",
    borderRadius: 6,
    border: "1px solid #2481cc33",
    background: "#2481cc08",
    color: "#e4e4e7",
    fontSize: 13,
    fontFamily: "monospace",
    textAlign: "right" as const,
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#555",
    fontSize: 13,
    cursor: "pointer",
    padding: "2px 4px",
  },
  submitBtn: {
    width: "100%",
    marginTop: 14,
    padding: "14px 0",
    borderRadius: 12,
    border: "none",
    background: "#2481cc",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  clearBtn: {
    width: "100%",
    marginTop: 6,
    padding: "10px 0",
    borderRadius: 10,
    border: "1px solid #ffffff10",
    background: "transparent",
    color: "#666",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
