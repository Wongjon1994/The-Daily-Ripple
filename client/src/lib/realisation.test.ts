import { describe, it, expect } from "vitest";
import { buildQuery, applyVerdict, type Verdict } from "../../../server/realisation";

/**
 * Unit tests for the pure realisation logic (Trends Part 2, Addendum A).
 * The Tavily/Anthropic network calls and runRealisationSweep are key-gated and
 * exercised at runtime, not here.
 */

describe("buildQuery", () => {
  it("strips watch framing", () => {
    expect(buildQuery("Watch whether MAS adjusts its S$NEER slope in October")).toBe(
      "MAS adjusts its S$NEER slope in October"
    );
  });
  it("strips a leading conditional and the 'then' clause", () => {
    expect(
      buildQuery("If Brent crude holds above ninety dollars then fuel costs rise")
    ).toBe("Brent crude holds above ninety dollars");
  });
  it("drops trailing punctuation", () => {
    expect(buildQuery("Monitor the Fed's next rate decision.")).toBe(
      "The Fed's next rate decision"
    );
  });
  it("leaves a plain subject untouched", () => {
    expect(buildQuery("ASEAN Kazan summit communiqué")).toBe("ASEAN Kazan summit communiqué");
  });

  it("caps very long signals under Tavily's 400-char limit, on a word boundary", () => {
    const long = "Watch whether " + "the Monetary Authority of Singapore adjusts its policy stance ".repeat(12);
    const q = buildQuery(long);
    expect(q.length).toBeLessThanOrEqual(400);
    expect(q.endsWith(" ")).toBe(false); // trimmed at a word boundary
  });
});

describe("applyVerdict", () => {
  const today = "2026-06-28";
  const v = (over: Partial<Verdict>): Verdict => ({
    realised: true,
    confidence: 0.9,
    evidenceUrl: "https://example.com/x",
    evidenceNote: "It happened.",
    ...over,
  });

  it("auto-realises at high confidence", () => {
    const u = applyVerdict(v({ confidence: 0.9 }), today);
    expect(u.status).toBe("realised");
    expect(u.realisedDate).toBe(today);
    expect(u.realisedEvidenceUrl).toBe("https://example.com/x");
    expect(u.confidence).toBe(0.9);
    expect(u.lastCheckedDate).toBe(today);
  });

  it("routes mid confidence to the editorial queue", () => {
    const u = applyVerdict(v({ confidence: 0.7 }), today);
    expect(u.status).toBe("pending_review");
    expect(u.realisedDate).toBeUndefined();
    expect(u.realisedEvidenceNote).toBe("It happened.");
  });

  it("leaves low confidence open", () => {
    const u = applyVerdict(v({ confidence: 0.3 }), today);
    expect(u.status).toBe("open");
    expect(u.realisedEvidenceUrl).toBeUndefined();
    expect(u.lastCheckedDate).toBe(today);
  });

  it("treats a non-realised verdict as zero confidence", () => {
    const u = applyVerdict(v({ realised: false, confidence: 0.95 }), today);
    expect(u.status).toBe("open");
    expect(u.confidence).toBe(0);
  });

  it("uses 0.85 as the realised boundary", () => {
    expect(applyVerdict(v({ confidence: 0.85 }), today).status).toBe("realised");
    expect(applyVerdict(v({ confidence: 0.84 }), today).status).toBe("pending_review");
  });

  it("never auto-realises a market-related signal from web evidence — caps to review", () => {
    // The Brent "$126" incident: a web verdict on a market-flavoured signal must go
    // through the editorial queue, however confident the LLM is.
    const u = applyVerdict(v({ confidence: 0.95 }), today, true);
    expect(u.status).toBe("pending_review");
    expect(u.confidence).toBe(0.8);
  });
});
