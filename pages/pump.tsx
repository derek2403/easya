import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
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

interface CoinData extends Curve {
  marketCap: number;
  priceChange: number;
  description: string;
  image: string;
  timeAgo: string;
  progress: number;
}

// Default wallet — same deterministic address as the Telegram bot portfolio
const DEFAULT_WALLET_ADDRESS = '0x2345a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d33690';

interface LaunchedStartup {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  description: string;
  creatorAddress: string;
  initialPurchase: number;
  lastPriceUsd: string;
  totalVolumeEth: string;
  tradeCount: string;
  createdAt: number;
}

export default function Pump() {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'newest' | 'marketCap'>('marketCap');
  const [walletConnected, setWalletConnected] = useState(false);
  const [launchedStartups, setLaunchedStartups] = useState<CoinData[]>([]);

  useEffect(() => {
    fetchCoins();
    fetchLaunchedStartups();
  }, []);

  const fetchCoins = async () => {
    try {
      const response = await fetch('https://api.goldsky.com/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts/v2/gn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `query LatestCurves($first: Int!) {
            curves(first: $first, orderBy: createdAt, orderDirection: desc) {
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
          variables: { first: 50 }
        })
      });

      const data = await response.json();

      if (data.data?.curves) {
        const processedCoins = await Promise.all(
          data.data.curves.map(async (curve: Curve) => {
            const marketCap = parseFloat(curve.lastPriceUsd) * 1000000 || Math.random() * 10000;
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

            return {
              ...curve,
              marketCap,
              priceChange,
              description,
              image: imageUrl,
              timeAgo: getTimeAgo(curve.createdAt),
              progress
            };
          })
        );

        setCoins(processedCoins);
      }
    } catch (error) {
      console.error('Error fetching coins:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLaunchedStartups = async () => {
    try {
      const res = await fetch('/api/launch');
      if (!res.ok) return;
      const startups: LaunchedStartup[] = await res.json();
      const asCoinData: CoinData[] = startups.map((s) => ({
        id: s.id,
        createdAt: String(Math.floor(s.createdAt / 1000)),
        token: s.id,
        name: s.name,
        symbol: s.symbol,
        uri: '',
        creator: s.creatorAddress || DEFAULT_WALLET_ADDRESS,
        graduated: false,
        lastPriceUsd: s.lastPriceUsd,
        lastPriceEth: '0',
        totalVolumeEth: s.totalVolumeEth,
        tradeCount: s.tradeCount,
        lastTradeAt: String(Math.floor(s.createdAt / 1000)),
        marketCap: parseFloat(s.lastPriceUsd) * 1000000 || 100,
        priceChange: 0,
        description: s.description || 'Newly launched startup',
        image: s.logo || '',
        timeAgo: getTimeAgo(String(Math.floor(s.createdAt / 1000))),
        progress: Math.random() * 15,
      }));
      setLaunchedStartups(asCoinData);
    } catch (err) {
      console.error('Error fetching launched startups:', err);
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

  const getTimeAgo = (timestamp: string): string => {
    const now = Date.now();
    const created = parseInt(timestamp) * 1000;
    const diff = Math.floor((now - created) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const formatMarketCap = (mc: number): string => {
    if (mc >= 1000000) return `$${(mc / 1000000).toFixed(2)}M`;
    if (mc >= 1000) return `$${(mc / 1000).toFixed(2)}K`;
    return `$${mc.toFixed(2)}`;
  };

  const getProgressGradient = (progress: number): string => {
    if (progress > 95) {
      return 'bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500';
    }
    return 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-400';
  };

  const sortedCoins = (() => {
    const subgraphCoins = [...coins].sort((a, b) => {
      if (activeTab === 'marketCap') return b.marketCap - a.marketCap;
      return parseInt(b.createdAt) - parseInt(a.createdAt);
    });
    // Launched startups always appear at the top
    return [...launchedStartups, ...subgraphCoins];
  })();

  return (
    <>
      <Head>
        <title>RobinPump - Live Coins</title>
        <meta name="description" content="RobinPump - Live cryptocurrency trading" />
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
              {walletConnected ? (
                <button className="text-sm font-bold text-foreground flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg bg-muted/50 border border-border">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="font-mono text-xs sm:text-sm">
                    {DEFAULT_WALLET_ADDRESS.slice(0, 6)}...{DEFAULT_WALLET_ADDRESS.slice(-4)}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setWalletConnected(true)}
                  className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg hover:bg-muted/50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path>
                    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path>
                  </svg>
                  Log in
                </button>
              )}
              <a className="bg-primary text-primary-foreground px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 sm:gap-2" href="/launch">
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
          <div className="min-h-screen bg-background text-foreground">
            <section className="pt-6 pb-20 max-w-[1400px] mx-auto px-0.5 sm:px-1">
              {/* Title and Live Indicator */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Live coins</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">Live</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="mb-4">
                <div className="inline-flex gap-1 p-1 bg-muted rounded-xl">
                  <button
                    onClick={() => setActiveTab('newest')}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${activeTab === 'newest'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Newest
                  </button>
                  <button
                    onClick={() => setActiveTab('marketCap')}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${activeTab === 'marketCap'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Market Cap
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Coins Grid */}
              {!loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2">
                  {sortedCoins.map((coin) => (
                    <a
                      key={coin.id}
                      className="group block"
                      href={`/project/${coin.id}`}
                    >
                      <article className="bg-card border border-border rounded-lg overflow-hidden flex transition-transform duration-150 hover:scale-[1.025]">
                        {/* Image */}
                        <div className="w-24 sm:w-28 md:w-32 aspect-square relative bg-muted shrink-0">
                          {coin.image ? (
                            <Image
                              alt={coin.name}
                              fill
                              className="object-cover"
                              src={coin.image}
                              sizes="(max-width: 791px) 100vw, (max-width: 1161px) 50vw, (max-width: 1561px) 33vw, 25vw"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
                          )}
                          {coin.graduated && (
                            <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 bg-gradient-to-r from-primary to-green-500 text-white text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded">
                              Graduated
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-2 sm:p-3 flex flex-col min-w-0 justify-between gap-0.5 overflow-hidden">
                          <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors leading-tight truncate">
                            {coin.name}
                          </h3>
                          <div className="text-xs sm:text-sm text-muted-foreground truncate">
                            {coin.symbol}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-muted-foreground min-w-0 overflow-hidden">
                            <span className="text-primary shrink-0">👤</span>
                            <span className="font-mono truncate">{coin.creator.slice(2, 8)}</span>
                            <span className="shrink-0 whitespace-nowrap">{coin.timeAgo}</span>
                          </div>

                          {/* Market Cap and Progress */}
                          <div className="flex items-center gap-1 sm:gap-2 min-w-0 overflow-hidden">
                            <span className="text-xs sm:text-sm font-semibold text-foreground shrink-0 whitespace-nowrap">
                              MC {formatMarketCap(coin.marketCap)}
                            </span>
                            <div className="flex-1 min-w-6 sm:min-w-12">
                              <div className="relative h-2.5 flex-1 overflow-visible">
                                <div className="absolute inset-0 bg-muted/50 rounded-full border border-border"></div>
                                <div
                                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 overflow-hidden ${getProgressGradient(coin.progress)}`}
                                  style={{ width: `${coin.progress}%` }}
                                >
                                  <div className="absolute inset-0 opacity-30 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,.2)_25%,rgba(255,255,255,.2)_50%,transparent_50%,transparent_75%,rgba(255,255,255,.2)_75%,rgba(255,255,255,.2))] bg-[length:10px_10px]"></div>
                                </div>
                              </div>
                            </div>
                            <span className="inline-flex">
                              <span className={`text-xs sm:text-sm font-semibold shrink-0 whitespace-nowrap ${coin.priceChange >= 0 ? 'text-primary' : 'text-red-500'
                                }`}>
                                {coin.priceChange >= 0 ? '↑' : '↓'} {Math.abs(coin.priceChange).toFixed(2)}%
                              </span>
                            </span>
                          </div>

                          {/* Description */}
                          <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {coin.description}
                          </p>
                        </div>
                      </article>
                    </a>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!loading && coins.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                  <p>No coins available at the moment.</p>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
