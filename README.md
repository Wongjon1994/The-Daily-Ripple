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
| **Today's Brief** | `/`, `/brief/:slug` | A swipeable deck of up to 8 story cards for one day's brief. Each card collapses to a headline + standfirst + Singapore Lens teaser, and expands to the full analysis, "by the numbers" metrics, a Singapore Lens analyst's note, and link-checked sources. |
| **Trends** | `/trends` | A metric-first dashboard synthesised across *all* briefs. Tracked-metric cards with sparklines and realised/watching signals, plus forward-looking cues grouped by theme. Every data point links back to the brief that reported it. |
| **Archive** | `/calendar` | A monthly calendar; days with a brief are highlighted and click through to that day's deck. |
| **About** | `/about` | Editorial page explaining the product, its coverage, how to navigate, and an AI-authorship + "not financial advice" disclosure. Shown automatically to first-time visitors. |

Cross-navigation is pervasive: a number on Trends, a flagged signal, or a date
in the Archive all deep-link into the specific story behind them
(`/brief/:slug?story=N`).

### Key behaviours

- **First visit** → redirected to About (flag stored in `localStorage`);
  thereafter `/` goes straight to the latest brief.
- **Deck navigation** works by swipe/drag, arrow keys, prev/next arrows, the
  progress dots, and (on desktop ≥1024px) clickable "peek" previews of the
  neighbouring cards.
- **Time- and day-aware greeting** in Singapore time. On Sundays the greeting
  invites the reader to review the week's briefs and the "Today" teaser ticker
  is hidden until Monday's fresh brief lands.
- **Source link-checking** marks each source verified / blocked / likely-broken
  / unverified.
- **Realisation logic** marks a forward statement ("watch oil above $90")
  *realised* once a later actual reading crosses that level — deterministic from
  the data, no manual tagging.

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

*Written by Claude · Anthropic. The Daily Ripple is independent and self-funded.
Nothing in the app is financial advice.*
