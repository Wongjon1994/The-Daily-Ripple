import { describe, it, expect } from "vitest";
import { marketThresholdSignals } from "./trendsAnalysis";
import type { DailyBrief, BriefSection } from "./briefParser";

function section(text: string): BriefSection {
  return {
    id: "3",
    emoji: "📊",
    category: "economics",
    headline: "Oil watch",
    summary: "",
    paragraphs: [text],
    singaporeLens: null,
    keyMetrics: [],
    readingTime: 2,
    sources: [],
    urgency: "medium",
    tags: [],
  };
}

function brief(date: string, text: string): DailyBrief {
  return { date, greeting: "", teaser: [], sections: [section(text)], systemsSynthesis: { thesis: "", signals: [] } };
}

describe("marketThresholdSignals", () => {
  const briefs = {
    "june-26-2026": brief("June 26, 2026", "We watch for oil to fall below $75 a barrel in the coming weeks."),
  };

  it("realises on the FIRST crossing and never re-realises on a later one", () => {
    // Brent dips below 75 on 28 Jun, and again on 30 Jun — realisation must be 28 Jun.
    const series = [
      { date: "2026-06-25", v: 78 },
      { date: "2026-06-26", v: 77 },
      { date: "2026-06-28", v: 74 }, // first crossing
      { date: "2026-06-29", v: 76 },
      { date: "2026-06-30", v: 73 }, // later crossing — must be ignored
    ];
    const out = marketThresholdSignals("Brent Crude", series, briefs);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("realised");
    expect(out[0].threshold).toMatchObject({ value: 75, direction: "below" });
    expect(out[0].realisation?.date).toBe("2026-06-28");
    expect(out[0].realisation?.lagDays).toBe(2);
  });

  it("stays 'watching' when the level is never crossed", () => {
    const series = [
      { date: "2026-06-26", v: 80 },
      { date: "2026-06-28", v: 79 },
      { date: "2026-06-30", v: 78 },
    ];
    const out = marketThresholdSignals("Brent Crude", series, briefs);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("watching");
    expect(out[0].realisation).toBeUndefined();
  });
});
