const SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts/v2/gn";

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error("fetchWithRetry: unreachable");
}

export interface Curve {
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
  lastTradeAt: string | null;
}

export interface Trade {
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

export async function fetchCurves(first = 50): Promise<Curve[]> {
  const res = await fetchWithRetry(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query LatestCurves($first: Int!) {
        curves(first: $first, orderBy: createdAt, orderDirection: desc) {
          id createdAt token name symbol uri creator graduated
          lastPriceUsd lastPriceEth totalVolumeEth tradeCount lastTradeAt
        }
      }`,
      variables: { first },
    }),
  });

  const json = await res.json();
  return json.data.curves;
}

export async function fetchTrades(
  curveId: string,
  first = 50
): Promise<Trade[]> {
  const res = await fetchWithRetry(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query TradesForCurve($curveId: ID!, $first: Int!) {
        trades(first: $first, orderBy: timestamp, orderDirection: desc, where: { curve: $curveId }) {
          id timestamp txHash trader side amountEth amountToken priceEth priceUsd
        }
      }`,
      variables: { curveId, first },
    }),
  });

  const json = await res.json();
  return json.data.trades;
}

export async function fetchCurveById(curveId: string): Promise<Curve | null> {
  const res = await fetchWithRetry(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query CurveById($id: ID!) {
        curve(id: $id) {
          id createdAt token name symbol uri creator graduated
          lastPriceUsd lastPriceEth totalVolumeEth tradeCount lastTradeAt
        }
      }`,
      variables: { id: curveId },
    }),
  });

  const json = await res.json();
  return json.data.curve;
}
