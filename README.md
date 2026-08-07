# The Daily Ripple

A single-page web app that presents a daily intelligence brief, an agentic
cross-brief **Signals** intelligence dashboard, a date archive, and an editorial about page. Stories are
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
| **Signals** | `/signals` | An agentic intelligence desk across *all* briefs: an **ask bar** (RAG search + opt-in cited synthesis), a **market-pulse** strip, a daily **House View** (opinionated alpha card), **theme cards** with a dominant-signal hero and evidence trail, re-orderable **Active Watches** (open/realised filter), an **agent-status** monitor, and the full markets carousel. The old `/trends` URL redirects here. |
| **Archive** | `/calendar` | A monthly calendar; days with a brief are highlighted and click through to that day's deck. |
| **About** | `/about` | Editorial page explaining the product, its coverage, how to navigate, and an AI-authorship + "not financial advice" disclosure. Shown automatically to first-time visitors. |

Cross-navigation is pervasive: a flagged signal or evidence link on Signals, a date
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
  the bento. Deep links (`?story=N`, e.g. from Signals watches) open in focused
  reading too. Without clicking a cell, the reader can simply scroll down from the
  summary to the deck.
- **Deck navigation** works by swipe/drag, arrow keys, prev/next arrows, the
  progress dots, and (on desktop ≥1024px) clickable "peek" previews of the
  neighbouring cards.
- **"Signals to watch"** — forward-looking signals are extracted from the
  Singapore Lens (story cards) and the synthesis prose (section 8) by one shared
  extractor, so the card's signals match the Signals watch list 1-to-1.
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
    pages/        ← Page-level components (BriefPageEnhanced, SignalsPage, CalendarPage, AboutPage, AdminSignalsPage)
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
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, the Signals agent subsystem, data flow, and stack rationale |
| [FUNCTIONAL_SPEC.md](FUNCTIONAL_SPEC.md) | Full observable behaviour of all four tabs |
| [BRIEF_FORMAT.md](BRIEF_FORMAT.md) | The `DailyBrief` schema and importer |
| [DATABASE_FUNCTIONALITY.md](DATABASE_FUNCTIONALITY.md) | Data model and persistence |
| [DEPLOY.md](DEPLOY.md) | Deployment |
| [EVALUATION.md](EVALUATION.md) | Output-quality evaluation layer (proposed design) |
| [COST_TRACKING.md](COST_TRACKING.md) | Per-run token/cost logging & unit economics (proposed design) |
| [CHANGELOG.md](CHANGELOG.md) | Dated log of every user-facing change (newest first) |
| [docs/internal/](docs/internal/) | Early specs, n8n pipeline guides, and agent handoff notes (build history) |

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) — newest first, one entry per user-facing change.
