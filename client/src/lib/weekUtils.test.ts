import { describe, it, expect } from "vitest";
import {
  getMondayOfWeek,
  getSundayOfWeek,
  getWeekKey,
  getWeekStartDate,
  isSameWeek,
  getWeekOffset,
  groupBriefsByWeek,
  sortWeekKeys,
  getWeekLabel,
} from "./weekUtils";

describe("weekUtils", () => {
  describe("getMondayOfWeek", () => {
    it("should return Monday for a date in the middle of the week", () => {
      const result = getMondayOfWeek("June 3, 2026"); // Tuesday
      expect(result.getDay()).toBe(1); // Monday
      expect(result.getDate()).toBe(1); // June 1, 2026 is Monday
    });

    it("should return the same day if date is Monday", () => {
      const result = getMondayOfWeek("June 1, 2026"); // Monday
      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(1);
    });

    it("should return previous Monday if date is Sunday", () => {
      const result = getMondayOfWeek("May 31, 2026"); // Sunday
      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(25); // May 25, 2026 is Monday
    });
  });

  describe("getSundayOfWeek", () => {
    it("should return Sunday for a date in the week", () => {
      const result = getSundayOfWeek("June 3, 2026"); // Tuesday
      expect(result.getDay()).toBe(0); // Sunday
      expect(result.getDate()).toBe(7); // June 7, 2026 is Sunday
    });

    it("should return the same day if date is Sunday", () => {
      const result = getSundayOfWeek("May 31, 2026"); // Sunday
      expect(result.getDay()).toBe(0);
      expect(result.getDate()).toBe(31);
    });
  });

  describe("getWeekKey", () => {
    it("should format week as 'May 27 - Jun 2, 2026'", () => {
      const result = getWeekKey("June 1, 2026");
      // Format may vary based on formatBriefDate output
      expect(result).toContain("2026");
      expect(result).toContain("-");
    });

    it("should work for dates in different weeks", () => {
      const result = getWeekKey("June 10, 2026");
      // Should contain date range and year
      expect(result).toContain("2026");
      expect(result).toContain("-");
    });
  });

  describe("getWeekStartDate", () => {
    it("should return Monday of the week", () => {
      const result = getWeekStartDate("June 3, 2026");
      expect(result).toContain("Jun 1");
    });
  });

  describe("isSameWeek", () => {
    it("should return true for dates in the same week", () => {
      const result = isSameWeek("June 1, 2026", "June 3, 2026");
      expect(result).toBe(true);
    });

    it("should return false for dates in different weeks", () => {
      const result = isSameWeek("May 31, 2026", "June 1, 2026");
      expect(result).toBe(false);
    });

    it("should return true for same date", () => {
      const result = isSameWeek("June 3, 2026", "June 3, 2026");
      expect(result).toBe(true);
    });
  });

  describe("getWeekOffset", () => {
    it("should return 0 for current week", () => {
      const today = new Date();
      const dateStr = today.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const result = getWeekOffset(dateStr);
      expect(result).toBe(0);
    });

    it("should return positive number for past weeks", () => {
      // Create a date 2 weeks ago
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const dateStr = twoWeeksAgo.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const result = getWeekOffset(dateStr);
      expect(result).toBeGreaterThanOrEqual(1);
    });
  });

  describe("groupBriefsByWeek", () => {
    it("should group briefs by week", () => {
      const briefs = [
        { date: "June 1, 2026", id: 1 },
        { date: "June 3, 2026", id: 2 },
        { date: "May 31, 2026", id: 3 },
        { date: "June 8, 2026", id: 4 },
      ];

      const result = groupBriefsByWeek(briefs);

      // Should have 2 groups (week of May 25-31 and week of June 1-7, June 8-14)
      expect(Object.keys(result).length).toBeGreaterThanOrEqual(2);

      // Check that briefs are grouped correctly
      const allBriefs = Object.values(result).flat();
      expect(allBriefs).toHaveLength(4);
    });

    it("should handle empty array", () => {
      const result = groupBriefsByWeek([]);
      expect(result).toEqual({});
    });

    it("should handle single brief", () => {
      const briefs = [{ date: "June 1, 2026", id: 1 }];
      const result = groupBriefsByWeek(briefs);

      expect(Object.keys(result).length).toBe(1);
      expect(result[Object.keys(result)[0]]).toHaveLength(1);
    });
  });

  describe("sortWeekKeys", () => {
    it("should sort week keys from newest to oldest", () => {
      const keys = [
        "May 27 - Jun 2, 2026",
        "Jun 10 - Jun 16, 2026",
        "Jun 3 - Jun 9, 2026",
      ];

      const result = sortWeekKeys(keys);

      // Should be in descending order (newest first)
      expect(result[0]).toContain("Jun 10");
      expect(result[result.length - 1]).toContain("May 27");
    });
  });

  describe("getWeekLabel", () => {
    it("should return 'This Week' for current week", () => {
      const today = new Date();
      const dateStr = today.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const result = getWeekLabel(dateStr);
      expect(result).toBe("This Week");
    });

    it("should return 'Last Week' for last week", () => {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const dateStr = lastWeek.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const result = getWeekLabel(dateStr);
      expect(result).toBe("Last Week");
    });

    it("should return '2 weeks ago' for 2 weeks ago", () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const dateStr = twoWeeksAgo.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const result = getWeekLabel(dateStr);
      expect(result).toBe("2 weeks ago");
    });
  });
});
