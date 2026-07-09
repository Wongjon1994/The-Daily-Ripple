import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { desc, eq, gte, lte, and, sql } from "drizzle-orm";
import * as schema from "../drizzle/schema.js";
import type { InsertBrief, InsertHouseView, InsertMarketMetric, InsertSignal, InsertThemeInsight } from "../drizzle/schema.js";

const connectionString = process.env.DATABASE_URL;

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): Pool {
  if (!_pool) {
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Point it at your Neon/Supabase Postgres connection string."
      );
    }
    _pool = new Pool({
      connectionString,
      // Neon/Supabase require TLS; set ?sslmode=disable in the URL for a local
      // Postgres without certs.
      ssl: /sslmode=disable/.test(connectionString) ? false : { rejectUnauthorized: false },
      max: 10,
    });
  }
  return _pool;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

/** Ensure the briefs and market_ticker tables exist. */
export async function initDb(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS briefs (
      id            SERIAL  PRIMARY KEY,
      date          TEXT    NOT NULL,
      date_slug     TEXT    NOT NULL UNIQUE,
      brief_date    TEXT    NOT NULL UNIQUE,
      greeting      TEXT    NOT NULL,
      teaser        JSONB   NOT NULL DEFAULT '[]'::jsonb,
      sections      JSONB   NOT NULL DEFAULT '[]'::jsonb,
      systems_synthesis JSONB,
      telegraph_url TEXT,
      raw_payload   JSONB,
      created_at    BIGINT  NOT NULL,
      updated_at    BIGINT  NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_briefs_brief_date ON briefs(brief_date);

    CREATE TABLE IF NOT EXISTS market_ticker (
      id          SERIAL  PRIMARY KEY,
      ticker_data JSONB   NOT NULL,
      fetched_at  BIGINT  NOT NULL
    );

    CREATE TABLE IF NOT EXISTS market_metrics (
      id          SERIAL  PRIMARY KEY,
      symbol      TEXT    NOT NULL,
      label       TEXT    NOT NULL,
      date        TEXT    NOT NULL,
      open        DOUBLE PRECISION,
      high        DOUBLE PRECISION,
      low         DOUBLE PRECISION,
      close       DOUBLE PRECISION,
      volume      BIGINT,
      source      TEXT    NOT NULL,
      fetched_at  BIGINT  NOT NULL,
      CONSTRAINT uniq_market_symbol_date UNIQUE (symbol, date)
    );
    CREATE INDEX IF NOT EXISTS idx_market_metrics_symbol_date ON market_metrics(symbol, date);

    CREATE TABLE IF NOT EXISTS market_cache (
      symbol      TEXT    PRIMARY KEY,
      payload     JSONB   NOT NULL,
      fetched_at  BIGINT  NOT NULL
    );

    CREATE TABLE IF NOT EXISTS signals (
      id              SERIAL  PRIMARY KEY,
      brief_date_slug TEXT    NOT NULL,
      story_index     INTEGER NOT NULL DEFAULT 0,
      theme           TEXT    NOT NULL,
      signal_text     TEXT    NOT NULL,
      headline        TEXT    NOT NULL DEFAULT '',
      surfaced_date   TEXT    NOT NULL,
      horizon_date    TEXT,
      expiry_date     TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'open',
      confidence      DOUBLE PRECISION,
      realised_date   TEXT,
      realised_evidence_url  TEXT,
      realised_evidence_note TEXT,
      last_checked_date TEXT,
      created_at      BIGINT  NOT NULL,
      updated_at      BIGINT  NOT NULL,
      CONSTRAINT uniq_signal UNIQUE (brief_date_slug, signal_text)
    );
    CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);

    CREATE TABLE IF NOT EXISTS theme_insights (
      id              SERIAL  PRIMARY KEY,
      theme           TEXT    NOT NULL,
      "window"        TEXT    NOT NULL,
      theme_narrative TEXT    NOT NULL DEFAULT '',
      sg_lens         TEXT    NOT NULL DEFAULT '',
      hero_narrative  TEXT,
      is_dominant     BOOLEAN NOT NULL DEFAULT FALSE,
      brief_count     INTEGER NOT NULL DEFAULT 0,
      window_start    TEXT    NOT NULL,
      window_end      TEXT    NOT NULL,
      generated_at    BIGINT  NOT NULL,
      CONSTRAINT uniq_theme_window UNIQUE (theme, "window")
    );

    CREATE TABLE IF NOT EXISTS house_view (
      id            SERIAL  PRIMARY KEY,
      date          TEXT    NOT NULL UNIQUE,
      headline      TEXT    NOT NULL,
      thesis        TEXT    NOT NULL,
      stance        TEXT    NOT NULL DEFAULT '',
      signal_refs   JSONB   NOT NULL DEFAULT '[]',
      model         TEXT    NOT NULL DEFAULT '',
      generated_at  BIGINT  NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_runs (
      id           SERIAL  PRIMARY KEY,
      job          TEXT    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'ok',
      started_at   BIGINT,
      finished_at  BIGINT  NOT NULL,
      summary      JSONB   NOT NULL DEFAULT '{}',
      created_at   BIGINT  NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_job_runs_job ON job_runs(job, finished_at DESC);
  `);

  // ── RAG foundation (Agentic Ripple, Phase A): pgvector + embeddings ──────────
  // Enabled separately so a failure here (e.g. extension not permitted) never
  // blocks the core app from booting.
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await pool.query(`
      ALTER TABLE signals ADD COLUMN IF NOT EXISTS embedding vector(1536);

      CREATE TABLE IF NOT EXISTS brief_chunks (
        id              SERIAL  PRIMARY KEY,
        brief_date_slug TEXT    NOT NULL,
        section_index   INTEGER NOT NULL,
        category        TEXT    NOT NULL DEFAULT '',
        chunk_text      TEXT    NOT NULL,
        embedding       vector(1536),
        created_at      BIGINT  NOT NULL,
        CONSTRAINT uniq_chunk UNIQUE (brief_date_slug, section_index)
      );
    `);
  } catch (e) {
    console.log("[rag] pgvector init skipped:", e);
  }
}

// ─── Job runs (agent status, Agentic Ripple Phase B) ─────────────────────────

/** Log one run of a background job. `summary` holds counts (jsonb). Never throws
 *  into the caller's critical path — status logging must not fail a job. */
export async function recordJobRun(
  job: "signal" | "synthesis" | "realise" | "alpha",
  status: "ok" | "error",
  startedAt: number | null,
  summary: Record<string, unknown>
): Promise<void> {
  try {
    const now = Date.now();
    await getPool().query(
      `INSERT INTO job_runs (job, status, started_at, finished_at, summary, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [job, status, startedAt, now, JSON.stringify(summary ?? {}), now]
    );
  } catch (e) {
    console.log("[jobs] recordJobRun failed:", e);
  }
}

/** Latest run per job + data-health snapshot, for the Agent Status monitor. */
export async function getAgentStatus() {
  const pool = getPool();
  const agents = (
    await pool.query(
      `SELECT DISTINCT ON (job) job, status, started_at, finished_at, summary
       FROM job_runs ORDER BY job, finished_at DESC`
    )
  ).rows;
  const sig = (await pool.query(`SELECT status, count(*)::int AS c FROM signals GROUP BY status`)).rows;
  const signals: Record<string, number> = {};
  for (const r of sig) signals[r.status] = r.c;
  const briefs = (await pool.query(`SELECT count(*)::int AS c, max(brief_date) AS m FROM briefs`)).rows[0];
  let chunks = 0;
  try {
    chunks = (await pool.query(`SELECT count(*)::int AS c FROM brief_chunks`)).rows[0].c;
  } catch {
    chunks = 0;
  }
  return {
    agents,
    health: { briefs: briefs.c, lastBriefDate: briefs.m, chunks, signals },
  };
}

// ─── Signals (qualitative ledger) ────────────────────────────────────────────

/** Insert newly-extracted signals, ignoring any that already exist (so a
 *  re-publish never clobbers a realised/expired status). Returns rows inserted. */
export async function insertSignals(rows: InsertSignal[]): Promise<number> {
  if (rows.length === 0) return 0;
  const db = getDb();
  const inserted = await db
    .insert(schema.signals)
    .values(rows)
    .onConflictDoNothing({ target: [schema.signals.briefDateSlug, schema.signals.signalText] })
    .returning({ id: schema.signals.id });
  return inserted.length;
}

/** Mark every still-open signal whose expiry has passed as expired. Returns count. */
export async function expireSignals(today: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.signals)
    .set({ status: "expired", updatedAt: Date.now() })
    .where(and(eq(schema.signals.status, "open"), lte(schema.signals.expiryDate, today)));
}

/** All signals (optionally filtered by status), newest brief first. */
export async function getSignals(status?: string) {
  const db = getDb();
  const q = db.select().from(schema.signals);
  const rows = status
    ? await q.where(eq(schema.signals.status, status)).orderBy(desc(schema.signals.surfacedDate))
    : await q.orderBy(desc(schema.signals.surfacedDate));
  return rows;
}

/** Persist a realisation verdict (status + confidence + evidence) for one signal. */
export async function applySignalRealisation(
  id: number,
  fields: {
    status: "open" | "realised" | "pending_review";
    confidence: number;
    lastCheckedDate: string;
    realisedDate?: string;
    realisedEvidenceUrl?: string | null;
    realisedEvidenceNote?: string | null;
  }
): Promise<void> {
  const db = getDb();
  await db
    .update(schema.signals)
    .set({ ...fields, updatedAt: Date.now() })
    .where(eq(schema.signals.id, id));
}

/** Editorial-queue confirm: a pending_review signal becomes realised. */
export async function confirmSignal(id: number, today: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.signals)
    .set({ status: "realised", realisedDate: today, lastCheckedDate: today, updatedAt: Date.now() })
    .where(and(eq(schema.signals.id, id), eq(schema.signals.status, "pending_review")));
}

/** Editorial-queue dismiss: a pending_review signal returns to open, evidence
 *  cleared and lastCheckedDate reset so the next Sunday sweep rechecks it. */
export async function dismissSignal(id: number, today: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.signals)
    .set({
      status: "open",
      confidence: null,
      realisedEvidenceUrl: null,
      realisedEvidenceNote: null,
      lastCheckedDate: today,
      updatedAt: Date.now(),
    })
    .where(and(eq(schema.signals.id, id), eq(schema.signals.status, "pending_review")));
}

// ─── Theme insights (qualitative synthesis) ──────────────────────────────────

/** Upsert one (theme, window) synthesis row, overwriting prose on each run. */
export async function upsertThemeInsight(row: InsertThemeInsight): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.themeInsights)
    .values(row)
    .onConflictDoUpdate({
      target: [schema.themeInsights.theme, schema.themeInsights.window],
      set: {
        themeNarrative: row.themeNarrative,
        sgLens: row.sgLens,
        heroNarrative: row.heroNarrative ?? null,
        isDominant: row.isDominant ?? false,
        briefCount: row.briefCount ?? 0,
        windowStart: row.windowStart,
        windowEnd: row.windowEnd,
        generatedAt: Date.now(),
      },
    });
}

/** All synthesis rows for a window (default 1W), dominant first then by briefCount. */
export async function getThemeInsights(window = "1W") {
  const db = getDb();
  return db
    .select()
    .from(schema.themeInsights)
    .where(eq(schema.themeInsights.window, window))
    .orderBy(desc(schema.themeInsights.isDominant), desc(schema.themeInsights.briefCount));
}

// ─── House View (daily alpha card, Agentic Ripple Phase D) ───────────────────

/** Upsert the daily house view (one row per brief date). */
export async function upsertHouseView(row: InsertHouseView): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.houseView)
    .values(row)
    .onConflictDoUpdate({
      target: schema.houseView.date,
      set: {
        headline: row.headline,
        thesis: row.thesis,
        stance: row.stance ?? "",
        signalRefs: row.signalRefs ?? [],
        model: row.model ?? "",
        generatedAt: Date.now(),
      },
    });
}

/** The latest house view (most recent brief date), or null if none generated. */
export async function getHouseView() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.houseView)
    .orderBy(desc(schema.houseView.date))
    .limit(1);
  return rows[0] ?? null;
}

/** Last-known-good market payloads (one row per symbol), for /api/markets resilience. */
export async function getAllMarketCache() {
  const db = getDb();
  return db.select().from(schema.marketCache);
}

export async function upsertMarketCache(symbol: string, payload: unknown, fetchedAt: number): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.marketCache)
    .values({ symbol, payload: payload as any, fetchedAt })
    .onConflictDoUpdate({ target: schema.marketCache.symbol, set: { payload: payload as any, fetchedAt } });
}

// ─── Brief CRUD ──────────────────────────────────────────────────────────────

export async function upsertBrief(brief: InsertBrief): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db
    .insert(schema.briefs)
    .values({ ...brief, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: schema.briefs.dateSlug,
      set: {
        sections: brief.sections,
        greeting: brief.greeting,
        teaser: brief.teaser,
        systemsSynthesis: brief.systemsSynthesis,
        telegraphUrl: brief.telegraphUrl,
        rawPayload: brief.rawPayload,
        updatedAt: now,
      },
    });
}

export async function getLatestBrief() {
  const db = getDb();
  const results = await db
    .select()
    .from(schema.briefs)
    .orderBy(desc(schema.briefs.briefDate))
    .limit(1);
  return results[0] ?? null;
}

/** Set the canonical brief URL for a given slug (idempotent backfill). */
export async function setTelegraphUrl(dateSlug: string, url: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.briefs)
    .set({ telegraphUrl: url, updatedAt: Date.now() })
    .where(eq(schema.briefs.dateSlug, dateSlug));
}

/** Replace just the sections payload for a slug (used by one-off data patches). */
export async function updateBriefSections(dateSlug: string, sections: unknown): Promise<void> {
  const db = getDb();
  await db
    .update(schema.briefs)
    .set({ sections: sections as any, updatedAt: Date.now() })
    .where(eq(schema.briefs.dateSlug, dateSlug));
}

export async function getBriefBySlug(dateSlug: string) {
  const db = getDb();
  const results = await db
    .select()
    .from(schema.briefs)
    .where(eq(schema.briefs.dateSlug, dateSlug))
    .limit(1);
  return results[0] ?? null;
}

export async function getAllBriefs(opts?: {
  limit?: number;
  cursor?: string; // briefDate ISO string, exclusive upper bound
  from?: string;
  to?: string;
}) {
  const db = getDb();
  const conditions = [];

  if (opts?.cursor) {
    conditions.push(lte(schema.briefs.briefDate, opts.cursor));
  }
  if (opts?.from) {
    conditions.push(gte(schema.briefs.briefDate, opts.from));
  }
  if (opts?.to) {
    conditions.push(lte(schema.briefs.briefDate, opts.to));
  }

  const rows = await db
    .select()
    .from(schema.briefs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.briefs.briefDate))
    .limit(opts?.limit ?? 50);

  return rows;
}

/** Returns { briefDate, dateSlug, date } for every brief — used by calendar. */
export async function getBriefDates() {
  const db = getDb();
  return db
    .select({
      briefDate: schema.briefs.briefDate,
      dateSlug: schema.briefs.dateSlug,
      date: schema.briefs.date,
    })
    .from(schema.briefs)
    .orderBy(desc(schema.briefs.briefDate));
}

export async function countBriefs(): Promise<number> {
  const db = getDb();
  const results = await db
    .select({ id: schema.briefs.id })
    .from(schema.briefs)
    .limit(1);
  if (results.length === 0) return 0;
  // Full count via a second simple query
  const all = await db.select({ id: schema.briefs.id }).from(schema.briefs);
  return all.length;
}

// ─── Market Ticker ───────────────────────────────────────────────────────────

export async function saveMarketTicker(tickerData: schema.TickerItem[]): Promise<void> {
  const db = getDb();
  // Keep only the latest row
  await db.delete(schema.marketTicker);
  await db
    .insert(schema.marketTicker)
    .values({ tickerData, fetchedAt: Date.now() });
}

export async function getLatestMarketTicker() {
  const db = getDb();
  const results = await db
    .select()
    .from(schema.marketTicker)
    .orderBy(desc(schema.marketTicker.fetchedAt))
    .limit(1);
  return results[0] ?? null;
}

// ─── Market Metrics (persistent OHLCV time series) ───────────────────────────

/** Upsert daily rows, idempotent on (symbol, date) so a re-run never duplicates. */
export async function upsertMarketMetrics(rows: InsertMarketMetric[]): Promise<number> {
  if (rows.length === 0) return 0;
  const db = getDb();
  await db
    .insert(schema.marketMetrics)
    .values(rows)
    .onConflictDoUpdate({
      target: [schema.marketMetrics.symbol, schema.marketMetrics.date],
      set: {
        label: sql`excluded.label`,
        open: sql`excluded.open`,
        high: sql`excluded.high`,
        low: sql`excluded.low`,
        close: sql`excluded.close`,
        volume: sql`excluded.volume`,
        source: sql`excluded.source`,
        fetchedAt: sql`excluded.fetched_at`,
      },
    });
  return rows.length;
}

/** Latest row per symbol — the headline number on each card. */
export async function getLatestMetrics() {
  const db = getDb();
  return db
    .selectDistinctOn([schema.marketMetrics.symbol])
    .from(schema.marketMetrics)
    .orderBy(schema.marketMetrics.symbol, desc(schema.marketMetrics.date));
}

/** Full daily history for one symbol from `fromDate` (ISO) forward, oldest first. */
export async function getMetricHistory(symbol: string, fromDate: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.marketMetrics)
    .where(and(eq(schema.marketMetrics.symbol, symbol), gte(schema.marketMetrics.date, fromDate)))
    .orderBy(schema.marketMetrics.date);
}
