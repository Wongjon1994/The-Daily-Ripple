/**
 * Trends Part 2 view model. Combines the persisted signal ledger with the
 * pre-generated synthesis prose into the shape the Trends page renders: a
 * dominant-theme hero plus a grid of active theme cards. Pure (no React, no
 * network) so it can be unit-tested; the page maps theme keys → icons/colours.
 */

export interface SignalRow {
  id: number;
  briefDateSlug: string;
  storyIndex: number;
  theme: string;
  signalText: string;
  headline: string;
  surfacedDate: string; // ISO
  status: string; // open | realised | expired | pending_review
  realisedDate: string | null;
  realisedEvidenceNote: string | null;
}

export interface ThemeInsightRow {
  theme: string;
  window: string;
  themeNarrative: string;
  sgLens: string;
  heroNarrative: string | null;
  isDominant: boolean;
  briefCount: number;
}

export interface DayCell { date: string; appeared: boolean }

export interface ThemeView {
  theme: string;
  briefCount: number; // distinct briefs in window touching this theme
  totalBriefs: number; // distinct briefs in the window (denominator)
  days: DayCell[]; // recency strip (last ≤7 briefs in window)
  signals: SignalRow[]; // newest first
  realisedCount: number;
  themeNarrative: string;
  sgLens: string;
  heroNarrative: string | null;
  isDominant: boolean;
}

export interface TrendsView {
  dominant: ThemeView | null;
  themes: ThemeView[]; // active themes (≥2 signals), briefCount desc
}

/**
 * @param windowDates distinct brief dates in the window (ISO, any order).
 * @param minSignals  suppression threshold — a theme needs at least this many
 *                    signals in the window to render (spec default: 2).
 */
export function buildTrendsView(
  signals: SignalRow[],
  insights: ThemeInsightRow[],
  windowDates: string[],
  minSignals = 2
): TrendsView {
  signals = signals ?? [];
  insights = insights ?? [];
  windowDates = windowDates ?? [];
  const windowSet = new Set(windowDates);
  // Recency strip = one publishing week. Briefs run Mon–Sat, so a full week is
  // 6 briefs, not 7 (matches the "N of 6" denominator at week's end).
  const recent = Array.from(new Set(windowDates)).sort().slice(-6);
  const totalBriefs = new Set(windowDates).size;
  const inWindow = signals.filter((s) => windowSet.has(s.surfacedDate));
  const insightByTheme = new Map(insights.map((i) => [i.theme, i]));

  const byTheme = new Map<string, SignalRow[]>();
  for (const s of inWindow) {
    const list = byTheme.get(s.theme) ?? [];
    list.push(s);
    byTheme.set(s.theme, list);
  }

  const views: ThemeView[] = [];
  for (const [theme, list] of Array.from(byTheme.entries())) {
    if (theme === "other") continue; // catch-all bucket isn't a display theme
    if (list.length < minSignals) continue; // suppression
    const sorted = [...list].sort((a, z) => (a.surfacedDate < z.surfacedDate ? 1 : -1));
    const themeDays = new Set(list.map((s) => s.surfacedDate));
    const insight = insightByTheme.get(theme);
    views.push({
      theme,
      briefCount: themeDays.size,
      totalBriefs,
      days: recent.map((date) => ({ date, appeared: themeDays.has(date) })),
      signals: sorted,
      realisedCount: list.filter((s) => s.status === "realised").length,
      themeNarrative: insight?.themeNarrative ?? "",
      sgLens: insight?.sgLens ?? "",
      heroNarrative: insight?.heroNarrative ?? null,
      isDominant: !!insight?.isDominant,
    });
  }

  views.sort((a, z) => z.briefCount - a.briefCount || z.signals.length - a.signals.length);

  // Dominant: the synthesis-flagged theme if present, else the most persistent.
  const dominant = views.find((v) => v.isDominant) ?? views[0] ?? null;
  return { dominant, themes: views };
}
