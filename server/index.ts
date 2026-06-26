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
      res.json({ ok: true });
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

  // Refresh market metrics — direct Yahoo/Alpha Vantage/MAS fetch, no n8n.
  // Triggered by an external scheduler (see README) at 7:30am SGT on weekdays.
  // `?range=5y` does a one-time history backfill for the chart windows.
  app.post("/api/scheduled/refresh-metrics", async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { fetchAllMetrics } = await import("./marketData.js");
      const { upsertMarketMetrics } = await import("./db.js");
      const range = typeof req.query.range === "string" ? req.query.range : "5d";
      const { rows, results } = await fetchAllMetrics(range);
      const stored = await upsertMarketMetrics(rows);
      res.json({ ok: true, stored, results });
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
