/**
 * Seeds the SQLite database with the 6 sample briefs.
 * Only runs when the briefs table is empty — safe to call on every startup.
 */

import { countBriefs, upsertBrief, setTelegraphUrl } from "./db.js";

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
];

/** Always-run: ensure every known brief has its canonical URL set. */
export async function backfillBriefUrls(): Promise<void> {
  for (const { dateSlug, telegraphUrl } of BRIEFS) {
    await setTelegraphUrl(dateSlug, telegraphUrl);
  }
}

export async function seedBriefs(): Promise<void> {
  const count = await countBriefs();
  if (count > 0) {
    console.log(`[seed] Database already has ${count} brief(s). Backfilling canonical URLs.`);
    await backfillBriefUrls();
    return;
  }

  console.log(`[seed] Seeding ${BRIEFS.length} briefs...`);
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
    console.log(`[seed]  ✓ ${brief.date}`);
  }
  console.log("[seed] Done.");
}
