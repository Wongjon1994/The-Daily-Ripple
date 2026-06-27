/**
 * Server-side market data, free tier, fetched on demand (no cron). Twelve Data
 * for US indices via the SPY/DIA ETFs (scaled to index level), Alpha Vantage for
 * Brent / Gold / 10Y yield / SGD FX. One fetch per symbol returns the full daily
 * series; range tabs just re-slice the cache, so no extra API calls. A per-symbol
 * cache (TD 30 min, AV 6 h) keeps AV within its tight 25/day free quota and
 * collapses all visitors onto a few upstream calls. Browser reads /api/markets.
 */

import axios from "axios";

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
  /** Last ~120 daily closes (ISO date) for signal-realisation, view-range-independent. */
  recent: { date: string; v: number }[];
}

type Source = "td" | "av";
interface Inst {
  symbol: string;
  label: string;
  source: Source;
  td?: { sym: string; scale: number };
  av?: { fn: string; params?: Record<string, string> };
}

const INSTRUMENTS: Inst[] = [
  { symbol: "^GSPC", label: "S&P 500", source: "td", td: { sym: "SPY", scale: 10 } },
  { symbol: "^NDX", label: "Nasdaq 100", source: "td", td: { sym: "QQQ", scale: 41 } }, // QQQ ETF ≈ NDX/41 (approx, drifts)
  { symbol: "^DJI", label: "Dow Jones", source: "td", td: { sym: "DIA", scale: 100 } },
  { symbol: "BRENT", label: "Brent Crude", source: "av", av: { fn: "BRENT" } },
  { symbol: "GOLD", label: "Gold", source: "td", td: { sym: "XAU/USD", scale: 1 } },
  { symbol: "US10Y", label: "US 10Y", source: "av", av: { fn: "TREASURY_YIELD", params: { maturity: "10year" } } },
  // FX via TD forex (real-time-ish; fresher than AV's laggy FX_DAILY).
  { symbol: "USDSGD", label: "USD/SGD", source: "td", td: { sym: "USD/SGD", scale: 1 } },
  { symbol: "JPYSGD", label: "JPY/SGD", source: "td", td: { sym: "JPY/SGD", scale: 1 } },
  { symbol: "EURSGD", label: "EUR/SGD", source: "td", td: { sym: "EUR/SGD", scale: 1 } },
  { symbol: "GBPSGD", label: "GBP/SGD", source: "td", td: { sym: "GBP/SGD", scale: 1 } },
  { symbol: "AUDSGD", label: "AUD/SGD", source: "td", td: { sym: "AUD/SGD", scale: 1 } },
  { symbol: "CNYSGD", label: "CNY/SGD", source: "td", td: { sym: "CNY/SGD", scale: 1 } },
];

const AV = "https://www.alphavantage.co/query";
const TD = "https://api.twelvedata.com/time_series";
const avKey = () => process.env.ALPHAVANTAGE_API_KEY ?? "";
const tdKey = () => process.env.TWELVEDATA_API_KEY ?? "";
const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : NaN;
};
const toTs = (date: string) => Math.floor(new Date(date).getTime() / 1000);

interface RawSeries {
  series: { ts: number; v: number }[]; // oldest first
  volume: number;
}

async function fetchTD(td: { sym: string; scale: number }): Promise<RawSeries> {
  const res = await axios.get(TD, {
    params: { symbol: td.sym, interval: "1day", outputsize: 1500, apikey: tdKey(), format: "JSON" },
    timeout: 15000,
  });
  const d = res.data;
  if (d?.status === "error" || !Array.isArray(d?.values)) throw new Error(d?.message || "TD no values");
  const vals = [...d.values].reverse(); // API is newest-first
  const series = vals.map((v: any) => ({ ts: toTs(v.datetime), v: num(v.close) * td.scale })).filter((p) => Number.isFinite(p.v));
  return { series, volume: num(vals[vals.length - 1]?.volume) || 0 };
}

async function fetchAvSeries(fn: string, params: Record<string, string>): Promise<RawSeries> {
  const res = await axios.get(AV, { params: { function: fn, interval: "daily", apikey: avKey(), ...params }, timeout: 15000 });
  const data = res.data?.data;
  if (!Array.isArray(data)) throw new Error(res.data?.Information || res.data?.Note || "AV no data");
  const series = [...data]
    .reverse()
    .map((d: any) => ({ ts: toTs(d.date), v: num(d.value) }))
    .filter((p) => Number.isFinite(p.v));
  return { series, volume: 0 };
}

function fetchInst(inst: Inst): Promise<RawSeries> {
  if (inst.source === "td") return fetchTD(inst.td!);
  return fetchAvSeries(inst.av!.fn, inst.av!.params ?? {});
}

// ── per-symbol cache (in-memory, backed by the market_cache table) ──────────────
const TTL = { td: 30 * 60 * 1000, av: 12 * 60 * 60 * 1000 };
const cache = new Map<string, { raw: RawSeries; ts: number }>();

// Hydrate the in-memory cache from the DB once, so a cold start (or a quota-blocked
// upstream) serves last-known-good instead of "Data unavailable".
let hydrated = false;
async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const { getAllMarketCache } = await import("./db.js");
    for (const row of await getAllMarketCache()) {
      if (!cache.has(row.symbol)) cache.set(row.symbol, { raw: row.payload as RawSeries, ts: row.fetchedAt });
    }
  } catch (e) {
    console.log("[markets] cache hydrate failed:", e);
  }
}

const RANGE_DAYS: Record<string, number> = { "1d": 2, "5d": 7, "1mo": 31, "3mo": 93, "6mo": 186, "1y": 366, "5y": 1830 };

function sliceRange(series: { ts: number; v: number }[], rangeKey: string): { ts: number; v: number }[] {
  if (series.length <= 2) return series;
  const lastTs = series[series.length - 1].ts;
  let cutoff: number;
  if (rangeKey === "ytd") cutoff = Math.floor(new Date(new Date().getUTCFullYear(), 0, 1).getTime() / 1000);
  else cutoff = lastTs - (RANGE_DAYS[rangeKey] ?? 31) * 86400;
  const win = series.filter((p) => p.ts >= cutoff);
  return win.length >= 2 ? win : series.slice(-2);
}

function build(raw: RawSeries, rangeKey: string): MarketData {
  const full = raw.series;
  const current = full[full.length - 1]?.v ?? 0;
  const prev = full[full.length - 2]?.v ?? current;
  const yearAgo = full[full.length - 1].ts - 366 * 86400;
  const yearWin = full.filter((p) => p.ts >= yearAgo);
  const win = sliceRange(full, rangeKey);
  const first = win[0]?.v ?? current;
  return {
    currentPrice: current,
    prevClose: prev,
    dayChange: current - prev,
    dayChangePct: prev ? ((current - prev) / prev) * 100 : 0,
    rangeChangePct: first ? ((current - first) / first) * 100 : 0,
    fiftyTwoWeekHigh: yearWin.length ? Math.max(...yearWin.map((p) => p.v)) : current,
    fiftyTwoWeekLow: yearWin.length ? Math.min(...yearWin.map((p) => p.v)) : current,
    regularMarketVolume: raw.volume,
    series: win,
    recent: full.slice(-120).map((p) => ({ date: new Date(p.ts * 1000).toISOString().slice(0, 10), v: p.v })),
  };
}

/** All instruments for a range; per-symbol cache, AV staggered to respect 5/min. */
export async function getMarkets(rangeKey: string): Promise<Record<string, MarketData | null>> {
  await hydrate();
  const out: Record<string, MarketData | null> = {};
  // Refresh only the symbols whose cache is stale; stagger AV to stay under 1/sec.
  for (const inst of INSTRUMENTS) {
    const hit = cache.get(inst.symbol);
    const fresh = hit && Date.now() - hit.ts < TTL[inst.source];
    if (!fresh) {
      try {
        const raw = await fetchInst(inst);
        const ts = Date.now();
        cache.set(inst.symbol, { raw, ts });
        try {
          const { upsertMarketCache } = await import("./db.js");
          await upsertMarketCache(inst.symbol, raw, ts);
        } catch (e) {
          console.log(`[markets] ${inst.symbol} persist failed: ${e}`);
        }
        if (inst.source === "av") await new Promise((r) => setTimeout(r, 1300));
      } catch (e: any) {
        // Keep the existing cache entry (in-memory or DB-hydrated) — serve last-good.
        console.log(`[markets] ${inst.symbol} fetch failed: ${e?.message ?? e}`);
      }
    }
    const cached = cache.get(inst.symbol);
    out[inst.symbol] = cached ? build(cached.raw, rangeKey) : null;
  }
  return out;
}
