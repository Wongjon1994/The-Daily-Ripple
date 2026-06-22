/**
 * Trends analysis — turns a set of briefs into:
 *   1. Tracked metrics (quantitative or qualitative) reported in ≥2 briefs,
 *      with their watch-signals bound and realisation status computed.
 *   2. Broader watch-signals grouped thematically.
 *
 * Realisation is detected two ways:
 *   - Threshold (reliable): a later actual reading crosses a signalled level.
 *   - Event (best-effort): a later brief reports a conditional signal's entity
 *     alongside a realisation verb. An explicit `realises` tag on a brief, when
 *     present, always wins over the heuristic.
 */

import type { DailyBrief } from "./briefParser";
import { compareDates } from "./dateUtils";

// ── types ─────────────────────────────────────────────────────────────────────
export interface MetricPoint {
  date: string;
  value: string;
  numeric: number | null;
  change?: string;
  direction?: "up" | "down" | "neutral";
  headline: string;
  category: string;
  /** Source brief slug + the story index, so a reading can deep-link back. */
  slug: string;
  storyIndex: number;
}

export interface WatchSignal {
  text: string;
  date: string;
  slug: string;
  storyIndex: number;
  headline: string;
  category: string;
}

export interface Threshold {
  value: number;
  text: string;
  direction: "above" | "below";
}

export interface BoundSignal {
  signal: WatchSignal;
  threshold?: Threshold;
  status: "realised" | "watching" | "topical";
  /** When realised: the actual reading that crossed the level. */
  realisation?: { date: string; value: string; lagDays: number };
}

export interface TrackedMetric {
  label: string;
  kind: "quant" | "qual";
  points: MetricPoint[];
  /** Outlier-filtered numeric points used to draw the sparkline (quant only). */
  chartPoints: MetricPoint[];
  thresholds: Threshold[];
  delta: number | null;
  signals: BoundSignal[];
  realisedCount: number;
}

export interface EventRealisation {
  date: string;
  snippet: string;
  lagDays: number;
}

export interface ThemeGroup {
  key: string;
  label: string;
  icon: string; // lucide-react icon name
  signals: { signal: WatchSignal; realisation?: EventRealisation }[];
  realisedCount: number;
}

// ── small helpers ──────────────────────────────────────────────────────────────
export function parseNumeric(value: string): number | null {
  const m = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (isNaN(da) || isNaN(db)) return 0;
  return Math.round((db - da) / 86_400_000);
}

/**
 * Classify a reading's dimension so we can reject series that mix incompatible
 * units across days (e.g. DJIA reported as a level one day, a point-change the
 * next, a % the next). For a named rate, a bare number and a % mean the same
 * thing (4.5 ≡ 4.5%), so they collapse to one dimension.
 */
export type MetricDim = "pct" | "points" | "currency" | "level" | "qual";
export function classifyDim(value: string, isRate: boolean): MetricDim {
  const v = value.toLowerCase();
  if (!/\d/.test(v)) return "qual";
  if (/\bpoints?\b|\bpts\b|\bbps\b/.test(v)) return "points";
  if (/%/.test(v)) return isRate ? "level" : "pct";
  if (/\$|usd|€|£|\/barrel|\/bbl|\bbn\b|billion|trillion/.test(v)) return "currency";
  return "level";
}

/** Numeric points with gross scale-outliers (>2.5× off the median) removed. */
export function chartablePoints(points: MetricPoint[]): MetricPoint[] {
  const numeric = points.filter((p) => p.numeric !== null);
  if (numeric.length < 3) return numeric;
  const sorted = numeric.map((p) => Math.abs(p.numeric!)).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  return numeric.filter((p) => {
    const m = Math.abs(p.numeric!);
    return m >= median / 2.5 && m <= median * 2.5;
  });
}

// ── metric ↔ signal matching ────────────────────────────────────────────────────
const RATE_LABEL = /yield|rate|inflation|interest/i;

// Metrics temporarily withheld from Trends (normalised labels). STI is hidden
// until the brief's daily metric set stabilises and reports it consistently.
const HIDDEN_METRICS = new Set(["sti"]);

function keywordFor(label: string): RegExp {
  const l = label.toLowerCase();
  if (/brent|crude|oil/.test(l)) return /\b(brent|crude|oil)\b/i;
  if (/treasury|yield|rate|fed/.test(l)) return /(\btreasury\b|\byield\b|\bfed\b|rate (hold|hike|cut|pivot)|interest rate)/i;
  if (/s&p|nasdaq|dow|nikkei|equit|stock/.test(l)) return /(s ?& ?p|\bnasdaq\b|\bdow\b|\bnikkei\b|equit|stock market|wall street)/i;
  const words = l
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["index", "average", "jones", "industrial", "composite"].includes(w));
  return words.length ? new RegExp(`\\b(${words.join("|")})\\b`, "i") : /a^/;
}

/** Does a signal reference this metric, and does it name a trigger threshold? */
function matchSignalToMetric(label: string, text: string): { matches: boolean; threshold?: Threshold } {
  const kw = keywordFor(label);
  const km = kw.exec(text);
  if (!km) return { matches: false };
  // Only trust a threshold sitting right beside the metric keyword.
  const start = Math.max(0, (km.index ?? 0) - 6);
  const window = text.slice(start, (km.index ?? 0) + km[0].length + 48);
  const m = window.match(
    /(above|below|under|over|past|beyond|reaches?)\s+((?:us)?\$?\s?\d[\d,.]*\s?(?:\/(?:barrel|bbl)|%|bps|billion|trillion)?)/i
  );
  if (!m) return { matches: true };
  const dirWord = m[1].toLowerCase();
  const direction: "above" | "below" = /below|under/.test(dirWord) ? "below" : "above";
  const value = parseFloat(m[2].replace(/[^0-9.]/g, ""));
  return { matches: true, threshold: { value, text: m[2].replace(/\s+/g, "").trim(), direction } };
}

// ── watch-signal extraction ─────────────────────────────────────────────────────
const WATCH = /\b(watch|monitor|keep an eye|look out|brace for|to watch|the tell)\b/i;
const ORDINAL = /^(first|second|third|fourth|fifth|finally)\b[:,]?\s*/i;
// A "…signals worth tracking:" lead-in that can prefix the first signal inline.
const HEADER = /^[^:]*\bsignals?\b[^:]*:\s*/i;
// "And if …" / "But if …" openers used for a follow-on signal in some briefs.
const LEAD_CONJ = /^(and|but|also)\s+/i;
// A whole sentence that is just the signals intro, e.g.
// "Here are the forward signals worth watching." — dropped from the body so it
// doesn't dangle once the signals are pulled out.
const INTRO_ONLY =
  /^(here are\s+|these are\s+|below are\s+)?(the\s+|a\s+)?(three\s+|several\s+|key\s+|forward\s+)*signals?\s+(worth\s+(watching|tracking|monitoring)|to\s+watch)\s*[.:]?$/i;

function splitSentences(t: string): string[] {
  return (t || "")
    .replace(/([a-z])\.([A-Z])/g, "$1. $2")
    .split(/(?<=[.!?])\s+(?=[A-Z"“'(]|If\b)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Reduce a sentence to its signal "core": strip a "…signals worth tracking:"
 *  header, then a leading ordinal ("First,"), then a leading conjunction
 *  ("And "/"But ") — so "Three signals…: First, if X" and "And if X" both
 *  reduce to "if X". */
function watchCore(raw: string): string {
  return raw.replace(HEADER, "").replace(ORDINAL, "").replace(LEAD_CONJ, "").trim();
}

/** Is a single sentence a forward-looking watch-signal worth surfacing? */
function isWatchSentence(raw: string, isSystems: boolean): boolean {
  const core = watchCore(raw);
  if (core.length < 45) return false;
  // In the synthesis, each "First/Second/Third/And if …" conditional is a signal.
  const conditional = isSystems && /^if\b/i.test(core);
  return WATCH.test(raw) || conditional;
}

/** Normalise a watch sentence (strip header/ordinal/conjunction, capitalise). */
function cleanWatchSentence(raw: string): string {
  const s = watchCore(raw);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Partition a section's narrative (Singapore Lens, or systems-synthesis prose)
 * into its analysis `body` and the forward-looking `watch` signals it contains.
 *
 * This is the single source of truth for "what counts as a signal" — both the
 * Trends "Broader signals" list (via buildWatchSignals) and the brief card's
 * watch note read from it, so the two stay matched 1-to-1 by construction.
 */
export function partitionLensWatch(
  text: string | null | undefined,
  isSystems = false
): { body: string; watch: string[] } {
  const body: string[] = [];
  const watch: string[] = [];
  for (const raw of splitSentences(text || "")) {
    if (isWatchSentence(raw, isSystems)) {
      watch.push(cleanWatchSentence(raw));
    } else if (isSystems && INTRO_ONLY.test(raw)) {
      // Drop a standalone "Here are the signals worth watching." lead-in.
    } else {
      body.push(raw);
    }
  }
  return { body: body.join(" ").trim(), watch };
}

export function buildWatchSignals(briefs: Record<string, DailyBrief>): WatchSignal[] {
  const out: WatchSignal[] = [];
  const seen = new Set<string>();
  const entries = Object.entries(briefs).sort((a, b) => compareDates(b[1].date, a[1].date));

  for (const [slug, brief] of entries) {
    brief.sections.forEach((section, idx) => {
      const isSystems = section.category === "systems";
      const text = isSystems ? section.paragraphs.join(" ") : section.singaporeLens || "";
      for (const sentence of partitionLensWatch(text, isSystems).watch) {
        const norm = sentence.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 90);
        if (seen.has(norm)) continue;
        seen.add(norm);
        out.push({
          text: sentence,
          date: brief.date,
          slug,
          storyIndex: idx,
          headline: isSystems ? "Systems synthesis" : section.headline,
          category: section.category,
        });
      }
    });
  }
  return out;
}

// ── threshold watch-statements (the reliable realisation engine) ───────────────
// Scans ALL section text (incl. story bodies) for forward-looking statements that
// name a level for a metric ("if oil holds above $90", "watch yields below 4%"),
// then checks later actual readings for a crossing. Deterministic — no guessing.
const COND = /\b(watch|expect|if|could|would|toward|approach|breach|tops?|holds?|drops?|stays?|climbs?|falls?|reaches?)\b/i;

function findThresholdSignals(
  label: string,
  readings: { date: string; numeric: number; value: string }[],
  briefs: Record<string, DailyBrief>
): BoundSignal[] {
  if (readings.length < 2) return [];
  const kw = keywordFor(label);
  const mags = readings.map((r) => Math.abs(r.numeric));
  const dMin = Math.min(...mags);
  const dMax = Math.max(...mags);
  const out: BoundSignal[] = [];
  const seen = new Set<string>();
  const entries = Object.entries(briefs).sort((a, b) => compareDates(a[1].date, b[1].date));

  for (const [slug, brief] of entries) {
    brief.sections.forEach((section, idx) => {
      const text = [section.singaporeLens || "", ...(section.paragraphs ?? [])].join(" ");
      for (const sent of splitSentences(text)) {
        if (sent.length < 30 || !COND.test(sent)) continue;
        const km = kw.exec(sent);
        if (!km) continue;
        const window = sent.slice(km.index, km.index + km[0].length + 50);
        const m = window.match(/(above|below|under|over|past|breaches?|tops?)\s+\$?\s?(\d[\d,.]*)/i);
        if (!m) continue;
        const value = parseFloat(m[2].replace(/[^0-9.]/g, ""));
        if (!(value >= dMin * 0.5 && value <= dMax * 1.5)) continue;
        const direction: "above" | "below" = /below|under/.test(m[1].toLowerCase()) ? "below" : "above";
        const key = `${value}|${direction}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const later = readings.filter((r) => compareDates(r.date, brief.date) > 0);
        const hit = later.find((r) => (direction === "below" ? r.numeric <= value : r.numeric >= value));
        out.push({
          signal: {
            text: sent.charAt(0).toUpperCase() + sent.slice(1),
            date: brief.date,
            slug,
            storyIndex: idx,
            headline: section.headline,
            category: section.category,
          },
          threshold: { value, text: m[2].replace(/\s+/g, "").trim(), direction },
          status: hit ? "realised" : "watching",
          realisation: hit
            ? { date: hit.date, value: hit.value, lagDays: daysBetween(brief.date, hit.date) }
            : undefined,
        });
      }
    });
  }
  return out.sort((a, b) => (b.status === "realised" ? 1 : 0) - (a.status === "realised" ? 1 : 0));
}

// ── tracked metrics (≥2 readings, quant or qual) ───────────────────────────────
export function buildTrackedMetrics(
  briefs: Record<string, DailyBrief>,
  watchSignals: WatchSignal[],
  claimed: Set<WatchSignal>
): TrackedMetric[] {
  const byLabel = new Map<string, { label: string; points: MetricPoint[] }>();
  const sorted = Object.entries(briefs).sort((a, b) => compareDates(a[1].date, b[1].date));

  for (const [slug, brief] of sorted) {
    brief.sections.forEach((section, storyIndex) => {
      for (const metric of section.keyMetrics ?? []) {
        const key = normalizeLabel(metric.label);
        if (!byLabel.has(key)) byLabel.set(key, { label: metric.label, points: [] });
        byLabel.get(key)!.points.push({
          date: brief.date,
          value: metric.value,
          numeric: parseNumeric(metric.value),
          change: metric.change,
          direction: metric.direction,
          headline: section.headline,
          category: section.category,
          slug,
          storyIndex,
        });
      }
    });
  }

  const metrics: TrackedMetric[] = [];
  for (const { label, points } of Array.from(byLabel.values())) {
    if (points.length < 2) continue; // reported more than once
    if (HIDDEN_METRICS.has(normalizeLabel(label))) continue;

    const isRate = RATE_LABEL.test(label);

    // ── Dimensional coherence ──────────────────────────────────────────────
    // A tracked metric must report ONE consistent dimension. Series that mix
    // levels, %-changes and point-changes under one label (DJIA, NASDAQ
    // Composite, US Dollar Index…) are not a coherent trajectory — drop them.
    const dims = points.map((p) => classifyDim(p.value, isRate)).filter((d) => d !== "qual");
    if (dims.length < 2) continue; // need ≥2 numeric readings
    const dimCounts = new Map<MetricDim, number>();
    for (const d of dims) dimCounts.set(d, (dimCounts.get(d) ?? 0) + 1);
    const topDim = Math.max(...Array.from(dimCounts.values()));
    if (topDim / dims.length < 0.6) continue; // mixed dimensions → not trackable

    // Pure change-% series (Broadcom, KOSPI, index futures) are generic daily
    // moves, not a tracked level — exclude unless the label is a named rate.
    if (points.every((p) => /%/.test(p.value)) && !isRate) continue;

    const chartPoints = chartablePoints(points);
    if (chartPoints.length < 2) continue; // need ≥2 chartable level readings

    // ── Flatline guard ─────────────────────────────────────────────────────
    // A metric that never moves (Anthropic $61B→$61bn, Alphabet $80B→$80B)
    // carries no signal — exclude if total variation is under 0.5% of scale.
    const nums = chartPoints.map((p) => p.numeric!);
    const scale = Math.max(...nums.map(Math.abs)) || 1;
    if ((Math.max(...nums) - Math.min(...nums)) / scale < 0.005) continue;

    const kind: "quant" | "qual" = "quant";

    // Period delta, guarded against absurd values.
    let delta: number | null = null;
    {
      const a = chartPoints[0]?.numeric;
      const b = chartPoints[chartPoints.length - 1]?.numeric;
      if (a && b) {
        const d = ((b - a) / Math.abs(a)) * 100;
        if (Math.abs(d) <= 400) delta = d;
      }
    }

    // Threshold watch-levels (scanned from all text, incl. bodies) drive
    // realisation. Narrative signals add topical context and get claimed out of
    // the broader list so they don't appear twice.
    const readings = (kind === "quant" ? chartPoints : points)
      .filter((p) => p.numeric !== null)
      .map((p) => ({ date: p.date, numeric: p.numeric!, value: p.value }));

    const thrSignals = findThresholdSignals(label, readings, briefs);
    const thresholds = thrSignals
      .map((s) => s.threshold!)
      .filter((t, i, arr) => arr.findIndex((x) => x.value === t.value) === i)
      .slice(0, 3);

    const topical: BoundSignal[] = [];
    for (const sig of watchSignals) {
      if (claimed.has(sig)) continue;
      const m = matchSignalToMetric(label, sig.text);
      if (!m.matches) continue;
      claimed.add(sig);
      if (!m.threshold) topical.push({ signal: sig, status: "topical" });
    }
    const signals: BoundSignal[] = [...thrSignals.slice(0, 4), ...topical];

    metrics.push({
      label,
      kind,
      points,
      chartPoints,
      thresholds: thresholds.slice(0, 3),
      delta,
      signals,
      realisedCount: signals.filter((s) => s.status === "realised").length,
    });
  }

  // Most data points first; metrics with a realised pairing float up.
  return metrics.sort(
    (a, b) => b.realisedCount - a.realisedCount || b.points.length - a.points.length
  );
}

// ── thematic grouping of broader signals ────────────────────────────────────────
const THEMES: { key: string; label: string; icon: string; re: RegExp }[] = [
  { key: "energy", label: "Energy & commodities", icon: "Flame", re: /\b(oil|brent|crude|hormuz|energy|electricity|tariff|lng|petrol|fuel|opec|commodit|gold)\b/i },
  { key: "rates", label: "Rates & banking", icon: "Landmark", re: /\b(fed|rate|yield|treasury|inflation|cpi|mas|sora|cpf|fomc|monetary|dbs|ocbc|uob|bank)\b/i },
  { key: "ai_tech", label: "AI & technology", icon: "Cpu", re: /\b(ai|artificial intelligence|chip|semiconductor|nvidia|broadcom|software|data cent|cloud|spacex|starlink|tech|algorithm|cradle|lundbeck)\b/i },
  { key: "geopolitics", label: "Geopolitics & security", icon: "Shield", re: /\b(china|iran|russia|ukraine|israel|trump|sanction|military|taiwan|war|election|protest|prabowo|defen[cs]e|navy|south china sea)\b/i },
  { key: "markets", label: "Markets & corporate", icon: "TrendingUp", re: /\b(ipo|valuation|equit|stock|nasdaq|s&p|index|earnings|merger|acquisition|reit|fund|raise|listing|shares|airtrunk|sgx)\b/i },
  { key: "society", label: "Society & culture", icon: "Sparkles", re: /\b(culture|film|music|tony|award|broadway|festival|sport|world cup|tourism|arts|esplanade|cannes|blackpink|bts)\b/i },
];

export function classifyTheme(text: string): { key: string; label: string; icon: string } {
  for (const t of THEMES) if (t.re.test(text)) return { key: t.key, label: t.label, icon: t.icon };
  return { key: "other", label: "Other signals", icon: "Telescope" };
}

export function detectEventRealisation(
  signal: WatchSignal,
  briefs: Record<string, DailyBrief>
): EventRealisation | null {
  // Heuristic event-matching (entity + realisation verb in a later brief) was
  // tested on real data and produced false positives — it can confirm an entity
  // is *mentioned* but not that the *specific predicted outcome* occurred (e.g.
  // "SpaceX confirmed excluded from index" wrongly matched "if SpaceX IPO trades
  // up"). Since wrong "realised" claims are worse than none for a trust feature,
  // event realisation is driven only by an explicit `realises` tag a curator adds
  // when hand-entering the later brief. Reliable threshold crossings are handled
  // separately by findThresholdSignals.
  type Tagged = DailyBrief & { realises?: { signal: string; outcome: string }[] };
  const later = Object.values(briefs as Record<string, Tagged>)
    .filter((b) => compareDates(b.date, signal.date) > 0)
    .sort((a, b) => compareDates(a.date, b.date));
  const needle = signal.text.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
  for (const b of later) {
    for (const tag of b.realises ?? []) {
      const hay = tag.signal.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (needle && hay.includes(needle.slice(0, 24))) {
        return { date: b.date, snippet: tag.outcome, lagDays: daysBetween(signal.date, b.date) };
      }
    }
  }
  return null;
}

export function groupBroaderSignals(
  signals: WatchSignal[],
  briefs: Record<string, DailyBrief>
): ThemeGroup[] {
  const groups = new Map<string, ThemeGroup>();
  for (const sig of signals) {
    const theme = classifyTheme(sig.text);
    if (!groups.has(theme.key)) {
      groups.set(theme.key, { ...theme, signals: [], realisedCount: 0 });
    }
    const realisation = detectEventRealisation(sig, briefs) ?? undefined;
    const g = groups.get(theme.key)!;
    g.signals.push({ signal: sig, realisation });
    if (realisation) g.realisedCount++;
  }
  // Bigger groups first; "Other" sinks to the bottom.
  return Array.from(groups.values()).sort(
    (a, b) => (a.key === "other" ? 1 : 0) - (b.key === "other" ? 1 : 0) || b.signals.length - a.signals.length
  );
}
