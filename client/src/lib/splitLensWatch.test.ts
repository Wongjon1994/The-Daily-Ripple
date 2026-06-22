import { describe, it, expect } from "vitest";
import { splitLensWatch } from "./briefParser";

describe("splitLensWatch", () => {
  it("splits a trailing 'Watch …' signal into its own note and drops the cue", () => {
    const lens =
      "For us, the stakes are concrete. Households will feel it at the meter. " +
      "Watch Brent: if it clears $90, pressure on our MAS intensifies.";
    const { body, watch } = splitLensWatch(lens);
    expect(body).toBe(
      "For us, the stakes are concrete. Households will feel it at the meter."
    );
    expect(watch).toBe(
      "Brent: if it clears $90, pressure on our MAS intensifies."
    );
  });

  it("returns the lens unchanged when there is no forward signal", () => {
    const lens =
      "For Singapore, a UK leadership transition adds uncertainty. " +
      "If you hold sterling assets, the pound has already slipped.";
    expect(splitLensWatch(lens)).toEqual({ body: lens, watch: null });
  });

  it("ignores a mid-sentence 'watch' that is not at a sentence boundary", () => {
    const lens =
      "The deeper question, which our policymakers will be watching, is one of dependency.";
    expect(splitLensWatch(lens).watch).toBeNull();
  });

  it("does not split when 'Watch' opens the whole lens (no body left)", () => {
    const lens = "Watch the SORA path closely this quarter.";
    expect(splitLensWatch(lens)).toEqual({ body: lens, watch: null });
  });

  it("handles null/empty input", () => {
    expect(splitLensWatch(null)).toEqual({ body: "", watch: null });
    expect(splitLensWatch("   ")).toEqual({ body: "", watch: null });
  });
});
