/**
 * Web-grounded signal realisation (Trends Part 2, Addendum A). The Sunday sweep
 * checks each open qualitative signal against live web search results and asks an
 * LLM whether the signal's condition has occurred. Verdicts are routed by
 * confidence: high → auto-realised, medium → editorial queue (pending_review),
 * low → left open and rechecked next week.
 *
 * Network calls (Tavily search + Anthropic verdict) are gated on their API keys
 * being present, so the sweep degrades to a pure expiry pass when unconfigured.
 * The query-building and verdict-routing logic is pure and unit-tested.
 */

import type { Signal } from "../drizzle/schema.js";

// ── query construction (pure) ───────────────────────────────────────────────
const CONDITIONAL = /^(if|whether|should)\b\s+/i;
const WATCH_LEAD = /^(watch|monitor|keep an eye on|look out for|brace for)\b\s+(whether|for|if|that)?\s*/i;

// Tavily rejects queries longer than 400 chars; cap below that with margin.
const MAX_QUERY = 380;

/** Turn a forward "watch …" signal into a plain search query: strip the
 *  conditional/watch framing and trailing punctuation, leaving the core subject.
 *  Capped to Tavily's length limit (truncated on a word boundary). */
export function buildQuery(signalText: string): string {
  let q = (signalText || "").trim();
  q = q.replace(WATCH_LEAD, "").replace(CONDITIONAL, "");
  // Drop a trailing "then …" clause and any final punctuation.
  q = q.replace(/\bthen\b.*$/i, "").replace(/[.?!,;:]+$/, "").trim();
  if (q.length > MAX_QUERY) q = q.slice(0, MAX_QUERY).replace(/\s+\S*$/, "").trim();
  return q.charAt(0).toUpperCase() + q.slice(1);
}

// ── verdict routing (pure) ──────────────────────────────────────────────────
export interface Verdict {
  realised: boolean;
  confidence: number; // 0.0–1.0
  evidenceUrl: string | null;
  evidenceNote: string | null;
}

export interface SignalUpdate {
  status: "open" | "realised" | "pending_review";
  confidence: number;
  lastCheckedDate: string;
  realisedDate?: string;
  realisedEvidenceUrl?: string | null;
  realisedEvidenceNote?: string | null;
}

/** Web verdicts on market-flavoured signals can never auto-realise: prices belong
 *  to the deterministic market sweep, so cap them into the editorial queue. */
export const MARKET_WEB_CONFIDENCE_CAP = 0.8;

/** Map an LLM verdict to the signal fields to persist. A non-realised verdict is
 *  treated as zero confidence so it always falls through to "leave open". When
 *  `marketRelated`, confidence is capped below the auto-realise band so a human
 *  confirms any market claim the web sweep makes (news snippets are not a price
 *  source — see the Brent "$126" incident). */
export function applyVerdict(verdict: Verdict, today: string, marketRelated = false): SignalUpdate {
  let confidence = verdict.realised ? verdict.confidence : 0;
  if (marketRelated) confidence = Math.min(confidence, MARKET_WEB_CONFIDENCE_CAP);
  const base = { confidence, lastCheckedDate: today };
  if (confidence >= 0.85) {
    return {
      ...base,
      status: "realised",
      realisedDate: today,
      realisedEvidenceUrl: verdict.evidenceUrl,
      realisedEvidenceNote: verdict.evidenceNote,
    };
  }
  if (confidence >= 0.5) {
    return {
      ...base,
      status: "pending_review",
      realisedEvidenceUrl: verdict.evidenceUrl,
      realisedEvidenceNote: verdict.evidenceNote,
    };
  }
  return { ...base, status: "open" };
}

// ── network calls (key-gated) ───────────────────────────────────────────────
export interface SearchSnippet {
  title: string;
  snippet: string;
  domain: string;
  publishedDate: string | null;
  url: string;
}

/** Top web-search snippets for a query via Tavily. Returns [] if no key set. */
async function searchTavily(query: string): Promise<SearchSnippet[]> {
  if (!process.env.TAVILY_API_KEY) return [];
  const { tavily } = await import("@tavily/core");
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
  const res = await client.search(query, { maxResults: 5, searchDepth: "basic" });
  return (res.results || []).map((r: any) => ({
    title: r.title || "",
    snippet: (r.content || "").slice(0, 280),
    domain: (() => { try { return new URL(r.url).hostname; } catch { return ""; } })(),
    publishedDate: r.publishedDate || null,
    url: r.url || "",
  }));
}

const VERDICT_SYSTEM =
  "You are a signal realisation checker for an intelligence brief. Be conservative — " +
  "only mark a signal as realised if the evidence clearly and specifically confirms the " +
  "stated condition occurred. Do not infer or extrapolate. Your evidence note may only " +
  "contain figures that appear verbatim in the search snippets — never supply a number " +
  "from memory. If the condition hinges on a market price level (a commodity, index, " +
  "yield or FX rate reaching a level), do not treat snippets as confirmation of the " +
  "price — keep confidence at or below 0.7 for such signals. Respond with JSON only.";

/** Ask Haiku whether a signal's condition is confirmed by the search snippets.
 *  Returns null if no Anthropic key is set or the response can't be parsed. */
async function checkRealisation(signal: Signal, snippets: SearchSnippet[]): Promise<Verdict | null> {
  if (!process.env.ANTHROPIC_API_KEY || snippets.length === 0) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const results = snippets
    .map((s, i) => `[${i + 1}] ${s.title} — ${s.snippet} (source: ${s.domain}, date: ${s.publishedDate ?? "n/a"})`)
    .join("\n");
  const user =
    `Signal: "${signal.signalText}"\nSurfaced: ${signal.surfacedDate}\n\n` +
    `Search results as of today:\n${results}\n\n` +
    `Has the specific condition in this signal been confirmed as having occurred? ` +
    `Respond in JSON: {"realised": true|false, "confidence": 0.0-1.0, ` +
    `"evidenceUrl": "url or null", "evidenceNote": "one sentence or null"}`;
  const resp = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system: VERDICT_SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  const text = resp.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return null;
  const match = text.text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const v = JSON.parse(match[0]);
    return {
      realised: !!v.realised,
      confidence: typeof v.confidence === "number" ? v.confidence : 0,
      evidenceUrl: v.evidenceUrl ?? null,
      evidenceNote: v.evidenceNote ?? null,
    };
  } catch {
    return null;
  }
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * The weekly sweep: expire stale signals, then web-check each remaining open
 * signal and route its verdict. Safe to call without API keys — it then only
 * runs the expiry pass and reports zero checks.
 */
export async function runRealisationSweep(): Promise<{
  expired: boolean;
  checked: number;
  skippedNumeric: number;
  realised: number;
  pendingReview: number;
  errors: number;
}> {
  const { getSignals, expireSignals, applySignalRealisation } = await import("./db.js");
  const { parseSignalThreshold, matchesTrackedSymbol } = await import("./numericRealisation.js");
  const today = todayIso();
  await expireSignals(today);

  let checked = 0, skippedNumeric = 0, realised = 0, pendingReview = 0, errors = 0;
  if (process.env.TAVILY_API_KEY && process.env.ANTHROPIC_API_KEY) {
    const open = await getSignals("open");
    for (const signal of open) {
      // Single source of truth for market levels: a signal that names a tracked
      // instrument AND a level is the numeric sweep's exclusive domain. If our own
      // price series says the level hasn't crossed, it stays open — the web sweep
      // must never adjudicate it from news snippets (the Brent "$126" incident).
      if (parseSignalThreshold(signal.signalText)) {
        skippedNumeric++;
        continue;
      }
      // Isolate each signal — a single search/LLM failure must not abort the sweep.
      try {
        const snippets = await searchTavily(buildQuery(signal.signalText));
        const verdict = await checkRealisation(signal, snippets);
        if (!verdict) continue;
        checked++;
        // Market-flavoured but unparseable signals can be web-checked, but never
        // auto-realised — they land in the editorial queue for a human call.
        const marketRelated = matchesTrackedSymbol(signal.signalText) !== null;
        const update = applyVerdict(verdict, today, marketRelated);
        await applySignalRealisation(signal.id, update);
        if (update.status === "realised") realised++;
        else if (update.status === "pending_review") pendingReview++;
      } catch (e) {
        errors++;
        console.log(`[realisation] signal ${signal.id} failed:`, e);
      }
    }
  }
  return { expired: true, checked, skippedNumeric, realised, pendingReview, errors };
}
