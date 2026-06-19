import { describe, it, expect } from "vitest";
import {
  parseBriefDate,
  formatBriefDate,
  formatBriefDateUppercase,
  getLatestDate,
  compareDates,
} from "./dateUtils";

describe("dateUtils", () => {
  describe("parseBriefDate", () => {
    it("should parse a date string correctly", () => {
      const result = parseBriefDate("June 3, 2026");
      expect(result).toBeInstanceOf(Date);
      expect(result.getMonth()).toBe(5); // June is month 5 (0-indexed)
      expect(result.getDate()).toBe(3);
      expect(result.getFullYear()).toBe(2026);
    });

    it("should handle different date formats", () => {
      const result = parseBriefDate("May 31, 2026");
      expect(result.getMonth()).toBe(4); // May is month 4
      expect(result.getDate()).toBe(31);
    });
  });

  describe("formatBriefDate", () => {
    it("should format date as 'D Mon YYYY' without leading zeros", () => {
      const date = new Date("June 3, 2026");
      const result = formatBriefDate(date);
      expect(result).toBe("Jun 3, 2026");
    });

    it("should format date from string input", () => {
      const result = formatBriefDate("June 3, 2026");
      expect(result).toBe("Jun 3, 2026");
    });

    it("should not have leading zeros on day", () => {
      const date = new Date("June 3, 2026");
      const result = formatBriefDate(date);
      expect(result).not.toContain("03");
      expect(result).toContain("3");
    });

    it("should handle single digit days", () => {
      const date = new Date("May 5, 2026");
      const result = formatBriefDate(date);
      expect(result).toBe("May 5, 2026");
    });
  });

  describe("formatBriefDateUppercase", () => {
    it("should format date in uppercase", () => {
      const date = new Date("June 3, 2026");
      const result = formatBriefDateUppercase(date);
      expect(result).toBe("JUN 3, 2026");
    });

    it("should not have leading zeros on day in uppercase", () => {
      const date = new Date("June 3, 2026");
      const result = formatBriefDateUppercase(date);
      expect(result).not.toContain("03");
      expect(result).toContain("3");
    });
  });

  describe("getLatestDate", () => {
    it("should return the latest date from a list", () => {
      const dates = ["May 31, 2026", "June 1, 2026", "June 3, 2026", "June 2, 2026"];
      const result = getLatestDate(dates);
      expect(result).toBe("June 3, 2026");
    });

    it("should handle unsorted dates", () => {
      const dates = ["June 3, 2026", "May 31, 2026", "June 2, 2026", "June 1, 2026"];
      const result = getLatestDate(dates);
      expect(result).toBe("June 3, 2026");
    });

    it("should return empty string for empty array", () => {
      const result = getLatestDate([]);
      expect(result).toBe("");
    });

    it("should handle single date", () => {
      const result = getLatestDate(["June 3, 2026"]);
      expect(result).toBe("June 3, 2026");
    });
  });

  describe("compareDates", () => {
    it("should return -1 when first date is earlier", () => {
      const result = compareDates("May 31, 2026", "June 3, 2026");
      expect(result).toBe(-1);
    });

    it("should return 1 when first date is later", () => {
      const result = compareDates("June 3, 2026", "May 31, 2026");
      expect(result).toBe(1);
    });

    it("should return 0 when dates are equal", () => {
      const result = compareDates("June 3, 2026", "June 3, 2026");
      expect(result).toBe(0);
    });

    it("should work with different date formats", () => {
      const result = compareDates("June 1, 2026", "June 2, 2026");
      expect(result).toBe(-1);
    });
  });
});
