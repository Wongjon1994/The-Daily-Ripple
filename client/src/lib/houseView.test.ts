import { describe, it, expect } from "vitest";
import { selectHouseSignals, buildHousePrompt, parseHouseView, type HouseSignalInput } from "../../../server/houseView";

/**
 * Unit tests for the pure House View input-selection + output-parsing (Agentic
 * Ripple Phase D). The Sonnet call and runHouseView are key-gated and exercised
 * at runtime.
 */

const sig = (over: Partial<HouseSignalInput>): HouseSignalInput => ({
  theme: "energy",
  signalText: "Watch Brent above $90 into winter.",
  briefDateSlug: "jul-8-2026",
  storyIndex: 2,
  surfacedDate: "2026-07-08",
  ...over,
});

describe("selectHouseSignals", () => {
  it("orders newest-first and caps the count", () => {
    const out = selectHouseSignals(
      [sig({ surfacedDate: "2026-07-01" }), sig({ surfacedDate: "2026-07-08" }), sig({ surfacedDate: "2026-07-04" })],
      2
    );
    expect(out.map((s) => s.surfacedDate)).toEqual(["2026-07-08", "2026-07-04"]);
  });
});

describe("buildHousePrompt", () => {
  it("numbers signals and returns matching refs", () => {
    const { user, refs } = buildHousePrompt([sig({ storyIndex: 5, briefDateSlug: "jul-8-2026" })]);
    expect(user).toContain("[1]");
    expect(user).toContain("Energy & Commodities");
    expect(user).toContain("STRICT JSON");
    // Grounding guardrail: forbid numeric levels not present in the signals.
    expect(user).toMatch(/do not introduce any price, rate, yield or index level/i);
    expect(refs).toEqual([{ slug: "jul-8-2026", storyIndex: 5, text: "Watch Brent above $90 into winter." }]);
  });

  it("includes recently-realised calls as confirmed context, but only open signals as refs", () => {
    const realised = sig({ signalText: "Brent held above $90.", realisedDate: "2026-07-06", realisedEvidenceNote: "Brent closed at $92." });
    const { user, refs } = buildHousePrompt([sig({ storyIndex: 1 })], [realised]);
    expect(user).toMatch(/Recently REALISED/);
    expect(user).toContain("Brent closed at $92.");
    // Realised items inform the prose but are not part of the reasoning-trail refs.
    expect(refs).toHaveLength(1);
    expect(refs[0].text).toBe("Watch Brent above $90 into winter.");
  });
});

describe("parseHouseView", () => {
  it("parses strict JSON", () => {
    const r = parseHouseView('{"headline":"Energy premium is mispriced","thesis":"Oil holds a bid.","stance":"Long the risk premium"}');
    expect(r).toEqual({ headline: "Energy premium is mispriced", thesis: "Oil holds a bid.", stance: "Long the risk premium" });
  });

  it("tolerates ```json code fences", () => {
    const r = parseHouseView('```json\n{"headline":"H","thesis":"T","stance":"S"}\n```');
    expect(r).toEqual({ headline: "H", thesis: "T", stance: "S" });
  });

  it("falls back to line-splitting when not JSON", () => {
    const r = parseHouseView("# Big call\nHere is the reasoning that follows.");
    expect(r).toEqual({ headline: "Big call", thesis: "Here is the reasoning that follows.", stance: "" });
  });

  it("returns null for empty input", () => {
    expect(parseHouseView("")).toBeNull();
  });
});
