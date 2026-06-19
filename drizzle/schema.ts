import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Canonical briefs table — replaces both dailyBriefs and n8nBriefs.
 * One row per published brief day.
 */
export const briefs = sqliteTable("briefs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Human-readable date: "May 31, 2026" */
  date: text("date").notNull(),
  /** URL slug for routing: "may-31-2026" */
  dateSlug: text("date_slug").notNull().unique(),
  /** ISO date for sorting: "2026-05-31" */
  briefDate: text("brief_date").notNull().unique(),
  /** Opening greeting */
  greeting: text("greeting").notNull(),
  /** Array of teaser lines */
  teaser: text("teaser", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .default([]),
  /** Array of 8 BriefSection objects */
  sections: text("sections", { mode: "json" })
    .notNull()
    .$type<BriefSection[]>()
    .default([]),
  /** Systems synthesis with thesis + signals */
  systemsSynthesis: text("systems_synthesis", { mode: "json" })
    .$type<{ thesis: string; signals: string[] }>(),
  /** Source Telegraph.ph URL if published there */
  telegraphUrl: text("telegraph_url"),
  /** Original raw payload from n8n (for debugging) */
  rawPayload: text("raw_payload", { mode: "json" }),
  /** Unix timestamp (ms) */
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});

/**
 * Cached market ticker data, refreshed by external cron.
 */
export const marketTicker = sqliteTable("market_ticker", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tickerData: text("ticker_data", { mode: "json" })
    .notNull()
    .$type<TickerItem[]>(),
  fetchedAt: integer("fetched_at").notNull().$defaultFn(() => Date.now()),
});

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
