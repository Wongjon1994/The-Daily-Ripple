/**
 * House View (Agentic Ripple, Phase D) — the daily "alpha" card. A single Sonnet
 * call that takes an opinionated, cross-cutting read on the currently-open signals
 * for the Singapore-professional persona (the house view; no per-user
 * personalisation). Persisted to `house_view` and chained off publish like theme
 * synthesis, so the page never calls an LLM at read time.
 *
 * Input selection + output parsing are pure and unit-tested; the Sonnet call is
 * gated on ANTHROPIC_API_KEY (without it, runHouseView is a no-op).
 */

import type { HouseViewRef, InsertHouseView } from "../drizzle/schema.js";

export interface HouseSignalInput {
  theme: string;
  signalText: string;
  briefDateSlug: string;
  storyIndex: number;
  surfacedDate: string;
  /** Present on realised inputs — the outcome that confirmed the call. */
  realisedDate?: string | null;
  realisedEvidenceNote?: string | null;
}

const THEME_LABELS: Record<string, string> = {
  geopolitics: "Geopolitics & Security",
  ai_tech: "AI & Technology",
  society: "Society & Culture",
  rates: "Rates & Banking",
  markets: "Markets & Corporate",
  energy: "Energy & Commodities",
  other: "Other",
};

// ── input + output shaping (pure) ────────────────────────────────────────────

/** The most recent open signals (newest first) that the view will reason over. */
export function selectHouseSignals(signals: HouseSignalInput[], cap = 14): HouseSignalInput[] {
  return [...signals].sort((a, b) => (a.surfacedDate < b.surfacedDate ? 1 : -1)).slice(0, cap);
}

/** Build the Sonnet prompt + the refs (slug/story/text) the view leans on. Recently
 *  realised signals (calls that have since come true) are given as confirmed facts so
 *  the view reflects the latest outcomes, not just the open watch list. */
export function buildHousePrompt(
  signals: HouseSignalInput[],
  realised: HouseSignalInput[] = []
): { user: string; refs: HouseViewRef[] } {
  const chosen = selectHouseSignals(signals);
  const refs: HouseViewRef[] = chosen.map((s) => ({ slug: s.briefDateSlug, storyIndex: s.storyIndex, text: s.signalText }));
  const lines = chosen
    .map((s, i) => `[${i + 1}] (${THEME_LABELS[s.theme] ?? s.theme}, ${s.surfacedDate}) ${s.signalText}`)
    .join("\n");
  const realisedBlock = realised.length
    ? `\n\nRecently REALISED — earlier calls that have now come true (treat as confirmed facts; any figure here ` +
      `is real, so you may use it; factor these outcomes into the view and note the track record where it sharpens the read):\n\n` +
      realised
        .map((s) => `(${THEME_LABELS[s.theme] ?? s.theme}, realised ${s.realisedDate ?? ""}) ${s.signalText}${s.realisedEvidenceNote ? ` → ${s.realisedEvidenceNote}` : ""}`)
        .join("\n")
    : "";
  const user =
    `Open forward-looking signals currently tracked (most recent first):\n\n${lines}${realisedBlock}\n\n` +
    `Synthesise the HOUSE VIEW: one opinionated, cross-cutting read for a Singapore professional — ` +
    `where the edge is right now, what the consensus is underrating, and the single thing to position around. ` +
    `Connect signals across themes; take a view, do not just summarise.\n\n` +
    `Ground every claim in the signals above. Do NOT introduce any price, rate, yield or index level that is not ` +
    `written verbatim in them (the realised block counts as written) — reason in directions and triggers, not invented figures.\n\n` +
    `Return STRICT JSON only, no prose or code fences: ` +
    `{"headline": "punchy, <=10 words", "thesis": "3-4 sentences written to the reader in plain stakes (their rate, bill, job, portfolio), specific on mechanism but with no numeric level not present in the signals, no hedging", "stance": "conviction line, <=8 words"}`;
  return { user, refs };
}

/** Parse the model's JSON (tolerating code fences); fall back to line-splitting. */
export function parseHouseView(text: string): { headline: string; thesis: string; stance: string } | null {
  if (!text || !text.trim()) return null;
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const o = JSON.parse(cleaned);
    if (o && typeof o.headline === "string" && typeof o.thesis === "string") {
      return {
        headline: o.headline.trim(),
        thesis: o.thesis.trim(),
        stance: (o.stance ?? "").toString().trim(),
      };
    }
  } catch {
    /* fall through to line-splitting */
  }
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  return { headline: lines[0].replace(/^#+\s*/, ""), thesis: lines.slice(1).join(" ") || lines[0], stance: "" };
}

// ── LLM generation (key-gated) ───────────────────────────────────────────────

const SYSTEM =
  "You are the house strategist at The Daily Ripple, writing the daily view for one reader: a Singapore " +
  "professional with a mortgage, a job, and a mix of local and global holdings. Take a clear, opinionated stance " +
  "and connect developments across domains — but write it TO them: second person, plain stakes, and the place " +
  "they'll feel it (their rate, their bill, their job, their portfolio), not an institutional research note. " +
  "Translate acronyms and jargon into what they mean for the reader. No hedging, no filler, no disclaimers. " +
  "CRITICAL — you have no live market data: do NOT state any specific numeric level (a price, rate, yield, index " +
  "level or percentage) unless that exact figure appears verbatim in the signals you are given; any number you " +
  "supply from memory will be stale. When a signal names a metric without a current level, describe the direction " +
  "and the trigger (e.g. 'reprices SORA upward', 'a Brent spike above the level the brief flags'), never a " +
  "fabricated threshold. Output only what is asked, in the exact format requested.";

async function generate(user: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  const block = resp.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text.trim() : null;
}

/**
 * Generate + persist the daily house view from the current open signals.
 * No-op ({ ok: false }) when ANTHROPIC_API_KEY is unset or there are no signals.
 */
export async function runHouseView(): Promise<{ ok: boolean; date?: string; refs?: number }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false };
  const { getSignals, getAllBriefs, upsertHouseView } = await import("./db.js");
  const open = (await getSignals("open")) as any[];
  if (!open.length) return { ok: false };

  const latest = await getAllBriefs({ limit: 1 });
  const date = (latest[0] as any)?.briefDate ?? new Date().toISOString().slice(0, 10);

  const inputs: HouseSignalInput[] = open.map((s) => ({
    theme: s.theme,
    signalText: s.signalText,
    briefDateSlug: s.briefDateSlug,
    storyIndex: s.storyIndex,
    surfacedDate: s.surfacedDate,
  }));

  // Recently realised calls (last 21 days) give the view confirmed, latest outcomes.
  const cutoff = new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10);
  const realisedInputs: HouseSignalInput[] = ((await getSignals("realised")) as any[])
    .filter((s) => (s.realisedDate ?? "") >= cutoff)
    .sort((a, b) => ((a.realisedDate ?? "") < (b.realisedDate ?? "") ? 1 : -1))
    .slice(0, 8)
    .map((s) => ({
      theme: s.theme,
      signalText: s.signalText,
      briefDateSlug: s.briefDateSlug,
      storyIndex: s.storyIndex,
      surfacedDate: s.surfacedDate,
      realisedDate: s.realisedDate,
      realisedEvidenceNote: s.realisedEvidenceNote,
    }));

  const { user, refs } = buildHousePrompt(inputs, realisedInputs);
  const parsed = parseHouseView((await generate(user)) ?? "");
  if (!parsed) return { ok: false };

  const row: InsertHouseView = {
    date,
    headline: parsed.headline,
    thesis: parsed.thesis,
    stance: parsed.stance,
    signalRefs: refs,
    model: "claude-sonnet-4-6",
  };
  await upsertHouseView(row);
  return { ok: true, date, refs: refs.length };
}
