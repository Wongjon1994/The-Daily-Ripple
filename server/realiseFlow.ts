/**
 * The weekly realisation flow, shared by the `/api/realise` endpoint and the
 * in-process weekly scheduler (server/scheduler.ts). Numeric threshold realisation
 * (Phase C, deterministic) runs first so it wins before the web-grounded sweep
 * re-checks the same signals; then the longer-window (1M/3M) synthesis regenerates
 * on the fresh counts. A module-level guard prevents overlapping runs whether the
 * trigger is the endpoint, the scheduler, or both.
 */

let running = false;

export const isRealiseRunning = () => running;

/** Run the full weekly realise + expiry + 1M/3M synthesis. No-op if already running. */
export async function runRealiseFlow(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const t0 = Date.now();
    const { runNumericRealisationSweep } = await import("./numericRealisation.js");
    const numeric = await runNumericRealisationSweep();
    const { runRealisationSweep } = await import("./realisation.js");
    const result = await runRealisationSweep();
    const { recordJobRun } = await import("./db.js");
    await recordJobRun("realise", "ok", t0, { numericRealised: numeric.realised, ...result });
    console.log("[realise] numeric sweep:", numeric, "· web sweep done:", result);

    // All theme synthesis (1W/1M/3M) regenerates weekly here, after the sweep so it
    // uses fresh realised counts. 1W moved off the daily publish flow to cut cost;
    // caching (per-theme header) makes each window's 2–3 calls read the prefix cheaply.
    const t1 = Date.now();
    const { runSynthesis } = await import("./synthesis.js");
    const windows: Record<string, number> = {};
    for (const w of ["1W", "1M", "3M"] as const) {
      try { windows[w] = (await runSynthesis(w)).themes; }
      catch (e) { console.log(`[synthesis] ${w} failed:`, e); }
    }
    await recordJobRun("synthesis", "ok", t1, windows);
  } catch (e) {
    console.log("[realise] failed:", e);
  } finally {
    running = false;
  }
}
