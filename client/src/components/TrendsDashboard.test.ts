import { describe, it, expect } from "vitest";
import type { DailyBrief } from "@/lib/briefParser";

// Mock briefs for testing
const createMockBrief = (date: string, sections: number = 3): DailyBrief => ({
  date,
  greeting: "Test brief",
  teaser: [],
  sections: Array(sections).fill({
    category: "Test",
    headline: "Test headline",
    body: "Test body",
    keyMetrics: [],
    singaporeLens: "Test Singapore Lens",
    readingTime: "2 min",
  }),
});

// Test logic: 7-day rolling window
function sortAndLimitBriefs(briefs: DailyBrief[]): DailyBrief[] {
  return briefs
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7); // Last 7 days
}

// Test logic: detect latest brief
function getLatestBrief(briefs: DailyBrief[]): DailyBrief | null {
  if (briefs.length === 0) return null;
  return briefs.reduce((latest, current) => {
    return new Date(current.date).getTime() > new Date(latest.date).getTime()
      ? current
      : latest;
  });
}

describe("TrendsDashboard Logic", () => {
  describe("Rolling 7-day window", () => {
    it("should display all briefs when fewer than 7 days", () => {
      const briefs = [
        createMockBrief("June 1, 2026"),
        createMockBrief("June 2, 2026"),
        createMockBrief("June 3, 2026"),
      ];

      const result = sortAndLimitBriefs(briefs);
      expect(result).toHaveLength(3);
      expect(result[0].date).toBe("June 1, 2026");
      expect(result[2].date).toBe("June 3, 2026");
    });

    it("should limit to last 7 days when more than 7 briefs exist", () => {
      const briefs = [
        createMockBrief("May 25, 2026"),
        createMockBrief("May 26, 2026"),
        createMockBrief("May 27, 2026"),
        createMockBrief("May 28, 2026"),
        createMockBrief("May 29, 2026"),
        createMockBrief("May 30, 2026"),
        createMockBrief("May 31, 2026"),
        createMockBrief("June 1, 2026"),
        createMockBrief("June 2, 2026"),
        createMockBrief("June 3, 2026"),
      ];

      const result = sortAndLimitBriefs(briefs);
      expect(result).toHaveLength(7);
      expect(result[0].date).toBe("May 28, 2026"); // Last 7 items from 10-item array
      expect(result[6].date).toBe("June 3, 2026");
    });

    it("should sort briefs by date in ascending order", () => {
      const briefs = [
        createMockBrief("June 3, 2026"),
        createMockBrief("June 1, 2026"),
        createMockBrief("June 2, 2026"),
      ];

      const result = sortAndLimitBriefs(briefs);
      expect(result[0].date).toBe("June 1, 2026");
      expect(result[1].date).toBe("June 2, 2026");
      expect(result[2].date).toBe("June 3, 2026");
    });

    it("should handle unsorted briefs with gaps in dates", () => {
      const briefs = [
        createMockBrief("June 5, 2026"),
        createMockBrief("June 1, 2026"),
        createMockBrief("June 3, 2026"),
      ];

      const result = sortAndLimitBriefs(briefs);
      expect(result[0].date).toBe("June 1, 2026");
      expect(result[1].date).toBe("June 3, 2026");
      expect(result[2].date).toBe("June 5, 2026");
    });
  });

  describe("Reactive latest brief detection", () => {
    it("should identify the latest brief", () => {
      const briefs = [
        createMockBrief("June 1, 2026"),
        createMockBrief("June 2, 2026"),
        createMockBrief("June 3, 2026"),
      ];

      const latest = getLatestBrief(briefs);
      expect(latest?.date).toBe("June 3, 2026");
    });

    it("should handle single brief", () => {
      const briefs = [createMockBrief("June 1, 2026")];

      const latest = getLatestBrief(briefs);
      expect(latest?.date).toBe("June 1, 2026");
    });

    it("should handle empty array", () => {
      const briefs: DailyBrief[] = [];

      const latest = getLatestBrief(briefs);
      expect(latest).toBeNull();
    });

    it("should work with unsorted briefs", () => {
      const briefs = [
        createMockBrief("June 3, 2026"),
        createMockBrief("June 1, 2026"),
        createMockBrief("June 2, 2026"),
      ];

      const latest = getLatestBrief(briefs);
      expect(latest?.date).toBe("June 3, 2026");
    });

    it("should update when new brief is added", () => {
      let briefs = [
        createMockBrief("June 1, 2026"),
        createMockBrief("June 2, 2026"),
      ];

      let latest = getLatestBrief(briefs);
      expect(latest?.date).toBe("June 2, 2026");

      // Add new brief
      briefs = [...briefs, createMockBrief("June 3, 2026")];

      latest = getLatestBrief(briefs);
      expect(latest?.date).toBe("June 3, 2026");
    });
  });

  describe("Combined rolling window + latest detection", () => {
    it("should limit to 7 days and highlight latest", () => {
      const briefs = [
        createMockBrief("May 25, 2026"),
        createMockBrief("May 26, 2026"),
        createMockBrief("May 27, 2026"),
        createMockBrief("May 28, 2026"),
        createMockBrief("May 29, 2026"),
        createMockBrief("May 30, 2026"),
        createMockBrief("May 31, 2026"),
        createMockBrief("June 1, 2026"),
        createMockBrief("June 2, 2026"),
        createMockBrief("June 3, 2026"),
      ];

      const sorted = sortAndLimitBriefs(briefs);
      const latest = getLatestBrief(sorted);

      expect(sorted).toHaveLength(7);
      expect(sorted[0].date).toBe("May 28, 2026"); // Last 7 items from 10-item array
      expect(latest?.date).toBe("June 3, 2026");
    });

    it("should handle when latest is not in the 7-day window (edge case)", () => {
      const briefs = [
        createMockBrief("May 20, 2026"),
        createMockBrief("May 21, 2026"),
        createMockBrief("June 3, 2026"), // Jump ahead
      ];

      const sorted = sortAndLimitBriefs(briefs);
      const latest = getLatestBrief(sorted);

      // Should include June 3 as it's the latest
      expect(sorted).toContainEqual(expect.objectContaining({ date: "June 3, 2026" }));
      expect(latest?.date).toBe("June 3, 2026");
    });
  });
});
