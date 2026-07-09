/**
 * Numeric realisation sweep (Agentic Ripple, Phase C). Resolves the *open*
 * numeric-threshold signals in the ledger against real market prices and marks the
 * ones whose level has been crossed as realised — deterministically, so confidence
 * is 1.0 (no web search, no LLM).
 *
 * This mirrors the client's card-level engine (client/src/lib/trendsAnalysis.ts:
 * findThresholdSignals) but reads the same live series the client does — the
 * per-symbol daily closes exposed by getMarkets().recent (backed by market_cache) —
 * rather than the unused market_metrics table. So a ledger signal and its market
 * card realise on the same crossing.
 *
 * The threshold parser + crossing check are pure and unit-tested; the sweep is
 * chained into /api/realise ahead of the web-grounded sweep.
 */

export type Direction = "above" | "below";
export interface ParsedThreshold {
  symbol: string;
  value: number;
  direction: Direction;
}

// The instruments we can resolve numerically — the subset with a keyword-matchable
// metric and a live series (mirrors the client's MATCH_LABEL). Order matters: the
// first keyword that hits (with a level beside it) wins.
const SYMBOL_KEYWORDS: { symbol: string; kw: RegExp }[] = [
  { symbol: "^GSPC", kw: /\bs\s?&\s?p(?:\s?500)?\b|\bs and p\b/i },
  { symbol: "^DJI", kw: /\bdow(?:\s+jones)?\b|\bdjia\b/i },
  { symbol: "BRENT", kw: /\bbrent\b|\bcrude\b|\boil\b/i },
  { symbol: "GOLD", kw: /\bgold\b/i },
  { symbol: "US10Y", kw: /\b(?:10[-\s]?year|10y|treasury|yield)\b/i },
];

// A level sitting right beside the metric keyword: "above $90", "below 4%", "tops 6000".
const THRESHOLD = /(above|below|under|over|past|beyond|breaches?|tops?)\s+\$?\s?(\d[\d,.]*)/i;

/** Parse a numeric threshold (symbol + level + direction) from a signal's text,
 *  or null if it names no resolvable metric-and-level. Pure. */
export function parseSignalThreshold(text: string): ParsedThreshold | null {
  if (!text) return null;
  for (const { symbol, kw } of SYMBOL_KEYWORDS) {
    const km = kw.exec(text);
    if (!km) continue;
    // Only trust a level within a short window after the metric keyword.
    const window = text.slice(km.index, km.index + km[0].length + 50);
    const m = window.match(THRESHOLD);
    if (!m) continue;
    const value = parseFloat(m[2].replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(value)) continue;
    const direction: Direction = /below|under/.test(m[1].toLowerCase()) ? "below" : "above";
    return { symbol, value, direction };
  }
  return null;
}

/**
 * The first daily close after `afterDate` that crosses `value` in `direction`, or
 * null if none. A scale guard rejects thresholds outside a plausible band for the
 * series (guards against a unit mismatch, e.g. a "$90B valuation" mis-read onto a
 * ~4500 index). Pure.
 */
export function resolveCrossing(
  readings: { date: string; close: number }[],
  afterDate: string,
  value: number,
  direction: Direction
): { date: string; close: number } | null {
  const clean = readings.filter((r) => Number.isFinite(r.close));
  if (clean.length < 2) return null;
  const mags = clean.map((r) => Math.abs(r.close));
  const dMin = Math.min(...mags);
  const dMax = Math.max(...mags);
  if (!(value >= dMin * 0.5 && value <= dMax * 1.5)) return null;
  const later = clean.filter((r) => r.date > afterDate).sort((a, b) => (a.date < b.date ? -1 : 1));
  return later.find((r) => (direction === "below" ? r.close <= value : r.close >= value)) ?? null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Resolve every open numeric-threshold signal against live market prices; mark the
 * crossed ones realised (confidence 1.0, evidence = the crossing). Returns a
 * summary. Cheap — reads cached series, no per-signal API calls.
 */
export async function runNumericRealisationSweep(): Promise<{ checked: number; numeric: number; realised: number }> {
  const { getSignals, applySignalRealisation } = await import("./db.js");
  const { getMarkets } = await import("./markets.js");

  const open = (await getSignals("open")) as any[];
  // `recent` (last ~120 daily closes) is view-range-independent, so any range works.
  const markets = await getMarkets("1mo");
  const today = todayIso();

  let numeric = 0;
  let realised = 0;
  for (const s of open) {
    const th = parseSignalThreshold(s.signalText);
    if (!th) continue;
    numeric++;
    const recent = markets[th.symbol]?.recent ?? [];
    const readings = recent.map((r) => ({ date: r.date, close: r.v }));
    const hit = resolveCrossing(readings, s.surfacedDate, th.value, th.direction);
    if (!hit) continue;
    await applySignalRealisation(s.id, {
      status: "realised",
      confidence: 1,
      lastCheckedDate: today,
      realisedDate: hit.date,
      realisedEvidenceNote: `${th.symbol} closed ${th.direction} ${th.value} on ${hit.date} (actual ${hit.close}).`,
    });
    realised++;
  }
  return { checked: open.length, numeric, realised };
}
