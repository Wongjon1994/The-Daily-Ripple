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

// ─── Twelve Data — US equity indices via ETF proxies (free tier has no raw
// indices and only resolves US-listed symbols; Yahoo/Stooq are both blocked from
// the server, see git history). SPY≈S&P500/10 and DIA≈Dow/100 — tight trackers,
// scaled to the index level at display time. Stores a provider-agnostic canonical
// symbol ("^GSPC"). The four Asian indices need a paid source — omitted for now. ──
const TD = "https://api.twelvedata.com/time_series";
const tdKey = () => process.env.TWELVEDATA_API_KEY ?? "";

const TD_INDICES: Array<{ symbol: string; label: string; td: string }> = [
  { symbol: "^GSPC", label: "S&P 500", td: "SPY" },
  { symbol: "^DJI", label: "Dow Jones", td: "DIA" },
];

/** Map a chart range ("5d", "1m", "5y") to a Twelve Data outputsize (trading days). */
function rangeToOutputsize(range: string): number {
  const m = /^(\d+)\s*([dmy])$/i.exec(range.trim());
  if (!m) return 30;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  const pts = u === "d" ? n + 2 : u === "m" ? n * 23 : n * 260;
  return Math.min(5000, Math.max(5, pts));
}

async function fetchTwelveData(cfg: (typeof TD_INDICES)[number], range: string): Promise<Row[]> {
  const res = await axios.get(TD, {
    params: { symbol: cfg.td, interval: "1day", outputsize: rangeToOutputsize(range), apikey: tdKey(), format: "JSON" },
    timeout: 12000,
  });
  const d = res.data;
  if (d?.status === "error" || !Array.isArray(d?.values)) {
    throw new Error(d?.message || "no values");
  }
  return (d.values as any[])
    .map((v): Row => ({
      symbol: cfg.symbol,
      label: cfg.label,
      date: v.datetime, // "YYYY-MM-DD"
      open: num(v.open),
      high: num(v.high),
      low: num(v.low),
      close: num(v.close),
      volume: num(v.volume),
      source: "twelvedata",
    }))
    .filter((r) => r.close != null);
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

/**
 * Fetch everything and return normalised rows plus a per-source summary. `range`
 * controls the index lookback ("5d" for the daily job, "5y" for a one-time history
 * backfill). `sources` selects which groups run ("indices" | "av") so we can test
 * one provider without spending the other's quota.
 */
export async function fetchAllMetrics(
  range = "5d",
  sources: string[] = ["indices", "av"]
): Promise<{ rows: Row[]; results: FetchResult[] }> {
  const rows: Row[] = [];
  const results: FetchResult[] = [];
  const run = (group: string) => sources.includes(group);

  const record = async (symbol: string, label: string, fn: () => Promise<Row[]>) => {
    try {
      const r = await fn();
      rows.push(...r);
      // Sources differ in order (TD newest-first, AV oldest-first) — pick by max date.
      const newest = r.reduce<Row | null>((a, b) => (a && a.date > b.date ? a : b), null);
      results.push({ symbol, label, ok: true, count: r.length, latest: newest ? `${newest.date}: ${newest.close}` : undefined });
    } catch (e: any) {
      results.push({ symbol, label, ok: false, count: 0, error: e?.message ?? String(e) });
    }
  };

  // Equity indices via Twelve Data — staggered (free tier ~8 credits/min).
  if (run("indices")) {
    for (const c of TD_INDICES) {
      await record(c.symbol, c.label, () => fetchTwelveData(c, range));
      await sleep(1000);
    }
  }

  // Alpha Vantage — staggered to respect the per-minute cap (and a tight 25/day).
  if (run("av")) {
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
  }

  return { rows, results };
}
