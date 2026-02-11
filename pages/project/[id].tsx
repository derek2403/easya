import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Geist } from 'next/font/google';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

interface Curve {
  id: string;
  createdAt: string;
  token: string;
  name: string;
  symbol: string;
  uri: string;
  creator: string;
  graduated: boolean;
  lastPriceUsd: string;
  lastPriceEth: string;
  totalVolumeEth: string;
  tradeCount: string;
  lastTradeAt: string;
}

interface Trade {
  id: string;
  timestamp: string;
  txHash: string;
  trader: string;
  side: string;
  amountEth: string;
  amountToken: string;
  priceEth: string;
  priceUsd: string;
}

interface ProjectData extends Curve {
  marketCap: number;
  priceChange: number;
  description: string;
  image: string;
  progress: number;
}

export default function Project() {
  const router = useRouter();
  const { id } = router.query;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      fetchProjectData(id as string);
      fetchTrades(id as string);
    }
  }, [id]);

  useEffect(() => {
    if (!chartContainerRef.current || !trades.length || !project) return;

    // Only run on client side
    if (typeof window === 'undefined') return;

    let chart: any = null;

    const initChart = async () => {
      try {
        // Dynamically import the chart library
        const { createChart } = await import('lightweight-charts');

        if (!chartContainerRef.current) return;

        chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: 330,
          layout: {
            background: { color: 'transparent' },
            textColor: '#9ca3af',
          },
          grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
          },
          crosshair: {
            mode: 1, // Normal crosshair mode
            vertLine: {
              width: 1,
              color: 'rgba(255, 255, 255, 0.3)',
              style: 3, // Dashed line
              labelBackgroundColor: '#10b981',
            },
            horzLine: {
              width: 1,
              color: 'rgba(255, 255, 255, 0.3)',
              style: 3, // Dashed line
              labelBackgroundColor: '#10b981',
            },
          },
          rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            scaleMargins: {
              top: 0.25,
              bottom: 0.25,
            },
          },
          timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            timeVisible: true,
            secondsVisible: false,
          },
        });

        const areaSeries = chart.addAreaSeries({
          lineColor: '#10b981',
          topColor: 'rgba(16, 185, 129, 0.4)',
          bottomColor: 'rgba(16, 185, 129, 0.0)',
          lineWidth: 2,
          priceFormat: {
            type: 'custom',
            formatter: (price: number) => {
              if (price >= 1000000) {
                return `$${(price / 1000000).toFixed(2)}M`;
              } else if (price >= 1000) {
                return `$${(price / 1000).toFixed(2)}K`;
              } else if (price >= 1) {
                return `$${price.toFixed(2)}`;
              } else if (price >= 0.0001) {
                return `$${price.toFixed(4)}`;
              } else {
                // For very small numbers, show full decimal notation
                const str = price.toFixed(20);
                return `$${str.replace(/\.?0+$/, '')}`;
              }
            },
          },
        });

        // Build data from trades (market cap = priceUsd * 1B)
        // De-duplicate timestamps to avoid chart issues
        const deduped = new Map<number, number>();
        for (const trade of trades) {
          const t = Number(trade.timestamp);
          const v = Number(trade.priceUsd) * 1_000_000_000;
          if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
          deduped.set(t, v);
        }

        const chartData = Array.from(deduped.entries())
          .map(([time, value]) => ({ time: time as any, value }))
          .sort((a, b) => a.time - b.time);

        areaSeries.setData(chartData);

        // Fit to the actual data window
        chart.timeScale().fitContent();

        const handleResize = () => {
          if (chartContainerRef.current && chart) {
            chart.applyOptions({
              width: chartContainerRef.current.clientWidth,
            });
          }
        };

        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
          if (chart) {
            chart.remove();
          }
        };
      } catch (error) {
        console.error('Chart initialization error:', error);
      }
    };

    initChart();

    return () => {
      if (chart) {
        chart.remove();
      }
    };
  }, [trades, project]);

  const fetchProjectData = async (curveId: string) => {
    try {
      const response = await fetch('https://api.goldsky.com/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts/v2/gn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `query GetCurve($id: ID!) {
            curve(id: $id) {
              id
              createdAt
              token
              name
              symbol
              uri
              creator
              graduated
              lastPriceUsd
              lastPriceEth
              totalVolumeEth
              tradeCount
              lastTradeAt
            }
          }`,
          variables: { id: curveId }
        })
      });

      const data = await response.json();

      if (data.data?.curve) {
        const curve = data.data.curve;
        const marketCap = parseFloat(curve.lastPriceUsd) * 1000000000 || 0; // 1 billion total supply
        const priceChange = (Math.random() - 0.5) * 100;
        const progress = Math.min(100, Math.random() * 100);

        let imageUrl = '';
        let description = 'No description';

        if (curve.uri) {
          const metadata = await fetchMetadata(curve.uri);
          if (metadata) {
            if (metadata.image) {
              imageUrl = convertIpfsToHttp(metadata.image);
            }
            if (metadata.description) {
              description = metadata.description;
            }
          }
        }

        setProject({
          ...curve,
          marketCap,
          priceChange,
          description,
          image: imageUrl,
          progress
        });
      }
    } catch (error) {
      console.error('Error fetching project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrades = async (curveId: string) => {
    try {
      const pageSize = 1000;
      const maxPages = 10; // 10k trades max; increase if needed
      let allTrades: Trade[] = [];

      for (let page = 0; page < maxPages; page++) {
        const response = await fetch('https://api.goldsky.com/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts/v2/gn', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `query TradesForCurve($curveId: ID!, $first: Int!, $skip: Int!) {
              trades(first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc, where: { curve: $curveId }) {
                id
                timestamp
                txHash
                trader
                side
                amountEth
                amountToken
                priceEth
                priceUsd
              }
            }`,
            variables: { curveId, first: pageSize, skip: page * pageSize }
          })
        });

        const data = await response.json();
        const chunk: Trade[] = data.data?.trades ?? [];

        allTrades = allTrades.concat(chunk);

        // If we got fewer trades than the page size, we've reached the end
        if (chunk.length < pageSize) break;
      }

      setTrades(allTrades);
    } catch (error) {
      console.error('Error fetching trades:', error);
    }
  };

  const convertIpfsToHttp = (ipfsUrl: string): string => {
    if (!ipfsUrl) return '';
    if (ipfsUrl.startsWith('ipfs://')) {
      const hash = ipfsUrl.replace('ipfs://', '');
      return `https://olive-defensive-giraffe-83.mypinata.cloud/ipfs/${hash}`;
    }
    return ipfsUrl;
  };

  const fetchMetadata = async (uri: string): Promise<{ image: string; description?: string } | null> => {
    try {
      const metadataUrl = convertIpfsToHttp(uri);
      const response = await fetch(metadataUrl);
      if (!response.ok) return null;
      const metadata = await response.json();
      return {
        image: metadata.image || '',
        description: metadata.description || metadata.name || ''
      };
    } catch (error) {
      console.error('Error fetching metadata:', error);
      return null;
    }
  };

  const formatMarketCap = (mc: number): string => {
    if (mc >= 1000000) return `$${(mc / 1000000).toFixed(2)}M`;
    if (mc >= 1000) return `$${(mc / 1000).toFixed(2)}K`;
    if (mc >= 1) return `$${mc.toFixed(2)}`;
    if (mc >= 0.01) return `$${mc.toFixed(2)}`;
    return `$${mc.toFixed(4)}`;
  };

  const getTimeAgo = (timestamp: string): string => {
    const now = Date.now();
    const created = parseInt(timestamp) * 1000;
    const diff = Math.floor((now - created) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getProgressGradient = (progress: number): string => {
    if (progress > 95) {
      return 'bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500';
    }
    return 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-400';
  };

  const formatAddress = (address: string): string => {
    if (!address) return '';
    return address.slice(-6);
  };

  const formatTxHash = (txHash: string): string => {
    if (!txHash) return '';
    return txHash.slice(0, 6);
  };

  const formatTokenAmount = (amount: string): string => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    const inMillions = num / 1000000;
    // Remove trailing zeros
    return parseFloat(inMillions.toFixed(2)).toString();
  };

  const formatNumber = (num: string | number): string => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return '0';
    if (n === 0) return '0';

    // For very small numbers, find the first significant digit
    if (n < 0.000001) {
      const str = n.toFixed(20);
      // Remove trailing zeros
      return str.replace(/\.?0+$/, '');
    }

    if (n < 1) return n.toFixed(10).replace(/\.?0+$/, '');
    return n.toFixed(8).replace(/\.?0+$/, '');
  };

  if (loading || !project) {
    return (
      <div className={`min-h-screen bg-background text-foreground ${geistSans.className} flex items-center justify-center`}>
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{project.name} - RobinPump</title>
        <meta name="description" content={project.description} />
      </Head>

      <div className={`min-h-screen bg-background text-foreground ${geistSans.className}`}>
        {/* Header */}
        <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-50 w-full">
          <div className="w-full max-w-[1400px] mx-auto px-2 sm:px-3 h-14 sm:h-16 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-8 min-w-0">
              <a className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity shrink-0" href="/">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 sm:w-6 sm:h-6 text-primary fill-primary">
                  <path d="M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z"></path>
                  <path d="M16 8 2 22"></path>
                  <path d="M17.5 15H9"></path>
                </svg>
                <span className="font-bold text-lg sm:text-xl tracking-tight text-foreground">RobinPump</span>
              </a>
              <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
                <a className="text-muted-foreground hover:text-foreground transition-colors" href="/leaderboard">Leaderboard</a>
              </nav>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg hover:bg-muted/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path>
                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path>
                </svg>
                Log in
              </button>
              <a className="bg-primary text-primary-foreground px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 sm:gap-2" href="/create">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M5 12h14"></path>
                  <path d="M12 5v14"></path>
                </svg>
                Launch
              </a>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          <div className="max-w-[1400px] mx-auto px-4 py-6">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"></path>
              </svg>
              Back
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Main Info */}
              <div className="lg:col-span-2 space-y-4">
                {/* Project Header */}
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    {/* Project Image */}
                    <div className="w-32 h-32 relative bg-muted rounded-lg overflow-hidden shrink-0">
                      {project.image ? (
                        <Image
                          alt={project.name}
                          fill
                          className="object-cover"
                          src={project.image}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
                      )}
                    </div>

                    {/* Project Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h1 className="text-3xl font-bold text-foreground mb-1">{project.name}</h1>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-mono">{project.symbol}</span>
                            <span>•</span>
                            <span className="font-mono text-xs">{formatAddress(project.token)}</span>
                          </div>
                        </div>
                        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors">
                          Share
                        </button>
                      </div>

                      <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="text-primary">👤</span>
                        <span>by: <span className="font-mono">{formatAddress(project.creator)}</span></span>
                        <span>•</span>
                        <span>{getTimeAgo(project.createdAt)}</span>
                      </div>

                      {project.graduated && (
                        <div className="mt-3 inline-block bg-gradient-to-r from-primary to-green-500 text-white text-xs font-bold px-3 py-1 rounded">
                          Graduated
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Market Cap */}
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Market Cap</div>
                      <div className="text-3xl font-bold text-foreground">{formatMarketCap(project.marketCap)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground mb-1">ATH</div>
                      <div className="text-xl font-bold text-foreground">
                        {formatMarketCap(project.marketCap * 1.2)}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-3 bg-muted/50 rounded-full border border-border overflow-hidden mb-2">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${getProgressGradient(project.progress)}`}
                      style={{ width: `${project.progress}%` }}
                    >
                      <div className="absolute inset-0 opacity-30 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,.2)_25%,rgba(255,255,255,.2)_50%,transparent_50%,transparent_75%,rgba(255,255,255,.2)_75%,rgba(255,255,255,.2))] bg-[length:10px_10px]"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-semibold ${project.priceChange >= 0 ? 'text-primary' : 'text-red-500'}`}>
                      {project.priceChange >= 0 ? '↑' : '↓'} {Math.abs(project.priceChange).toFixed(2)}% 24hr
                    </span>
                    <span className="text-muted-foreground">
                      Vol 24h: {parseFloat(project.totalVolumeEth).toFixed(2)} ETH
                    </span>
                  </div>
                </div>

                {/* Trading Chart */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden px-4 pt-4 pb-2">
                  <div className="relative -ml-4" style={{ width: 'calc(100% + 16px)' }}>
                    <div ref={chartContainerRef} className="w-full" />
                  </div>
                </div>

                {/* Price Info */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-xs text-muted-foreground mb-1">Price</div>
                    <div className="text-sm font-bold text-foreground">${formatNumber(project.lastPriceUsd)}</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-xs text-muted-foreground mb-1">From Launch</div>
                    <div className="text-sm font-bold text-primary">↑ 144.20%</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-xs text-muted-foreground mb-1">Price (in ETH)</div>
                    <div className="text-sm font-bold text-foreground">{formatNumber(project.lastPriceEth)}</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-xs text-muted-foreground mb-1">ETH/USD</div>
                    <div className="text-sm font-bold text-foreground">$1949.55</div>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-card border border-border rounded-lg p-6">
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                </div>

                {/* Trades Table */}
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-lg font-bold text-foreground mb-4">Trades</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-xs text-muted-foreground font-medium pb-3">Account</th>
                          <th className="text-left text-xs text-muted-foreground font-medium pb-3">Type</th>
                          <th className="text-left text-xs text-muted-foreground font-medium pb-3">Amount (ETH)</th>
                          <th className="text-left text-xs text-muted-foreground font-medium pb-3">Amount ({project.symbol})</th>
                          <th className="text-left text-xs text-muted-foreground font-medium pb-3">Time</th>
                          <th className="text-left text-xs text-muted-foreground font-medium pb-3">Txn</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map((trade) => (
                          <tr key={trade.id} className="border-b border-border/50">
                            <td className="py-3 text-sm font-mono">{formatAddress(trade.trader)}</td>
                            <td className="py-3">
                              <span className={`text-sm font-semibold ${trade.side === 'BUY' ? 'text-primary' : 'text-red-500'}`}>
                                {trade.side === 'BUY' ? 'Buy' : 'Sell'}
                              </span>
                            </td>
                            <td className="py-3 text-sm">{parseFloat(parseFloat(trade.amountEth).toFixed(8)).toString()}</td>
                            <td className={`py-3 text-sm font-semibold ${trade.side === 'BUY' ? 'text-primary' : 'text-red-500'}`}>
                              {formatTokenAmount(trade.amountToken)}M
                            </td>
                            <td className="py-3 text-sm text-muted-foreground">{getTimeAgo(trade.timestamp)}</td>
                            <td className="py-3">
                              <a
                                href={`https://basescan.org/tx/${trade.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-mono text-primary hover:underline"
                              >
                                {formatTxHash(trade.txHash)}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column - Trading */}
              <div className="space-y-4">
                {/* Connect to Trade */}
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">Connect to Trade</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Connect wallet to trade {project.symbol} and start winning
                    </p>
                    <button className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      Connect Wallet
                    </button>
                    <div className="mt-4 text-xs text-muted-foreground">
                      Or view on <a href="https://basescan.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Basescan</a>
                    </div>
                  </div>
                </div>

                {/* Bonding Curve Progress */}
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-foreground">Bonding Curve Progress</h3>
                    <span className="text-lg font-bold text-primary">{project.progress.toFixed(1)}%</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-3 bg-muted/50 rounded-full border border-border overflow-hidden mb-4">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${getProgressGradient(project.progress)}`}
                      style={{ width: `${project.progress}%` }}
                    >
                      <div className="absolute inset-0 opacity-30 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,.2)_25%,rgba(255,255,255,.2)_50%,transparent_50%,transparent_75%,rgba(255,255,255,.2)_75%,rgba(255,255,255,.2))] bg-[length:10px_10px]"></div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">0.84 ETH in bonding curve</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">$43,865 to graduate</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
