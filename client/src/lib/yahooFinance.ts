/**
 * Client-side Yahoo Finance fetch. Runs in the visitor's browser so requests
 * come from a residential IP — Yahoo blocks datacenter IPs (Render) but not
 * normal browsers. No API key, no server, no cost. Unofficial endpoint, so this
 * can rate-limit (429) or break without notice; cards degrade to "unavailable".
 */

const YF1 = "https://query1.finance.yahoo.com";
const YF2 = "https://query2.finance.yahoo.com";

export type QuoteResult = {
  regularMarketPrice: number;
  regularMarketPreviousClose: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
};

export type ChartPoint = { ts: number; v: number };

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

/** Fetch a chart path, trying query1 then query2. */
async function yfChart(path: string): Promise<any> {
  for (const base of [YF1, YF2]) {
    try {
      const res = await fetch(`${base}${path}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      /* try next base */
    }
  }
  throw new Error("yahoo fetch failed");
}

/** Quote pulled from the chart endpoint's `meta` (avoids the separate quote API). */
export async function fetchQuote(symbol: string): Promise<QuoteResult> {
  const json = await yfChart(`/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`);
  const meta = json?.chart?.result?.[0]?.meta ?? {};
  const price = meta.regularMarketPrice ?? 0;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
  return {
    regularMarketPrice: price,
    regularMarketPreviousClose: prev,
    regularMarketChange: price - prev,
    regularMarketChangePercent: prev ? ((price - prev) / prev) * 100 : 0,
    regularMarketVolume: meta.regularMarketVolume ?? 0,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
  };
}

export async function fetchChart(symbol: string, range: string): Promise<ChartPoint[]> {
  const { range: r, interval } = RANGE_MAP[range] ?? RANGE_MAP["1mo"];
  const json = await yfChart(`/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${r}`);
  const result = json?.chart?.result?.[0];
  if (!result) return [];
  const ts: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  return ts
    .map((t, i) => ({ ts: t, v: closes[i] ?? null }))
    .filter((p): p is ChartPoint => p.v !== null);
}

export async function fetchInstrument(symbol: string, range: string): Promise<{ quote: QuoteResult; chart: ChartPoint[] }> {
  const [quote, chart] = await Promise.all([fetchQuote(symbol), fetchChart(symbol, range)]);
  return { quote, chart };
}
