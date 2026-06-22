import { describe, it, expect } from "vitest";
import { partitionLensWatch } from "./trendsAnalysis";

describe("partitionLensWatch", () => {
  it("pulls a watch-cued sentence out of the lens body", () => {
    const lens =
      "For us, the stakes are concrete and the squeeze is real for households. " +
      "Watch Brent closely: if it clears $90, pressure on our MAS to tighten intensifies markedly.";
    const { body, watch } = partitionLensWatch(lens);
    expect(body).toBe(
      "For us, the stakes are concrete and the squeeze is real for households."
    );
    expect(watch).toEqual([
      "Watch Brent closely: if it clears $90, pressure on our MAS to tighten intensifies markedly.",
    ]);
  });

  it("matches the 'monitor' cue too (as Broader signals does)", () => {
    const lens =
      "Indonesia is our largest regional neighbour and the anchor economy here. " +
      "Monitor SGX's weekly foreign institutional flow data for whether net inflows accelerate above their 52-week average.";
    const { watch } = partitionLensWatch(lens);
    expect(watch).toHaveLength(1);
    expect(watch[0]).toMatch(/^Monitor SGX/);
  });

  it("returns no signals when the lens is pure analysis", () => {
    const lens =
      "For Singapore, a UK leadership transition adds uncertainty to a complicated relationship. " +
      "The pound has already slipped on the speculation.";
    expect(partitionLensWatch(lens).watch).toEqual([]);
  });

  it("does not treat 'watching' (no word boundary) as a signal", () => {
    const lens =
      "Our Ministry of Foreign Affairs will be watching whether a Burnham-led Labour shifts trade priorities.";
    expect(partitionLensWatch(lens).watch).toEqual([]);
  });

  it("handles null/empty input", () => {
    expect(partitionLensWatch(null)).toEqual({ body: "", watch: [] });
    expect(partitionLensWatch("")).toEqual({ body: "", watch: [] });
  });
});
