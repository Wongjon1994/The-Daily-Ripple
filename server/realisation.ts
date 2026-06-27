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

/** Turn a forward "watch …" signal into a plain search query: strip the
 *  conditional/watch framing and trailing punctuation, leaving the core subject. */
export function buildQuery(signalText: string): string {
  let q = (signalText || "").trim();
  q = q.replace(WATCH_LEAD, "").replace(CONDITIONAL, "");
  // Drop a trailing "then …" clause and any final punctuation.
  q = q.replace(/\bthen\b.*$/i, "").replace(/[.?!,;:]+$/, "").trim();
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

/** Map an LLM verdict to the signal fields to persist. A non-realised verdict is
 *  treated as zero confidence so it always falls through to "leave open". */
export function applyVerdict(verdict: Verdict, today: string): SignalUpdate {
  const confidence = verdict.realised ? verdict.confidence : 0;
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
  "stated condition occurred. Do not infer or extrapolate. Respond with JSON only.";

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
  realised: number;
  pendingReview: number;
}> {
  const { getSignals, expireSignals, applySignalRealisation } = await import("./db.js");
  const today = todayIso();
  await expireSignals(today);

  let checked = 0, realised = 0, pendingReview = 0;
  if (process.env.TAVILY_API_KEY && process.env.ANTHROPIC_API_KEY) {
    const open = await getSignals("open");
    for (const signal of open) {
      const snippets = await searchTavily(buildQuery(signal.signalText));
      const verdict = await checkRealisation(signal, snippets);
      if (!verdict) continue;
      checked++;
      const update = applyVerdict(verdict, today);
      await applySignalRealisation(signal.id, update);
      if (update.status === "realised") realised++;
      else if (update.status === "pending_review") pendingReview++;
    }
  }
  return { expired: true, checked, realised, pendingReview };
}
