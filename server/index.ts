import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { appRouter } from "./routers.js";
import { createContext } from "./trpc.js";
import { initDb } from "./db.js";
import { seedBriefs, patchManualMetricFixes } from "./seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Ensure Postgres tables exist, then seed sample data if empty
  await initDb();
  await seedBriefs();
  await patchManualMetricFixes();
  try {
    const { backfillSignals } = await import("./signals.js");
    const r = await backfillSignals();
    console.log(`[signals] backfill: ${r.inserted} new from ${r.briefs} briefs`);
  } catch (e) {
    console.log("[signals] backfill failed:", e);
  }

  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "4mb" }));

  // tRPC
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  const authorized = (req: express.Request) =>
    !!process.env.PUBLISH_API_KEY &&
    (req.headers["x-api-key"] as string | undefined) === process.env.PUBLISH_API_KEY;

  // Webhook alias: n8n can POST the full structured DailyBrief to /api/publish.
  app.post("/api/publish", async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { upsertBrief } = await import("./db.js");
      await upsertBrief(req.body);
      let signals = 0;
      try {
        const { persistBriefSignals } = await import("./signals.js");
        signals = await persistBriefSignals(req.body, req.body?.dateSlug);
      } catch (e) {
        console.log("[signals] extraction failed:", e);
      }
      // Synthesis runs after extraction (1W view regenerates daily on publish).
      let synthesis = 0;
      try {
        const { runSynthesis } = await import("./synthesis.js");
        synthesis = (await runSynthesis("1W")).themes;
      } catch (e) {
        console.log("[synthesis] 1W run failed:", e);
      }
      res.json({ ok: true, signals, synthesis });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Publish from a Telegraph URL: the server fetches the published page, parses
  // it into the DailyBrief schema, and upserts it. n8n POSTs { url, date? }.
  app.post("/api/publish-telegraph", async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { briefFromTelegraph } = await import("./telegraphImport.js");
      const brief = await briefFromTelegraph({ url: req.body?.url, date: req.body?.date });
      const { upsertBrief } = await import("./db.js");
      await upsertBrief(brief);
      res.json({ ok: true, dateSlug: brief.dateSlug, sections: Array.isArray(brief.sections) ? brief.sections.length : 0 });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Weekly signal realisation sweep (Trends Part 2, Addendum A). n8n's Sunday
  // cron POSTs here; expires stale signals, then web-checks each open signal.
  app.post("/api/realise", async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { runRealisationSweep } = await import("./realisation.js");
      const result = await runRealisationSweep();
      // Longer-window synthesis (1M/3M) regenerates weekly, after the sweep so it
      // uses fresh realised/open counts.
      const synthesis: Record<string, number> = {};
      try {
        const { runSynthesis } = await import("./synthesis.js");
        for (const w of ["1M", "3M"] as const) synthesis[w] = (await runSynthesis(w)).themes;
      } catch (e) {
        console.log("[synthesis] 1M/3M run failed:", e);
      }
      res.json({ ok: true, ...result, synthesis });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Manual synthesis trigger (Trends Part 2, Addendum B). Body { window?: "1W"|"1M"|"3M" }
  // — defaults to all three. Used for one-off backfill; routine runs are chained
  // to publish (1W) and /api/realise (1M/3M).
  app.post("/api/synthesize", async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { runSynthesis } = await import("./synthesis.js");
      const windows = req.body?.window ? [req.body.window] : (["1W", "1M", "3M"] as const);
      const out: Record<string, unknown> = {};
      for (const w of windows) out[w] = await runSynthesis(w);
      res.json({ ok: true, ...out });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Market data — server fetches Twelve Data (SPY/DIA) + Alpha Vantage on demand
  // and serves it same-origin, cached. Free tier, no cron, no proxy.
  app.get("/api/markets", async (req, res) => {
    try {
      const { getMarkets } = await import("./markets.js");
      const range = typeof req.query.range === "string" ? req.query.range : "1mo";
      const data = await getMarkets(range);
      res.json({ ok: true, range, data });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Lightweight health check — used by the host's health probe and the
  // keep-warm cron ping (avoids serving the full SPA HTML on every poll).
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, ts: Date.now() });
  });

  // ── Static assets (production) ──────────────────────────────────────────────
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // SPA fallback
  app.get("*", (_req, res) => {
    const indexPath = path.join(staticPath, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) res.status(404).send("Not found");
    });
  });

  const port = parseInt(process.env.PORT || "3001", 10);
  server.listen(port, () => {
    console.log(`\n🌊 The Daily Ripple server running on http://localhost:${port}/`);
    console.log(`   API:      http://localhost:${port}/api/trpc`);
    console.log(`   Publish:  POST /api/publish (X-Api-Key required)\n`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
