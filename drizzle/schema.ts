import { bigint, doublePrecision, jsonb, pgTable, serial, text, unique } from "drizzle-orm/pg-core";

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
    /** "yahoo" | "alphavantage" | "mas" */
    source: text("source").notNull(),
    fetchedAt: bigint("fetched_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  },
  (t) => ({
    uniqSymbolDate: unique("uniq_market_symbol_date").on(t.symbol, t.date),
  })
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
