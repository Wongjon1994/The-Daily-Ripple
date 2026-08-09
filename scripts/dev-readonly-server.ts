/**
 * Dev-only READ-ONLY API server.
 *
 * Serves the tRPC router against whatever DATABASE_URL points to, but performs
 * NONE of the boot-time writes the real `server/index.ts` does — no seedBriefs,
 * no metric patch, no signal/embedding backfill, no scheduler, and none of the
 * /api/publish* or /api/realise* mutation routes.
 *
 * Purpose: verify the frontend against real data locally without any risk of
 * mutating the (production Neon) database. Viewing pages fire tRPC *queries*
 * only. Run with:  PORT=3001 tsx scripts/dev-readonly-server.ts
 *
 * NOT a production entrypoint — never referenced by the build.
 */

import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers.js";
import { createContext } from "../server/trpc.js";

const app = express();
app.use(express.json({ limit: "4mb" }));

app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

// Markets REST endpoint the Signals page reads (on-demand fetch, no DB write).
app.get("/api/markets", async (req, res) => {
  try {
    const { getMarkets } = await import("../server/markets.js");
    const range = typeof req.query.range === "string" ? req.query.range : "1mo";
    res.json({ ok: true, range, data: await getMarkets(range) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/healthz", (_req, res) => res.status(200).json({ ok: true, readOnly: true }));

const port = parseInt(process.env.PORT || "3001", 10);
app.listen(port, () => {
  console.log(`\n🔒 READ-ONLY dev API on http://localhost:${port}/  (no writes, no seed)\n`);
});
