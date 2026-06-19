# The Daily Ripple — Quick Start

## Prerequisites

- Node.js 20+ ([nodejs.org](https://nodejs.org))
- pnpm (`npm install -g pnpm`)

## First run

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment config
cp .env.example .env

# 3. Start backend (seeds the 6 sample briefs on first launch)
pnpm dev:server

# 4. Start frontend (in a second terminal)
pnpm dev
```

Open http://localhost:3000

The server auto-seeds the 6 sample briefs (May 31 – June 5, 2026) into
`ripple.db` on first launch. No MySQL or external database required.

## Pages

| Route | Description |
|---|---|
| `/` | Latest daily brief |
| `/brief/:slug` | Specific brief (e.g. `/brief/june-2-2026`) |
| `/calendar` | Archive calendar — all published dates |
| `/trends` | Signal trends across all briefs |

## Publish a new brief (n8n integration)

```bash
curl -X POST http://localhost:3001/api/publish \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_PUBLISH_API_KEY" \
  -d @payload.json
```

Payload schema: see `SAMPLE_BRIEF_SCHEMA.json`

## Architecture

- **Frontend**: React 19 + Vite + Tailwind 4 + tRPC client
- **Backend**: Express + tRPC + Drizzle ORM
- **Database**: SQLite (file `ripple.db`) — no server needed, portable
- **No Manus/platform lock-in** — runs on any VPS, Railway, Render, etc.

## Production build

```bash
pnpm build       # builds frontend + server
pnpm start       # runs dist/index.cjs
```
