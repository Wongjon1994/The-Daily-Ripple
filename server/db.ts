import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { desc, eq, gte, lte, and } from "drizzle-orm";
import * as schema from "../drizzle/schema.js";
import type { InsertBrief } from "../drizzle/schema.js";

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
  `);
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
