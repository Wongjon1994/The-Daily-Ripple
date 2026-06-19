# Deploying The Daily Ripple

A **single Node app**: an Express server ([`server/index.ts`](server/index.ts))
that serves the tRPC API **and** the built React SPA, backed by a **cloud
Postgres** database (Neon or Supabase) via Drizzle ORM. Deploy it to any Node
host — Railway or Render are the easiest.

## 1. Create the database (free)

Use either provider and grab the connection string:

- **Neon** — https://neon.tech → new project → copy the connection string
  (`postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/DB?sslmode=require`).
- **Supabase** — https://supabase.com → new project → Settings → Database →
  Connection string (URI). Prefer the **pooled** (pgBouncer) string for hosted apps.

That value is your `DATABASE_URL`.

## 2. How it runs

```
pnpm install        # pure-JS deps (pg) — no native build step
pnpm run build      # vite build → dist/public  +  esbuild server → dist/index.js
pnpm start          # NODE_ENV=production node dist/index.js  (serves SPA + API)
```

The server listens on `process.env.PORT` (the host injects it) and serves the
SPA from `dist/public`. On first boot it runs `CREATE TABLE IF NOT EXISTS`
([`server/db.ts`](server/db.ts) `initDb`) and seeds the briefs from
[`server/seed.ts`](server/seed.ts) — so a fresh database is populated
automatically.

## Environment variables

| Var               | Required | Notes |
|-------------------|----------|-------|
| `DATABASE_URL`    | **yes**  | Postgres connection string from Neon/Supabase. |
| `NODE_ENV`        | yes      | Must be `production` (the `start` script sets it; the configs also set it). |
| `PORT`            | no       | Injected by the host. |
| `PUBLISH_API_KEY` | no       | Only if n8n POSTs briefs to `/api/publish`. |
| `APP_TITLE`       | no       | Defaults to "The Daily Ripple". |

## Railway

1. New Project → **Deploy from GitHub repo** → `Wongjon1994/The-Daily-Ripple`.
2. Railway reads [`railway.json`](railway.json) + `packageManager` (pnpm) and
   auto-runs install → `pnpm run build` → `pnpm start`.
3. In **Variables**, add `DATABASE_URL` (+ optional `PUBLISH_API_KEY`).
4. Open the generated URL.

## Render

1. New → **Blueprint** → pick this repo. Render reads [`render.yaml`](render.yaml).
2. When prompted, set `DATABASE_URL` (it's declared `sync: false`, so it's not
   stored in the repo).
3. It builds and starts the web service automatically.

## Local development

```
cp .env.example .env      # set DATABASE_URL (a Neon/Supabase dev branch works great)
pnpm install
pnpm dev:server           # API on :3001 (seeds the DB on first run)
pnpm dev                  # Vite SPA on :3000, proxies /api → :3001
```

To regenerate Drizzle migrations against the schema: `pnpm db:migrate`
(requires `DATABASE_URL`). The app also self-creates tables on boot, so this is
optional.

## Vercel

Now that the database is hosted Postgres, the **frontend** can run on Vercel
(static `dist/public`) with the API either kept on Railway/Render or ported to
Vercel serverless functions. For an all-Vercel setup, swap the `pg` Pool in
[`server/db.ts`](server/db.ts) for `@neondatabase/serverless` +
`drizzle-orm/neon-http` (Neon only) to avoid pooling issues on serverless.
