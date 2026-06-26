/**
 * Direct market-data fetchers — Yahoo Finance (equity indices) + Alpha Vantage
 * (commodities, yield, FX) + MAS (SORA). No n8n, no LLM: call API, parse, store.
 *
 * Known-shape parsers (Yahoo chart, AV FX_DAILY / TREASURY_YIELD / BRENT) are
 * built to documented response shapes. The two unverified sources — AV
 * GOLD_SILVER_SPOT and the MAS SORA endpoint — log their raw response and parse
 * defensively; finalise those parsers against what the first real run returns.
 */

import axios from "axios";
import type { InsertMarketMetric } from "../drizzle/schema.js";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type Row = Omit<InsertMarketMetric, "id" | "fetchedAt">;

export interface FetchResult {
  symbol: string;
  label: string;
  ok: boolean;
  count: number;
  latest?: string; // "date: close"
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

// ─── Yahoo Finance — equity indices (unofficial; robots.txt disallows; UA req'd) ──
const YAHOO_INDICES: Array<{ symbol: string; label: string }> = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^DJI", label: "Dow Jones" },
  { symbol: "^STI", label: "STI" },
  { symbol: "^N225", label: "Nikkei 225" },
  { symbol: "^HSI", label: "Hang Seng" },
  { symbol: "^KS11", label: "KOSPI" },
];

async function fetchYahoo(symbol: string, label: string, range: string): Promise<Row[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const res = await axios.get(url, {
    params: { range, interval: "1d" },
    headers: { "User-Agent": BROWSER_UA },
    timeout: 10000,
  });
  const result = res.data?.chart?.result?.[0];
  const ts: number[] = result?.timestamp ?? [];
  const q = result?.indicators?.quote?.[0] ?? {};
  const rows: Row[] = [];
  for (let i = 0; i < ts.length; i++) {
    const close = num(q.close?.[i]);
    if (close == null) continue; // skip incomplete sessions
    rows.push({
      symbol,
      label,
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: num(q.open?.[i]),
      high: num(q.high?.[i]),
      low: num(q.low?.[i]),
      close,
      volume: num(q.volume?.[i]),
      source: "yahoo",
    });
  }
  return rows;
}

// ─── Alpha Vantage ────────────────────────────────────────────────────────────
const AV = "https://www.alphavantage.co/query";
const avKey = () => process.env.ALPHAVANTAGE_API_KEY ?? "";

const AV_FX: Array<{ symbol: string; label: string; from: string; to: string }> = [
  { symbol: "USDSGD", label: "USD/SGD", from: "USD", to: "SGD" },
  { symbol: "JPYSGD", label: "JPY/SGD", from: "JPY", to: "SGD" },
  { symbol: "EURSGD", label: "EUR/SGD", from: "EUR", to: "SGD" },
];

async function fetchAvFx(cfg: (typeof AV_FX)[number]): Promise<Row[]> {
  const res = await axios.get(AV, {
    params: { function: "FX_DAILY", from_symbol: cfg.from, to_symbol: cfg.to, outputsize: "compact", apikey: avKey() },
    timeout: 12000,
  });
  const series = res.data?.["Time Series FX (Daily)"];
  if (!series || typeof series !== "object") {
    throw new Error(res.data?.Information || res.data?.Note || "no FX series");
  }
  return Object.entries(series).map(([date, v]: [string, any]) => ({
    symbol: cfg.symbol,
    label: cfg.label,
    date,
    open: num(v["1. open"]),
    high: num(v["2. high"]),
    low: num(v["3. low"]),
    close: num(v["4. close"]),
    volume: null,
    source: "alphavantage",
  }));
}

/** TREASURY_YIELD / BRENT share the `{ data: [{date, value}] }` shape (value-only). */
async function fetchAvSeries(
  fn: "TREASURY_YIELD" | "BRENT",
  extraParams: Record<string, string>,
  symbol: string,
  label: string
): Promise<Row[]> {
  const res = await axios.get(AV, {
    params: { function: fn, interval: "daily", apikey: avKey(), ...extraParams },
    timeout: 12000,
  });
  const data = res.data?.data;
  if (!Array.isArray(data)) throw new Error(res.data?.Information || res.data?.Note || "no data array");
  return data
    .map((d: any): Row | null => {
      const close = num(d.value);
      return close == null ? null : { symbol, label, date: d.date, open: null, high: null, low: null, close, volume: null, source: "alphavantage" };
    })
    .filter((r): r is Row => r !== null);
}

/** AV GOLD_SILVER_SPOT — shape unverified. Log raw, parse defensively. */
async function fetchAvGold(): Promise<Row[]> {
  const res = await axios.get(AV, {
    params: { function: "GOLD_SILVER_SPOT", symbol: "GOLD", apikey: avKey() },
    timeout: 12000,
  });
  console.log("[marketData] GOLD_SILVER_SPOT raw:", JSON.stringify(res.data)?.slice(0, 800));
  const d = res.data ?? {};
  // Try the two plausible shapes: { data: [{date,value}] } or a time-series object.
  if (Array.isArray(d.data)) {
    return (d.data as any[])
      .map((x): Row | null => {
        const close = num(x.value);
        return close == null ? null : { symbol: "GOLD", label: "Gold", date: x.date, open: null, high: null, low: null, close, volume: null, source: "alphavantage" };
      })
      .filter((r): r is Row => r !== null);
  }
  const seriesKey = Object.keys(d).find((k) => /time series/i.test(k));
  if (seriesKey && d[seriesKey] && typeof d[seriesKey] === "object") {
    return Object.entries(d[seriesKey]).map(([date, v]: [string, any]) => ({
      symbol: "GOLD",
      label: "Gold",
      date,
      open: num(v["1. open"]),
      high: num(v["2. high"]),
      low: num(v["3. low"]),
      close: num(v["4. close"] ?? v.close ?? v.value),
      volume: null,
      source: "alphavantage" as const,
    }));
  }
  throw new Error("unrecognised GOLD_SILVER_SPOT shape — see logged raw");
}

// ─── MAS SORA — try once; if Cloudflare-blocked, caller drops it ─────────────────
async function fetchMasSora(): Promise<Row[]> {
  const res = await axios.get("https://eservices.mas.gov.sg/api/action/datastore/search.json", {
    params: { resource_id: "9a0bf149-308c-4bd2-832d-76c8e6cb47ed", limit: 1, sort: "end_of_day desc", fields: "end_of_day,comp_sora_1m,comp_sora_3m,comp_sora_6m" },
    headers: { "User-Agent": BROWSER_UA },
    timeout: 10000,
  });
  console.log("[marketData] MAS SORA raw:", JSON.stringify(res.data)?.slice(0, 500));
  const rec = res.data?.result?.records?.[0];
  const close = num(rec?.comp_sora_3m);
  if (!rec || close == null) throw new Error("no SORA record");
  return [{ symbol: "SORA3M", label: "3-Month SORA", date: rec.end_of_day, open: null, high: null, low: null, close, volume: null, source: "mas" }];
}

/**
 * Fetch everything, stagger the Alpha Vantage calls (free tier ~5/min), and return
 * normalised rows plus a per-source summary. `range` controls the Yahoo lookback
 * ("5d" for the daily job, e.g. "5y" for a one-time history backfill).
 */
export async function fetchAllMetrics(range = "5d"): Promise<{ rows: Row[]; results: FetchResult[] }> {
  const rows: Row[] = [];
  const results: FetchResult[] = [];

  const record = async (symbol: string, label: string, fn: () => Promise<Row[]>) => {
    try {
      const r = await fn();
      rows.push(...r);
      const last = r[r.length - 1];
      results.push({ symbol, label, ok: true, count: r.length, latest: last ? `${last.date}: ${last.close}` : undefined });
    } catch (e: any) {
      results.push({ symbol, label, ok: false, count: 0, error: e?.message ?? String(e) });
    }
  };

  // Yahoo — independent host, safe to run in parallel.
  await Promise.all(YAHOO_INDICES.map((c) => record(c.symbol, c.label, () => fetchYahoo(c.symbol, c.label, range))));

  // Alpha Vantage — staggered to respect the per-minute cap.
  const avJobs: Array<[string, string, () => Promise<Row[]>]> = [
    ["BRENT", "Brent Crude", () => fetchAvSeries("BRENT", {}, "BRENT", "Brent Crude")],
    ["GOLD", "Gold", () => fetchAvGold()],
    ["US10Y", "US 10-Year Yield", () => fetchAvSeries("TREASURY_YIELD", { maturity: "10year" }, "US10Y", "US 10-Year Yield")],
    ...AV_FX.map((c) => [c.symbol, c.label, () => fetchAvFx(c)] as [string, string, () => Promise<Row[]>]),
  ];
  for (const [symbol, label, fn] of avJobs) {
    await record(symbol, label, fn);
    await sleep(1500);
  }

  // MAS SORA — single probe; dropped automatically if it errors (e.g. Cloudflare).
  await record("SORA3M", "3-Month SORA", fetchMasSora);

  return { rows, results };
}
