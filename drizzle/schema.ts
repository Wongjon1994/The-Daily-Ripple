import { bigint, jsonb, pgTable, serial, text } from "drizzle-orm/pg-core";

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
