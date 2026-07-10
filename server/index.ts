import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { appRouter } from "./routers.js";
import { createContext } from "./trpc.js";
import { initDb, recordJobRun } from "./db.js";
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
  // RAG embeddings backfill (Phase A) — idempotent; no-op without OPENAI_API_KEY.
  // Runs in the background so a slow embedding pass never delays server start.
  (async () => {
    try {
      const { backfillEmbeddings } = await import("./embeddings.js");
      const r = await backfillEmbeddings();
      if (r.chunks || r.signals) console.log(`[rag] embedded ${r.chunks} chunks, ${r.signals} signals`);
    } catch (e) {
      console.log("[rag] embedding backfill failed:", e);
    }
  })();

  // Weekly realisation sweep (Sunday ~09:00 SGT) — in-process, catch-up aware.
  // Replaces the n8n Sunday cron; the /api/realise endpoint stays for manual runs.
  try {
    const { startWeeklyRealiseScheduler } = await import("./scheduler.js");
    startWeeklyRealiseScheduler();
  } catch (e) {
    console.log("[scheduler] start failed:", e);
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
      // Extract Trends signals on publish so the ledger is fresh same-day (a
      // re-publish adds any new signals; existing ones are left untouched).
      let signals = 0;
      try {
        const { persistBriefSignals } = await import("./signals.js");
        signals = await persistBriefSignals(brief, brief.dateSlug);
      } catch (e) {
        console.log("[signals] telegraph extraction failed:", e);
      }
      res.json({ ok: true, dateSlug: brief.dateSlug, sections: Array.isArray(brief.sections) ? brief.sections.length : 0, signals });
      // Regenerate the 1W synthesis (hero + theme narratives + SG Lens) after the
      // response — it reads the freshly-extracted signals and takes ~30–60s, so
      // fire-and-forget keeps the publish node fast. 1M/3M run weekly via /realise.
      (async () => {
        const t0 = Date.now();
        let chunks = 0;
        let expired = 0;
        try {
          const { persistBriefChunks } = await import("./embeddings.js");
          chunks = await persistBriefChunks(brief, brief.dateSlug);
        } catch (e) {
          console.log("[rag] chunk embedding on publish failed:", e);
        }
        // Age out open signals past their 30-day / named-horizon expiry. A reliable
        // daily cadence: the boot backfill rarely runs (free tier stays warm) and the
        // weekly realise sweep isn't dependable, so open signals otherwise pile up.
        try {
          const { expireSignals } = await import("./db.js");
          expired = await expireSignals(new Date().toISOString().slice(0, 10));
          if (expired) console.log(`[signals] expired ${expired} past-horizon signals on publish`);
        } catch (e) {
          console.log("[signals] expiry on publish failed:", e);
        }
        await recordJobRun("signal", "ok", t0, { signals, chunks, expired, brief: brief.dateSlug });
        try {
          const t1 = Date.now();
          const { runSynthesis } = await import("./synthesis.js");
          const r = await runSynthesis("1W");
          await recordJobRun("synthesis", "ok", t1, { window: "1W", themes: r.themes });
          console.log(`[synthesis] 1W regenerated on publish: ${r.themes} themes`);
        } catch (e) {
          console.log("[synthesis] 1W on publish failed:", e);
        }
        // House view (daily alpha) — one Sonnet call over the fresh open signals.
        try {
          const t2 = Date.now();
          const { runHouseView } = await import("./houseView.js");
          const hv = await runHouseView();
          await recordJobRun("alpha", "ok", t2, hv);
          console.log("[alpha] house view on publish:", hv);
        } catch (e) {
          console.log("[alpha] house view on publish failed:", e);
        }
      })();
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Weekly signal realisation sweep + 1M/3M synthesis (Trends Part 2). The sweep
  // web-checks ~100 open signals (Tavily + Haiku each), so it runs for minutes —
  // far longer than an HTTP request should stay open. Respond immediately and run
  // it in the background, so a caller (the in-process scheduler, or a manual/n8n
  // trigger) gets a fast ack. The shared flow guards against overlapping runs.
  app.post("/api/realise", async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const { isRealiseRunning, runRealiseFlow } = await import("./realiseFlow.js");
    if (isRealiseRunning()) return res.status(202).json({ ok: true, started: false, note: "already running" });
    res.status(202).json({ ok: true, started: true });
    void runRealiseFlow();
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
      const { runHouseView } = await import("./houseView.js");
      out.houseView = await runHouseView();
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

  // Hashed assets (/assets/index-*.js|css) are content-addressed → cache forever.
  // index.html must revalidate every load, else browsers (esp. in-app webviews like
  // Telegram's) keep loading a stale bundle reference after a deploy.
  app.use(
    express.static(staticPath, {
      setHeaders(res, filePath) {
        if (filePath.endsWith(path.sep + "index.html") || filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  // SPA fallback
  app.get("*", (_req, res) => {
    const indexPath = path.join(staticPath, "index.html");
    res.setHeader("Cache-Control", "no-cache");
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
