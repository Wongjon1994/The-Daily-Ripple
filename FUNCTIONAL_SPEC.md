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
| `/brief/:slug?story=N` | …deep-linked to story **N** (1-based) within that brief |
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

### 1.3 Masthead (top of every tab)
- A teaser ticker (Today's Brief only) cycling the first three headlines every 5s, with a live clock in the **reader's local timezone** (labelled, e.g. "09:06 GMT+8"). On **Sundays** (Singapore time — the brief-publishing cadence) the ticker is hidden until Monday's fresh brief lands.
- The banner artwork (falls back to a text masthead if the image fails to load); clicking it returns to `/`.
- A **sticky navigation bar** that locks to the top of the viewport once the banner scrolls away. Tabs, left→right: **Today's Brief · Signals · Archive · About**. The active tab is highlighted in cyan.
- A greeting line (Today's Brief only), time-of-day aware in the **reader's local time** ("Good morning/afternoon/evening"), matching the local-time theme band. On **Sundays**, the salutation is kept but the second sentence is replaced to invite the reader to review the week's briefs ("…This week's briefs are ready for your review — have a read. We'll see you next week.") rather than announce a daily brief.

### 1.4 Sticky layering
Secondary bars stack beneath the nav (which defines `--nav-h`): the brief's date-picker row (Today's Brief) and the Signals "Intelligence signals" section header pin directly below the nav as you scroll.

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
4. **Singapore Lens · Analyst's note** — the local-angle commentary in **non-italic** serif, closing out the story after the paragraphs (cyan left-rule, pin icon). Suppressed when it would merely duplicate the body (e.g. Systems Synthesis). Any forward-looking sentence carrying a watch cue (`watch`, `monitor`, `keep an eye`, …) is split out beneath the note as a gold-accented **"Signal(s) to watch"** block (eye icon). These signals come from the same extractor that persists the Signals ledger, so the brief card and the Signals watch list stay matched 1-to-1.
5. **Sources** — a **two-line row** per source: status icon + outlet + date on the first line, the article title wrapping below. Each row is clickable (opens in a new tab) and carries a **link-status icon**:
   - ✓ verified (2xx–3xx), ⚠ blocked (the site refused the automated check — likely fine in a browser; 401/403/405/429/5xx), ✗ likely broken (404/410), ? unverified/timeout. A spinner shows while checks run.
   - When a story has no inline sources, a single "read the full brief" link is shown instead.

A "Show less" control collapses the card again.

### 2.5 States
- **Loading:** centred spinner + "PREPARING YOUR BRIEF".
- **No briefs:** message prompting to publish a brief via the API.

---

## 3. Tab 2 — Signals (`/signals`; the old `/trends` URL redirects here)

An **agentic intelligence dashboard** synthesised across **all** briefs. Where the daily brief is one day, Signals is the running, opinionated read on what's building and what to watch. A small pipeline of background jobs (extraction, synthesis, house view, realisation) produces the layer; the page itself never calls an LLM at read time. Top to bottom:

### 3.1 Ask bar (RAG)
- A search bar over the whole archive. A query runs **retrieval-first** semantic search over the signal ledger + brief chunks and lists ranked, **cited** sources.
- **Synthesise** is opt-in: it calls an LLM (Haiku) for a grounded answer with inline `[n]` citations linking back to the cited brief. Degrades gracefully (no embeddings → "no matching signals"; no answer key → citations still show). Example prompts seed the empty state.

### 3.2 Market pulse
- A compact strip of six headline instruments (S&P 500, Nasdaq 100, US 10Y, Brent, Gold, USD/SGD): price, day change, and a mini sparkline. Tap a chip to expand an inline detail row. The full Markets carousel lives lower down (§3.7).

### 3.3 Intelligence signals — the qualitative layer
Under a sticky header with a **1W / 1M / 3M** window toggle. Forward-looking "watch" signals are extracted from each brief, grouped by theme, and enriched with pre-generated synthesis prose.
- **Dominant hero** — the window's most persistent theme: a headline, a synthesis narrative, an appearance strip across recent briefs ("N of M briefs"), a realised count, and its aggregated **Singapore Lens**.
- **Theme cards** — a grid of active themes (appearing in ≥2 briefs in the window; "Other" suppressed). Each shows persistence dots and a narrative; expanding reveals its Singapore Lens and an **evidence trail** of the underlying signals (each links to its brief story; realised ones carry a date).
- Themes: Energy & commodities, Rates & banking, AI & technology, Science & health, Geopolitics & security, Markets & corporate, Society & culture.

### 3.4 House View (daily "alpha" card)
- One opinionated, cross-cutting read, generated **daily** by a single LLM (Sonnet) call over the current open signals: a punchy **headline**, a conviction **stance**, a **thesis** written directly to the reader, and a **reasoning trail** back to the signals it leans on. Renders only once generated. It must not state a numeric level (price/rate/index) that isn't present in the signals it's given.

### 3.5 Active Watches
- The reader's list of open forward-looking signals, with an **Open / Realised** filter (live counts). Open watches are **re-orderable** (up/down buttons; order persisted per device via localStorage). Realised watches show a green "Realised · <date>" badge and the sweep's evidence note.

### 3.6 Agent status
- A monitor for the background jobs that produce the layer — **Signal extraction, Synthesis, House View, Realisation sweep** — each with an ok/idle status, a relative last-run time, and a summary, plus a data-health footer (briefs · open · realised · embedded chunks).

### 3.7 Markets carousel
- The full instrument deck (**Exchanges · Rates & commodities · FX vs SGD**), swipeable, with range tabs (1D…5Y). Each card resolves the briefs' threshold signals against its live series, marking a signal **realised** on the first crossing.

### 3.8 Realisation logic (what "realised" means)
Two engines, both grounded in real data — never an LLM's guess about a number:
- **Numeric (deterministic):** a signal naming a tracked instrument *and* a level ("watch Brent above $90") is resolved against our own market series — realised on the first crossing after it surfaced. This is the single source of truth for market levels; the web engine never adjudicates them.
- **Web-grounded (weekly):** the Sunday sweep web-checks each remaining open signal (search + an LLM verdict) and routes by confidence — high → realised, medium → an editorial queue (`pending_review`), low → left open. Market-flavoured signals are capped to the queue and can never auto-realise here.
- Open signals **expire** after 30 days (or a named horizon).
- Editors confirm/dismiss queued signals at `/admin/signals` (key-gated, not in nav).

### 3.9 States
- **Loading:** centred spinner.
- **No themes yet:** "No persistent themes in this window yet." — the read builds as briefs accumulate.

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
3. **How to navigate the site** — three **interactive cards** (Today's Brief / Signals / Archive), each with an icon in that section's colour; clicking a card navigates to that tab.
4. **Making the most of the Signals page** — a walkthrough of the Signals tab: ask across every brief, start with the House View, scan the market pulse, track/re-order Active Watches, watch flagged calls get marked realised, and see the agent jobs behind it — each linking into Signals.
5. **A note on how this is made — and its limits** — an AI-authorship disclosure ("Written by Claude · Anthropic"), the accuracy/limitations note, and a distinct amber **"This is not financial advice"** callout.
6. **Footer** — the independent/self-funded line and a closing "Start reading today's brief →" CTA.

All copy is presented as written; the page only shapes its layout.

---

## 6. Cross-cutting behaviour

### 6.1 Responsive design
- The layout adapts at the `lg` (1024px) breakpoint: deck **peek** previews are desktop-only; the brief's **swipe hint** is mobile-only; on Signals the theme-card grid and the agent-status/active-watches ops-rail go single-column on mobile and two-column on desktop, while the market-pulse strip reflows from two-across up to six. The deck's prev/next arrows live with the top counter on **all** sizes.
- Sticky bars (nav, date picker, the Signals "Intelligence signals" header) keep key controls reachable while scrolling on both form factors.

### 6.2 Deep linking & cross-navigation
- Signals watches, evidence-trail signals, RAG source hits, House View reasoning-trail links, Archive day cells, and the About nav cards all link into the rest of the app (`/brief/:slug?story=N` for brief stories), so a reader can move from a flagged signal, a source, or a date straight to the story behind it, and back.

### 6.3 Data model (per brief)
Each brief has: a human date and slug, an ISO `briefDate` (used for sorting/calendar), a greeting, an array of teaser lines, up to 8 **sections** (each with category, emoji, headline, summary, paragraphs, optional Singapore Lens, key metrics, sources, urgency, reading time), an optional systems-synthesis object, and an optional source (Telegraph) URL.

### 6.4 Content ingestion (non-UI)
- **Runtime publish:** `POST /api/publish` (or the `n8n.publish` tRPC procedure), protected by an `X-Api-Key`, upserts a brief by slug.
- **Bundled briefs:** the canonical brief set ships in code. On every server boot it is **upserted into the database (idempotent by slug)**, so deploying a newly added brief publishes it even into an already-populated database. Briefs added only at runtime via `/api/publish` are left untouched.
- A lightweight **`/healthz`** endpoint returns a 200 JSON heartbeat, used for the host's health probe and an external keep-warm ping.

### 6.5 Error handling
- The app is wrapped in an error boundary; a not-found route renders a 404 view. Link checks, brief fetches, and the Signals computations (RAG search, synthesis, market data) each degrade to a safe empty state rather than crashing the page.
