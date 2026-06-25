/**
 * Seeds the SQLite database with the 6 sample briefs.
 * Only runs when the briefs table is empty — safe to call on every startup.
 */

import { countBriefs, upsertBrief, setTelegraphUrl, getBriefBySlug, updateBriefSections } from "./db.js";

// ─── Brief data ───────────────────────────────────────────────────────────────
// These imports strip the `import type` at runtime so briefParser is not needed.

import { may31Brief } from "../briefs-json-export/may31Brief.js";
import { june1Brief } from "../briefs-json-export/june1Brief.js";
import { june2Brief } from "../briefs-json-export/june2Brief.js";
import { june3Brief } from "../briefs-json-export/june3Brief.js";
import { jun4Brief } from "../briefs-json-export/jun4Brief.js";
import { jun5Brief } from "../briefs-json-export/jun5Brief.js";
import { jun6Brief } from "../briefs-json-export/jun6Brief.js";
import { jun8Brief } from "../briefs-json-export/jun8Brief.js";
import { jun9Brief } from "../briefs-json-export/jun9Brief.js";
import { jun10Brief } from "../briefs-json-export/jun10Brief.js";
import { jun11Brief } from "../briefs-json-export/jun11Brief.js";
import { jun12Brief } from "../briefs-json-export/jun12Brief.js";
import { jun13Brief } from "../briefs-json-export/jun13Brief.js";
import { jun15Brief } from "../briefs-json-export/jun15Brief.js";
import { jun16Brief } from "../briefs-json-export/jun16Brief.js";
import { jun17Brief } from "../briefs-json-export/jun17Brief.js";
import { jun18Brief } from "../briefs-json-export/jun18Brief.js";
import { jun19Brief } from "../briefs-json-export/jun19Brief.js";
import { jun20Brief } from "../briefs-json-export/jun20Brief.js";

// Canonical "read the full brief" URLs — the authoritative, verified-working
// link for each day (Telegraph for May 31 / Jun 1, linkly shortlinks after).
const BRIEFS = [
  { brief: may31Brief, briefDate: "2026-05-31", dateSlug: "may-31-2026", telegraphUrl: "https://telegra.ph/The-Daily-Ripple-05-31" },
  { brief: june1Brief, briefDate: "2026-06-01", dateSlug: "june-1-2026", telegraphUrl: "https://telegra.ph/The-Daily-Ripple-06-01" },
  { brief: june2Brief, briefDate: "2026-06-02", dateSlug: "june-2-2026", telegraphUrl: "https://linkly.link/2jzC3" },
  { brief: june3Brief, briefDate: "2026-06-03", dateSlug: "june-3-2026", telegraphUrl: "https://linkly.link/2k2hv" },
  { brief: jun4Brief,  briefDate: "2026-06-04", dateSlug: "june-4-2026", telegraphUrl: "https://linkly.link/2k5vj" },
  { brief: jun5Brief,  briefDate: "2026-06-05", dateSlug: "june-5-2026", telegraphUrl: "https://linkly.link/2k8R8" },
  { brief: jun6Brief,  briefDate: "2026-06-06", dateSlug: "june-6-2026", telegraphUrl: "https://linkly.link/2kBcC" },
  { brief: jun8Brief,  briefDate: "2026-06-08", dateSlug: "june-8-2026", telegraphUrl: "https://linkly.link/2kEfA" },
  { brief: jun9Brief,  briefDate: "2026-06-09", dateSlug: "june-9-2026", telegraphUrl: "https://linkly.link/2kGfd" },
  { brief: jun10Brief, briefDate: "2026-06-10", dateSlug: "june-10-2026", telegraphUrl: "https://linkly.link/2kIsJ" },
  { brief: jun11Brief, briefDate: "2026-06-11", dateSlug: "june-11-2026", telegraphUrl: "https://linkly.link/2kKxn" },
  { brief: jun12Brief, briefDate: "2026-06-12", dateSlug: "june-12-2026", telegraphUrl: "https://linkly.link/2kNJR" },
  { brief: jun13Brief, briefDate: "2026-06-13", dateSlug: "june-13-2026", telegraphUrl: "https://linkly.link/2kPn3" },
  { brief: jun15Brief, briefDate: "2026-06-15", dateSlug: "june-15-2026", telegraphUrl: "https://linkly.link/2kSaA" },
  { brief: jun16Brief, briefDate: "2026-06-16", dateSlug: "june-16-2026", telegraphUrl: "https://linkly.link/2kV6j" },
  { brief: jun17Brief, briefDate: "2026-06-17", dateSlug: "june-17-2026", telegraphUrl: "https://linkly.link/2kY90" },
  { brief: jun18Brief, briefDate: "2026-06-18", dateSlug: "june-18-2026", telegraphUrl: "https://linkly.link/2kijD" },
  { brief: jun19Brief, briefDate: "2026-06-19", dateSlug: "june-19-2026", telegraphUrl: "https://linkly.link/2ksxv" },
  { brief: jun20Brief, briefDate: "2026-06-20", dateSlug: "june-20-2026", telegraphUrl: "https://telegra.ph/The-Daily-Ripple-06-20-2" },
];

/** Always-run: ensure every known brief has its canonical URL set. */
export async function backfillBriefUrls(): Promise<void> {
  for (const { dateSlug, telegraphUrl } of BRIEFS) {
    await setTelegraphUrl(dateSlug, telegraphUrl);
  }
}

export async function seedBriefs(): Promise<void> {
  const count = await countBriefs();
  // The bundled briefs are the canonical set: upsert them all on every boot so a
  // newly added brief publishes into an already-seeded database (idempotent by
  // dateSlug). Briefs added separately at runtime via /api/publish are untouched.
  console.log(`[seed] Syncing ${BRIEFS.length} briefs (database currently has ${count})...`);
  for (const { brief, briefDate, dateSlug, telegraphUrl } of BRIEFS) {
    await upsertBrief({
      date: brief.date,
      dateSlug,
      briefDate,
      greeting: brief.greeting,
      teaser: brief.teaser ?? [],
      sections: brief.sections as any,
      systemsSynthesis: brief.systemsSynthesis ?? null,
      telegraphUrl,
      rawPayload: null,
    });
  }
  console.log("[seed] Done.");
}

// ─── One-off manual metric corrections ──────────────────────────────────────────
// The 23–24 Jun 2026 briefs (published at runtime via /api/publish, so not in the
// bundled set above) shipped with hallucinated S&P 500 / Nikkei 225 levels. Each
// fix is keyed off the known-wrong value, so it applies exactly once, lands on the
// right brief regardless of slug, and never overwrites a later correct figure (e.g.
// once Alpha Vantage market data flows in). Safe no-op where absent. Remove once
// upstream market data is trusted.
const MANUAL_METRIC_SCAN_SLUGS = ["june-22-2026", "june-23-2026", "june-24-2026", "june-25-2026"];
const MANUAL_METRIC_FIXES: Array<{ metric: RegExp; wrong: RegExp; value: string }> = [
  { metric: /s&p\s*500/i, wrong: /5[.,]?560/, value: "7,429.79" }, // 23 Jun
  { metric: /nikkei/i, wrong: /38[.,]?900/, value: "72,353.96" }, // 23 Jun
  { metric: /s&p\s*500/i, wrong: /5[.,]?570/, value: "7,365.46" }, // 24 Jun
  { metric: /s&p\s*500/i, wrong: /5[.,]?383/, value: "7,358.22" }, // 25 Jun
];

export async function patchManualMetricFixes(): Promise<void> {
  for (const slug of MANUAL_METRIC_SCAN_SLUGS) {
    const row = await getBriefBySlug(slug);
    if (!row || !Array.isArray(row.sections)) continue;
    let changed = false;
    const sections = (row.sections as any[]).map((sec) => {
      if (!Array.isArray(sec?.keyMetrics)) return sec;
      const keyMetrics = sec.keyMetrics.map((m: any) => {
        const fix = MANUAL_METRIC_FIXES.find(
          (f) => f.metric.test(String(m?.label ?? "")) && f.wrong.test(String(m?.value ?? ""))
        );
        if (!fix) return m;
        changed = true;
        console.log(`[patch] ${slug} ${m.label}: "${m.value}" → "${fix.value}"`);
        return { ...m, value: fix.value };
      });
      return { ...sec, keyMetrics };
    });
    if (changed) await updateBriefSections(slug, sections);
  }
}
