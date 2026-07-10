import { describe, it, expect } from "vitest";
import { mostRecentWeeklySlot, isRealiseDue, OVERDUE_GRACE_MS } from "../../../server/scheduler";

/**
 * Unit tests for the pure weekly-slot maths behind the realisation scheduler.
 * 09:00 SGT == 01:00 UTC (Singapore has no DST). 2026-07-05 is a Sunday.
 */

const ms = (iso: string) => Date.parse(iso);

describe("mostRecentWeeklySlot", () => {
  it("rolls a mid-week time back to the previous Sunday 01:00 UTC", () => {
    expect(mostRecentWeeklySlot(ms("2026-07-08T12:00:00Z"))).toBe(ms("2026-07-05T01:00:00Z"));
  });

  it("returns the same Sunday once past 01:00 UTC", () => {
    expect(mostRecentWeeklySlot(ms("2026-07-05T02:00:00Z"))).toBe(ms("2026-07-05T01:00:00Z"));
  });

  it("returns the prior Sunday when before 01:00 UTC on a Sunday", () => {
    expect(mostRecentWeeklySlot(ms("2026-07-05T00:30:00Z"))).toBe(ms("2026-06-28T01:00:00Z"));
  });
});

describe("isRealiseDue", () => {
  it("is due when overdue past the grace and never run", () => {
    expect(isRealiseDue(ms("2026-07-08T12:00:00Z"), 0)).toBe(true);
  });

  it("is NOT due when a run already finished after the slot", () => {
    expect(isRealiseDue(ms("2026-07-08T12:00:00Z"), ms("2026-07-06T00:00:00Z"))).toBe(false);
  });

  it("is NOT due inside the grace window right after the slot", () => {
    // 30 min after the slot — under the 1h grace.
    expect(isRealiseDue(ms("2026-07-05T01:30:00Z"), 0)).toBe(false);
  });

  it("becomes due once past the grace window", () => {
    expect(isRealiseDue(ms("2026-07-05T02:30:00Z"), 0, OVERDUE_GRACE_MS)).toBe(true);
  });
});
