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

### 2026-07-09 — Agentic Ripple Phase C (numeric realisation into the ledger)
- **Numeric realisation sweep** — open numeric-threshold signals in the ledger
  ("Watch Brent above $90", "the 10Y below 4%") are now resolved server-side against
  real market prices and marked **realised** when the level is crossed —
  deterministically (confidence 1.0, no web search / LLM), so they surface in the
  unified watch list, not just on the market cards. `server/numericRealisation.ts`
  parses the metric + level (5 instruments: S&P, Dow, Brent, Gold, US 10Y) and checks
  the first crossing after the surfaced date against `getMarkets().recent` (the same
  live series the cards use), with a scale guard against unit mismatches. Chained into
  `/api/realise` ahead of the web-grounded sweep (deterministic wins; the web sweep
  then skips the already-realised ones). Parse + crossing logic is pure + unit-tested.

### 2026-07-08 — Agentic Ripple Phase D (two-column rail + touch reorder)
- **Signals two-column rail** — the middle of the Signals page now matches the
  locked IA: a left column (2/3) with the House View alpha card + the dominant-signal
  hero, and a right column (1/3) with the Agent Status panel + Active Watches. The
  theme-card grid runs full-width below. Stacks to one column on mobile.
- **Touch reorder for Active Watches** — the watch list now reorders with Pointer
  Events instead of HTML5 drag, so it works on touch as well as mouse (the pure,
  tested `moveBefore`/`mergeWatchOrder` ordering is unchanged).

### 2026-07-08 — Agentic Ripple Phase D (editorial review UI)
- **Editorial review queue** (`/admin/signals`, not in nav) — an admin page for the
  signals the realisation sweep scored in the ambiguous band (`pending_review`):
  each shows the sweep's evidence (note, source link, confidence, checked date) with
  **Confirm realised** / **Dismiss** actions wired to the existing `confirmSignal` /
  `dismissSignal` mutations. Those are `apiKeyProcedure`-guarded, so the admin pastes
  the `PUBLISH_API_KEY` once; it's held in `sessionStorage` and sent as `x-api-key`
  by the tRPC client (never written to disk, cleared on tab close). Actions are
  disabled until the key is unlocked; a wrong key surfaces a clear error.

### 2026-07-08 — Agentic Ripple Phase D (house view / alpha card)
- **House View (daily alpha card)** — a single opinionated, cross-cutting read on
  the current open signals for the Singapore-professional persona (the house view;
  no per-user personalisation). A new `house_view` table + `server/houseView.ts`
  does one **Sonnet** call over the open-signal ledger, chained off publish like
  theme synthesis (and available via `/api/synthesize`); the page reads the
  pre-generated row (`n8n.getHouseView`), never an LLM. The **Alpha card** renders
  the headline, a conviction stance, the thesis, and a reasoning trail back to the
  signals it leans on — and self-hides until a view exists. The job also surfaces
  in the Agent Status panel ("House view"). Input-selection + output-parsing are
  pure + unit-tested (`houseView.test.ts`); the Sonnet call is `ANTHROPIC_API_KEY`-
  gated (reuses the existing key — no new env var).

### 2026-07-08 — Agentic Ripple Phase D (active watches)
- **Active Watches** — a re-orderable list of the open, forward-looking signals
  the reader is tracking. Order is arranged by drag and persisted to localStorage
  (no accounts); a reader's arrangement survives and freshly-surfaced watches land
  at the end. No invented predictive %: each row shows only honest metadata (theme,
  surfaced date, horizon, and the realisation engine's `conf` when it has scored
  one). Sits beside the Agent Status panel as a two-column ops rail under the
  Intelligence-signals header. Reorder logic is pure + unit-tested (`lib/watchOrder`).

### 2026-07-08 — Agentic Ripple Phase D (agent status)
- **Agent Status panel** — the Signals page now surfaces the background jobs that
  produce the intelligence layer. A compact monitor reads `n8n.getAgentStatus` and
  shows the latest run per job (Signal extraction, Synthesis, Realisation sweep)
  with an ok/error/idle dot, a relative "last run" time and a summary line, plus a
  data-health footer (briefs · open · realised · embedded chunks). Render-only,
  degrades to "no runs" when the ledger is empty.

### 2026-07-08 — Agentic Ripple Phase D (ask bar)
- **Ask bar** — the Signals page now opens with an agentic ask bar. It's
  retrieval-first: a query runs free semantic search over the signal ledger + brief
  chunks (`n8n.search`) and lists ranked, cited sources. **Synthesise** is opt-in
  and calls Haiku (`n8n.synthesizeAnswer`) for a grounded answer with inline `[n]`
  citations that link back to the cited brief — so generation cost is paid only on
  explicit intent. Degrades gracefully (no embeddings → "no matches"; no answer key
  → citations still shown). Example prompts seed the empty state.

### 2026-07-08 — Agentic Ripple Phase D (start)
- **Trends → Signals** — the nav tab and page are now **Signals** (route `/signals`);
  the old `/trends` URL 301-redirects so existing links keep working. Document title
  and IA copy follow.
- **Market-pulse strip** — the Signals page now opens with a compact pulse strip:
  six headline instruments (S&P 500, Nasdaq 100, US 10Y, Brent, Gold, USD/SGD) with
  price, day change and a mini sparkline; tap any chip to expand an inline detail row
  (day/range change, 52-week range or previous close). The full **Markets** carousel
  (all instruments, range tabs, bound threshold signals) is demoted to supporting
  context at the bottom of the page. The strip reads from the same server-cached
  market data on its own fixed range, so it adds no upstream API calls.

### 2026-07-03
- **Markets: fresh Brent + US 10Y (off laggy Alpha Vantage)** — Brent and US 10Y
  were the only instruments still on Alpha Vantage, whose `BRENT` and
  `TREASURY_YIELD` endpoints lag by days (Brent ~10 days stale, 10Y ~1 week) while
  everything on Twelve Data stayed current. Brent now uses Twelve Data's `XBR/USD`
  commodity CFD (like Gold's `XAU/USD`); US 10Y uses **FRED** (`DGS10`, daily) when
  `FRED_API_KEY` is set, with automatic Alpha Vantage fallback so nothing regresses
  before the free key is added.

### 2026-07-08
- **Design consistency pass** — toward a more intentional, less "vibe-coded" feel:
  (1) technical fundamentals — a brand ripple `favicon.svg` + apple-touch-icon,
  meta description, `theme-color`, Open Graph + Twitter cards (masthead image), and
  per-route document titles; (2) replaced the two commodity emoji (oil/medal) with
  Lucide icons — country flags kept as a legit FX convention; (3) removed the
  decorative pulse on the Trends hero badge (calmer, matches the "no glow, no pulse"
  ethos). Deeper unification (one brand Button, full radius/card retrofit) lands
  natively as the Signals page is built on the locked tokens.
- **Agentic Ripple — Phase B: agent status (`job_runs`)** — a `job_runs` table now
  logs each background job (`signal` = extract + embed on publish, `synthesis` =
  1W on publish / 1M+3M on realise, `realise` = weekly sweep) via
  `recordJobRun`. New tRPC `getAgentStatus` returns the latest run per job plus a
  data-health snapshot (brief count, last brief date, embedded-chunk count, signal
  status counts) for the Agent Status monitor. Status logging never throws into a
  job's critical path. Verified live.

### 2026-07-06
- **Agentic Ripple — Phase A: RAG foundation (pgvector + embeddings + search)** —
  enabled `pgvector` on Neon; signals carry an `embedding vector(1536)` and a new
  `brief_chunks` table holds one retrieval chunk per brief section, embedded with
  OpenAI `text-embedding-3-small`. `server/embeddings.ts` (key-gated on
  `OPENAI_API_KEY`) chunks/embeds on an idempotent boot backfill and on every
  publish (chained into `/api/publish-telegraph`). New tRPC `search` (cosine
  top-K over signals + chunks — retrieval only, ~$0/query) and `synthesizeAnswer`
  (opt-in Haiku answer with inline citations). Verified live: relevant retrieval
  + grounded, cited answers. Pure chunk/vector helpers covered by
  `embeddings.test.ts`; network paths no-op without the key.
- **Trends: Intelligence-signals header restyled** — the sticky header was a
  full-bleed bar with the title and 1W/1M/3M toggle cramped against the edges. It's
  now a rounded, lifted card (horizontal padding, themed border, soft shadow + lit
  top edge via the `--card-lift-*` tokens) so the title and toggle have breathing
  room and it reads as gently 3D. Also: USD/SGD FX card now uses the 🇺🇸 base-
  currency flag (was 🇸🇬), matching the other FX pairs.

### 2026-07-04
- **1W synthesis regenerates on every publish** — the daily Telegraph publish
  extracted Trends signals but never re-ran the synthesis, so the 1W hero + theme
  narratives + Singapore Lens were frozen at the last manual run (signal-driven
  bits like persistence dots and the evidence trail still updated, making the
  hero's stale prose stand out). `/api/publish-telegraph` now fire-and-forgets a
  1W `runSynthesis` after responding, so the narratives refresh with each brief.
  1M/3M still regenerate weekly via `/api/realise`.

### 2026-06-30
- **Brief page: bento + reading deck share one column on desktop** — the bento
  filled the full 1280px container while the swipe deck was capped at ~760px, so
  the two stacked blocks looked mismatched on desktop. Both now sit in a shared
  ~1040px centred column (deck viewport widened to match), so their edges align
  and the carousel peeks fill out. Reading card stays ~600px; mobile unchanged.
- **Telegraph import: section 8 no longer swallows its Sources footer** — the
  systems-synthesis blockquote carries an injected "📎 Sources" label + source
  list; the parser was flattening the whole blockquote, merging that footer into
  the synthesis prose and the last signal (e.g. "…competitiveness.📎 SourcesLA
  Times. (29 Jun)…"). It now walks the blockquote children — skipping the 📎
  label, routing the linked list into the section's `sources`, keeping only real
  paragraphs — so section 8 renders clean prose plus a proper Sources block.

### 2026-06-29
- **Signals extracted on Telegraph publish** — `/api/publish-telegraph` now runs
  signal extraction after upserting the brief, so the Trends ledger refreshes
  same-day instead of only on the next server restart (boot backfill). Idempotent:
  a re-publish adds new signals and leaves existing ones untouched.
- **Realisation sweep hardening** — (1) the Tavily search query is now capped at
  380 chars (Tavily rejects >400; long Singapore-Lens signals overran it and 500'd
  the whole Sunday sweep); (2) each signal's check is isolated in try/catch so one
  failure is logged and skipped rather than aborting the run (now reports an
  `errors` count); (3) `POST /api/realise` runs the sweep + 1M/3M synthesis in the
  **background** and returns `202` immediately — the work takes minutes, so a
  synchronous response was timing out the n8n cron node even though it completed.
  A guard prevents overlapping runs.

### 2026-06-28
- **Trends: mobile header no longer overflows** — the "Intelligence signals" title
  and the 1W/1M/3M window toggle shared one non-wrapping row, pushing 3M past the
  card edge on narrow phones. The toggle now drops to its own row below `sm` and
  sits inline (right-aligned) at `sm`+.
- **Trends 1W window = 6 briefs (Mon–Sat), not 7** — briefs publish Mon–Sat, so a
  publishing week is 6 briefs. The 1W window and persistence strip now use the last
  6 briefs, so the hero/cards read "N of 6" (e.g. "6 of 6") at week's end instead of
  pulling in the prior Saturday for a misleading "of 7". (1M/3M are date-range based
  and already counted only real briefs.)
- **Trends: explainer tooltip + collapsed-card height fix** — an info popover next
  to "Intelligence signals" explains how signals, themes, and realisation work
  (tap-friendly on mobile). Collapsed theme cards no longer over-reserve vertical
  space on mobile — the preview now uses a word-boundary clip instead of
  `-webkit-line-clamp` (which inflates height on iOS Safari).
- **n8n: weekly realisation cron** — added a Sunday Schedule → `POST /api/realise`
  branch (reuses the existing publish `X-Api-Key`) so the realisation sweep + 1M/3M
  synthesis run automatically each week. (Workflow `Daily Ripple MVP 1.95`.)

### 2026-06-27
- **Markets section → swipeable subsection deck** — the three Markets subsections
  (Exchanges · Rates & commodities · FX vs SGD) are now a one-at-a-time carousel
  (like the Today's Brief story deck) instead of three stacked grids, so Markets
  stays one subsection tall and the lead intelligence signal sits higher on the
  page. Navigation: circular ‹ › arrows, tappable section tabs, position dots, an
  explicit "N of 3 · swipe or use arrows" hint, and touch-swipe — all visible on
  both mobile and desktop. Directional fade on change (respects
  `prefers-reduced-motion`). Lands on Exchanges by default.
- **Trends Part 2 (Addendum C): Trends page redesign — intelligence layer** — the
  Trends page now leads with the live markets grid, then a **Dominant Signal hero**
  (the most persistent theme in the window: pulsing badge, serif headline derived
  from the synthesis, hero narrative, a 7-brief frequency sparkline, and the
  aggregated Singapore Lens callout) and a **2-column theme-card grid** (persistence
  dots, theme narrative, expandable Singapore Lens + signal evidence trail with
  realised badges). A 1W/1M/3M window toggle governs the view. Themes appearing in
  fewer than 2 briefs (and the `other` catch-all) are suppressed. Built on the live
  Daily Ripple tokens (cyan/sage/category hues, Playfair headings), responsive on
  mobile and desktop. Driven by the persisted signal ledger + synthesis prose via
  `getSignals` / `getThemeInsights`; new view-model in `lib/trendsView.ts` (tested).
  Note: `trendsAnalysis.ts`'s `groupBroaderSignals` / `buildWatchSignals` are now
  unused by the page (pending a follow-up cleanup).
- **Trends Part 2 (Addendum B): qualitative synthesis layer** — a new
  `theme_insights` table holds pre-generated prose per (theme, window). The
  synthesis job classifies each brief's Singapore Lens entries into themes and uses
  `claude-sonnet-4-6` to write, per active theme, a theme narrative + aggregated
  Singapore Lens, plus a hero narrative for the dominant theme. It runs **1W on
  brief publish** (after extraction) and **1M/3M weekly** (chained to
  `/api/realise`); a guarded `POST /api/synthesize` triggers it on demand. The
  Trends page reads this table — never an LLM at read time. Gated on
  `ANTHROPIC_API_KEY`; window/input construction is pure and covered by
  `synthesis.test.ts`. (Spec named Sonnet 4 → current Sonnet 4.6.)
- **Trends Part 2 (Addendum A): web-grounded signal realisation** — a weekly
  sweep (`POST /api/realise`, for n8n's Sunday cron, `X-Api-Key`-guarded) expires
  stale signals, then for each open signal runs a Tavily web search and asks
  `claude-haiku-4-5` whether the signal's condition occurred. Verdicts route by
  confidence: ≥0.85 auto-`realised` with evidence, 0.50–0.85 → `pending_review`
  editorial queue, <0.50 left `open` and rechecked next week. The queue is worked
  via the `confirmSignal` / `dismissSignal` tRPC mutations (admin-only). All
  network calls are gated on `TAVILY_API_KEY` + `ANTHROPIC_API_KEY`; without them
  the sweep degrades to a pure expiry pass. Query-building and verdict-routing are
  pure and covered by `realisation.test.ts`. (Spec named Haiku 3.5, which retired
  Feb 2026; using the current Haiku 4.5 for the same cheap-classification role.)
- **Trends Part 2 (Phase 0): persistent qualitative signal ledger** — forward
  "watch …" signals are now extracted from each brief's Singapore Lens / systems
  synthesis on publish and persisted to a new `signals` table (theme, surfaced /
  horizon / expiry dates, editorial-queue `status`, confidence + realisation
  fields). Extraction mirrors the existing client watch-sentence logic; named
  horizons ("by Q3", "in November", "2028") set the expiry, otherwise surfaced +
  30 days. Existing briefs are backfilled idempotently on boot, an expiry sweep
  runs alongside, and signals are exposed via the `getSignals` tRPC query.
  Date parsing is now timezone-stable (a brief dated June 15 stays the 15th in
  SGT, previously shifted a day via UTC). Covered by `signalsExtraction.test.ts`.
- **Markets: grouped sections, more FX, last-known-good persistence** — the grid
  is now split into **Exchanges**, **Rates & commodities**, and **FX · vs SGD**;
  US-index cards show the proxy ETF they're derived from ("· via SPY/QQQ/DIA").
  Added GBP/SGD, AUD/SGD, CNY/SGD (TD forex). New `market_cache` table persists
  each symbol's last fetched series so a quota-blocked/failed Alpha Vantage call
  serves the previous value instead of "Data unavailable" (fixes US 10Y / Brent
  blanking when AV's 25/day is spent) and survives restarts; AV cache TTL → 12 h.
  Navigation tooltip + About updated for the bento summary and the live Trends.
- **Markets: FX + Nasdaq 100 on Twelve Data; AV trimmed to 2 calls** — moved the
  three SGD FX pairs from Alpha Vantage (which lags ~2 days) to TD forex (fresher),
  and added **Nasdaq 100** via the QQQ ETF (TD, scaled ≈×41 — approximate, drifts).
  Brent and 10Y yield stay on AV (TD free has no raw Brent future or yield/index;
  BNO/NDX/TNX are fund-proxies or Grow-only). AV is now just Brent + 10Y (~8/day,
  well under its 25/day cap); TD carries the other 7 instruments.
- **Quantitative signal realisation on the Markets cards** — each card binds the
  briefs' forward threshold-signals ("watch oil below $75") to its live series and
  resolves them against real prices: a dashed reference line on the sparkline
  (green = realised, amber = watching) plus a one-line callout ("Flagged below $75
  → hit $74.20 (+2d)", linking to the source brief). Realisation is the **first**
  crossing after the signal's brief date, so a signal realises exactly once and
  never re-realises on a later crossing (`marketThresholdSignals`, reusing the
  existing `findThresholdSignals` against `/api/markets` `recent` data; tested).
- **Markets footer** now reads "Twelve Data & Alpha Vantage · daily close · cached
  server-side" (was the stale Yahoo/browser line).
- **Markets: free, on-demand, server-side TD + Alpha Vantage** — the Trends
  "Tracked metrics" section is now a `MarketsSection` of 8 instruments fetched on
  demand (no cron) via our own `GET /api/markets?range=X`. `server/markets.ts`
  sources S&P 500 + Dow from Twelve Data (SPY/DIA ETFs, scaled ×10/×100), Gold from
  TD `XAU/USD`, and Brent / 10Y yield / SGD-FX from Alpha Vantage. One fetch per
  symbol returns the full daily series; range tabs (1D–5Y) just re-slice the cache,
  so no extra calls. Per-symbol cache (TD 30 min, AV 6 h) keeps AV within its 25/day
  free quota (≤20/day) and collapses all visitors onto a few upstream calls. Themed
  to the navy palette: sparklines, day/range change, volume/prev-close, 52-week bar.
  Cost: $0. (Supersedes the abandoned Yahoo client-side / Yahoo-via-IPRoyal-proxy
  attempts — Yahoo blocks both datacenter IPs and its residential-proxy pool; the
  Asian indices need a paid tier and are omitted. Removed `server/marketData.ts`,
  the `/api/scheduled/refresh-metrics` endpoint, and the `https-proxy-agent` dep.)

### 2026-06-26
- **Indices scoped to US (SPY/DIA) on Twelve Data free** — TD's free tier has no
  raw indices and only resolves US-listed symbols, so S&P 500 and Dow source from
  the SPY/DIA ETFs (≈index ÷10 and ÷100; scale at display). The four Asian indices
  (STI/Nikkei/Hang Seng/KOSPI) need a paid tier and are omitted for now.
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
