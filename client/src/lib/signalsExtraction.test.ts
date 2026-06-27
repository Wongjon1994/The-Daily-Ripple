import { describe, it, expect } from "vitest";
import {
  classifyTheme,
  parseHorizon,
  extractBriefSignals,
} from "../../../server/signals";

/**
 * Unit tests for the qualitative signal extraction (Trends Part 2, Phase 0).
 * Only the pure functions are exercised here — persistBriefSignals/backfillSignals
 * touch the DB and are covered by integration paths, not this suite.
 */

describe("classifyTheme", () => {
  it("maps energy keywords", () => {
    expect(classifyTheme("Brent crude spiked as Hormuz tensions rose")).toBe("energy");
  });
  it("maps rates keywords", () => {
    expect(classifyTheme("The Fed held rates; MAS kept its S$NEER slope")).toBe("rates");
  });
  it("maps ai_tech keywords", () => {
    expect(classifyTheme("Nvidia's new chip and data centre buildout")).toBe("ai_tech");
  });
  it("maps geopolitics keywords", () => {
    expect(classifyTheme("China and Russia signalled deeper military ties")).toBe("geopolitics");
  });
  it("falls back to other when nothing matches", () => {
    expect(classifyTheme("A quiet day with little of note")).toBe("other");
  });
});

describe("parseHorizon", () => {
  const surfaced = new Date("2026-06-15");

  it("returns last day of a named quarter", () => {
    expect(parseHorizon("Watch whether earnings improve by Q3", surfaced)).toBe("2026-09-30");
  });
  it("uses an explicit later year with a quarter", () => {
    expect(parseHorizon("Resolution likely in Q1 2027", surfaced)).toBe("2027-03-31");
  });
  it("returns last day of a named month, rolling to next year if past", () => {
    expect(parseHorizon("Decision expected in November", surfaced)).toBe("2026-11-30");
    expect(parseHorizon("A review is due in March", surfaced)).toBe("2027-03-31");
  });
  it("handles relative next month / next quarter", () => {
    expect(parseHorizon("MAS may move next month", surfaced)).toBe("2026-07-16");
    expect(parseHorizon("Outcome by next quarter", surfaced)).toBe("2026-09-15");
  });
  it("returns year-end for a bare future year", () => {
    expect(parseHorizon("The treaty runs through 2028", surfaced)).toBe("2028-12-31");
  });
  it("returns null when no horizon is present", () => {
    expect(parseHorizon("Watch whether MAS adjusts the slope", surfaced)).toBeNull();
  });
});

describe("extractBriefSignals", () => {
  const brief = {
    date: "June 15, 2026",
    sections: [
      {
        headline: "MAS holds policy",
        category: "Markets",
        singaporeLens:
          "The central bank stayed put this round. Watch whether MAS adjusts its S$NEER slope at the October meeting if core inflation reaccelerates.",
      },
      {
        headline: "Systems synthesis",
        category: "Systems Synthesis",
        paragraphs: [
          "Cross-cutting view of the week.",
          "If Brent crude holds above ninety dollars through Q3, expect fuel-cost passthrough across the region.",
        ],
      },
    ],
  };

  it("extracts watch + conditional signals with theme, expiry and status", () => {
    const rows = extractBriefSignals(brief, "june-15-2026");
    expect(rows.length).toBe(2);

    const mas = rows.find((r) => r.signalText.includes("MAS"));
    expect(mas).toBeDefined();
    expect(mas!.briefDateSlug).toBe("june-15-2026");
    expect(mas!.storyIndex).toBe(0);
    expect(mas!.theme).toBe("rates");
    expect(mas!.surfacedDate).toBe("2026-06-15");

    const brent = rows.find((r) => r.signalText.startsWith("If Brent"));
    expect(brent).toBeDefined();
    expect(brent!.storyIndex).toBe(1);
    expect(brent!.theme).toBe("energy");
    // named Q3 horizon → quarter-end
    expect(brent!.horizonDate).toBe("2026-09-30");
    expect(brent!.expiryDate).toBe("2026-09-30");
  });

  it("defaults expiry to surfaced + 30 days when no horizon", () => {
    const rows = extractBriefSignals(brief, "june-15-2026");
    const mas = rows.find((r) => r.signalText.includes("MAS"))!;
    expect(mas.horizonDate).toBeNull();
    expect(mas.expiryDate).toBe("2026-07-15");
  });

  it("ignores non-watch sentences", () => {
    const plain = {
      date: "June 15, 2026",
      sections: [{ headline: "x", category: "Markets", singaporeLens: "Nothing forward-looking here at all." }],
    };
    expect(extractBriefSignals(plain, "june-15-2026")).toEqual([]);
  });
});
