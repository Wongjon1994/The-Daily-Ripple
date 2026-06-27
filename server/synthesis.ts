/**
 * Qualitative synthesis layer (Trends Part 2, Addendum B). For each active theme
 * in a window, generates the reader-facing prose shown on the Trends page — a
 * theme narrative, an aggregated Singapore Lens, and (for the dominant theme) a
 * hero narrative — and persists them to `theme_insights`. The Trends page reads
 * that table; it never calls an LLM at read time.
 *
 * The window/input construction is pure and unit-tested; the Sonnet calls are
 * gated on ANTHROPIC_API_KEY (without it, runSynthesis is a no-op).
 */

import { classifyTheme } from "./signals.js";
import type { InsertThemeInsight } from "../drizzle/schema.js";

export type Window = "1W" | "3M" | "1M";

// ── window + input construction (pure) ───────────────────────────────────────
const iso = (date: string): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export interface LensEntry { date: string; headline: string; lens: string }
export interface ThemeInput {
  theme: string;
  entries: LensEntry[]; // chronological (oldest → newest)
  briefCount: number; // distinct briefs in window touching this theme
}
export interface SynthesisInputs {
  themes: ThemeInput[]; // active (briefCount ≥ 1), dominant first
  dominant: string | null;
  windowStart: string;
  windowEnd: string;
}

/** Most-recent briefs for a window: last 7 for 1W, within 30/90 days for 1M/3M. */
function selectWindow(briefs: any[], window: Window): any[] {
  const dated = briefs
    .map((b) => ({ b, iso: iso(b?.briefDate || b?.date || "") }))
    .filter((x) => x.iso)
    .sort((a, z) => (a.iso < z.iso ? 1 : -1)); // newest first
  if (window === "1W") return dated.slice(0, 7).map((x) => x.b);
  const days = window === "1M" ? 30 : 90;
  const newest = dated[0]?.iso;
  if (!newest) return [];
  const cutoff = new Date(newest);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return dated.filter((x) => x.iso >= cutoffIso).map((x) => x.b);
}

/** Build the per-theme Singapore-Lens inputs for one window. Pure. */
export function buildThemeInputs(briefs: any[], window: Window): SynthesisInputs {
  const selected = selectWindow(briefs, window);
  const isos = selected.map((b) => iso(b?.briefDate || b?.date || "")).filter(Boolean).sort();
  const windowStart = isos[0] ?? "";
  const windowEnd = isos[isos.length - 1] ?? "";

  const byTheme = new Map<string, { entries: LensEntry[]; days: Set<string> }>();
  // Oldest → newest so each theme's entries read chronologically.
  for (const b of [...selected].reverse()) {
    const date = iso(b?.briefDate || b?.date || "");
    const sections = Array.isArray(b?.sections) ? b.sections : [];
    for (const sec of sections) {
      const lens = (sec?.singaporeLens || "").trim();
      if (!lens) continue;
      const theme = classifyTheme(`${sec?.headline || ""} ${lens}`);
      if (theme === "other") continue;
      const slot = byTheme.get(theme) ?? { entries: [], days: new Set<string>() };
      slot.entries.push({ date, headline: sec?.headline || "", lens });
      slot.days.add(date);
      byTheme.set(theme, slot);
    }
  }

  const themes: ThemeInput[] = Array.from(byTheme.entries())
    .map(([theme, { entries, days }]) => ({ theme, entries, briefCount: days.size }))
    .sort((a, z) => z.briefCount - a.briefCount || z.entries.length - a.entries.length);

  return { themes, dominant: themes[0]?.theme ?? null, windowStart, windowEnd };
}

/** Render a theme's lens entries as the chronological list the prompt expects. */
export function formatEntries(entries: LensEntry[], cap = 12): string {
  return entries
    .slice(-cap)
    .map((e) => `[${e.date}] ${e.headline}:\n${e.lens}`)
    .join("\n\n");
}

// ── LLM synthesis (key-gated) ────────────────────────────────────────────────
const SYSTEM =
  "You are an intelligence analyst for The Daily Ripple, a Singapore-focused global " +
  "intelligence brief. Write in a precise, analytical style — no hedging, no filler. " +
  "Be direct and specific about mechanisms, institutions, and numbers where they exist " +
  "in the source material. Output only the requested prose, no preamble.";

const THEME_LABELS: Record<string, string> = {
  geopolitics: "Geopolitics & Security",
  ai_tech: "AI & Technology",
  society: "Society & Culture",
  rates: "Rates & Banking",
  markets: "Markets & Corporate",
  energy: "Energy & Commodities",
};

async function generate(user: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  const block = resp.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text.trim() : null;
}

function header(input: ThemeInput, window: Window, start: string, end: string): string {
  const label = THEME_LABELS[input.theme] ?? input.theme;
  return (
    `Theme: ${label}\nWindow: ${window} (${start} to ${end})\n\n` +
    `Singapore Lens entries for this theme, chronologically:\n\n${formatEntries(input.entries)}`
  );
}

/**
 * Generate + persist synthesis prose for every active theme in a window.
 * Returns a summary. No-op (themes: 0) when ANTHROPIC_API_KEY is unset.
 */
export async function runSynthesis(window: Window): Promise<{ window: Window; themes: number; dominant: string | null }> {
  if (!process.env.ANTHROPIC_API_KEY) return { window, themes: 0, dominant: null };
  const { getAllBriefs, upsertThemeInsight } = await import("./db.js");
  const briefs = await getAllBriefs({ limit: 1000 });
  const { themes, dominant, windowStart, windowEnd } = buildThemeInputs(briefs, window);

  let generated = 0;
  for (const input of themes) {
    const base = header(input, window, windowStart, windowEnd);
    const themeNarrative =
      (await generate(`${base}\n\nWrite a 2–3 sentence synthesis of how this theme has evolved across this window and what the single most important development is. Focus on trajectory. Do not summarise each entry individually.`)) ?? "";
    const sgLens =
      (await generate(`${base}\n\nWrite a 2–3 sentence synthesis of what this theme means for Singapore right now, as of the most recent brief.`)) ?? "";
    const isDominant = input.theme === dominant;
    const heroNarrative = isDominant
      ? (await generate(`${base}\n\nWrite a 3–4 sentence hero synthesis: the single most important development in this dominant theme and why it matters for Singapore right now. Lead with the outcome.`)) ?? null
      : null;

    const row: InsertThemeInsight = {
      theme: input.theme,
      window,
      themeNarrative,
      sgLens,
      heroNarrative,
      isDominant,
      briefCount: input.briefCount,
      windowStart,
      windowEnd,
    };
    await upsertThemeInsight(row);
    generated++;
  }
  return { window, themes: generated, dominant };
}
