/**
 * Model A/B harness (audit step 5) — runs the two Sonnet, reader-facing prose
 * stages (weekly synthesis + house view) through BOTH the current model and a
 * candidate cheaper model on the last real inputs, and prints them side by side so
 * a human can judge regression. Read-only: it never writes to the DB and never
 * touches production model configuration.
 *
 *   ANTHROPIC_API_KEY=... DATABASE_URL=... npx tsx scripts/model-ab.ts
 *
 * Optional: CANDIDATE_MODEL=claude-haiku-4-5 (default), SAMPLES=5.
 *
 * The user-prompt bodies come from the real exported builders (buildThemeInputs /
 * formatEntries / buildHousePrompt) so the comparison is faithful; only the short
 * SYSTEM + instruction strings are mirrored here (kept in sync with synthesis.ts /
 * houseView.ts).
 */

import { getAllBriefs, getSignals } from "../server/db.js";
import { buildThemeInputs, formatEntries, type Window } from "../server/synthesis.js";
import { buildHousePrompt, type HouseSignalInput } from "../server/houseView.js";

const CURRENT = { synthesis: "claude-sonnet-4-6", houseView: "claude-sonnet-4-6" };
const CANDIDATE = process.env.CANDIDATE_MODEL || "claude-haiku-4-5";

// Mirrors server/synthesis.ts SYSTEM + the sgLens instruction (the representative
// reader-facing call).
const SYN_SYSTEM =
  "You are the resident analyst at The Daily Ripple, writing for one reader: a Singapore professional " +
  "juggling a mortgage, a job, and a mix of local and global investments. Match the voice of the brief's " +
  "Singapore Lens entries in the material below — write TO the reader (second person, 'here in Singapore'), " +
  "and land each point where they'll actually feel it: their rate, their bill, their job, their CPF, their " +
  "portfolio. Keep the rigour — be specific about the mechanism and the numbers that matter — but translate " +
  "institutions and acronyms into plain stakes, and stay warm and concrete, not corporate. No hedging, no " +
  "filler. Output only the requested prose, no preamble.";
const SYN_INSTRUCTION =
  "\n\nWrite 2–3 sentences in the voice of the Singapore Lens above: what this means for the reader here right " +
  "now — what to watch, and where it shows up in their life (their rate, bill, job, or portfolio). Speak to them directly.";
const THEME_LABELS: Record<string, string> = {
  geopolitics: "Geopolitics & Security", ai_tech: "AI & Technology", health: "Science & Health",
  society: "Society & Culture", rates: "Rates & Banking", markets: "Markets & Corporate", energy: "Energy & Commodities",
};

async function run(model: string, system: string, user: string): Promise<{ text: string; inTok: number; outTok: number }> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const resp = await client.messages.create({ model, max_tokens: 500, system, messages: [{ role: "user", content: user }] });
  const block = resp.content.find((b) => b.type === "text");
  return {
    text: block && block.type === "text" ? block.text.trim() : "(no text)",
    inTok: resp.usage.input_tokens,
    outTok: resp.usage.output_tokens,
  };
}

function hr(label: string) { console.log(`\n${"═".repeat(90)}\n${label}\n${"═".repeat(90)}`); }
async function compare(tag: string, currentModel: string, system: string, user: string) {
  const a = await run(currentModel, system, user);
  const b = await run(CANDIDATE, system, user);
  console.log(`\n### ${tag}`);
  console.log(`\n[${currentModel}]  in≈${a.inTok} out≈${a.outTok}\n${a.text}`);
  console.log(`\n[${CANDIDATE}]  in≈${b.inTok} out≈${b.outTok}\n${b.text}`);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY required");
  const samples = Number(process.env.SAMPLES || 5);

  hr(`WEEKLY SYNTHESIS — sgLens (reader-facing prose) · current=${CURRENT.synthesis} vs ${CANDIDATE}`);
  const briefs = await getAllBriefs({ limit: 1000 });
  for (const w of ["1W", "1M", "3M"] as Window[]) {
    const { themes, windowStart, windowEnd } = buildThemeInputs(briefs, w);
    for (const input of themes.slice(0, Math.ceil(samples / 3))) {
      const label = THEME_LABELS[input.theme] ?? input.theme;
      const base = `Theme: ${label}\nWindow: ${w} (${windowStart} to ${windowEnd})\n\nSingapore Lens entries for this theme, chronologically:\n\n${formatEntries(input.entries)}`;
      await compare(`SYNTHESIS · ${w} · ${label}`, CURRENT.synthesis, SYN_SYSTEM, base + SYN_INSTRUCTION);
    }
  }

  hr(`HOUSE VIEW (reader-facing prose) · current=${CURRENT.houseView} vs ${CANDIDATE}`);
  const open = (await getSignals("open")) as any[];
  const realised = (await getSignals("realised")) as any[];
  const toInput = (s: any): HouseSignalInput => ({ theme: s.theme, signalText: s.signalText, briefDateSlug: s.briefDateSlug, storyIndex: s.storyIndex, surfacedDate: s.surfacedDate, realisedDate: s.realisedDate, realisedEvidenceNote: s.realisedEvidenceNote });
  const { user } = buildHousePrompt(open.map(toInput), realised.slice(0, 8).map(toInput));
  // House view has no separate system in buildHousePrompt; mirror houseView.ts SYSTEM head.
  await compare("HOUSE VIEW · today", CURRENT.houseView, "You are the house strategist at The Daily Ripple. Follow the instructions exactly and return STRICT JSON.", user);

  console.log("\n\nDone. Eyeball each pair; mark PASS only where the candidate holds voice, accuracy and grounding.");
}

main().catch((e) => { console.error(e); process.exit(1); });
