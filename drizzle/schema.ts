import { bigint, boolean, doublePrecision, integer, jsonb, pgTable, serial, text, unique } from "drizzle-orm/pg-core";

/**
 * Canonical briefs table — replaces both dailyBriefs and n8nBriefs.
 * One row per published brief day.
 */
export const briefs = pgTable("briefs", {
  id: serial("id").primaryKey(),
  /** Human-readable date: "May 31, 2026" */
  date: text("date").notNull(),
  /** URL slug for routing: "may-31-2026" */
  dateSlug: text("date_slug").notNull().unique(),
  /** ISO date for sorting: "2026-05-31" */
  briefDate: text("brief_date").notNull().unique(),
  /** Opening greeting */
  greeting: text("greeting").notNull(),
  /** Array of teaser lines */
  teaser: jsonb("teaser").notNull().$type<string[]>().default([]),
  /** Array of 8 BriefSection objects */
  sections: jsonb("sections").notNull().$type<BriefSection[]>().default([]),
  /** Systems synthesis with thesis + signals */
  systemsSynthesis: jsonb("systems_synthesis").$type<{ thesis: string; signals: string[] }>(),
  /** Source Telegraph.ph URL if published there */
  telegraphUrl: text("telegraph_url"),
  /** Original raw payload from n8n (for debugging) */
  rawPayload: jsonb("raw_payload"),
  /** Unix timestamp (ms) */
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});

/**
 * Cached market ticker data, refreshed by external cron.
 */
export const marketTicker = pgTable("market_ticker", {
  id: serial("id").primaryKey(),
  tickerData: jsonb("ticker_data").notNull().$type<TickerItem[]>(),
  fetchedAt: bigint("fetched_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});

/**
 * Persistent daily market time series — one row per (symbol, date), sourced
 * directly from Yahoo Finance / Alpha Vantage / MAS (no n8n, no LLM). Stores full
 * OHLCV because every API call returns it for free; only `close` renders today.
 */
export const marketMetrics = pgTable(
  "market_metrics",
  {
    id: serial("id").primaryKey(),
    /** Provider symbol, e.g. "^GSPC", "BRENT", "USDSGD" */
    symbol: text("symbol").notNull(),
    /** Display label, e.g. "S&P 500" */
    label: text("label").notNull(),
    /** Trading day, ISO "YYYY-MM-DD" */
    date: text("date").notNull(),
    open: doublePrecision("open"),
    high: doublePrecision("high"),
    low: doublePrecision("low"),
    close: doublePrecision("close"),
    /** Nullable — not all sources report volume (indices generally don't) */
    volume: bigint("volume", { mode: "number" }),
    /** "twelvedata" | "alphavantage" */
    source: text("source").notNull(),
    fetchedAt: bigint("fetched_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  },
  (t) => ({
    uniqSymbolDate: unique("uniq_market_symbol_date").on(t.symbol, t.date),
  })
);

/**
 * Last-known-good cache for the on-demand /api/markets fetch: one row per symbol
 * holding the full fetched series + meta as JSON. Lets a failed/quota-blocked
 * upstream call (esp. Alpha Vantage's 25/day) serve the previous value instead of
 * "Data unavailable", and survives instance restarts.
 */
export const marketCache = pgTable("market_cache", {
  symbol: text("symbol").primaryKey(),
  payload: jsonb("payload").notNull(),
  fetchedAt: bigint("fetched_at", { mode: "number" }).notNull(),
});

/**
 * Persistent qualitative signal ledger (Trends Part 2). One row per forward
 * "watch …" signal extracted from a brief's Singapore Lens / synthesis on publish.
 * Realisation is resolved later (web-grounded, Sunday job); status carries the
 * editorial-queue state. Unique on (briefDateSlug, signalText) so re-publishing a
 * brief doesn't duplicate.
 */
export const signals = pgTable(
  "signals",
  {
    id: serial("id").primaryKey(),
    briefDateSlug: text("brief_date_slug").notNull(),
    storyIndex: integer("story_index").notNull().default(0),
    theme: text("theme").notNull(),
    signalText: text("signal_text").notNull(),
    headline: text("headline").notNull().default(""),
    surfacedDate: text("surfaced_date").notNull(), // ISO YYYY-MM-DD
    horizonDate: text("horizon_date"), // named horizon if the text gave one
    expiryDate: text("expiry_date").notNull(), // horizonDate or surfacedDate + 30d
    /** 'open' | 'realised' | 'expired' | 'pending_review' */
    status: text("status").notNull().default("open"),
    confidence: doublePrecision("confidence"),
    realisedDate: text("realised_date"),
    realisedEvidenceUrl: text("realised_evidence_url"),
    realisedEvidenceNote: text("realised_evidence_note"),
    lastCheckedDate: text("last_checked_date"),
    createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  },
  (t) => ({ uniqSignal: unique("uniq_signal").on(t.briefDateSlug, t.signalText) })
);

/**
 * Pre-generated qualitative synthesis (Trends Part 2, Addendum B). One row per
 * (theme, window) — the reader-facing prose for the Trends page (hero narrative,
 * theme narrative, aggregated Singapore Lens). Regenerated by the synthesis job
 * (1W on publish, 1M/3M weekly); the Trends page reads this, never an LLM.
 */
export const themeInsights = pgTable(
  "theme_insights",
  {
    id: serial("id").primaryKey(),
    theme: text("theme").notNull(),
    window: text("window").notNull(), // '1W' | '1M' | '3M'
    themeNarrative: text("theme_narrative").notNull().default(""),
    sgLens: text("sg_lens").notNull().default(""),
    heroNarrative: text("hero_narrative"), // only the dominant theme
    isDominant: boolean("is_dominant").notNull().default(false),
    briefCount: integer("brief_count").notNull().default(0),
    windowStart: text("window_start").notNull(),
    windowEnd: text("window_end").notNull(),
    generatedAt: bigint("generated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  },
  (t) => ({ uniqThemeWindow: unique("uniq_theme_window").on(t.theme, t.window) })
);

// ─── Shared sub-types ────────────────────────────────────────────────────────

export interface BriefSource {
  outlet: string;
  title: string;
  url: string;
  date: string;
}

export interface KeyMetric {
  label: string;
  value: string;
  change?: string;
  direction?: "up" | "down" | "neutral";
}

export interface BriefSection {
  id: string;
  emoji: string;
  category: string;
  headline: string;
  summary: string;
  paragraphs: string[];
  singaporeLens: string | null;
  keyMetrics: KeyMetric[];
  readingTime: number;
  sources: BriefSource[];
  urgency: "high" | "medium" | "low";
  tags: string[];
}

export interface TickerItem {
  label: string;
  value: string;
  change?: string;
  direction?: "up" | "down" | "neutral";
}

export type Brief = typeof briefs.$inferSelect;
export type InsertBrief = typeof briefs.$inferInsert;
export type MarketTicker = typeof marketTicker.$inferSelect;
export type MarketMetric = typeof marketMetrics.$inferSelect;
export type InsertMarketMetric = typeof marketMetrics.$inferInsert;
export type Signal = typeof signals.$inferSelect;
export type InsertSignal = typeof signals.$inferInsert;
export type ThemeInsight = typeof themeInsights.$inferSelect;
export type InsertThemeInsight = typeof themeInsights.$inferInsert;
