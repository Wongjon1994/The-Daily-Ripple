import { describe, it, expect } from "vitest";
import { partitionLensWatch, isSynthesisSection } from "./trendsAnalysis";

describe("isSynthesisSection", () => {
  it("recognizes every synthesis label a brief might use", () => {
    expect(isSynthesisSection({ category: "systems" })).toBe(true);
    expect(isSynthesisSection({ category: "synthesis" })).toBe(true);
    expect(isSynthesisSection({ category: "Systems Synthesis" })).toBe(true);
    expect(isSynthesisSection({ category: "geopolitics" })).toBe(false);
    expect(isSynthesisSection({ category: null })).toBe(false);
  });
});

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

  it("extracts the synthesis section's three ordinal/if signals (isSystems)", () => {
    const synthesis =
      "Today's brief reveals a single tension: Singapore both benefits from and is exposed to the same forces. " +
      "First: if Thursday's US PCE print comes in above 2.8% month-on-month, watch for the Fed to harden its tone. " +
      "Second: if the Switzerland talks produce a durable Hormuz framework by Wednesday, Brent slips back below $80. " +
      "Third: if Andy Burnham replaces Starmer before September, the UK-Singapore trade track slows materially.";
    const { body, watch } = partitionLensWatch(synthesis, true);
    expect(watch).toHaveLength(3);
    expect(watch[0]).toMatch(/^If Thursday's US PCE/);
    expect(watch[1]).toMatch(/^If the Switzerland talks/);
    expect(watch[2]).toMatch(/^If Andy Burnham/);
    // The thesis stays as the body; the three signals are removed from it.
    expect(body).toMatch(/single tension/);
    expect(body).not.toMatch(/PCE print/);
  });

  it("catches the first signal when it is merged with a 'signals worth tracking:' header", () => {
    const synthesis =
      "These stories are not parallel — they are causally linked. " +
      "Three forward signals worth tracking: First, if Iran and the US reach a documented Hormuz reopening in two weeks, Brent falls toward $80 and SORA eases. " +
      "Second, if Alphabet's raise closes above plan, the AI capex thesis is validated for Keppel DC REIT. " +
      "Third, if the Fed hikes by Q3, floating-rate HDB mortgages reprice harder than the last cycle.";
    const { body, watch } = partitionLensWatch(synthesis, true);
    expect(watch).toHaveLength(3);
    expect(watch[0]).toMatch(/^If Iran and the US/);
    expect(body).not.toMatch(/signals worth tracking/);
  });

  it("catches an 'And if …' opener and drops the dangling intro line", () => {
    const synthesis =
      "Everything in today's brief is a symptom of that single chain. " +
      "Here are the forward signals worth watching. " +
      "And if the yen continues sliding towards the BoJ intervention threshold of 158–160, Tokyo gets pricier — check SGD/JPY. " +
      "If US CPI on Wednesday comes in above 3.5%, the Fed December hike probability moves above 80% and our REIT yields reprice. " +
      "If SpaceX prices at or above its $1.75 trillion target, it greenlights Nasdaq 100 exposure for the rest of the quarter.";
    const { body, watch } = partitionLensWatch(synthesis, true);
    expect(watch).toHaveLength(3);
    expect(watch[0]).toMatch(/^If the yen/);
    expect(body).not.toMatch(/signals worth watching/);
    expect(body).toMatch(/single chain/);
  });
});
