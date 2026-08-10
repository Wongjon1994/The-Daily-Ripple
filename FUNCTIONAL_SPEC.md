# The Daily Ripple — Functional Specification

A single-page web app that presents a daily intelligence brief, a cross-brief
signals intelligence dashboard, a date archive, and an about page. It is a React SPA (wouter
routing) served by an Express + tRPC backend over a cloud Postgres database.
This document specifies the **observable behaviour** of each of the four
navigation tabs and the elements shared across them.

---

## 1. Global behaviour (shared by all tabs)

### 1.1 Routing
Client-side routes (no full page reloads between tabs):

| Path | Tab / View |
|------|------------|
| `/` | First-ever visitor is redirected to **About**; thereafter **Today's Brief** (latest brief) |
| `/brief/:slug` | Today's Brief, showing a specific day (e.g. `/brief/june-20-2026`) |
| `/brief/:slug/:story` | **Story page** — story **N** (1-based) within that brief, as a standalone read |
| `/signals` | Signals (agentic intelligence dashboard) |
| `/trends` | Redirects to `/signals` (legacy) |
| `/admin/signals` | Editorial review queue (key-gated; not in nav) |
| `/calendar` | Archive |
| `/about` | About |
| anything else | Not Found |

### 1.2 First-visit landing
The very first time a visitor lands on `/`, they are redirected to **About** and
a flag (`ripple_visited`) is stored in `localStorage`. On every visit after
that, `/` goes straight to Today's Brief. The About tab remains reachable from
the nav at any time. Explicit `/brief/:slug` links are unaffected.

### 1.3 Site header & navigation
- A **slim sticky header** at every width: the wordmark (ripple mark + "The Daily Ripple", returns to `/`) and the theme toggle. The full masthead **banner artwork now lives on the About page**, not atop every tab.
- **Navigation** is responsive: a **bottom tab bar** (<640px) fixed in the thumb zone with 44px icon+label targets, and a **top tab bar** (≥640px) with the same icons. Tabs, left→right: **Today's Brief · Signals · Archive · About**. The active tab carries a cyan pill **and** an underline/indicator (not colour alone), so the state reads without relying on colour.
- A **teaser ticker** (≥640px) cycling the first headlines every 5s with a live clock in the **reader's local timezone** (e.g. "09:06 GMT+8"); hidden on the slim mobile header and, on **Sundays** (Singapore time — the publishing cadence), until Monday's fresh brief lands.
- A greeting line (Today's Brief only), time-of-day aware in the **reader's local time** ("Good morning/afternoon/evening"), matching the local-time theme band. On **Sundays**, the salutation is kept but the second sentence invites the reader to review the week's briefs rather than announce a daily brief.

### 1.4 Sticky layering
Secondary bars stack beneath the nav (which defines `--nav-h`): the brief's date-picker row (Today's Brief) and the Signals "Intelligence signals" section header pin directly below the nav as you scroll.

### 1.5 Theme & background
A time-of-day adaptive theme in four bands (morning/midday light → evening/night dark), keyed to the reader's local hour with an Auto/Light/Dark override, over a faint fixed world-map backdrop. Secondary text and status colours are tuned per band to meet WCAG AA contrast.

### 1.6 Data & loading
- All content is fetched from the backend via tRPC (`/api/trpc`). The frontend never reads the database directly.
- Each tab shows a **spinner** while its query is in flight and a graceful empty/fallback state if there is no data.

---

## 2. Tab 1 — Today's Brief (`/`, `/brief/:slug`)

The reading experience: a single-column **list** of the day's stories. Each story opens its own **Story page** (§2.4); there is no swipe carousel.

### 2.1 Brief selection
- On `/`, the **most recent** brief loads. On `/brief/:slug`, that specific day loads; an unknown slug falls back to the latest.
- A **date-picker row** (sticky under the header) holds:
  - A **brief selector** dropdown grouping recent briefs by week ("This Week", "Last Week"); older briefs are reachable via the Archive tab.
  - A **Telegram** CTA ("For the latest updates"; "Telegram" on mobile) and a **"Read the full brief"** link ("Full brief" on mobile) opening the canonical Telegraph source in a new tab — shown only when a source URL exists.
  - A **help (?)** button opening a "How to navigate" modal.

### 2.2 The story list
- A brief has up to **8 stories** (sections 1–7 plus a Systems Synthesis).
- **Lead card** — section 1, a prominent card with a filled **"Lead story"** pill, serif headline, a one-line dek with key figures emphasised in gold, source attribution, and a "Read →" affordance.
- **Story rows** — the remaining stories as compact rows: a category icon in a tinted tile, an **NN category** eyebrow, the headline, and a one-line `source · reading-time` meta.
- **System Synthesis** (section 8) gets its own distinct gold tint so it reads as analysis, not another headline.
- **Responsive:** a single column on mobile; from 640px the secondary stories become a 2→3-column card grid under the full-width lead. The **DOM order stays linear** (lead → 2 → 3 … → synthesis) regardless of the visual grid, for screen readers.
- Tapping any item navigates to its **Story page** at `/brief/:slug/:story`.

### 2.3 The one shared category map
Category → icon, colour (a `--color-cat-*` token), and label are defined once (`lib/categories.ts`) and reused across the brief list, Story page, Signals, and About. Section 1 is always presented as the day's **Lead story** (globe icon, cyan accent) regardless of its underlying category.

### 2.4 Story page (`/brief/:slug/:story`)
A focused, standalone read for one story. A slim bar with a **Back to brief** control replaces the main header. Body, top to bottom:
1. **Eyebrow** — category label (in the category colour) + estimated **reading time**.
2. **Headline** (serif) and a **byline/meta** line (`via <outlets> · <date>`), then a category-coloured rule.
3. **Stat tiles** — where the section carries structured `keyMetrics` with real values, the key figures are pulled out of the prose into tiles at the top (label, value, and an up/down **arrow + colour** change — never colour alone). Progressive enhancement: sections without metrics simply omit them.
4. **Lede paragraph** with an editorial drop cap in the category colour, then the **remaining paragraphs** as short blocks.
5. **Singapore Lens · Analyst's note** — the local-angle commentary in serif with a cyan left-rule + pin icon, visually distinct from the body prose. Any forward-looking sentence carrying a watch cue is split out beneath as a gold **"Signal(s) to watch"** block (eye icon), from the same extractor that persists the Signals ledger — so the story and the Signals watch list stay matched 1-to-1. The Systems Synthesis surfaces its numbered "Signals to watch" instead of a Lens box.
6. **Track in Signals** — a link into the Signals layer.
7. **Sources** — one row per source: status icon + outlet + date, article title wrapping below; each clickable (new tab) with a **link-status icon** (✓ verified · ⚠ blocked · ✗ likely broken · ? unverified; spinner while checking). With no inline sources, a "read the full brief" link shows instead; the canonical **Telegraph** link is always offered.

### 2.5 States
- **Loading:** centred spinner + "PREPARING YOUR BRIEF" (list); a spinner on the Story page.
- **No briefs:** message prompting to publish a brief via the API. An unknown story index shows a "That story isn't available" fallback with a link back to the brief.

---

## 3. Tab 2 — Signals (`/signals`; the old `/trends` URL redirects here)

An **agentic intelligence dashboard** synthesised across **all** briefs. Where the daily brief is one day, Signals is the running, opinionated read on what's building and what to watch. A small pipeline of background jobs (extraction, synthesis, house view, realisation) produces the layer; the page itself never calls an LLM at read time. Top to bottom:

### 3.1 Ask bar (RAG) — "Ask Ripple"
- A pill-shaped ask bar (sparkle mark + a circular submit button) over the whole archive. It is **answer-led and one action**: a single deliberate submit runs a grounded synthesis (Haiku) and lands straight on the **answer** — the LLM cost is still only paid on explicit intent (one submit), not on typing. One "Reading across the briefs…" state covers the wait.
- The answer ("Ripple's read") carries inline `[n]` citation chips that preview the source on hover and open the cited brief on click; the cited briefs sit in a **collapsed "Sources · N"** disclosure beneath the answer rather than a dominating grid.
- Degrades gracefully: no embeddings → "No matching briefs yet"; no answer key → the cited briefs still show (sources open). Example prompts seed the empty state.

### 3.2 Market pulse (the single markets surface)
- A strip of all tracked instruments — US indices (S&P 500, Nasdaq 100, Dow Jones), rates & commodities (US 10Y, Brent, Gold), and FX vs SGD (USD, EUR, GBP, JPY, AUD, CNY): each chip shows price, day change (with a direction arrow, not colour alone), and a mini sparkline; it reflows from two-across up to six.
- **Tap to expand** a chip for an inline detail row: day change, 1-month range change, 52-week range (or previous close for FX/yields), and — when the instrument carries a **brief threshold-signal** — the headline bound signal ("Flagged above 90.00 → hit 93.85 (+13d)" when realised, else "Watching above …"), which links to the story that flagged it. Chips with a bound signal show a small check (realised) or eye (watching) marker. This replaces the former standalone Markets carousel.

### 3.3 Intelligence signals — the qualitative layer
Under a sticky header with a **1W / 1M / 3M** window toggle. Forward-looking "watch" signals are extracted from each brief, grouped by theme, and enriched with pre-generated synthesis prose.
- **Dominant hero** — the window's most persistent theme: a headline, a synthesis narrative, an appearance strip across recent briefs ("N of M briefs"), a realised count, and its aggregated **Singapore Lens**.
- **Theme cards** — a grid of active themes (appearing in ≥2 briefs in the window; "Other" suppressed). Each shows persistence dots and a narrative; expanding reveals its Singapore Lens and an **evidence trail** of the underlying signals (each links to its brief story; realised ones carry a date).
- Themes: Energy & commodities, Rates & banking, AI & technology, Science & health, Geopolitics & security, Markets & corporate, Society & culture.

### 3.4 House View (daily "alpha" card)
- One opinionated, cross-cutting read, generated **daily** by a single LLM (Sonnet) call over the current open signals: a punchy **headline**, a conviction **stance**, a **thesis** written directly to the reader, and a **reasoning trail** back to the signals it leans on. Renders only once generated. It must not state a numeric level (price/rate/index) that isn't present in the signals it's given.

### 3.5 Active Watches
- The reader's list of open forward-looking signals, with an **Open / Realised** filter (live counts). Open watches are **re-orderable** (up/down buttons; order persisted per device via localStorage). Realised watches show a green "Realised · <date>" badge and the sweep's evidence note.

### 3.6 Freshness
- The reader-facing surface is a calm **freshness line** — "⟳ Updated Xh ago" — on mobile/tablet, and a simplified **sync widget** in the desktop right rail ("Last sync Xh ago · N signals tracking · M realised"). The full per-job telemetry (Signal extraction, Synthesis, House View, Realisation sweep — status, last-run time, data-health counts) lives on the **admin page** (`/admin/signals`), not the reader view.

### 3.7 Realisation logic (what "realised" means)
Two engines, both grounded in real data — never an LLM's guess about a number:
- **Numeric (deterministic):** a signal naming a tracked instrument *and* a level ("watch Brent above $90") is resolved against our own market series — realised on the first crossing after it surfaced. This is the single source of truth for market levels; the web engine never adjudicates them.
- **Web-grounded (weekly):** the Sunday sweep web-checks each remaining open signal (search + an LLM verdict) and routes by confidence — high → realised, medium → an editorial queue (`pending_review`), low → left open. Market-flavoured signals are capped to the queue and can never auto-realise here.
- Open signals **expire** after 30 days (or a named horizon).
- Editors confirm/dismiss queued signals at `/admin/signals` (key-gated, not in nav).

### 3.8 States
- **Loading:** centred spinner.
- **No themes yet:** "No persistent themes in this window yet." — the read builds as briefs accumulate.

---

## 4. Tab 3 — Archive (`/calendar`)

Past briefs grouped under week signposts, with an all-time search.

### 4.1 Browse mode (no search)
- A **search box** ("Search the archive…") sits at the top.
- Recent briefs show as **week groups** — "This week", "Last week", "2 weeks ago" — each with a brief count. Every row is a **day + date** block (`Sat / 8`), the lead **headline**, an `N stories · 1 synthesis` meta, and a chevron → navigates to `/brief/{slug}`. One column on mobile; a two-column grid from `lg`.
- Everything **older than two weeks** folds behind an expandable **"Browse earlier briefs by date"** control that opens a **month calendar** (Monday-first, ‹ › month nav, a cyan dot on days with a brief; a day click opens that brief). This keeps the browse scroll bounded.

### 4.2 Search mode (query present)
- Typing **flattens** the tiers: a single week-grouped list of **all** matching briefs across the whole archive (headline/date match), so no older brief is ever hidden from search. Clearing the query returns to browse mode.

### 4.3 States
- **Loading:** centred spinner.
- **No matches / empty archive:** a short empty-state message.

---

## 5. Tab 4 — About (`/about`)

An editorial page explaining the product. It is the **landing page for first-time
visitors** (see §1.2) and is otherwise reached via the About tab.

### 5.1 Sections
1. **Hero** — an "ABOUT" kicker, the serif title "The Daily Ripple", a one-line mission tagline, and a "**Start reading today's brief →**" call-to-action linking to `/`.
2. **What this is** — the mission, with the brief's coverage rendered as an **eight-tile grid** that mirrors the daily deck (🌐 Lead story · ⚖️ Global politics & policy · 📊 Markets · 💼 Business · 🤖 Technology & the future of work · 🔬 Science & health · 🎭 Culture · 🔗 Systems Synthesis), each tile carrying its section emoji, ordinal (01–08), and category colour. A pulled-out line emphasises the core question ("So what does this mean for me, here?").
3. **How to navigate the site** — three **interactive cards** (Today's Brief / Signals / Archive), each with an icon in that section's colour; clicking a card navigates to that tab.
4. **Making the most of the Signals page** — a walkthrough of the Signals tab: ask across every brief, start with the House View, scan the market pulse, track/re-order Active Watches, watch flagged calls get marked realised, and read the freshness of the layer — each linking into Signals.
5. **A note on how this is made — and its limits** — an AI-authorship disclosure ("Written by Claude · Anthropic"), the accuracy/limitations note, and a distinct amber **"This is not financial advice"** callout.
6. **Footer** — the independent/self-funded line and a closing "Start reading today's brief →" CTA.

All copy is presented as written; the page only shapes its layout.

---

## 6. Cross-cutting behaviour

### 6.1 Responsive design
- Navigation switches at 640px: a **bottom tab bar** below, a **top tab bar** above (§1.3). Today's Brief is a single column on mobile and a lead-card-plus-grid from 640px; the Archive rows go two-column from `lg`. On Signals the theme-card grid and the active-watches rail go single-column on mobile and two-column on desktop (the rail is sticky, carrying Active Watches + the freshness widget), while the market-pulse strip reflows from two-across up to six.
- Sticky bars (header, date picker, the Signals "Intelligence signals" header) keep key controls reachable while scrolling on both form factors.

### 6.2 Deep linking & cross-navigation
- Signals watches, evidence-trail signals, RAG source hits, House View reasoning-trail links, Archive rows, and the About nav cards all link into the rest of the app (`/brief/:slug/:story` for a specific story), so a reader can move from a flagged signal, a source, or a date straight to the story behind it, and back.

### 6.3 Data model (per brief)
Each brief has: a human date and slug, an ISO `briefDate` (used for sorting/calendar), a greeting, an array of teaser lines, up to 8 **sections** (each with category, emoji, headline, summary, paragraphs, optional Singapore Lens, key metrics, sources, urgency, reading time), an optional systems-synthesis object, and an optional source (Telegraph) URL.

### 6.4 Content ingestion (non-UI)
- **Runtime publish:** `POST /api/publish` (or the `n8n.publish` tRPC procedure), protected by an `X-Api-Key`, upserts a brief by slug.
- **Bundled briefs:** the canonical brief set ships in code. On every server boot it is **upserted into the database (idempotent by slug)**, so deploying a newly added brief publishes it even into an already-populated database. Briefs added only at runtime via `/api/publish` are left untouched.
- A lightweight **`/healthz`** endpoint returns a 200 JSON heartbeat, used for the host's health probe and an external keep-warm ping.

### 6.5 Error handling
- The app is wrapped in an error boundary; a not-found route renders a 404 view. Link checks, brief fetches, and the Signals computations (RAG search, synthesis, market data) each degrade to a safe empty state rather than crashing the page.
