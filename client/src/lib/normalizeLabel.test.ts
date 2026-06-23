import { describe, it, expect } from "vitest";
import { normalizeLabel } from "./trendsAnalysis";

describe("normalizeLabel", () => {
  it("collapses the 10-year yield variants into one key", () => {
    const variants = [
      "US 10-Year Treasury Yield",
      "US 10-Year Yield",
      "US 10Y Yield",
      "US 10yr Treasury Yield",
      "10-Year Yield",
      "U.S. 10-Year Treasury yield",
    ];
    const keys = new Set(variants.map(normalizeLabel));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBe("10 year yield");
  });

  it("keeps genuinely different metrics apart", () => {
    expect(normalizeLabel("US 2-Year Yield")).not.toBe(normalizeLabel("US 10-Year Yield"));
    expect(normalizeLabel("Japan 10-Year Yield")).not.toBe(normalizeLabel("US 10-Year Yield"));
    expect(normalizeLabel("Brent Crude")).toBe("brent crude");
    expect(normalizeLabel("S&P 500")).toBe("s&p 500");
    expect(normalizeLabel("STI")).toBe("sti");
  });
});
