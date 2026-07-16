import { describe, it, expect } from "vitest";
import { parseSignalThreshold, resolveCrossing, matchesTrackedSymbol } from "../../../server/numericRealisation";

/**
 * Unit tests for the pure Phase C threshold parse + crossing check. The sweep
 * itself (getMarkets + DB writes) is exercised at runtime against prod.
 */

describe("parseSignalThreshold", () => {
  it("parses a Brent level above", () => {
    expect(parseSignalThreshold("Watch Brent crude above $90 into winter.")).toEqual({ symbol: "BRENT", value: 90, direction: "above" });
  });

  it("parses a 10Y yield below", () => {
    expect(parseSignalThreshold("Watch the 10-year Treasury yield below 4%.")).toEqual({ symbol: "US10Y", value: 4, direction: "below" });
  });

  it("parses an S&P index level with commas", () => {
    expect(parseSignalThreshold("If the S&P 500 tops 6,000 the rally holds.")).toEqual({ symbol: "^GSPC", value: 6000, direction: "above" });
  });

  it("returns null when there is a metric but no level", () => {
    expect(parseSignalThreshold("Gold remains a haven amid the turmoil.")).toBeNull();
  });

  it("returns null when there is a level but no known metric", () => {
    expect(parseSignalThreshold("Watch unemployment above 5%.")).toBeNull();
  });
});

describe("matchesTrackedSymbol", () => {
  it("flags a tracked instrument even without a parseable level", () => {
    expect(matchesTrackedSymbol("Watch Brent directionally even if you hold no energy stocks.")).toBe("BRENT");
  });
  it("returns null for non-market text", () => {
    expect(matchesTrackedSymbol("Watch ASEAN's July communiqué for the Batanes wording.")).toBeNull();
  });
});

describe("resolveCrossing", () => {
  const series = [
    { date: "2026-07-01", close: 85 },
    { date: "2026-07-02", close: 88 },
    { date: "2026-07-03", close: 92 },
    { date: "2026-07-04", close: 95 },
  ];

  it("finds the first close crossing above after the surfaced date", () => {
    expect(resolveCrossing(series, "2026-07-01", 90, "above")).toEqual({ date: "2026-07-03", close: 92 });
  });

  it("ignores crossings on or before the surfaced date", () => {
    // 88 on 2026-07-02 is below 90; first >= 90 after that is 92 on the 3rd.
    expect(resolveCrossing(series, "2026-07-02", 90, "above")).toEqual({ date: "2026-07-03", close: 92 });
  });

  it("returns null when the level is never crossed", () => {
    expect(resolveCrossing(series, "2026-07-01", 200, "above")).toBeNull();
  });

  it("resolves a below crossing", () => {
    const falling = [
      { date: "2026-07-01", close: 4.6 },
      { date: "2026-07-02", close: 4.4 },
      { date: "2026-07-03", close: 3.9 },
    ];
    expect(resolveCrossing(falling, "2026-07-01", 4, "below")).toEqual({ date: "2026-07-03", close: 3.9 });
  });

  it("rejects a threshold outside the plausible band (unit mismatch)", () => {
    // 9000 onto a ~90 series → scale guard rejects it.
    expect(resolveCrossing(series, "2026-07-01", 9000, "above")).toBeNull();
  });
});
