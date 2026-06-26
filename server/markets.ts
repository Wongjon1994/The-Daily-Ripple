/**
 * Server-side market data — fetches Yahoo Finance through the IPRoyal residential
 * proxy so the request exits on a residential IP (Yahoo blocks Render's datacenter
 * IP with 429; CORS blocks browser fetches entirely). A shared in-memory cache
 * (10-min TTL) means N visitors collapse to a handful of upstream calls.
 *
 * Set IPROYAL_PROXY to the full proxy URL: http://user:pass@host:port
 */

import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Our range keys → Yahoo chart params.
const RANGE_MAP: Record<string, { range: string; interval: string }> = {
  "1d": { range: "1d", interval: "5m" },
  "5d": { range: "5d", interval: "15m" },
  "1mo": { range: "1mo", interval: "1d" },
  "3mo": { range: "3mo", interval: "1d" },
  "6mo": { range: "6mo", interval: "1wk" },
  ytd: { range: "ytd", interval: "1wk" },
  "1y": { range: "1y", interval: "1wk" },
  "5y": { range: "5y", interval: "1mo" },
};

const SYMBOLS = ["^STI", "^GSPC", "^DJI", "^N225", "^HSI", "^KS11", "JPY=X", "SGD=X", "EUR=X", "^TNX", "BZ=F", "GC=F"];

export interface MarketData {
  currentPrice: number;
  prevClose: number;
  dayChange: number;
  dayChangePct: number;
  rangeChangePct: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  regularMarketVolume: number;
  series: { ts: number; v: number }[];
}

function proxyAgent(): HttpsProxyAgent<string> | undefined {
  const url = process.env.IPROYAL_PROXY;
  return url ? new HttpsProxyAgent(url) : undefined;
}

async function fetchSymbol(symbol: string, rangeKey: string): Promise<MarketData> {
  const { range, interval } = RANGE_MAP[rangeKey] ?? RANGE_MAP["1mo"];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await axios.get(url, {
    httpsAgent: proxyAgent(),
    proxy: false,
    timeout: 12000,
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
  });
  const result = res.data?.chart?.result?.[0];
  const meta = result?.meta ?? {};
  const ts: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
  const series = ts.map((t, i) => ({ ts: t, v: closes[i] })).filter((p): p is { ts: number; v: number } => p.v != null);

  const price = meta.regularMarketPrice ?? series[series.length - 1]?.v ?? 0;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const first = series[0]?.v ?? prev;
  const last = series[series.length - 1]?.v ?? price;
  return {
    currentPrice: price,
    prevClose: prev,
    dayChange: price - prev,
    dayChangePct: prev ? ((price - prev) / prev) * 100 : 0,
    rangeChangePct: first ? ((last - first) / first) * 100 : 0,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
    regularMarketVolume: meta.regularMarketVolume ?? 0,
    series,
  };
}

const cache = new Map<string, { data: MarketData; ts: number }>();
const TTL_MS = 30 * 60 * 1000; // 30 min — collapses bursts onto one warm, stretches proxy GB

/** All 12 instruments for a range, served from cache; stale/missing entries refetch. */
export async function getMarkets(rangeKey: string): Promise<Record<string, MarketData | null>> {
  const out: Record<string, MarketData | null> = {};
  await Promise.all(
    SYMBOLS.map(async (symbol) => {
      const key = `${symbol}:${rangeKey}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.ts < TTL_MS) {
        out[symbol] = hit.data;
        return;
      }
      try {
        const data = await fetchSymbol(symbol, rangeKey);
        cache.set(key, { data, ts: Date.now() });
        out[symbol] = data;
      } catch {
        out[symbol] = hit?.data ?? null; // serve stale on error, else signal "unavailable"
      }
    })
  );
  return out;
}
