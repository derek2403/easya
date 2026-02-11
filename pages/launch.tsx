import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import Script from "next/script";

interface LaunchData {
  name: string;
  ticker: string;
  logo: string;
  description: string;
  twitter: string;
  website: string;
  initialPurchase: string;
}

export default function LaunchPage() {
  const [form, setForm] = useState<LaunchData>({
    name: "",
    ticker: "",
    logo: "",
    description: "",
    twitter: "",
    website: "",
    initialPurchase: "",
  });
  const [showSocials, setShowSocials] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

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
    fetch(`/api/portfolio?userId=${getUserId()}`)
      .then((r) => r.json())
      .then((data) => setBalance(data.usdcBalance))
      .catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Logo must be under 5MB");
      return;
    }

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validTypes.includes(file.type)) {
      setError("Logo must be JPEG, PNG, GIF or WebP");
      return;
    }

    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setForm((prev) => ({ ...prev, logo: dataUrl }));
      setLogoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!form.ticker.trim()) {
      setError("Ticker is required");
      return;
    }

    const purchaseAmount = parseFloat(form.initialPurchase) || 0;

    setSubmitting(true);
    try {
      // Fetch wallet address for creator
      const portfolioRes = await fetch(
        `/api/portfolio?userId=${getUserId()}`
      );
      const portfolio = await portfolioRes.json();

      // Create the startup
      const launchRes = await fetch("/api/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          symbol: form.ticker.trim().toUpperCase(),
          logo: form.logo,
          description: form.description.trim(),
          socialLinks: {
            twitter: form.twitter.trim() || undefined,
            website: form.website.trim() || undefined,
          },
          creatorId: getUserId(),
          creatorAddress: portfolio.walletAddress,
          initialPurchase: purchaseAmount,
        }),
      });

      if (!launchRes.ok) {
        const err = await launchRes.json();
        setError(err.error || "Launch failed");
        setSubmitting(false);
        return;
      }

      const startup = await launchRes.json();

      // If initial purchase, deduct from portfolio
      if (purchaseAmount > 0) {
        const tradeRes = await fetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: getUserId(),
            type: "trade",
            symbol: form.ticker.trim().toUpperCase(),
            curveId: startup.id,
            name: form.name.trim(),
            side: "buy",
            amount: purchaseAmount.toString(),
            price: "0.001",
          }),
        });
        if (tradeRes.ok) {
          const updated = await tradeRes.json();
          setBalance(updated.usdcBalance);
        }
      }

      // Send to Telegram
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        window.Telegram.WebApp.sendData(
          JSON.stringify({
            type: "launch_startup",
            name: form.name.trim(),
            symbol: form.ticker.trim().toUpperCase(),
            description: form.description.trim(),
            initialPurchase: purchaseAmount,
            startupId: startup.id,
          })
        );
      }

      setSubmitted(true);
      setTimeout(() => {
        if (typeof window !== "undefined" && window.Telegram?.WebApp) {
          window.Telegram.WebApp.close();
        }
      }, 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <>
        <Head>
          <title>Launch</title>
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
          <div style={s.successWrap}>
            <div style={s.successIcon}>&#127881;</div>
            <p
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginTop: 16,
                color: "#0ecb81",
              }}
            >
              Launched!
            </p>
            <p style={{ fontSize: 14, color: "#888", marginTop: 4 }}>
              ${form.ticker.toUpperCase()} is now live on the bonding curve
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Launch</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />

      <div style={s.container}>
        <div style={s.content}>
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <h2 style={s.title}>Launch your idea</h2>
            <p style={s.subtitle}>
              Create a startup idea that&apos;s instantly tradeable for under $1
              in one click
            </p>

            {error && <div style={s.errorBox}>{error}</div>}

            {/* Section label */}
            <h3 style={s.sectionTitle}>Idea details</h3>
            <p style={s.sectionHint}>
              Choose carefully, these can&apos;t be changed after launch
            </p>

            {/* Name */}
            <label style={s.label}>Name</label>
            <input
              type="text"
              placeholder="Name your startup idea"
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
              required
              style={s.input}
            />

            {/* Ticker */}
            <label style={s.label}>Ticker</label>
            <input
              type="text"
              placeholder="Your ticker (e.g. ACME)"
              value={form.ticker}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  ticker: e.target.value.toUpperCase().slice(0, 10),
                }))
              }
              required
              style={s.input}
            />

            {/* Logo */}
            <label style={s.label}>Logo</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <div
              onClick={() => fileRef.current?.click()}
              style={s.logoUpload}
            >
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div style={s.logoPlaceholder}>
                  <span style={{ fontSize: 24, marginBottom: 4 }}>+</span>
                  <span style={{ fontSize: 11 }}>Click to upload</span>
                </div>
              )}
              <p style={s.logoHint}>
                JPEG, PNG, GIF or WebP. Max 5MB.
              </p>
            </div>

            {/* Description */}
            <label style={s.label}>Description (Optional)</label>
            <textarea
              placeholder="Write a short description of your startup idea (e.g. Uber but for private jets. bc wagmi)"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  description: e.target.value.slice(0, 200),
                }))
              }
              rows={3}
              style={s.textarea}
            />
            <p style={s.charCount}>{form.description.length}/200</p>

            {/* Social links toggle */}
            <button
              type="button"
              onClick={() => setShowSocials(!showSocials)}
              style={s.socialsToggle}
            >
              {showSocials ? "Hide" : "Add"} social links
              <span style={{ color: "#555", marginLeft: 4 }}>(Optional)</span>
            </button>

            {showSocials && (
              <div style={s.socialsWrap}>
                <label style={s.label}>Twitter / X</label>
                <input
                  type="text"
                  placeholder="https://x.com/yourstartup"
                  value={form.twitter}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, twitter: e.target.value }))
                  }
                  style={s.input}
                />
                <label style={s.label}>Website</label>
                <input
                  type="text"
                  placeholder="https://yourstartup.com"
                  value={form.website}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, website: e.target.value }))
                  }
                  style={s.input}
                />
              </div>
            )}

            {/* Initial purchase */}
            <div style={s.purchaseSection}>
              <h3 style={s.sectionTitle}>Initial purchase (optional)</h3>
              <p style={s.sectionHint}>
                Be the first to invest in your startup idea. Shows you believe
                in your own project.
              </p>

              <p style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                Available:{" "}
                <span
                  style={{
                    color: "#0ecb81",
                    fontWeight: 600,
                    fontFamily: "monospace",
                  }}
                >
                  0.93823 ETH
                </span>
              </p>

              <div style={s.purchaseRow}>
                <div style={s.purchaseToggle}>Switch to token</div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={form.initialPurchase}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      initialPurchase: e.target.value,
                    }))
                  }
                  style={s.purchaseInput}
                />
                <div style={s.purchaseCurrency}>ETH</div>
              </div>
            </div>

            {/* Launch button */}
            <button
              type="submit"
              disabled={submitting || !form.name || !form.ticker}
              style={{
                ...s.launchBtn,
                opacity:
                  submitting || !form.name || !form.ticker ? 0.4 : 1,
              }}
            >
              {submitting ? "Launching..." : "Launch idea"}
            </button>
            <p style={s.launchHint}>
              Launches your coin on a bonding curve. Cost: Gas fees only.
            </p>
          </form>
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
  title: {
    fontSize: 20,
    fontWeight: 700,
    margin: "8px 0 4px",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    margin: "0 0 20px",
    lineHeight: 1.4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    margin: "20px 0 8px",
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
  sectionHint: {
    fontSize: 12,
    color: "#666",
    margin: "0 0 12px",
    lineHeight: 1.5,
  },
  label: {
    display: "block",
    fontSize: 13,
    color: "#888",
    marginTop: 12,
    marginBottom: 6,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid #ffffff08",
    backgroundColor: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    color: "var(--tg-theme-text-color, #e4e4e7)",
    fontSize: 14,
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid #ffffff08",
    backgroundColor: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    color: "var(--tg-theme-text-color, #e4e4e7)",
    fontSize: 14,
    resize: "vertical" as const,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    lineHeight: 1.5,
  },
  charCount: {
    fontSize: 11,
    color: "#666",
    textAlign: "right",
    margin: "4px 0 0",
  },
  logoUpload: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    border: "1px dashed #ffffff18",
    backgroundColor: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    cursor: "pointer",
  },
  logoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 14,
    background: "#ffffff08",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    color: "#666",
    flexShrink: 0,
  },
  logoHint: {
    fontSize: 12,
    color: "#666",
    margin: 0,
    lineHeight: 1.5,
  },
  socialsToggle: {
    display: "block",
    width: "100%",
    marginTop: 16,
    padding: "10px 0",
    background: "none",
    border: "none",
    color: "#2481cc",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left" as const,
  },
  socialsWrap: {
    padding: "0 0 8px",
    borderLeft: "2px solid #ffffff08",
    paddingLeft: 12,
    marginTop: 4,
  },
  purchaseSection: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    background: "var(--tg-theme-secondary-bg-color, #1a1b23)",
    border: "none",
  },
  purchaseRow: {
    display: "flex",
    gap: 0,
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #ffffff08",
    alignItems: "center",
  },
  purchaseToggle: {
    padding: "11px 12px",
    fontSize: 11,
    color: "#666",
    whiteSpace: "nowrap" as const,
    backgroundColor: "var(--tg-theme-bg-color, #0f1117)",
  },
  purchaseInput: {
    flex: 1,
    padding: "11px 12px",
    border: "none",
    backgroundColor: "var(--tg-theme-bg-color, #0f1117)",
    color: "var(--tg-theme-text-color, #e4e4e7)",
    fontSize: 16,
    fontFamily: "monospace",
  },
  purchaseCurrency: {
    padding: "11px 16px",
    backgroundColor: "#ffffff08",
    color: "#888",
    fontSize: 14,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
  },
  launchBtn: {
    width: "100%",
    marginTop: 20,
    padding: "14px 0",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #0ecb81, #0ba36a)",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  launchHint: {
    fontSize: 11,
    color: "#666",
    textAlign: "center",
    margin: "8px 0 0",
  },
  errorBox: {
    background: "#f6465d22",
    border: "1px solid #f6465d44",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    color: "#f6465d",
    textAlign: "center",
    marginBottom: 12,
  },
  successWrap: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    height: "80vh",
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: "#0ecb8118",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 36,
  },
};
