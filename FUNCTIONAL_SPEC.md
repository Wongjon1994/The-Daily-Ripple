# The Daily Ripple — Functional Specification

A single-page web app that presents a daily intelligence brief, a cross-brief
trends dashboard, a date archive, and an about page. It is a React SPA (wouter
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
| `/brief/:slug?story=N` | …deep-linked to story **N** (1-based) within that brief |
| `/trends` | Trends |
| `/calendar` | Archive |
| `/about` | About |
| anything else | Not Found |

### 1.2 First-visit landing
The very first time a visitor lands on `/`, they are redirected to **About** and
a flag (`ripple_visited`) is stored in `localStorage`. On every visit after
that, `/` goes straight to Today's Brief. The About tab remains reachable from
the nav at any time. Explicit `/brief/:slug` links are unaffected.

### 1.3 Masthead (top of every tab)
- A teaser ticker (Today's Brief only) cycling the first three headlines every 5s, with a live clock in the **reader's local timezone** (labelled, e.g. "09:06 GMT+8"). On **Sundays** (Singapore time — the brief-publishing cadence) the ticker is hidden until Monday's fresh brief lands.
- The banner artwork (falls back to a text masthead if the image fails to load); clicking it returns to `/`.
- A **sticky navigation bar** that locks to the top of the viewport once the banner scrolls away. Tabs, left→right: **Today's Brief · Trends · Archive · About**. The active tab is highlighted in cyan.
- A greeting line (Today's Brief only), time-of-day aware in the **reader's local time** ("Good morning/afternoon/evening"), matching the local-time theme band. On **Sundays**, the salutation is kept but the second sentence is replaced to invite the reader to review the week's briefs ("…This week's briefs are ready for your review — have a read. We'll see you next week.") rather than announce a daily brief.

### 1.4 Sticky layering
Secondary bars stack beneath the nav (which defines `--nav-h`): the brief's date-picker row (Today's Brief) and each Trends section header pin directly below the nav as you scroll.

### 1.5 Theme & background
Dark theme throughout, with a faint fixed world-map backdrop behind all content.

### 1.6 Data & loading
- All content is fetched from the backend via tRPC (`/api/trpc`). The frontend never reads the database directly.
- Each tab shows a **spinner** while its query is in flight and a graceful empty/fallback state if there is no data.

---

## 2. Tab 1 — Today's Brief (`/`, `/brief/:slug`)

The reading experience: a swipeable deck of story cards for one day's brief.

### 2.1 Brief selection
- On `/`, the **most recent** brief loads. On `/brief/:slug`, that specific day loads; an unknown slug falls back to the latest.
- A **date-picker row** (sticky under the nav) holds:
  - A **brief selector** dropdown grouping recent briefs by week ("This Week", "Last Week"); older briefs are reachable via the Archive tab. Selecting a brief switches the deck and resets to story 1.
  - A **"Read the full brief"** link (label shortens to "Full brief" on mobile) opening the canonical source (Telegraph) in a new tab — shown only when a source URL exists.
  - A **help (?)** button opening a "How to navigate" modal.

### 2.2 The story deck (carousel)
- A brief has up to **8 story cards** (sections 1–7 plus a Systems Synthesis).
- **Story counter + arrows (primary navigation):** a centred "**N of 8**" counter sits above the deck, flanked by circular **‹ ›** prev/next arrows on every screen size.
- **Progress dots** sit below the deck; the current dot is enlarged and cyan, and tapping any dot jumps to that story.
- **Other ways to navigate:**
  - **Swipe** left/right (touch) or **drag** (mouse).
  - **Arrow keys** (←/→).
  - **Desktop (≥1024px):** faint "peek" previews of the previous/next cards flank the focal card and are clickable.
  - **Mobile (<1024px):** a "Swipe or tap the arrows to move between stories" hint sits under the dots.
- Navigation wraps around (next from the last story returns to the first).
- The deep-link `?story=N` opens the deck at story N.

### 2.3 Story card — collapsed state
Each card shows, top to bottom:
1. **Category kicker** — emoji + label, an **urgency dot** (red = high, cyan = medium, none = low), and an estimated **reading time** (e.g. "2m"). A thin category-coloured rule sits under the header, with a faint large story number watermarked in the corner.
   - **Story 1 is labelled "LEAD STORY"** on the card. Its underlying category (e.g. geopolitics) is unchanged — only the displayed label differs, matching how the brief is constructed.
2. **Headline** (serif).
3. **Deck/standfirst** — a 2–3 line summary with the first few words in gold as a lead-in; long decks fade out at the bottom to signal there's more.
4. **Singapore Lens teaser** — a short, cyan-ruled preview of the local-angle note (shown only when the Lens adds something beyond the body). Tapping it expands the card.
5. **Footer** — source attribution ("via …") and a full-width **CTA** that advertises what's inside: e.g. "Full analysis · Singapore Lens · 3 sources → Read more".

### 2.4 Story card — expanded state
Tapping "Read more" expands an inset panel containing, in order:
1. **"By the numbers"** strip — key-metric chips (label, value, up/down colour-coded change), when the story carries metrics.
2. **Lede paragraph** (story's first paragraph) — bright text with an editorial drop cap in the category colour.
3. **Remaining paragraphs** — same bright typography as the lede; one punchy sentence may be lifted out as a large italic pull-quote to break the prose.
4. **Singapore Lens · Analyst's note** — the local-angle commentary in **non-italic** serif, closing out the story after the paragraphs (cyan left-rule, pin icon). Suppressed when it would merely duplicate the body (e.g. Systems Synthesis). Any forward-looking sentence carrying a watch cue (`watch`, `monitor`, `keep an eye`, …) is split out beneath the note as a gold-accented **"Signal(s) to watch"** block (eye icon). These signals come from the same extractor that feeds the Trends "Broader signals", so the two stay matched 1-to-1.
5. **Sources** — a **two-line row** per source: status icon + outlet + date on the first line, the article title wrapping below. Each row is clickable (opens in a new tab) and carries a **link-status icon**:
   - ✓ verified (2xx–3xx), ⚠ blocked (the site refused the automated check — likely fine in a browser; 401/403/405/429/5xx), ✗ likely broken (404/410), ? unverified/timeout. A spinner shows while checks run.
   - When a story has no inline sources, a single "read the full brief" link is shown instead.

A "Show less" control collapses the card again.

### 2.5 States
- **Loading:** centred spinner + "PREPARING YOUR BRIEF".
- **No briefs:** message prompting to publish a brief via the API.

---

## 3. Tab 2 — Trends (`/trends`)

A metric-first dashboard synthesised across **all** briefs. Two sticky-headed sections.

### 3.1 Tracked metrics
- Header "**Tracked metrics**" (gold) with a count ("N reported ≥2× · M signals realised").
- A grid of **metric cards** for every quantity reported in ≥2 briefs that passes quality filters (coherent single dimension, real movement, not pure %-change noise; some metrics — e.g. STI — are temporarily withheld in code).
- **Collapsed metric card:**
  - A trend-coloured kicker (green up / red down), the **metric name**, and a **realised/watching** badge.
  - The **latest value** (large) with the period **delta** and a direction arrow.
  - A **sparkline** of the series with dashed threshold lines; realised-crossing points are marked green. **Each data point links** to the brief that reported it:
    - **Desktop:** hovering a point shows a tooltip (value, date, story headline, "Open brief →"); clicking opens the brief.
    - **Touch:** the first tap on a point reveals its tooltip; a second tap (on the point or the tooltip) opens the brief — so a reader can preview before deciding. Tapping elsewhere dismisses it.
  - For metrics with a realised signal, a **payoff line**: "Flagged above 90 → hit $99/barrel (+1d)" — the trust moment, surfaced on the card face.
  - A footer: compact period ("May 31 – Jun 20 · 17 pts") and a **CTA** ("Signal ledger" if it has signals, else "Explore").
- **Expanded metric card** adds:
  - **Signal ledger** — realised/watching callouts (each links to its source brief story).
  - **Related cues** — topical signals tied to this metric, capped with a "Show N more" toggle.
  - When a metric has none of the above, a hint points the reader at the clickable chart points (so expanding is never empty).

### 3.2 Broader signals · by theme
- Header "**Broader signals · by theme**" (cyan) with an explainer line.
- Forward-looking cues that aren't bound to a tracked metric, grouped into themes (Energy, Rates & banking, AI & technology, Geopolitics & security, Markets & corporate, Society & culture, Other). Each theme is a **collapsed** row with its own accent colour, a signal count (and realised count), and a single-line preview (the theme's first signal, truncated).
- Expanding a theme lists its signals (each links to its brief story), capped at 6 with a "Show N more" toggle. Larger themes sort first; "Other" sinks to the bottom.

### 3.3 Realisation logic (what "realised" means)
A forward statement that named a level for a metric ("watch oil above $90") is marked **realised** when a later actual reading crosses that level (with the lag in days), otherwise **watching**. This is deterministic from the data; no manual tagging is required.

### 3.4 States
- **Loading:** centred spinner.
- **No data:** "No metrics to track yet — trends appear as briefs accumulate."

---

## 4. Tab 3 — Archive (`/calendar`)

A monthly calendar for browsing past briefs by date.

### 4.1 Layout & navigation
- Centred month view titled "**{Month} {Year}**" with a subtitle "**N briefs this month**".
- ‹ › buttons step to the previous/next month (rolling the year over at the boundaries).
- A Monday-first 7-column grid; leading/trailing blanks pad the weeks. Weekday headers (Mon…Sun) sit above.

### 4.2 Day cells
- **Days with a brief** are highlighted (brighter text, a small cyan dot, a hover state) and **clickable** → navigate to `/brief/{slug}` for that day, landing on the Today's Brief tab for that date.
- **Days without a brief** are dimmed and non-interactive (disabled).
- **Today** is outlined in cyan (whether or not it has a brief).
- A **legend** explains the "Brief available" dot and the "Today" outline.

### 4.3 States
- **Loading:** centred spinner in place of the grid.
- Months with no briefs simply show no highlighted days and "0 briefs this month".

---

## 5. Tab 4 — About (`/about`)

An editorial page explaining the product. It is the **landing page for first-time
visitors** (see §1.2) and is otherwise reached via the About tab.

### 5.1 Sections
1. **Hero** — an "ABOUT" kicker, the serif title "The Daily Ripple", a one-line mission tagline, and a "**Start reading today's brief →**" call-to-action linking to `/`.
2. **What this is** — the mission, with the brief's coverage rendered as an **eight-tile grid** that mirrors the daily deck (🌐 Lead story · ⚖️ Global politics & policy · 📊 Markets · 💼 Business · 🤖 Technology & the future of work · 🔬 Science & health · 🎭 Culture · 🔗 Systems Synthesis), each tile carrying its section emoji, ordinal (01–08), and category colour. A pulled-out line emphasises the core question ("So what does this mean for me, here?").
3. **How to navigate the site** — three **interactive cards** (Today's Brief / Trends / Archive), each with an icon in that section's colour; clicking a card navigates to that tab.
4. **A note on how this is made — and its limits** — an AI-authorship disclosure ("Written by Claude · Anthropic"), the accuracy/limitations note, and a distinct amber **"This is not financial advice"** callout.
5. **Footer** — the independent/self-funded line and a closing "Start reading today's brief →" CTA.

All copy is presented as written; the page only shapes its layout.

---

## 6. Cross-cutting behaviour

### 6.1 Responsive design
- The layout adapts at the `lg` (1024px) breakpoint: deck **peek** previews are desktop-only; the brief's **swipe hint** is mobile-only; the Trends grid is single-column on mobile and two-column on desktop; the Trends metric count subtitle is hidden on the narrowest screens. The deck's prev/next arrows live with the top counter on **all** sizes.
- Sticky bars (nav, date picker, Trends section headers) keep key controls reachable while scrolling on both form factors.

### 6.2 Deep linking & cross-navigation
- Trends signals, metric points, Archive day cells, and the About nav cards all link into the rest of the app (`/brief/:slug?story=N` for brief stories), so a reader can move from a number, a flagged signal, or a date straight to the story behind it, and back.

### 6.3 Data model (per brief)
Each brief has: a human date and slug, an ISO `briefDate` (used for sorting/calendar), a greeting, an array of teaser lines, up to 8 **sections** (each with category, emoji, headline, summary, paragraphs, optional Singapore Lens, key metrics, sources, urgency, reading time), an optional systems-synthesis object, and an optional source (Telegraph) URL.

### 6.4 Content ingestion (non-UI)
- **Runtime publish:** `POST /api/publish` (or the `n8n.publish` tRPC procedure), protected by an `X-Api-Key`, upserts a brief by slug.
- **Bundled briefs:** the canonical brief set ships in code. On every server boot it is **upserted into the database (idempotent by slug)**, so deploying a newly added brief publishes it even into an already-populated database. Briefs added only at runtime via `/api/publish` are left untouched.
- A lightweight **`/healthz`** endpoint returns a 200 JSON heartbeat, used for the host's health probe and an external keep-warm ping.

### 6.5 Error handling
- The app is wrapped in an error boundary; a not-found route renders a 404 view. Link checks, brief fetches, and trends computations each degrade to a safe empty state rather than crashing the page.
