import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { appRouter } from "./routers.js";
import { createContext } from "./trpc.js";
import { initDb } from "./db.js";
import { seedBriefs } from "./seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Ensure Postgres tables exist, then seed sample data if empty
  await initDb();
  await seedBriefs();

  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "4mb" }));

  // tRPC
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  // Webhook alias: n8n can POST to /api/publish instead of going through tRPC
  app.post("/api/publish", async (req, res) => {
    const key = req.headers["x-api-key"] as string | undefined;
    if (!process.env.PUBLISH_API_KEY || key !== process.env.PUBLISH_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { upsertBrief } = await import("./db.js");
      await upsertBrief(req.body);
      res.json({ ok: true });
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
