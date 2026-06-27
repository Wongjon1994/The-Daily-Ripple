import { describe, it, expect } from "vitest";
import { buildTrendsView, type SignalRow, type ThemeInsightRow } from "./trendsView";

const sig = (over: Partial<SignalRow>): SignalRow => ({
  id: 1,
  briefDateSlug: "june-27-2026",
  storyIndex: 0,
  theme: "geopolitics",
  signalText: "Watch the Strait.",
  headline: "Hormuz",
  surfacedDate: "2026-06-27",
  status: "open",
  realisedDate: null,
  realisedEvidenceNote: null,
  ...over,
});

const windowDates = ["2026-06-20", "2026-06-23", "2026-06-27"];

describe("buildTrendsView", () => {
  it("suppresses themes with fewer than 2 signals in the window", () => {
    const out = buildTrendsView([sig({ id: 1 })], [], windowDates);
    expect(out.themes).toEqual([]);
    expect(out.dominant).toBeNull();
  });

  it("builds an active theme with briefCount, denominator and recency strip", () => {
    const out = buildTrendsView(
      [
        sig({ id: 1, surfacedDate: "2026-06-20" }),
        sig({ id: 2, surfacedDate: "2026-06-27", status: "realised", realisedDate: "2026-06-28" }),
      ],
      [],
      windowDates
    );
    const geo = out.themes[0];
    expect(geo.theme).toBe("geopolitics");
    expect(geo.briefCount).toBe(2);
    expect(geo.totalBriefs).toBe(3);
    expect(geo.realisedCount).toBe(1);
    expect(geo.days.map((d) => d.appeared)).toEqual([true, false, true]); // 20 ✓, 23 ✗, 27 ✓
    expect(geo.signals[0].surfacedDate).toBe("2026-06-27"); // newest first
  });

  it("excludes signals outside the window", () => {
    const out = buildTrendsView(
      [sig({ id: 1, surfacedDate: "2026-06-27" }), sig({ id: 2, surfacedDate: "2026-01-01" })],
      [],
      windowDates
    );
    expect(out.themes).toEqual([]); // only 1 in-window signal → suppressed
  });

  it("attaches synthesis prose and honours the dominant flag", () => {
    const insights: ThemeInsightRow[] = [
      { theme: "ai_tech", window: "1W", themeNarrative: "Tech narrative.", sgLens: "SG tech lens.", heroNarrative: "Hero.", isDominant: true, briefCount: 2 },
    ];
    const out = buildTrendsView(
      [
        sig({ id: 1, theme: "geopolitics", surfacedDate: "2026-06-20" }),
        sig({ id: 2, theme: "geopolitics", surfacedDate: "2026-06-23" }),
        sig({ id: 3, theme: "geopolitics", surfacedDate: "2026-06-27" }),
        sig({ id: 4, theme: "ai_tech", surfacedDate: "2026-06-20" }),
        sig({ id: 5, theme: "ai_tech", surfacedDate: "2026-06-27" }),
      ],
      insights,
      windowDates
    );
    // geopolitics is more persistent (3 vs 2) but ai_tech is flagged dominant.
    expect(out.themes[0].theme).toBe("geopolitics");
    expect(out.dominant?.theme).toBe("ai_tech");
    expect(out.dominant?.heroNarrative).toBe("Hero.");
    const tech = out.themes.find((t) => t.theme === "ai_tech")!;
    expect(tech.themeNarrative).toBe("Tech narrative.");
    expect(tech.sgLens).toBe("SG tech lens.");
  });
});
