# Brief format & n8n ingest guide

What I learned importing the Jun 6–13 briefs from Telegraph, and the recommended
contract for automating future uploads through n8n.

## TL;DR — should there be a prescribed format?

**Yes. The data shape must be rigid; the *content* is where nuance lives.**

The dashboard renders 12 fixed fields per section. Every time the source format
drifted (a missing section number, a sentence where a number belonged, a
renamed category), the importer either dropped data or produced junk. A strict
schema is the contract that makes rendering reliable. Flexibility belongs in the
LLM's writing, not in the JSON structure.

## The canonical schema (`DailyBrief`)

This TypeScript interface in `client/src/lib/briefParser.ts` **is** the contract:

```ts
DailyBrief {
  date: string;            // "June 13, 2026"
  greeting: string;        // one line
  teaser: string[];        // 3 headline teasers
  sections: BriefSection[];// 8: 7 stories + 1 "systems" synthesis
  systemsSynthesis: { thesis: string; signals: string[] };
}

BriefSection {
  id: string;              // "1".."8"
  emoji: string;           // drives category color
  category: "geopolitics" | "economics" | "business" | "ai-tech"
          | "science" | "culture" | "systems";
  headline: string;
  summary: string;         // 1–2 sentences
  paragraphs: string[];    // 2–4
  singaporeLens: string | null;
  keyMetrics: { label: string; value: string; change?: string;
                direction: "up" | "down" | "neutral" }[];
  readingTime: number;     // minutes
  sources: { outlet: string; title: string; url: string; date: string }[];
  urgency: "high" | "medium" | "low";
  tags: string[];
}
```

### Field rules that matter for rendering

- **`keyMetrics.value` must be a short figure** — `"$87/bbl"`, `"7,394"`,
  `"4.54%"`, or a short qualitative like `"Record close"`. **Never a sentence.**
  Prose values break the Trends sparklines and the card layout.
- **A metric `value` is a *level*, not a *change*.** `"Down 20%"` as a Brent
  value poisoned the Trends delta (read as 20 vs. prices near 90 → +336%). Put
  movement in `change`/`direction`, keep `value` as the level.
- **`sources[].url` must be the real article URL.** Validate before publishing.
- **`singaporeLens`** is a distilled 1–2 sentence callout, separate from the
  Singapore paragraph in `paragraphs` (the paragraph stays).
- **Watch-signal cue (drives the "Signal to watch" note _and_ Trends "Broader
  signals").** When a section's `singaporeLens` carries a forward-looking thing
  to monitor, phrase it as its **own sentence containing a cue word** — one of
  `watch`, `monitor`, `keep an eye`, `look out`, `brace for`, `to watch`,
  `the tell`. That sentence (≥45 chars) is then pulled out of the lens and
  surfaced two places from a **single extractor** (`partitionLensWatch` in
  `client/src/lib/trendsAnalysis.ts`):
  1. on the story card, as a gold "Signal to watch" block under the analyst's
     note, and
  2. in the Trends tab's "Broader signals · by theme".
  A lens with **no** cue word simply shows as plain analysis in both places —
  nothing breaks, the signal just isn't surfaced. So include a cue sentence in
  every section where a signal is intended, e.g.
  *"Watch Brent: if it clears \$90, pressure on MAS to tighten intensifies."*
  Notes: the match is whole-word, so `watching`/`monitored` do **not** trigger;
  and the `systems` section additionally treats `If …` / ordinal (`First, …`)
  sentences as signals (that's how the synthesis bullets become Broader
  signals). If the LLM ever emits a dedicated structured field for this, route
  it through the same extractor so the two views stay matched 1-to-1.

## Recommended n8n architecture

**Do not parse Telegraph back into the schema.** Telegraph is a *lossy
rendering*: it carries headline, paragraphs, sources, and (only sometimes) a
metrics list. It does **not** carry `summary`, `singaporeLens`, `tags`,
`urgency`, `readingTime`, `teaser`, `greeting`, or `systemsSynthesis` — those
have to be re-derived with heuristics, which is exactly what
`scripts/import-telegraph.mjs` does, and why its output is good-but-not-perfect.

Instead, make the **structured JSON the canonical artifact**:

```
n8n: generate brief  ──►  full DailyBrief JSON  ──┬─►  POST /api/publish   (dashboard)
   (LLM emits schema)                             └─►  render to Telegraph  (newsletter)
```

1. The generating LLM emits the **full `DailyBrief` JSON directly** (give it the
   schema above + one example as a few-shot). It already "knows" the summary,
   lens, tags, and metrics — capture them at generation time instead of
   reverse-engineering them later.
2. n8n POSTs that JSON to `POST /api/publish` (endpoint already exists; protect
   with `X-Api-Key`).
3. Telegraph becomes just one rendering of the same JSON, not the source of truth.

### Harden `/api/publish`

Today `publish` accepts `sections: z.any()`. Make it a **strict Zod schema**
mirroring `BriefSection` so malformed uploads are rejected at the door, and add
a server-side `validateLinks` pass on `sources[].url` (already built) to flag
dead links before they're stored.

## Format nuances I hit (why rigidity matters)

Importing 7 real briefs surfaced these inconsistencies — each one is an argument
for a strict generator contract:

| Nuance observed | Effect | Mitigation in importer |
|---|---|---|
| Section number sometimes omitted (`💼 BUSINESS —`) | A whole section was dropped | Number made optional; order assigned by position |
| Systems synthesis published as a `blockquote`, not `h3` | Easy to miss | Detected separately, appended as §8 |
| Category label renamed (`CULTURE` → `TONY AWARDS 2026`) | Category mis-assigned | Use **emoji** as the primary category signal |
| Metrics list mixes figures, prose, and `"No verified data"` | Junk metrics in Trends | `cleanMetricValue()` drops prose/placeholders |
| Multiple sources mashed into one `<li>` | Sources merged | Split per `<a>` tag |
| `Jun 13` published at path `…-06-13-2` (a republish) | Wrong URL guess | Resolve the linkly shortlink, don't guess the path |

## The importer (stopgap)

`scripts/import-telegraph.mjs` converts a published Telegraph brief into a
`briefs-json-export/<name>.ts` file. Useful for backfilling history, but it
derives the lossy fields heuristically. Once n8n emits structured JSON, this
script is no longer needed for new briefs.

```
node scripts/import-telegraph.mjs <telegraph-path> "<date>" <dateSlug> <varName> <fullBriefUrl>
```
