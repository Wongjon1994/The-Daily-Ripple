/**
 * In-process weekly scheduler for the realisation sweep — the Render-native
 * replacement for the n8n Sunday cron. Fires the shared realise flow at ~Sunday
 * 09:00 Asia/Singapore.
 *
 * Catch-up aware: rather than firing once at an exact instant (which a redeploy or
 * a brief outage could miss, skipping a whole week), an hourly check runs the sweep
 * whenever the most recent scheduled slot has passed WITHOUT a recorded run — but
 * only once it's overdue by at least an hour (the grace window). So a slot missed
 * while the instance was down/redeploying self-heals within the hour on the next
 * check or boot, and a run that already happened this slot is never repeated.
 *
 * The slot maths + due check are pure and unit-tested; only the timers and DB read
 * are side-effecting. Singapore has no DST, so 09:00 SGT is always 01:00 UTC.
 */

/** 09:00 Asia/Singapore expressed in UTC (SGT = UTC+8, no DST). */
export const SLOT_UTC_HOUR = 1;
/** Only catch up once the slot is overdue by this much (guards the boundary). */
export const OVERDUE_GRACE_MS = 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Epoch ms of the most recent Sunday 01:00 UTC (= 09:00 SGT) at or before `now`. */
export function mostRecentWeeklySlot(now: number): number {
  const d = new Date(now);
  const todayAtSlot = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), SLOT_UTC_HOUR, 0, 0, 0);
  let slot = todayAtSlot - d.getUTCDay() * DAY_MS; // roll back to Sunday
  if (slot > now) slot -= 7 * DAY_MS; // this Sunday's slot is still ahead → last week's
  return slot;
}

/**
 * Is the weekly realise overdue — the current slot has passed by at least the grace
 * window and no run finished since it? `lastFinished` is epoch ms (0 if never run).
 */
export function isRealiseDue(now: number, lastFinished: number, graceMs = OVERDUE_GRACE_MS): boolean {
  const slot = mostRecentWeeklySlot(now);
  return now - slot >= graceMs && lastFinished < slot;
}

/** Start the hourly catch-up check (and one shortly after boot). */
export function startWeeklyRealiseScheduler(): void {
  const check = async () => {
    try {
      const { getLastJobRun } = await import("./db.js");
      const last = await getLastJobRun("realise");
      const lastFinished = last ? Number(last.finished_at) : 0;
      if (!isRealiseDue(Date.now(), lastFinished)) return;
      console.log("[scheduler] weekly realise overdue — running catch-up sweep");
      const { runRealiseFlow } = await import("./realiseFlow.js");
      await runRealiseFlow();
    } catch (e) {
      console.log("[scheduler] weekly realise check failed:", e);
    }
  };
  setTimeout(check, 60_000); // ~1 min after boot — catch up a slot missed while down
  setInterval(check, HOUR_MS); // hourly thereafter
}
