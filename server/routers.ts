import { router, publicProcedure, apiKeyProcedure } from "./trpc.js";
import { z } from "zod";
import {
  getLatestBrief,
  getBriefBySlug,
  getAllBriefs,
  getBriefDates,
  upsertBrief,
  getSignals,
  confirmSignal,
  dismissSignal,
  getThemeInsights,
} from "./db.js";

const todayIso = () => new Date().toISOString().slice(0, 10);

const BriefSectionSchema = z.object({
  id: z.string(),
  emoji: z.string().default("📰"),
  category: z.string(),
  headline: z.string(),
  summary: z.string(),
  paragraphs: z.array(z.string()).default([]),
  singaporeLens: z.string().nullable().default(null),
  keyMetrics: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        change: z.string().optional(),
        direction: z.enum(["up", "down", "neutral"]).optional(),
      })
    )
    .default([]),
  readingTime: z.number().default(3),
  sources: z
    .array(
      z.object({
        outlet: z.string(),
        title: z.string(),
        url: z.string(),
        date: z.string(),
      })
    )
    .default([]),
  urgency: z.enum(["high", "medium", "low"]).default("medium"),
  tags: z.array(z.string()).default([]),
});

export const appRouter = router({
  n8n: router({
    /** Latest brief (newest by date) */
    getLatest: publicProcedure.query(async () => {
      const brief = await getLatestBrief();
      return { ok: true, brief: brief ?? null };
    }),

    /** Brief by date slug e.g. "may-31-2026" */
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const brief = await getBriefBySlug(input.slug);
        return { ok: true, brief: brief ?? null };
      }),

    /**
     * All briefs, newest first.
     * Supports cursor pagination: pass cursor = briefDate of last item received.
     * Supports date range filtering: from / to are ISO dates (YYYY-MM-DD).
     */
    getAll: publicProcedure
      .input(
        z
          .object({
            limit: z.number().min(1).max(100).default(30),
            cursor: z.string().optional(),
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const briefs = await getAllBriefs({
          limit: input?.limit ?? 30,
          cursor: input?.cursor,
          from: input?.from,
          to: input?.to,
        });
        const nextCursor =
          briefs.length === (input?.limit ?? 30)
            ? briefs[briefs.length - 1].briefDate
            : undefined;
        return { ok: true, briefs, nextCursor };
      }),

    /**
     * Returns lightweight date index used by the calendar view.
     * Shape: { briefDate, dateSlug, date }[]
     */
    getBriefDates: publicProcedure.query(async () => {
      const dates = await getBriefDates();
      return { ok: true, dates };
    }),

    /** Persisted qualitative signals (Trends Part 2). Optional status filter. */
    getSignals: publicProcedure
      .input(z.object({ status: z.enum(["open", "realised", "expired", "pending_review"]).optional() }).optional())
      .query(async ({ input }) => {
        const signals = await getSignals(input?.status);
        return { ok: true, signals };
      }),

    /** Pre-generated synthesis prose for the Trends page (Addendum B). */
    getThemeInsights: publicProcedure
      .input(z.object({ window: z.enum(["1W", "1M", "3M"]).default("1W") }).optional())
      .query(async ({ input }) => {
        const insights = await getThemeInsights(input?.window ?? "1W");
        return { ok: true, insights };
      }),

    /** Editorial queue: confirm a pending_review signal as realised. Admin-only. */
    confirmSignal: apiKeyProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await confirmSignal(input.id, todayIso());
        return { ok: true };
      }),

    /** Editorial queue: dismiss a pending_review signal back to open. Admin-only. */
    dismissSignal: apiKeyProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await dismissSignal(input.id, todayIso());
        return { ok: true };
      }),

    /**
     * Publish (create or update) a brief.
     * Protected by PUBLISH_API_KEY env var; pass as X-Api-Key header.
     * Also accepts an n8n webhook call with the structured payload.
     */
    publish: apiKeyProcedure
      .input(
        z.object({
          date: z.string(),
          dateSlug: z.string(),
          briefDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          greeting: z.string(),
          teaser: z.array(z.string()).default([]),
          sections: z.array(BriefSectionSchema),
          systemsSynthesis: z
            .object({
              thesis: z.string(),
              signals: z.array(z.string()),
            })
            .optional(),
          telegraphUrl: z.string().url().optional(),
          rawPayload: z.any().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await upsertBrief({
          date: input.date,
          dateSlug: input.dateSlug,
          briefDate: input.briefDate,
          greeting: input.greeting,
          teaser: input.teaser,
          sections: input.sections as any,
          systemsSynthesis: input.systemsSynthesis ?? null,
          telegraphUrl: input.telegraphUrl ?? null,
          rawPayload: input.rawPayload ?? null,
        });
        return {
          ok: true,
          dateSlug: input.dateSlug,
          dashboardUrl: `/brief/${input.dateSlug}`,
        };
      }),

    /**
     * Check reachability of source URLs server-side (avoids browser CORS).
     * Returns per-url status:
     *   "ok"      — 2xx/3xx, link resolves
     *   "blocked" — 401/403/405/429: the site refuses our bot, but the article
     *               very likely exists and WILL load in a real browser. Never
     *               treat as broken; surface as "unverified".
     *   "broken"  — 404/410: the page is gone.
     *   "unknown" — DNS failure / timeout / other: inconclusive.
     *
     * NOTE: a server HEAD with a bot UA is NOT equivalent to a real browser
     * request, so callers must keep every link clickable regardless of status.
     */
    validateLinks: publicProcedure
      .input(
        z.object({
          urls: z.array(z.string().url()).max(30),
        })
      )
      .query(async ({ input }) => {
        const UA =
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

        async function probe(url: string, method: "HEAD" | "GET") {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          try {
            const res = await fetch(url, {
              method,
              signal: controller.signal,
              redirect: "follow",
              headers: { "User-Agent": UA, Accept: "*/*" },
            });
            return res.status;
          } finally {
            clearTimeout(timeout);
          }
        }

        function classify(code: number): "ok" | "blocked" | "broken" {
          if (code >= 200 && code < 400) return "ok";
          if (code === 404 || code === 410) return "broken";
          // 401/403/405/429/5xx → site refused the bot, not necessarily dead
          return "blocked";
        }

        const results = await Promise.all(
          input.urls.map(async (url) => {
            try {
              let code = await probe(url, "HEAD");
              // Some servers reject HEAD outright — retry once with GET.
              if (code === 405 || code === 501) {
                code = await probe(url, "GET");
              }
              return { url, status: classify(code), code };
            } catch {
              return { url, status: "unknown" as const, code: null };
            }
          })
        );
        return { ok: true, results };
      }),
  }),
});

export type AppRouter = typeof appRouter;
