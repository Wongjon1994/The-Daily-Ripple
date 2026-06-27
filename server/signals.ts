/**
 * Qualitative signal extraction (Trends Part 2, Phase 0). Pulls the forward
 * "watch …" signals out of each brief's Singapore Lens / synthesis on publish and
 * persists them to the `signals` ledger. Deliberately mirrors the watch-sentence
 * and theme logic in client/src/lib/trendsAnalysis.ts (kept in sync; tested).
 * Realisation (web-grounded) and synthesis come in later phases.
 */

import type { InsertSignal } from "../drizzle/schema.js";

// ── watch-sentence extraction (parallels partitionLensWatch) ───────────────────
const WATCH = /\b(watch|monitor|keep an eye|look out|brace for|to watch|the tell)\b/i;
const ORDINAL = /^(first|second|third|fourth|fifth|finally)\b[:,]?\s*/i;
const HEADER = /^[^:]*\bsignals?\b[^:]*:\s*/i;
const LEAD_CONJ = /^(and|but|also|separately|meanwhile|elsewhere|additionally|relatedly|next)\b[,]?\s+/i;

function splitSentences(t: string): string[] {
  return (t || "")
    .replace(/([a-z])\.([A-Z])/g, "$1. $2")
    .split(/(?<=[.!?])\s+(?=[A-Z"“'(]|If\b)/)
    .map((s) => s.trim())
    .filter(Boolean);
}
function watchCore(raw: string): string {
  return raw.replace(HEADER, "").replace(ORDINAL, "").replace(LEAD_CONJ, "").trim();
}
function isWatchSentence(raw: string, isSystems: boolean): boolean {
  const core = watchCore(raw);
  if (core.length < 45) return false;
  const conditional = isSystems && /^if\b/i.test(core);
  return WATCH.test(raw) || conditional;
}
function cleanWatch(raw: string): string {
  const s = watchCore(raw);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function extractWatch(text: string, isSystems: boolean): string[] {
  const out: string[] = [];
  for (const raw of splitSentences(text || "")) if (isWatchSentence(raw, isSystems)) out.push(cleanWatch(raw));
  return out;
}

// ── theme classification (parallels classifyTheme) ─────────────────────────────
const THEMES: { key: string; re: RegExp }[] = [
  { key: "energy", re: /\b(oil|brent|crude|hormuz|energy|electricity|tariff|lng|petrol|fuel|opec|commodit|gold)\b/i },
  { key: "rates", re: /\b(fed|rate|yield|treasury|inflation|cpi|mas|sora|cpf|fomc|monetary|dbs|ocbc|uob|bank)\b/i },
  { key: "ai_tech", re: /\b(ai|artificial intelligence|chip|semiconductor|nvidia|broadcom|software|data cent|cloud|spacex|starlink|tech|algorithm|cradle|lundbeck)\b/i },
  { key: "geopolitics", re: /\b(china|iran|russia|ukraine|israel|trump|sanction|military|taiwan|war|election|protest|prabowo|defen[cs]e|navy|south china sea)\b/i },
  { key: "markets", re: /\b(ipo|valuation|equit|stock|nasdaq|s&p|index|earnings|merger|acquisition|reit|fund|raise|listing|shares|airtrunk|sgx)\b/i },
  { key: "society", re: /\b(culture|film|music|tony|award|broadway|festival|sport|world cup|tourism|arts|esplanade|cannes|blackpink|bts)\b/i },
];
export function classifyTheme(text: string): string {
  for (const t of THEMES) if (t.re.test(text)) return t.key;
  return "other";
}

// ── horizon + expiry ───────────────────────────────────────────────────────────
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Parse a named horizon ("by Q3", "in November", "in 2027", "next quarter") from
 *  the signal text → ISO end-date; null if none (caller defaults to surfaced+30d). */
export function parseHorizon(text: string, surfaced: Date): string | null {
  const l = text.toLowerCase();
  const baseYear = surfaced.getUTCFullYear();
  const ym = l.match(/\b(20[2-9]\d)\b/);
  const qm = l.match(/\bq([1-4])\b/);
  if (qm) {
    const q = parseInt(qm[1], 10);
    const y = ym ? parseInt(ym[1], 10) : baseYear;
    return iso(new Date(Date.UTC(y, q * 3, 0))); // last day of the quarter
  }
  if (/\bnext quarter\b/.test(l)) return iso(addDays(surfaced, 92));
  if (/\bnext month\b/.test(l)) return iso(addDays(surfaced, 31));
  for (let i = 0; i < 12; i++) {
    if (new RegExp(`\\b(in|by|during|come)\\s+${MONTHS[i]}\\b`).test(l)) {
      const y = i < surfaced.getUTCMonth() ? baseYear + 1 : baseYear;
      return iso(new Date(Date.UTC(y, i + 1, 0))); // last day of that month
    }
  }
  if (ym) {
    const y = parseInt(ym[1], 10);
    if (y > baseYear) return `${y}-12-31`;
  }
  return null;
}

function briefDateToIso(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return todayIso();
  // Use local calendar components: a brief dated "June 15, 2026" must stay the
  // 15th regardless of the host timezone (toISOString would shift it in UTC+ TZs).
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Extract the persistable signal rows from one brief (DB row or publish payload). */
export function extractBriefSignals(brief: any, dateSlug: string): InsertSignal[] {
  const surfacedDate = briefDateToIso(brief?.date);
  const surfaced = new Date(surfacedDate);
  const today = todayIso();
  const out: InsertSignal[] = [];
  const sections = Array.isArray(brief?.sections) ? brief.sections : [];
  sections.forEach((sec: any, idx: number) => {
    const isSystems = /system|synth/i.test(sec?.category || "");
    const text = isSystems ? (sec?.paragraphs || []).join(" ") : sec?.singaporeLens || "";
    for (const signalText of extractWatch(text, isSystems)) {
      const horizon = parseHorizon(signalText, surfaced);
      const expiry = horizon ?? iso(addDays(surfaced, 30));
      out.push({
        briefDateSlug: dateSlug,
        storyIndex: idx,
        theme: classifyTheme(`${signalText} ${sec?.headline || ""}`),
        signalText,
        headline: sec?.headline || "",
        surfacedDate,
        horizonDate: horizon,
        expiryDate: expiry,
        status: expiry < today ? "expired" : "open",
      });
    }
  });
  return out;
}

/** Extract + persist signals for a freshly-published brief (chained off /api/publish). */
export async function persistBriefSignals(brief: any, dateSlug: string): Promise<number> {
  const rows = extractBriefSignals(brief, dateSlug);
  if (rows.length === 0) return 0;
  const { insertSignals } = await import("./db.js");
  return insertSignals(rows);
}

/** One-off (idempotent) backfill of all existing briefs, then an expiry sweep. */
export async function backfillSignals(): Promise<{ briefs: number; inserted: number }> {
  const { getAllBriefs, insertSignals, expireSignals } = await import("./db.js");
  const briefs = await getAllBriefs({ limit: 1000 });
  let inserted = 0;
  for (const b of briefs) inserted += await insertSignals(extractBriefSignals(b, (b as any).dateSlug));
  await expireSignals(todayIso());
  return { briefs: briefs.length, inserted };
}
