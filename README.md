# The Daily Ripple

A single-page web app that presents a daily intelligence brief, a cross-brief
trends dashboard, a date archive, and an editorial about page. Stories are
written for a Singapore reader and always answer the same question: *so what
does this mean for me, here?*

> **This README is the functional overview.** For the full, element-by-element
> behavioural specification of every tab, see **[FUNCTIONAL_SPEC.md](FUNCTIONAL_SPEC.md)**.

---

## What it does

The app has four navigation tabs, plus an About page that doubles as the
first-visit landing page.

| Tab | Route | What it is |
|-----|-------|------------|
| **Today's Brief** | `/`, `/brief/:slug` | A swipeable deck of up to 8 story cards for one day's brief. Story cards expand to the full analysis, "by the numbers" metrics, a Singapore Lens note, a gold **"Signal(s) to watch"** block, and link-checked sources. The 8th card is the **systems synthesis** — thesis prose plus three numbered "Signals to watch" (no metrics, no Lens box). A date picker plus **Telegram** ("For the latest updates") and **Full brief** CTAs sit above the deck. |
| **Trends** | `/trends` | A metric-first dashboard synthesised across *all* briefs. Tracked-metric cards with sparklines and realised/watching signals, plus forward-looking cues grouped by theme. Every data point links back to the brief that reported it. |
| **Archive** | `/calendar` | A monthly calendar; days with a brief are highlighted and click through to that day's deck. |
| **About** | `/about` | Editorial page explaining the product, its coverage, how to navigate, and an AI-authorship + "not financial advice" disclosure. Shown automatically to first-time visitors. |

Cross-navigation is pervasive: a number on Trends, a flagged signal, or a date
in the Archive all deep-link into the specific story behind them
(`/brief/:slug?story=N`).

### Key behaviours

- **First visit** → redirected to About (flag stored in `localStorage`);
  thereafter `/` goes straight to the latest brief.
- **"At a glance" bento** — above the deck, an editorial magazine-style summary
  of all eight sections: a "Lead Story" hero cell, two mediums, a four-across
  strip, and a full-width System Synthesis footer. Each cell distills its section
  to a topic line (clean word-boundary truncation, no mid-word cuts) plus its
  most telling figure — a key-metric chip and/or gold numerals in the dek — not
  just a repeated headline. The grid is the default at every width: 2 columns on
  narrow, the 4-column magazine grid from `sm` up; cells size to content.
- **Focused reading** — clicking a bento cell hides the summary, scrolls the deck
  to the top, and locks the view on that story so the reader can swipe left/right
  without distraction; a "Back to summary" CTA returns to the top and restores
  the bento. Deep links (`?story=N`, e.g. from Trends signals) open in focused
  reading too. Without clicking a cell, the reader can simply scroll down from the
  summary to the deck.
- **Deck navigation** works by swipe/drag, arrow keys, prev/next arrows, the
  progress dots, and (on desktop ≥1024px) clickable "peek" previews of the
  neighbouring cards.
- **"Signals to watch"** — forward-looking signals are extracted from the
  Singapore Lens (story cards) and the synthesis prose (section 8) by one shared
  extractor, so the card's signals match the Trends "Broader signals" 1-to-1.
  The synthesis card always surfaces three numbered signals.
- **Top ticker on every tab** — a "TODAY · cycling headline · clock" bar shows
  across all four tabs (falls back to the latest brief's headlines off the brief
  page), hidden on Sundays until Monday's brief lands.
- **Time-of-day greeting** ("Good morning/afternoon/evening") and the **clock**
  follow the **reader's local timezone**. On Sundays the greeting invites the
  reader to review the week's briefs (Sunday cadence is Singapore time, the
  publishing day).
- **Source link-checking** marks each source verified / blocked / likely-broken
  / unverified.
- **Realisation logic** marks a forward statement ("watch oil above $90")
  *realised* once a later actual reading crosses that level — deterministic from
  the data, no manual tagging.

### Theming

- **Time-of-day adaptive theme** keyed to the reader's local hour, in four
  bands — `morning` (06–12, light) · `midday` (12–18, lightest) · `evening`
  (18–24, dim dusk) · `night` (00–06, dark) — set before first paint by a
  script in `client/index.html` to avoid a flash. A nav **Auto / Light / Dark**
  toggle (`ThemeToggle`) overrides it and persists to `localStorage`.
- The light bands use a dedicated light masthead (`masthead-banner-light.png`)
  and a warm merlion-cream gold accent; the dark/evening bands keep the cyan +
  gold duotone. Bands are defined as `:root[data-theme="…"]` blocks in
  `client/src/index.css`.

---

## Stack

- **Frontend:** React 19, Wouter (client-side routing), Tailwind CSS 4,
  shadcn/ui (Radix), TanStack Query, Vite.
- **Backend:** Express serving tRPC (`/api/trpc`); the frontend never touches
  the database directly.
- **Database:** PostgreSQL via Drizzle ORM (`DATABASE_URL`).
- **Design tokens** live in `client/src/index.css`.

```
client/
  src/
    pages/        ← Page-level components (BriefPageEnhanced, TrendsPage, CalendarPage, AboutPage)
    components/   ← Deck, cards, masthead, charts, shadcn/ui
    lib/          ← briefParser and helpers
server/           ← Express + tRPC, seed/publish ingestion, link checks
shared/           ← Shared types & constants
briefs-json-export/ ← Bundled canonical brief set (upserted on boot)
```

---

## Getting started

Requires Node and a Postgres database (`DATABASE_URL` in the environment).

```bash
npm install

# run migrations and seed the bundled briefs
npm run db:migrate
npm run db:seed

# dev: Vite frontend + tRPC server (separate terminals)
npm run dev          # frontend (Vite, --host)
npm run dev:server   # backend (tsx watch, PORT=3001)
```

Other scripts:

| Command | Purpose |
|---------|---------|
| `npm run build` | Build the client and bundle the server to `dist/` |
| `npm run start` | Run the production server |
| `npm run check` | TypeScript type-check (`tsc --noEmit`) |
| `npm run test` | Run the Vitest suite |
| `npm run format` | Prettier |

---

## Content ingestion

- **Runtime publish:** `POST /api/publish` (or the `n8n.publish` tRPC
  procedure), protected by an `X-Api-Key` header, upserts a brief by slug.
- **Bundled briefs:** the canonical brief set ships in code and is upserted into
  the database (idempotent by slug) on every server boot, so deploying a newly
  added brief publishes it even into an already-populated database.
- **Health:** `GET /healthz` returns a 200 JSON heartbeat for host probes and an
  external keep-warm ping.

See **[BRIEF_FORMAT.md](BRIEF_FORMAT.md)** for the brief schema and the
**N8N integration guides** for the automated publish pipeline.

---

## Documentation

| Document | Covers |
|----------|--------|
| [FUNCTIONAL_SPEC.md](FUNCTIONAL_SPEC.md) | Full observable behaviour of all four tabs |
| [BRIEF_FORMAT.md](BRIEF_FORMAT.md) | The `DailyBrief` schema and importer |
| [DATABASE_FUNCTIONALITY.md](DATABASE_FUNCTIONALITY.md) | Data model and persistence |
| [DEPLOY.md](DEPLOY.md) | Deployment |
| [N8N_INTEGRATION_GUIDE.md](N8N_INTEGRATION_GUIDE.md) | Automated brief ingestion via n8n |

---

## Changelog

Newest first. Append an entry here for every change.

### 2026-06-26
- **Market data: indices via Twelve Data, SORA dropped** — the first prod run
  showed Yahoo is IP-blocked from Render (429) and Stooq is behind a JS anti-bot
  wall, so the six equity indices now source from Twelve Data (`TWELVEDATA_API_KEY`,
  free 800/day, datacenter-friendly). MAS's SORA endpoint is in maintenance, so
  SORA is dropped per the spec's decision rule. Refresh endpoint groups are now
  `?sources=indices,av`.
- **Market data, Part 1 (data layer)** — new `market_metrics` table (persistent
  daily OHLCV time series, unique on symbol+date) plus a direct fetch service
  (`server/marketData.ts`): Yahoo Finance for the six equity indices (S&P 500,
  Dow, STI, Nikkei, Hang Seng, KOSPI), Alpha Vantage for Brent / Gold / 10Y yield
  / FX (USD·JPY·EUR/SGD), MAS for 3-month SORA — no n8n, no LLM. Authed endpoint
  `POST /api/scheduled/refresh-metrics` (`X-Api-Key`) fetches all, staggers the AV
  calls, upserts idempotently; `?range=5y` does a one-time history backfill. Needs
  `ALPHAVANTAGE_API_KEY`. Gold + SORA parsers log their raw response and parse
  defensively pending first-run verification. (Trends repoint + card redesign next.)

### 2026-06-24
- **Singapore Lens from the 3rd paragraph** — by the brief's authoring convention
  the 3rd paragraph of a story (§1–7) is the Singapore Lens, so the card now falls
  back to `paragraphs[2]` when the dedicated `singaporeLens` field is empty. The
  lens box populates for every brief (incl. runtime-published ones) with no
  per-brief data fix, and the duplicated body paragraph is de-duped either way.
- **Calmer source link flags** — a source that fails the server-side link check no
  longer gets a loud crimson box + red ✕ (the fetch often 404s/blocks real
  articles that load fine in a browser). The row stays neutral with a muted status
  icon + hover tooltip, consistent with the "annotate, don't alarm" treatment.
- **Manual metric corrections (23–24 Jun)** — a one-off, idempotent startup patch
  (`patchManualMetricFixes` in `server/seed.ts`) corrects hallucinated index levels
  on the runtime-published briefs: 23 Jun S&P 500 `~5,560 → 7,429.79` and Nikkei 225
  `~38,900 → 72,353.96`; 24 Jun S&P 500 `~5,570 → 7,365.46`. Keyed off the known-wrong
  value so it applies once and never overwrites a later correct figure (once Alpha
  Vantage market data flows in). Flows through Trends, the bento chips, and the card
  metric strip. Remove once upstream market data is trusted.
- **Story card formatting fixes** — (1) the expanded "by the numbers" strip now
  hides metrics with no real value (an unreported `—`, e.g. STI / Hang Seng on a
  quiet day) instead of rendering empty placeholder boxes; (2) removed the
  pull-quote feature, which lifted a "sentence" from a body paragraph — abbrev­
  iations like `Ltd.` caused false sentence breaks, producing an incomplete quote
  and orphaning the rest of the paragraph; body prose now renders intact and in
  order; (3) the Singapore Lens box now shows whenever a section carries a lens,
  and any body paragraph that merely repeats the lens is stripped, so the lens
  always lands in its own template box (not as loose prose) even when an incoming
  brief duplicates it across `paragraphs` and `singaporeLens`.

### 2026-06-23
- **Typography pass across all four tabs** — normalised the heading scale and
  eyebrow letter-spacing so the tabs feel like one system: Trends section headers
  bumped `text-xl → text-2xl` to match Calendar/About; uppercase eyebrow kickers
  unified at `tracking-[0.14em]` (About hero, Calendar weekdays); the bento "at a
  glance" label bumped to `text-base`/bold. Playfair headings, the gold/cyan
  duotone, and the mono "data voice" (dates, counts, metric values) are kept.
- **"At a glance" bento summary** — new `BriefBento` above the reading deck: an
  editorial magazine grid (lead-story hero + two mediums + four-across strip +
  full-width System Synthesis footer) summarising all eight sections, each cell
  linking into the deck. Section 1 is labelled "Lead Story"; cells show the
  headline's lead clause word-boundary–truncated (no mid-word cuts or dangling
  connectives), a key-metric chip when the section carries structured metrics, and
  a dek with figures emphasised in gold. The bento grid is the default at every
  width — a 2-column bento on narrow screens, the 4-column magazine grid from `sm`
  up — cells size to content, and it never collapses to a single stack. Driven
  entirely from section data, so it applies to every brief and any future n8n
  brief automatically.
- **Focused reading mode** — clicking a bento cell hides the summary, scrolls the
  deck to the top, and locks the view on that story for distraction-free swiping;
  a "Back to summary" CTA (in the sticky toolbar, so it stays visible while
  scrolling) restores the bento and returns to the top. Deep links (`?story=N`)
  open focused too.
- **Trends metric de-duplication** — label variants of the same series now
  group together (e.g. "US 10-Year Treasury Yield", "US 10Y Yield" and
  "10-Year Yield" → one card) via a stronger `normalizeLabel`.
- **Top ticker on all tabs** — the masthead ticker + clock now show on
  Trends/Archive/About (falls back to the latest brief's teaser), not just
  Today's Brief.
- **Local timezone** — the clock shows the reader's local time + tz label, and
  the "Good morning/afternoon/evening" greeting follows the reader's local hour
  (was hardcoded SGT). Sunday cadence stays SGT.
- **Synthesis card cleanup** — the systems-synthesis card no longer shows the
  metric strip or a duplicate Singapore Lens box; it's thesis + three numbered
  "Signals to watch". Synthesis-section detection accepts `systems` /
  `synthesis` / `systems synthesis` so incoming n8n briefs render correctly
  regardless of the exact label.
- **"Signals to watch"** — story cards and the synthesis split their
  forward-looking signals out via one shared extractor (`partitionLensWatch`),
  matched 1-to-1 with the Trends "Broader signals". Extraction hardened to catch
  header-merged "First, if…" and "And if…" openers; every brief's synthesis now
  yields exactly three signals.
- **Data fixes** — rebuilt the malformed May 31–Jun 5 syntheses from their
  Telegraph sources (correct content, standard format, three signals each); both
  the bundled `.ts` and the production DB were updated.
- **Time-of-day adaptive theme** — four local-time bands with an Auto/Light/Dark
  toggle, a dedicated light masthead, and merlion-cream gold accents.
- **Telegram CTA** — a "For the latest updates" button (→ t.me/TheDailyRipple)
  beside "Read the full brief"; both wrap cleanly on mobile.
- **Desktop first-fold** — trimmed banner + deck spacing so the full carousel
  card sits within the fold on desktop (mobile unchanged).
- **Docs** — README replaced the stale template; functional spec, brief-format,
  and the watch-signal cue convention documented.

---

*Written by Claude · Anthropic. The Daily Ripple is independent and self-funded.
Nothing in the app is financial advice.*
