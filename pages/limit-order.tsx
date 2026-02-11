import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import Script from "next/script";
import {
  createChart,
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
  side: "buy" | "sell";
}

type View = "form" | "success";

function formatPrice(p: number): string {
  if (p === 0) return "$0";
  if (p < 0.000001) {
    // Count leading zeros after decimal, then show 2 significant digits
    const str = p.toFixed(20);
    const match = str.match(/^0\.(0+)/);
    const zeros = match ? match[1].length : 0;
    return `$0.${"0".repeat(zeros)}${Math.round(p * Math.pow(10, zeros + 2))}`;
  }
  if (p < 0.01) return `$${p.toFixed(8).replace(/0+$/, "")}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(2)}`;
}

export default function LimitOrderPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [view, setView] = useState<View>("form");
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [triggeredBoxes, setTriggeredBoxes] = useState<Set<string>>(new Set());
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");

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
    setBoxes([]);
    setTriggeredBoxes(new Set());
    if (animTimerRef.current) {
      clearInterval(animTimerRef.current);
      animTimerRef.current = null;
    }
    setAnimating(false);

    // Generate mock price data with distinct segments
    const now = Math.floor(Date.now() / 1000);
    const interval = 3600; // 1 hour
    const points: ChartPoint[] = [];
    let price = 0.00025; // starting price

    // Segment 1: Accumulation (flat / slight rise) — 20 points
    for (let i = 0; i < 20; i++) {
      price += (Math.random() - 0.45) * 0.000005;
      price = Math.max(price, 0.0001);
      points.push({ time: now - (80 - i) * interval, value: price });
    }
    // Segment 2: Breakout (sharp rise) — 15 points
    for (let i = 0; i < 15; i++) {
      price += Math.random() * 0.00004 + 0.00001;
      points.push({ time: now - (60 - i) * interval, value: price });
    }
    // Segment 3: Distribution (choppy top) — 20 points
    const topPrice = price;
    for (let i = 0; i < 20; i++) {
      price = topPrice + (Math.random() - 0.5) * 0.00008;
      points.push({ time: now - (45 - i) * interval, value: price });
    }
    // Segment 4: Pullback (decline) — 15 points
    for (let i = 0; i < 15; i++) {
      price -= Math.random() * 0.00003 + 0.000005;
      price = Math.max(price, 0.00015);
      points.push({ time: now - (25 - i) * interval, value: price });
    }
    // Segment 5: Recovery (gradual rise) — 10 points
    for (let i = 0; i < 10; i++) {
      price += Math.random() * 0.00002 + 0.000005;
      points.push({ time: now - (10 - i) * interval, value: price });
    }

    setChartData(points);
    setCurrentPrice(price);
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
        background: { color: "transparent" },
        textColor: "#9ca3af",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
        shiftVisibleRangeOnNewBar: false,
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
        autoScale: true,
      },
      localization: {
        priceFormatter: (price: number) => formatPrice(price),
      },
      crosshair: {
        mode: 1,
        horzLine: {
          color: "rgba(255, 255, 255, 0.3)",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#10b981",
        },
        vertLine: {
          color: "rgba(255, 255, 255, 0.3)",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#10b981",
        },
      },
      handleScroll: false,
      handleScale: false,
    });

    const lineSeries = chart.addLineSeries({
      color: "#10b981",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      priceFormat: {
        type: "custom",
        formatter: (price: number) => formatPrice(price),
        minMove: samplePrice < 0.0001 ? 0.0000000001 : samplePrice < 0.01 ? 0.00000001 : 0.01,
      },
    });

    lineSeries.setData(
      chartData.map((p) => ({
        time: p.time as import("lightweight-charts").Time,
        value: p.value,
      }))
    );

    if (currentPrice > 0) {
      lineSeries.createPriceLine({
        price: currentPrice,
        color: "#10b981",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "",
      });
    }

    // Show recent data on the left ~30%, blank space on right for drawing boxes
    const totalBars = chartData.length;
    chart.timeScale().setVisibleLogicalRange({
      from: 0,
      to: totalBars * 3,
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
      side: orderSide,
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

      // Show placed, then animate line extending into empty space
      setSubmitting(false);
      setView("success");

      const startTime = chartData[chartData.length - 1]?.time || Math.floor(Date.now() / 1000);
      const basePrice = currentPrice;
      const savedBoxes = [...boxes];

      // Fixed path: up with swings, then back down
      const path = [
        0.02, 0.05, 0.03, -0.01, -0.04, -0.08, -0.05, -0.02,
        0.01, 0.06, 0.12, 0.15, 0.10, 0.07, 0.03, -0.02,
        -0.06, -0.10, -0.13, -0.09, -0.05, 0.00, 0.04, 0.09,
        0.14, 0.18, 0.22, 0.19, 0.15, 0.11, 0.08, 0.13,
        0.17, 0.21, 0.25, 0.20, 0.16, 0.22, 0.28, 0.32,
        // Peak then descend
        0.28, 0.24, 0.20, 0.15, 0.18, 0.12, 0.08, 0.05,
        0.01, -0.03, -0.07, -0.04, -0.09, -0.13, -0.10, -0.15,
        -0.18, -0.14, -0.20, -0.22,
      ];
      let tickCount = 0;
      const triggered = new Set<string>();

      // Small delay before animation starts
      setTimeout(() => {
        setView("form");
        setAnimating(true);
        setTriggeredBoxes(new Set());

        // Lock the price scale so it never rescales
        if (chartRef.current) {
          chartRef.current.priceScale("right").applyOptions({ autoScale: false });
        }

        animTimerRef.current = setInterval(() => {
          if (!seriesRef.current || tickCount >= path.length) {
            if (animTimerRef.current) clearInterval(animTimerRef.current);
            animTimerRef.current = null;
            setAnimating(false);
            return;
          }

          const price = basePrice * (1 + path[tickCount]);
          const currentTime = startTime + (tickCount + 1) * 3600;

          seriesRef.current.update({
            time: currentTime as import("lightweight-charts").Time,
            value: price,
          });

          // Get the x pixel position of the current line tip
          const lineX = chartRef.current?.timeScale().timeToCoordinate(
            currentTime as import("lightweight-charts").Time
          );

          // Only trigger if price is in range AND line has reached the box horizontally
          if (lineX !== null && lineX !== undefined) {
            for (const box of savedBoxes) {
              if (
                !triggered.has(box.id) &&
                price >= box.entryPrice &&
                price <= box.tpPrice &&
                (lineX as number) >= box.left
              ) {
                triggered.add(box.id);
                setTriggeredBoxes(new Set(triggered));
              }
            }
          }

          // Update box pixel positions from price values
          if (seriesRef.current) {
            const s = seriesRef.current;
            setBoxes((prev) =>
              prev.map((b) => {
                const yTop = s.priceToCoordinate(b.tpPrice);
                const yBot = s.priceToCoordinate(b.entryPrice);
                if (yTop === null || yBot === null) return b;
                const newTop = Math.min(yTop as number, yBot as number);
                const newHeight = Math.abs((yBot as number) - (yTop as number));
                return { ...b, top: newTop, height: newHeight };
              })
            );
          }

          tickCount++;
        }, 120);
      }, 1200);
    } catch {
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
              {/* Header Card */}
              <div style={s.headerCard}>
                <div style={s.header}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#000" }}>
                      Limit Order
                    </h2>
                    {balance !== null && (
                      <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
                        Balance:{" "}
                        <span style={{ color: "#0ecb81", fontWeight: 700, fontFamily: "monospace", fontSize: 14 }}>
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

                {/* Buy / Sell toggle */}
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button
                    onClick={() => setOrderSide("buy")}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 10,
                      border: orderSide === "buy" ? "1px solid #10b981" : "1px solid #ddd",
                      background: orderSide === "buy" ? "#10b981" : "#f5f5f5",
                      color: orderSide === "buy" ? "#fff" : "#333",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    BUY
                  </button>
                  <button
                    onClick={() => setOrderSide("sell")}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 10,
                      border: orderSide === "sell" ? "1px solid #ef4444" : "1px solid #ddd",
                      background: orderSide === "sell" ? "#ef4444" : "#f5f5f5",
                      color: orderSide === "sell" ? "#fff" : "#333",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    SELL
                  </button>
                </div>

                {/* Amount selector */}
                <div style={s.amountRow}>
                  <span style={{ fontSize: 11, color: "#333", fontWeight: 600 }}>Amount per box:</span>
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
              </div>

              {balanceError && <div style={s.errorBox}>{balanceError}</div>}

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
                    {boxes.map((box) => {
                      const hit = triggeredBoxes.has(box.id);
                      const color = box.side === "buy" ? "#10b981" : "#ef4444";
                      const dimColor = box.side === "buy"
                        ? "rgba(16, 185, 129, 0.25)"
                        : "rgba(239, 68, 68, 0.25)";
                      const bgColor = box.side === "buy"
                        ? hit ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.05)"
                        : hit ? "rgba(239, 68, 68, 0.12)" : "rgba(239, 68, 68, 0.05)";
                      return (
                        <div key={box.id}>
                          <div
                            style={{
                              position: "absolute",
                              left: box.left,
                              top: box.top,
                              width: box.width,
                              height: box.height,
                              background: bgColor,
                              border: hit
                                ? `2px solid ${color}`
                                : `1px solid rgba(255, 255, 255, 0.3)`,
                              borderRadius: 4,
                              pointerEvents: "auto",
                              cursor: "pointer",
                              zIndex: 10,
                              transition: "all 0.3s ease",
                              boxShadow: hit
                                ? `inset 4px 4px 0 ${color}, inset -4px -4px 0 ${color}, inset 4px -4px 0 ${color}, inset -4px 4px 0 ${color}`
                                : `inset 4px 4px 0 ${dimColor}, inset -4px -4px 0 ${dimColor}, inset 4px -4px 0 ${dimColor}, inset -4px 4px 0 ${dimColor}`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBox(box.id);
                            }}
                          />
                          {/* Top price */}
                          <div
                            style={{
                              position: "absolute",
                              left: box.left + 4,
                              top: box.top - 14,
                              fontSize: 10,
                              color: hit ? color : "rgba(255,255,255,0.5)",
                              fontWeight: 600,
                              fontFamily: "monospace",
                              pointerEvents: "none",
                              zIndex: 15,
                            }}
                          >
                            {formatPrice(box.tpPrice)}
                          </div>
                          {/* Bottom price */}
                          <div
                            style={{
                              position: "absolute",
                              left: box.left + 4,
                              top: box.top + box.height + 2,
                              fontSize: 10,
                              color: hit ? color : "rgba(255,255,255,0.5)",
                              fontWeight: 600,
                              fontFamily: "monospace",
                              pointerEvents: "none",
                              zIndex: 15,
                            }}
                          >
                            {formatPrice(box.entryPrice)}
                          </div>
                        </div>
                      );
                    })}

                    {/* Preview rectangle while drawing */}
                    {previewRect && previewRect.width > 5 && (
                      <div
                        style={{
                          position: "absolute",
                          left: previewRect.left,
                          top: previewRect.top,
                          width: previewRect.width,
                          height: previewRect.height,
                          background: orderSide === "buy" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                          border: orderSide === "buy" ? "1px dashed rgba(16, 185, 129, 0.6)" : "1px dashed rgba(239, 68, 68, 0.6)",
                          borderRadius: 4,
                          pointerEvents: "none",
                          zIndex: 20,
                        }}
                      />
                    )}
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

                  {boxes.map((box, i) => {
                    const isBuy = box.side === "buy";
                    const sideColor = isBuy ? "#0ecb81" : "#ef4444";
                    return (
                    <div key={box.id} style={{
                      ...s.orderRow,
                      borderLeft: `3px solid ${sideColor}`,
                    }}>
                      <div style={{ ...s.orderNum, background: sideColor }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: sideColor, fontWeight: 700, marginBottom: 2 }}>
                          {isBuy ? "BUY" : "SELL"}
                        </div>
                        <div style={s.orderPrices}>
                          <span>
                            <span style={{ color: isBuy ? "#0ecb81" : "#ef4444", fontWeight: 700, fontSize: 14 }}>
                              {isBuy ? "Entry" : "Exit"}
                            </span>{" "}
                            <span style={{ fontFamily: "monospace", color: "#000", fontWeight: 700, fontSize: 14 }}>
                              {formatPrice(box.entryPrice)}
                            </span>
                          </span>
                          <span style={{ color: "#000", fontSize: 14 }}>→</span>
                          <span>
                            <span style={{ color: isBuy ? "#2481cc" : "#f59e0b", fontWeight: 700, fontSize: 14 }}>
                              {isBuy ? "TP" : "SL"}
                            </span>{" "}
                            <span style={{ fontFamily: "monospace", color: "#000", fontWeight: 700, fontSize: 14 }}>
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
                        style={{
                          ...s.amountInput,
                          borderColor: sideColor,
                        }}
                      />
                      <button
                        onClick={() => removeBox(box.id)}
                        style={s.removeBtn}
                      >
                        &#10005;
                      </button>
                    </div>
                    );
                  })}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting || animating || boxes.length === 0}
                style={{
                  ...s.submitBtn,
                  opacity: submitting || animating || boxes.length === 0 ? 0.35 : 1,
                }}
              >
                {submitting
                  ? "Placing..."
                  : animating
                    ? "Simulating..."
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
  content: { maxWidth: 480, margin: "0 auto", padding: "12px 16px 32px" },
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
  headerCard: {
    background: "#ffffff",
    borderRadius: 16,
    padding: "16px",
    marginBottom: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tokenSelect: {
    padding: "8px 14px",
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "#f5f5f5",
    color: "#000",
    fontSize: 13,
    fontWeight: 700,
    appearance: "none" as const,
    minWidth: 100,
  },
  amountRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  amountChip: {
    padding: "6px 14px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#f5f5f5",
    color: "#333",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  amountChipActive: {
    background: "#10b981",
    color: "#fff",
    border: "1px solid #10b981",
  },
  chartWrap: {
    background: "#0c0e14",
    borderRadius: 16,
    overflow: "hidden",
    position: "relative" as const,
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "16px 16px 8px",
    minHeight: 350,
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
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 15,
    color: "#000",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  summaryTotal: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#10b981",
  },
  orderRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#ffffff",
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 8,
    border: "1px solid #e0e0e0",
  },
  orderNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    background: "#10b981",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  orderPrices: {
    display: "flex",
    gap: 8,
    fontSize: 15,
    alignItems: "center",
  },
  amountInput: {
    width: 65,
    padding: "8px 10px",
    borderRadius: 8,
    border: "2px solid #10b981",
    background: "#f5f5f5",
    color: "#000",
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "monospace",
    textAlign: "right" as const,
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#000",
    fontSize: 18,
    cursor: "pointer",
    padding: "4px 6px",
  },
  submitBtn: {
    width: "100%",
    marginTop: 16,
    padding: "16px 0",
    borderRadius: 12,
    border: "none",
    background: "#10b981",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  clearBtn: {
    width: "100%",
    marginTop: 8,
    padding: "12px 0",
    borderRadius: 10,
    border: "1px solid #f6465d44",
    background: "#f6465d15",
    color: "#f6465d",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};
